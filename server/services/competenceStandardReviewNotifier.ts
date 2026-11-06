import type { IStorage } from "../storage";
import { computeStandardReviewDueDate } from "../storage";
import { sendNotification, getRule, emailStatus } from "./notifications";

// Narrowed to just what this notifier calls, rather than the full IStorage - the concrete
// DbStorage instance server/index.ts constructs doesn't fully satisfy IStorage (a pre-existing
// gap elsewhere in the interface, unrelated to this feature), so requiring the whole interface
// here would surface that mismatch at this call site too.
type ReviewNotifierStorage = Pick<IStorage,
  'getCompetencyElementsWithReviewCycle' | 'getUser' | 'getNotificationLogs' | 'createNotificationLog'
>;

// Sentinel settingId tagging every notification_logs row this notifier writes, so dedup lookups
// (below) don't have to scan the whole table.
const STANDARD_REVIEW_SETTING_ID = "standard-review-cycle";
const DEFAULT_THRESHOLDS_DAYS = [90, 60, 30];

function dueDateKey(dueDate: Date): string {
  return dueDate.toISOString().slice(0, 10);
}

// Runs on a timer from server/index.ts (daily). For every competencyElement with a review cycle
// configured, checks whether its due date has entered a notification window (90/60/30 days by default, changeable
// on the Email Notifications screen) and, if so, emails the standard's owner/approver/reviewer - once per
// (element, threshold, due date) combination, using notification_logs itself as the dedup ledger rather than a separate table.
// `<= threshold` (not `=== threshold`) deliberately catches up if the job didn't run on the exact
// day a window opened (e.g. server was down), rather than silently missing that reminder forever.
export async function checkAndSendReviewNotifications(storage: ReviewNotifierStorage): Promise<{ checked: number; sent: number; errors: number }> {
  const rule = await getRule("standard_review_due");
  const elements = await storage.getCompetencyElementsWithReviewCycle();
  if (!rule.isEnabled) return { checked: elements.length, sent: 0, errors: 0 };
  // Nothing can be sent until email is set up, and this reminder is retried every day, so do not fill the log with a "not sent" row per day
  if (!emailStatus().configured) return { checked: elements.length, sent: 0, errors: 0 };
  const thresholds = [...(rule.reminderDays ?? DEFAULT_THRESHOLDS_DAYS)].sort((a, b) => a - b);
  const now = new Date();
  let sent = 0;
  let errors = 0;

  const allReviewLogs = await storage.getNotificationLogs({ settingId: STANDARD_REVIEW_SETTING_ID });
  const alreadySent = new Set(
    allReviewLogs
      .filter(l => l.status === 'sent')
      .map(l => `${(l.metadata as any)?.elementId}:${(l.metadata as any)?.thresholdDays}:${(l.metadata as any)?.dueDateKey}`)
  );

  for (const element of elements) {
    const dueDate = computeStandardReviewDueDate({
      lastReviewedAt: element.lastReviewedAt,
      createdAt: element.createdAt,
      reviewCycleMonths: element.reviewCycleMonths,
    });
    if (!dueDate) continue;

    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    const key = dueDateKey(dueDate);

    // Only the tightest threshold currently in play needs to fire - once the 30-day email has
    // gone out there's no need for 90/60 to also send for the same due date.
    const threshold = thresholds.find(t => daysUntilDue <= t);
    if (threshold === undefined) continue;
    if (alreadySent.has(`${element.id}:${threshold}:${key}`)) continue;

    const recipientIds = Array.from(new Set(
      [element.standardOwnerId, element.standardApproverId, element.standardReviewerId].filter((id): id is string => !!id)
    ));
    if (recipientIds.length === 0) continue;

    const overdue = daysUntilDue < 0;
    const result = await sendNotification("standard_review_due", {
      userIds: recipientIds,
      vars: {
        standard: element.name,
        status: overdue ? "Overdue" : "Due Soon",
        dueText: overdue ? "is overdue" : `due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}`,
        dueSentence: overdue ? "and is now overdue" : `on ${dueDate.toLocaleDateString()}`,
      },
      path: "/admin/standards-review",
      settingId: STANDARD_REVIEW_SETTING_ID,
      // the ledger above reads these back, so each (element, threshold, due date) is only sent once
      metadata: { elementId: element.id, elementName: element.name, thresholdDays: threshold, dueDateKey: key },
    });
    sent += result.sent;
    errors += result.failed;
  }

  return { checked: elements.length, sent, errors };
}

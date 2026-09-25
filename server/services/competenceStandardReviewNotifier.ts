import type { IStorage } from "../storage";
import { computeStandardReviewDueDate } from "../storage";
import { emailService } from "./emailService";

// Narrowed to just what this notifier calls, rather than the full IStorage - the concrete
// DbStorage instance server/index.ts constructs doesn't fully satisfy IStorage (a pre-existing
// gap elsewhere in the interface, unrelated to this feature), so requiring the whole interface
// here would surface that mismatch at this call site too.
type ReviewNotifierStorage = Pick<IStorage,
  'getCompetencyElementsWithReviewCycle' | 'getUser' | 'getNotificationLogs' | 'createNotificationLog'
>;

// Sentinel settingId tagging every notification_logs row this notifier writes, so dedup lookups
// (below) don't have to scan the whole table - notificationSettings itself is never actually
// consulted (see REVIEW_THRESHOLDS_DAYS), this is just a stable key into the shared log table.
const STANDARD_REVIEW_SETTING_ID = "standard-review-cycle";
const REVIEW_THRESHOLDS_DAYS = [90, 60, 30];

function dueDateKey(dueDate: Date): string {
  return dueDate.toISOString().slice(0, 10);
}

// Runs on a timer from server/index.ts (daily). For every competencyElement with a review cycle
// configured, checks whether its due date has entered a 90/60/30-day notification window and, if
// so, emails the standard's owner/approver/reviewer - once per (element, threshold, due date)
// combination, using notification_logs itself as the dedup ledger rather than a separate table.
// `<= threshold` (not `=== threshold`) deliberately catches up if the job didn't run on the exact
// day a window opened (e.g. server was down), rather than silently missing that reminder forever.
export async function checkAndSendReviewNotifications(storage: ReviewNotifierStorage): Promise<{ checked: number; sent: number; errors: number }> {
  const elements = await storage.getCompetencyElementsWithReviewCycle();
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
    const threshold = [...REVIEW_THRESHOLDS_DAYS].sort((a, b) => a - b).find(t => daysUntilDue <= t);
    if (threshold === undefined) continue;
    if (alreadySent.has(`${element.id}:${threshold}:${key}`)) continue;

    const recipientIds = Array.from(new Set(
      [element.standardOwnerId, element.standardApproverId, element.standardReviewerId].filter((id): id is string => !!id)
    ));
    if (recipientIds.length === 0) continue;

    for (const recipientId of recipientIds) {
      try {
        const recipient = await storage.getUser(recipientId);
        if (!recipient?.email) continue;

        const subject = daysUntilDue < 0
          ? `Overdue: "${element.name}" competence standard review`
          : `"${element.name}" competence standard review due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}`;
        const html = `
          <h2>Competence Standard Review ${daysUntilDue < 0 ? 'Overdue' : 'Due Soon'}</h2>
          <p>The competence standard <strong>${element.name}</strong> is due for its periodic review${daysUntilDue < 0 ? ', and is now overdue' : ` on ${dueDate.toLocaleDateString()}`}.</p>
          <p>Please review the standard and confirm it in Capera once complete.</p>
        `;

        // If email isn't configured, log as 'skipped' rather than 'sent' - the dedup check above
        // only treats 'sent' as already-handled, so this correctly retries on the next daily run
        // once email service is configured, instead of silently pretending it went out.
        const emailWasConfigured = emailService.isConfigured();
        if (emailWasConfigured) {
          await emailService.sendEmail({ to: recipient.email, subject, html });
        }

        await storage.createNotificationLog({
          settingId: STANDARD_REVIEW_SETTING_ID,
          recipientId,
          recipientEmail: recipient.email,
          subject,
          body: html,
          sentAt: emailWasConfigured ? now : undefined,
          status: emailWasConfigured ? 'sent' : 'skipped',
          metadata: { elementId: element.id, elementName: element.name, thresholdDays: threshold, dueDateKey: key },
        });
        if (emailWasConfigured) sent++;
      } catch (error: any) {
        errors++;
        console.error(`Failed to send standard review notification for element ${element.id} to ${recipientId}:`, error);
        try {
          await storage.createNotificationLog({
            settingId: STANDARD_REVIEW_SETTING_ID,
            recipientId,
            recipientEmail: '',
            subject: `Standard review notification failed for "${element.name}"`,
            body: '',
            status: 'failed',
            errorMessage: error.message || String(error),
            metadata: { elementId: element.id, elementName: element.name, thresholdDays: threshold, dueDateKey: key },
          });
        } catch {
          // Logging the failure is itself best-effort - never let it mask the original error.
        }
      }
    }
  }

  return { checked: elements.length, sent, errors };
}

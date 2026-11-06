// Every email Capera sends is one of the notification types below. A type says what the email is, who normally gets it, which
// placeholders its wording can use, and its default subject and body. Administrators can switch a type off, add recipients, change
// how often it goes out and rewrite its wording (see notificationRules and services/notifications.ts); a type with no changes
// uses what is written here.
//
// Wording is plain text. A blank line starts a new paragraph. {{name}} is replaced with that placeholder's value, escaped so it
// can never inject HTML. A placeholder whose name ends in Html (for example {{itemsHtml}}) is a ready-made block such as a table.
// {{recipientName}} is always available and is the person the email is going to.

export type Frequency = "immediate" | "daily" | "weekly";

export interface NotificationVariable { name: string; description: string; example: string }

export interface NotificationType {
  key: string;
  category: string;
  label: string;
  description: string;
  audience: string; // who normally receives it, in words
  variables: NotificationVariable[]; // not including recipientName, which every type has
  subject: string;
  body: string;
  frequencies: Frequency[]; // how often it may be sent. Only types that go out as events can be bundled into a digest
  reminderDays?: number[]; // for types that remind ahead of a date: the default days before
  managerCopy?: boolean; // "also send to the line manager of the person it is about" makes sense for this type
}

export const RECIPIENT_NAME: NotificationVariable = { name: "recipientName", description: "The name of the person receiving the email", example: "Sam Gupta" };

const IMMEDIATE: Frequency[] = ["immediate"];
const EVENT: Frequency[] = ["immediate", "daily", "weekly"];

export const NOTIFICATION_TYPES: NotificationType[] = [
  // ------------------------------------------------------------------------------------------------ competence and assessment
  {
    key: "competence_expiring", category: "Competence and assessment", label: "Competence expiring soon",
    description: "A reminder that competence the person holds is about to expire, so it can be reassessed in time.",
    audience: "The person whose competence is expiring", reminderDays: [90, 60, 30, 7], managerCopy: true, frequencies: IMMEDIATE,
    variables: [
      { name: "count", description: "How many items are expiring", example: "2" },
      { name: "days", description: "The reminder stage, in days before expiry", example: "30" },
      { name: "itemsHtml", description: "A table of the items and their expiry dates", example: "(a table)" },
    ],
    subject: "Competence expiry reminder: {{count}} item(s) expiring within {{days}} days",
    body: "Hello {{recipientName}},\n\nThe following competence assessments are due to expire and will need to be renewed:\n\n{{itemsHtml}}\n\nPlease sign in to Capera to arrange your reassessment.",
  },
  {
    key: "competence_expired", category: "Competence and assessment", label: "Competence has expired",
    description: "Sent once when competence the person holds has expired and needs reassessment.",
    audience: "The person whose competence has expired", managerCopy: true, frequencies: IMMEDIATE,
    variables: [
      { name: "count", description: "How many items have expired", example: "1" },
      { name: "itemsHtml", description: "A table of the items and when they expired", example: "(a table)" },
    ],
    subject: "Competence expired: {{count}} item(s) need reassessment",
    body: "Hello {{recipientName}},\n\nThe following competence assessments have expired and need to be reassessed:\n\n{{itemsHtml}}\n\nPlease sign in to Capera to arrange your reassessment.",
  },
  {
    key: "assessment_outcome", category: "Competence and assessment", label: "Assessment outcome",
    description: "Tells a candidate the result when their assessor signs off an assessment.",
    audience: "The candidate who was assessed", managerCopy: true, frequencies: IMMEDIATE,
    variables: [
      { name: "element", description: "The competence element assessed", example: "Isolation of electrical equipment" },
      { name: "outcome", description: "The result", example: "Competent" },
      { name: "assessor", description: "Who assessed it", example: "Priya Nair" },
      { name: "expiryText", description: "The reassessment date, or nothing if there is none", example: "Expiry / reassessment due: 12 March 2028" },
    ],
    subject: "Assessment outcome: {{element}}",
    body: "Dear {{recipientName}},\n\nYour assessment for {{element}} has been completed.\n\nOutcome: {{outcome}}\nAssessed by: {{assessor}}\n{{expiryText}}\n\nPlease sign in to your account to view the full details and evidence, and to give feedback if needed.",
  },
  {
    key: "assessment_scheduled", category: "Competence and assessment", label: "Assessment scheduled",
    description: "Tells a candidate when their assessor has scheduled an assessment.",
    audience: "The candidate", frequencies: IMMEDIATE,
    variables: [
      { name: "element", description: "The competence element", example: "Isolation of electrical equipment" },
      { name: "dateTime", description: "When it is scheduled", example: "12/03/2027, 09:30:00" },
      { name: "locationText", description: "The location line, or nothing", example: "Location: Training room 2" },
      { name: "notesText", description: "The assessor's notes line, or nothing", example: "Notes from your assessor: Bring your logbook" },
    ],
    subject: "Assessment scheduled",
    body: "Your assessor has scheduled an assessment for {{element}}.\n\nDate: {{dateTime}}\n{{locationText}}\n{{notesText}}",
  },
  {
    key: "candidate_ready", category: "Competence and assessment", label: "Candidate ready for assessment",
    description: "Tells an assessor that a candidate has marked themselves ready.",
    audience: "The assessor", frequencies: EVENT,
    variables: [
      { name: "candidate", description: "The candidate", example: "Sam Gupta" },
      { name: "element", description: "The competence element", example: "Isolation of electrical equipment" },
    ],
    subject: "Candidate ready for assessment",
    body: "{{candidate}} has marked themselves ready for assessment on {{element}}.\n\nPlease schedule a date in your assessor workspace.",
  },
  {
    key: "evidence_submitted", category: "Competence and assessment", label: "New evidence submitted",
    description: "Tells an assessor that a candidate has uploaded evidence for an assessment.",
    audience: "The assessor", frequencies: EVENT,
    variables: [
      { name: "candidate", description: "The candidate", example: "Sam Gupta" },
      { name: "competency", description: "The competence element", example: "E1 - Isolation of electrical equipment" },
      { name: "evidenceType", description: "The type of evidence", example: "Work product" },
      { name: "title", description: "The evidence title", example: "Isolation certificate" },
      { name: "description", description: "What the candidate wrote about it", example: "Completed on the 12th" },
      { name: "fileCount", description: "How many files were attached", example: "2" },
    ],
    subject: "New evidence submitted",
    body: "{{candidate}} has submitted new evidence for assessment.\n\nCompetency: {{competency}}\nEvidence type: {{evidenceType}}\nTitle: {{title}}\nDescription: {{description}}\nFiles attached: {{fileCount}}\n\nPlease review the evidence in your assessor workspace.",
  },
  {
    key: "evidence_rejected", category: "Competence and assessment", label: "Evidence not accepted",
    description: "Tells a candidate that evidence they submitted was not accepted, and why.",
    audience: "The candidate", frequencies: IMMEDIATE,
    variables: [
      { name: "fileName", description: "The evidence file", example: "isolation-cert.pdf" },
      { name: "element", description: "The competence element", example: "Isolation of electrical equipment" },
      { name: "reason", description: "The reason given", example: "The certificate has expired" },
    ],
    subject: "Evidence not accepted",
    body: "Your submitted evidence \"{{fileName}}\" for {{element}} was reviewed and marked as not applicable.\n\nReason: {{reason}}\n\nPlease submit new evidence that addresses this, or contact your assessor if you have questions.",
  },
  {
    key: "self_assessment_completed", category: "Competence and assessment", label: "Knowledge self-assessment completed",
    description: "Tells an assessor that a candidate has finished a knowledge self-assessment.",
    audience: "The assessor", frequencies: EVENT,
    variables: [
      { name: "candidate", description: "The candidate", example: "Sam Gupta" },
      { name: "element", description: "The competence element", example: "Isolation of electrical equipment" },
      { name: "scoreText", description: "The score, or a note that open answers need review", example: "Score: 85%" },
    ],
    subject: "Candidate completed knowledge self-assessment",
    body: "{{candidate}} has completed the knowledge self-assessment for {{element}}.\n\n{{scoreText}}\n\nReview their answers in your assessor workspace.",
  },
  {
    key: "verification_completed", category: "Competence and assessment", label: "Internal verification completed",
    description: "Tells an assessor that an internal verifier has checked one of their assessments.",
    audience: "The assessor whose assessment was verified", frequencies: EVENT,
    variables: [
      { name: "verifier", description: "The internal verifier", example: "Ian Dunmore" },
      { name: "candidate", description: "The candidate assessed", example: "Sam Gupta" },
      { name: "element", description: "The competence element", example: "Isolation of electrical equipment" },
      { name: "outcome", description: "The verification outcome", example: "satisfactory" },
      { name: "commentsText", description: "The verifier's comments, or nothing", example: "Comments: Well evidenced" },
    ],
    subject: "Internal verification completed on your assessment",
    body: "{{verifier}} has completed an internal verification on your assessment of {{candidate}} for {{element}}.\n\nOutcome: {{outcome}}\n{{commentsText}}\n\nReview the full verification record and acknowledge it from your Assessor Dashboard.",
  },
  {
    key: "standard_review_due", category: "Competence and assessment", label: "Competence standard review due",
    description: "Reminds the owner, approver and reviewer of a competence standard that its periodic review is due or overdue.",
    audience: "The owner, approver and reviewer of the standard", reminderDays: [90, 60, 30], frequencies: IMMEDIATE,
    variables: [
      { name: "standard", description: "The competence standard", example: "Isolation of electrical equipment" },
      { name: "status", description: "Due Soon or Overdue", example: "Due Soon" },
      { name: "dueText", description: "When it is due, or that it is overdue", example: "due in 30 days" },
      { name: "dueSentence", description: "A sentence giving the due date", example: "on 12 March 2027" },
    ],
    subject: "\"{{standard}}\" competence standard review {{dueText}}",
    body: "The competence standard {{standard}} is due for its periodic review {{dueSentence}}.\n\nPlease review the standard and confirm it in Capera once complete.",
  },
  // ------------------------------------------------------------------------------------------------------------------ training
  {
    key: "training_dates_needed", category: "Training", label: "Training dates needed",
    description: "Tells the training administrators that someone needs a mandatory course booked but no sessions are scheduled.",
    audience: "Training administrators (or administrators if there are none)", frequencies: EVENT,
    variables: [
      { name: "requestor", description: "Who needs the training", example: "Sam Gupta" },
      { name: "training", description: "The course", example: "Confined Space Entry" },
      { name: "dates", description: "The preferred dates they gave", example: "Any Tuesday in March" },
      { name: "venueText", description: "The preferred venue line, or nothing", example: "Preferred venue: Harbour Point training room" },
    ],
    subject: "Training dates needed: {{training}}",
    body: "{{requestor}} needs \"{{training}}\" (Mandatory) booked but no sessions are currently scheduled.\n\nPreferred dates: {{dates}}\n{{venueText}}\n\nReview it on the Training Manager's Pending Requests tab.",
  },
  {
    key: "training_approval_requested", category: "Training", label: "Training approval requested",
    description: "Asks a manager or approver to approve a training request.",
    audience: "The person's line manager and training approvers (or administrators if there are none)", frequencies: EVENT,
    variables: [
      { name: "requestor", description: "Who is asking", example: "Sam Gupta" },
      { name: "training", description: "The course", example: "Confined Space Entry" },
      { name: "level", description: "Role Specific or Discretionary", example: "Role Specific" },
      { name: "justification", description: "Why they need it", example: "Needed for the new rota" },
    ],
    subject: "Training approval needed: {{training}}",
    body: "{{requestor}} is requesting approval for \"{{training}}\" ({{level}}).\n\nJustification: {{justification}}\n\nReview it under Training Approvals.",
  },
  {
    key: "training_approved_ready", category: "Training", label: "Approved training ready to book",
    description: "Tells the training administrators that a request has been approved and can now be booked.",
    audience: "Training administrators (or administrators if there are none)", frequencies: EVENT,
    variables: [{ name: "training", description: "The course", example: "Confined Space Entry" }],
    subject: "Approved, ready to book: {{training}}",
    body: "A request for \"{{training}}\" has been approved and is ready to book.\n\nReview it on the Training Manager's Pending Requests tab.",
  },
  {
    key: "training_request_declined", category: "Training", label: "Training request not approved",
    description: "Tells someone that their training request was not approved.",
    audience: "The person who asked", frequencies: IMMEDIATE,
    variables: [
      { name: "training", description: "The course", example: "Confined Space Entry" },
      { name: "reasonText", description: "The reason line, or nothing", example: "Reason: Not needed for your role" },
    ],
    subject: "Training request not approved: {{training}}",
    body: "Your request for \"{{training}}\" was not approved.\n\n{{reasonText}}",
  },
  // ---------------------------------------------------------------------------------------------------------- performance reviews
  {
    key: "appraisal_started", category: "Performance reviews", label: "Annual review started",
    description: "Tells someone that their manager has started their annual review.",
    audience: "The person being reviewed", frequencies: IMMEDIATE,
    variables: [
      { name: "manager", description: "The manager", example: "Helen Marsh" },
      { name: "dueText", description: "The objectives deadline, or nothing", example: " by 12 March 2027" },
    ],
    subject: "Your annual review has been started",
    body: "{{manager}} has started your annual review. Please draft your objectives{{dueText}}, and your manager will agree them with you.",
  },
  {
    key: "self_review_opened", category: "Performance reviews", label: "Self assessment opened",
    description: "Tells someone their self assessment is open.",
    audience: "The person being reviewed", frequencies: IMMEDIATE,
    variables: [
      { name: "dueText", description: "The deadline, or nothing", example: " and is due by 12 March 2027" },
      { name: "reminderNote", description: "A line about reminders, or nothing", example: "We will send reminders in the 30 days before the due date." },
    ],
    subject: "Please complete your self assessment",
    body: "Your self assessment is now open{{dueText}}.\n\nLook back over your objectives and behaviours, add your own ratings, and submit it to your manager.\n\n{{reminderNote}}",
  },
  {
    key: "manager_review_turn", category: "Performance reviews", label: "Your turn to review",
    description: "Tells a manager that a team member has submitted their self assessment.",
    audience: "The manager", frequencies: EVENT,
    variables: [
      { name: "employee", description: "The team member", example: "Sam Gupta" },
      { name: "dueText", description: "The deadline, or nothing", example: ", due by 12 March 2027" },
    ],
    subject: "{{employee}} has submitted their self assessment",
    body: "It is now your turn to complete the manager review{{dueText}}.\n\nRate each objective and behaviour, add your summary and development plan, then submit. You will then discuss it with them before sharing the report.",
  },
  {
    key: "report_shared", category: "Performance reviews", label: "Review report shared",
    description: "Tells someone that their manager has shared their final review report.",
    audience: "The person reviewed", frequencies: IMMEDIATE,
    variables: [],
    subject: "Your review report is ready",
    body: "Your manager has held your review discussion and shared the final report with you.\n\nPlease read it and, when you are happy, sign it off. You can add your own comments when you do.",
  },
  {
    key: "raters_proposed", category: "Performance reviews", label: "Feedback raters need approval",
    description: "Tells a manager that a team member has suggested colleagues to give 360 feedback.",
    audience: "The manager", frequencies: EVENT,
    variables: [{ name: "employee", description: "The team member", example: "Sam Gupta" }],
    subject: "Feedback raters need your approval",
    body: "{{employee}} has suggested colleagues to give 360 feedback. Please approve the list.",
  },
  {
    key: "feedback_requested", category: "Performance reviews", label: "360 feedback requested",
    description: "Asks a colleague for 360 feedback about someone.",
    audience: "The colleague asked for feedback", frequencies: IMMEDIATE,
    variables: [{ name: "colleague", description: "The person the feedback is about", example: "Sam Gupta" }],
    subject: "{{colleague}} has asked for your feedback",
    body: "It takes a few minutes. Your answers are anonymous and only shown as averages once enough people have responded.",
  },
  {
    key: "performance_reminder", category: "Performance reviews", label: "Review reminder",
    description: "Reminds someone of an annual review task that is coming due or overdue.",
    audience: "Whoever the task is waiting on", reminderDays: [30, 14, 7, 3, 1, 0], frequencies: IMMEDIATE,
    variables: [
      { name: "task", description: "What needs doing", example: "complete your self assessment" },
      { name: "detail", description: "A sentence about it", example: "Your self assessment is due. Please complete it and submit it to your manager." },
      { name: "dueText", description: "How close the deadline is", example: "It is due on 12 March 2027 (3 days away)." },
    ],
    subject: "Reminder: {{task}}",
    body: "{{detail}}\n\n{{dueText}}",
  },
  // --------------------------------------------------------------------------------------------------------------------- compliance
  {
    key: "staffing_shortfall", category: "Compliance", label: "Minimum staffing not met",
    description: "Warns that fewer people are available than a duty-to-operate requirement needs, and repeats weekly until a decision is recorded.",
    audience: "The people named on the requirement (or all administrators)", frequencies: IMMEDIATE,
    variables: [
      { name: "requirement", description: "The role and place", example: "Responsible Electrical Person at Northfield Terminal" },
      { name: "actual", description: "How many are available", example: "0" },
      { name: "required", description: "How many are required", example: "1" },
      { name: "legalNote", description: "A sentence naming the safety case reference, or nothing", example: "This is a duty-to-operate requirement (Safety case, section 4.2)." },
    ],
    subject: "Minimum staffing not met: {{requirement}}",
    body: "{{actual}} of the {{required}} required are available ({{requirement}}). {{legalNote}}\n\nPlease review it and record whether a risk assessment is needed.",
  },
  {
    key: "staffing_at_risk", category: "Compliance", label: "Minimum staffing at risk",
    description: "An early warning that a minimum is met now but people counted are about to be lost, once a month while it applies.",
    audience: "The people named on the requirement (or all administrators)", frequencies: IMMEDIATE,
    variables: [
      { name: "requirement", description: "The role and place", example: "Responsible Electrical Person at Northfield Terminal" },
      { name: "actual", description: "How many are available", example: "1" },
      { name: "required", description: "How many are required", example: "1" },
      { name: "atRisk", description: "How many of them are at risk", example: "1" },
      { name: "legalNote", description: "A sentence naming the safety case reference, or nothing", example: "This is a duty-to-operate requirement." },
    ],
    subject: "Early warning, minimum staffing at risk: {{requirement}}",
    body: "The minimum is currently met ({{actual}} of {{required}}), but {{atRisk}} of those counted have competence expiring within 60 days or are leaving within 90 days. {{legalNote}}",
  },
  {
    key: "retention_warning", category: "Compliance", label: "Leaver details due to be removed",
    description: "Warns administrators that the retention period is ending for some leavers, so their personal details will be removed.",
    audience: "Administrators", frequencies: IMMEDIATE,
    variables: [
      { name: "count", description: "How many people", example: "2" },
      { name: "listHtml", description: "The people and the date for each", example: "(a list)" },
    ],
    subject: "{{count}} leaver(s)' details will be removed soon",
    body: "The retention period is ending for these leavers, so their personal details will be removed on the date shown:\n\n{{listHtml}}\n\nTheir competence and training history is kept. To keep someone's details longer, put them on hold, or restore them if they have come back.",
  },
  // -------------------------------------------------------------------------------------------------------------- communications
  {
    key: "announcement", category: "Communications", label: "Announcement",
    description: "Emails the people an announcement is for, once, when it goes live. Only sent for announcements set to also send email.",
    audience: "The people the announcement is for", frequencies: EVENT,
    variables: [
      { name: "title", description: "The announcement title", example: "New permit to work procedure" },
      { name: "messageHtml", description: "The announcement text", example: "From Monday all isolations need a second check." },
      { name: "importanceNote", description: "A line saying it is important, or nothing", example: "This is an important notice." },
      { name: "ackNote", description: "A line asking people to confirm they have read it, or nothing", example: "Please sign in to Capera and confirm that you have read and understood it." },
      { name: "sender", description: "Who sent it", example: "Helen Marsh" },
    ],
    subject: "{{title}}",
    body: "{{messageHtml}}\n\n{{importanceNote}}\n{{ackNote}}\n\nSent by {{sender}}.",
  },
  {
    key: "announcement_reminder", category: "Communications", label: "Announcement reminder",
    description: "A reminder sent when an administrator chases the people who have not yet read, or not yet confirmed, an announcement.",
    audience: "People who have not yet read or confirmed it", frequencies: IMMEDIATE,
    variables: [
      { name: "title", description: "The announcement title", example: "New permit to work procedure" },
      { name: "actionText", description: "What they have not done yet", example: "read" },
    ],
    subject: "Reminder: {{title}}",
    body: "You have not yet {{actionText}} this announcement: {{title}}.\n\nPlease sign in to Capera to read it.",
  },
  // ------------------------------------------------------------------------------------------------------------------ certificates
  {
    key: "certificate_issued", category: "Certificates", label: "E-learning certificate ready",
    description: "Tells someone their e-learning certificate has been issued.",
    audience: "The learner", frequencies: IMMEDIATE,
    variables: [
      { name: "course", description: "The course", example: "Hydrocarbon Release Awareness" },
      { name: "number", description: "The certificate number", example: "CAP-2026-7K4Q9X" },
    ],
    subject: "Your certificate for {{course}} is ready",
    body: "Well done on completing {{course}}.\n\nYour certificate ({{number}}) is ready to view and print from My Training.",
  },
  {
    key: "certificate_declined", category: "Certificates", label: "E-learning certificate not issued",
    description: "Tells someone that their e-learning certificate was not issued, and why.",
    audience: "The learner", frequencies: IMMEDIATE,
    variables: [
      { name: "course", description: "The course", example: "Hydrocarbon Release Awareness" },
      { name: "reason", description: "The reason given", example: "Assessment not witnessed" },
    ],
    subject: "Your certificate for {{course}} was not issued",
    body: "Your certificate was not issued. Reason given: {{reason}}\n\nPlease speak to your training administrator.",
  },
];

export const TYPE_BY_KEY = new Map(NOTIFICATION_TYPES.map(t => [t.key, t]));

/** Roles an administrator can add as extra recipients. */
export const ADDABLE_ROLES = [
  { value: "admin", label: "Administrators" },
  { value: "super_admin", label: "Super administrators" },
  { value: "manager", label: "Managers" },
  { value: "assessor", label: "Assessors" },
  { value: "internal_verifier", label: "Internal verifiers" },
  { value: "training_administrator", label: "Training administrators" },
  { value: "training_approver", label: "Training approvers" },
] as const;

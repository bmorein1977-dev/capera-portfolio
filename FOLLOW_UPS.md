# Capera follow-ups and known gaps

A running list of things that are not finished, not verified, or need a decision, so they are not forgotten.
Internal note: it is kept out of the clean demo zip. Add to it whenever something is built with a known limit,
and tick items off (with the date) when they are dealt with.

Last updated: 7 November 2026.

## Needs a decision or advice before real use

- [ ] **Retention periods (leavers).** The default of 24 months after leaving is a placeholder, not advice. Agree the real period with
      whoever owns data protection for the customer, and write it into the retention rule (Admin Area, Archived People).
- [ ] **Data protection impact assessment (DPIA).** Needed before real people's data goes into the performance reviews, 360 feedback and
      Talent Score, and worth doing for retention and the audit log too.
- [ ] **Vantage number format.** Validation only checks 4 to 20 letters, digits or hyphens. Confirm the real format with Vantage and tighten it.
- [ ] **Contractor status and written consent.** Written consent from the agency and a solicitor's review before commercial talks (see the
      IP provenance briefing). Not a code task, listed so it is not lost.
- [ ] **Neon database password.** Rotate it (it has appeared in session logs).
- [ ] **`attached_assets` provenance.** Review where those files came from before any IP sale.

## Leaver retention (built, migration 0046)

- [ ] Free text written about a person is **not** removed when their details are: performance review comments, 360 feedback, assessor and
      verifier comments, standard-draft notes. It sits across many tables. Decide whether to blank or delete these after the period.
- [ ] Removal is anonymising, not deleting the record, so competence history survives. If a customer insists on full deletion, that is a
      separate and larger piece of work (many tables, audit evidence implications).
- [ ] The sign-in block was tested as a rule, not against the real Replit/OIDC login. Try it once with a real archived account.
- [ ] A block can lag up to a minute after someone is archived or restored (cached lookup).
- [ ] Stored files (CV, photo) are deleted from object storage on a best-effort basis. If that fails it is only logged. Add a retry or a report.
- [ ] No demo data for archived people in the clean demo seed, so the page is empty until someone is archived.
- [ ] Hold is per person with a free-text reason. No expiry or review date on a hold yet.

## Duty to operate (built, migration 0044)

- [ ] Counts people by role at a location. It does **not** know who is on shift or on the rota, so it cannot say "short on nights".
- [ ] A risk assessment is only a reference text on the decision. There is no link to a risk assessment document or register.
- [ ] No history or trend report, no export, and no dashboard tile yet.
- [ ] Alerts go by email only. If email is not configured they are logged as "skipped" and show on screen only.
- [ ] Counts someone as competent from their valid sign-offs for the role's required elements. Confirm that is how the customer's safety
      case defines "competent" for each role.

## Email notifications (rebuilt, migration 0049)

- [ ] **Email is not set up on any deployment yet.** Until it is, every email is recorded in the Email log as "Not sent" and nobody
      receives anything. Each deployment needs EMAIL_SERVICE (smtp, resend or sendgrid), EMAIL_FROM and that provider's credentials
      (see DEMO_SETUP.md). Decide the provider and the sending address for the first real customer.
- [ ] In production (NODE_ENV=production) the server refuses to start if the email settings are missing. Only development mode skips
      it. Decide whether that is wanted, because a customer without email would not be able to start the system.
- [ ] The competence expiry reminders (and the "expired" notice) are new and off until switched on. They chase the latest valid assessment
      of each element the person's job role requires. They do not yet honour exemptions (not required, in training), so an exempt person
      could be reminded. "Expired" is only announced for things that expired in the last 30 days, once, with no repeat or escalation.
- [ ] The old `notification_settings` table is no longer used. Reminder days set up there are carried over once when the new system first
      runs. Drop the table when nothing needs it.
- [ ] Digests go out at the time of the daily job (about 24 hours after the server last started), not at a time you choose. A weekly digest
      goes 7 days after the previous one. The wording of the digest wrapper itself is not editable.
- [ ] Only {{recipientName}} personalises an email per person. No per-person preferences or unsubscribe: control is by administrators only.
- [ ] The Email log keeps the full text of every email, which is personal data, and grows for ever. Decide how long to keep it. Leaver
      retention removes the text of emails sent to a person whose details are removed, but nothing else prunes it.
- [ ] Wording is English only and plain text with paragraphs (no bold, links or images in a template), and emails have no attachments.
- [ ] Behaviour that changed: training requests now send one email per person (before, one email addressed to the whole group, so
      everyone saw each other's address); text typed by users is now escaped (before it was inserted as raw HTML); every email is logged.
- [ ] A few recipient rules are still worked out where the email is sent (for example "training administrators, or administrators if there
      are none"). They could become choices on the screen.

## E-learning certificates (built, migration 0047)

- [ ] The certificate is a printable web page (Print or save as PDF in the browser), not a generated PDF file. Add server-side PDF
      generation if a file attachment is needed (for example to email it).
- [ ] Nobody outside the system can check a certificate number online. Consider a public verification page (number in, valid or revoked out).
- [ ] Manual mode has no email or daily digest telling administrators something is waiting, only the queue and its count. No bulk approve.
- [ ] Repeat completions (recertification after expiry) are not handled. The completion roll-up stops once an enrolment is completed, so a
      second cycle does not create a new certificate. Check how recertification should work with training enrolments first.
- [ ] Completed e-learning now gets an expiry date from the training's validity period, but only for completions from now on. Earlier
      completions still have none. Decide whether to backfill expiry dates (it would change compliance figures).
- [ ] "Create for earlier completions" uses today's mode and issues the certificate dated today with the original completion date shown.
- [ ] The SCORM version on a certificate is the standard (1.2 or 2004) read from the package, not a version number of the course itself.
- [ ] Learner-uploaded certificates still exist for external training. For e-learning with a system certificate the upload is hidden.
- [ ] Branding is one logo, heading and colour for the whole organisation (migration 0048). Per business unit or per course branding
      needs the multi-company design. Only PNG, JPEG and WebP logos are accepted (SVG is refused because it can carry scripts), up to 1 MB.
      The fonts are fixed, and a very wide or very tall logo is scaled to fit rather than cropped.
- [ ] "Date awarded" is the date the learner completed the training. "Issued" is when it was issued, which differs in manual mode. Confirm
      that wording suits each customer, and whether the heading should be translated for non-English customers.

## Vantage number (built, migration 0044)

- [ ] Not on a person's own profile page (only in User Management). Check the bulk and CSV user imports and the HR lifecycle import
      carry it, and add it if not.
- [ ] No expiry date or helicopter booking link. It is a recorded number only.

## Audit log (built, migration 0045)

- [ ] Only records changes made through the application. Direct database changes are not seen.
- [ ] Only the main records show before and after values (people, job roles, locations, teams, business units, trainings, competence
      elements, notification settings, absences, staffing requirements). Everything else shows which fields were sent.
- [ ] Learner progress (SCORM and video position) is deliberately left out as noise. Failed attempts are not recorded.
- [ ] No archive or size limit. The table grows for ever. Decide a retention period for the log itself.
- [ ] Impersonated actions: the log records both the real person and who they acted as, but the business records themselves
      (assessments, bookings) are still attributed to the person being impersonated.
- [ ] When someone's details are removed, their name is taken out of the audit entries about them. That is the one exception to "append only".

## Found while checking the system, not yet fixed

- [ ] Training permissions: the screen offers a `training_administrator` role that the server does not honour. Replace the hard-coded
      role checks with a permission matrix (view, create, edit, delete, approve per user type) (planned).
- [ ] Course booking and e-learning completion are fixed, but a wider review of the training routes' permission rules is still worth doing.
- [ ] Deleting a user is only a soft delete (hidden). It never removes anything. Retention now covers leavers, not "deleted" people.

## Planned features not built yet

- [x] E-learning certificates on completion, with an automatic or manual switch and a "pending" state (built 6 Nov 2026, see below).
- [ ] SCORM / e-learning version tracking, for audit. **Partly done:** each certificate records the SCORM standard (1.2 or 2004), score and result at completion (see below). Still to build: a history of package versions when a SCORM package is replaced, and which version each learner completed.
- [ ] Communications and announcements to everyone, business units or job roles.
- [ ] Support or helpdesk tickets.
- [x] Notification rules, templates, frequency and recipients, with a log of every email and resend (built 7 Nov 2026, see below).
- [ ] Training permission matrix (see above).
- [ ] Allocating e-learning to licensed business units, then all, job role or individual. Needs the multi-company design decision first:
      today there is one organisation per deployment and business units are labels only.

## Performance reviews and Talent Score (built earlier, migrations 0042 and 0043)

- [ ] Not built: AI extraction of experience and qualifications from an uploaded CV, 9-box talent grid, score and potential on succession
      plans, behaviour gap in role transition, objective cascade screen, entitlement gating by licence level (Gold).
- [ ] DPIA before real data (see top).

## Housekeeping and technical debt

- [ ] The type-check has 75 pre-existing errors (for example `DbStorage` not matching `IStorage`, missing methods on `IStorage`, `user` possibly
      undefined in the sidebar). Keep it at 75 or below; reducing it would make future checks more useful.
- [ ] The clean demo Repl is updated by unzipping a rebuilt zip. It has no git history, so a normal merge cannot work there. After any
      update, restart the server from the Shell with `nohup npm run dev` (the Run button uses Replit's own empty database).
- [ ] Landing page rebuild is uncommitted on this PC (client/index.html, Landing.tsx, landing.css) and goes into the demo zip from the
      working copy. Commit it on its own branch when agreed.
- [ ] Several internal documents and the clean-demo zips sit untracked in the project folder. Decide where they should live.

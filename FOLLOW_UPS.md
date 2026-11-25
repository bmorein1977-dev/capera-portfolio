# Capera follow-ups and known gaps

A running list of things that are not finished, not verified, or need a decision, so they are not forgotten.
Internal note: it is kept out of the clean demo zip. Add to it whenever something is built with a known limit,
and tick items off (with the date) when they are dealt with.

Last updated: 25 November 2026.

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

## Reporting: export any page to Excel or an infographic (built 21 Nov 2026, branch feature/reporting-export)

- [x] **Export button** in the top bar of every page, for managers, administrators, super administrators and developers (`ExportMenu.tsx`). It takes what the page is showing: the browser lists the data calls the page is watching (`client/src/lib/pageData.ts`), and the **server makes those calls again as the same person** (`server/services/reportData.ts`, their own cookie), so nobody can export more than they can see and an export cannot be forged. Only reads of `/api/...` data addresses are allowed; sign-in, file downloads, avatars, CVs, other exports and test routes are refused; at most 14 calls per page.
- [x] **Excel workbook** (`server/services/reportWorkbook.ts`, ExcelJS): a front sheet (page, who it was prepared for, when, filters, a contents list with links, key figures, confidentiality note), then one sheet per data source as a real Excel table (banded rows, filter buttons), written straight to the .xlsx format with JSZip (no spreadsheet library, so no extra dependency tree), real dates and numbers, percentages, status words coloured (red before amber before green, so "Not ready" is never green), data bars on counts, frozen headings, landscape fit-to-width print with repeating headings and a confidential footer. Identifiers, housekeeping and secrets are left out; headings are sentence case. Checked by opening it in real Excel: it opens cleanly with no repair prompt. People tables that carry competence and training counts get a plain **Readiness** column (Ready, Expiring soon, Not ready, On leave).
- [x] **Infographic** (`server/services/reportInfographic.ts`, `InfographicView.tsx`): key figures, donut and bar charts (status shown as donuts, percentages as bands, expiry dates as "already past / next 30 / 60 / 90 days"), what it shows, what to do first. Saved as a picture or printed or saved as PDF. **The numbers are counted by Capera; the AI only chooses what to show and writes the words**, and may refer to a figure only by a reference we give it, which we fill in; a sentence with any other number is thrown away. **Only counts and category names (statuses, job roles, sites) are sent to the AI, never names, emails or free text.** "Infographic without AI" keeps everything inside Capera; with no AI key, or if the AI fails, the same infographic is built by rules.
- [x] **Safeguards:** every export and infographic is written to the audit log (and whether AI was used); rate limits per person; prepared data is held for 15 minutes for that person only; an export id cannot be used by anyone else; `AI_REPORTS=off` switches the AI step off for a deployment.
- [x] Tests: `tests/security/reports.unit.ts` (49) and `tests/security/reports.e2e.cjs` (25).
- [ ] **AI step not yet tried against the real service** (no key in the local setup). It is covered by tests with a stand-in, and always falls back to the rules version. Try "Infographic (AI)" on the demo Repl, which has the AI key.
- [ ] **What gets exported is what the page loads.** Filters applied on screen after loading are not in the workbook (filters that change the request are, and are listed on the front sheet); pages that load their data by a POST, or draw it from files, give nothing to export. Pages without a hand-made layout (below) get the generic reader.
- [ ] Possible next steps: PowerPoint and PDF versions, native Excel charts, a saved report library, branded cover with the customer's logo, report layouts for more pages (Element 3 KPIs, Executive Dashboard, Team Compliance Matrix, bookings, the assessor and verifier pages).

### Hand-made report layouts (built 22 Nov 2026, `server/services/reportDefinitions.ts`)

- [x] Eleven data addresses have a curated layout: **Compliance Explorer** (key figures, People with a computed Readiness, safety-critical gaps and every competence/training count, Sites and teams), **Competence Detail** (Gaps and expiries ranked safety-critical first, By element, and the **Matrix laid out like the screen**: elements down column A, filterable, people across the top with job role, location, team and competence percentage above each name, each cell saying "Current until 27 Dec 2028", "Expiring soon", "Expired", "No record" or "N/A", coloured, first column frozen), **Training Completions** (the list, By training, By category), **Duty to Operate** (Requirements with shortfall/at risk/met, People counted, Shortfall reviews), **Appraisal completion** (key figures, People, By stage, By manager, review cycle named), **Team appraisals**, **Contractor management** (people, declarations, waiting for approval, company named) and **Audit Log** (reads up to 5,000 events, newest first, keeps the page's filters, says plainly when it is only the newest part). Plain headings, plain-word statuses, dates as real dates, no identifiers. Roll-ups and the matrix stay in Excel only (`skipCharts`); written-out columns (notes, comments, emails) are never charted (`free`).
- [x] **Team appraisals deliberately leave out the scores and Talent Score**: a report is passed around, the scores are for administrators on their own screen.
- [x] The infographic's expiry windows now round up to whole days like the pages do (an item expiring in exactly 30 days is in "Next 30 days").
- [x] Tests: `tests/security/layouts.unit.ts` (68).
- [ ] Still the generic reader: Element 3 KPIs, Executive Dashboard, Team Compliance Matrix and every other page. Add a definition (a few lines each) when a customer asks.

### Scheduled reports by email (built 22 Nov 2026, migration 0054)

- [x] Any manager or administrator can choose **Export, then "Email me this regularly"**: every week (a weekday) or month (day 1 to 28), at an hour, in their own time zone, as **a summary, an Excel workbook, or both**; optional AI wording. Looked after on **Scheduled Reports** (Team and Compliance menu): send now, pause, resume, delete; an administrator can also see everyone's, pause or delete any, but not read or redirect them. Up to 10 per person.
- [x] **A scheduled report is only ever for the person who set it up.** It runs as them and goes to their own Capera email address only. It is made from an open export, so its data addresses are ones that export just read successfully as them (never typed in). Extra recipients or digest settings an administrator puts on the "Scheduled report" email type are ignored on purpose; its on/off switch and wording (Settings, Notifications) are honoured.
- [x] **How it reads data with nobody at a screen** (`server/services/reportRunnerAuth.ts`): a signed pass for that one person, valid two minutes, only from the server's own address, only GET, refused if a proxy header is present, made with a key derived from `SESSION_SECRET`; the closed-account check still applies. Every permission and "own people only" rule applies exactly as at their screen.
- [x] **Safe to run on several servers:** a due report is claimed by moving its next time forward in one step only one server can win; after a long stop it is sent once, not once per missed run. If the person has left or lost the manager/administrator role, or the report comes back empty, nothing is sent and the schedule says why. Run times are stored with a time zone, so daylight-saving changes do not move them. The job looks every 10 minutes (first look 1 minute after start).
- [x] The email carries counts and category names only (no names); the Excel attachment holds names, so it goes only to the owner. Attachments are added to the email service for SMTP, Resend and SendGrid.
- [x] Audit log records: scheduled, changed, paused, resumed, deleted, sent.
- [x] Tests: `tests/security/schedule.unit.ts` (40: next-run maths through clock changes and other zones, the pass, the email) and `tests/security/schedule.e2e.ts` (55: who may, whose is whose, due run claimed once, blocked cases, off switch, limits, audit). The e2e test needs a fresh server (rate limits) and the demo database.
- [ ] **Not yet tried with real email.** Everything is tested to the point of the email service; set up SMTP/Resend/SendGrid on the demo Repl and use "Send now". The summary is table-and-inline-style HTML made to survive email programs, viewed in a browser only (not yet in Outlook or Gmail).
- [ ] **Decision for Bruce:** an Excel file with people's names in a mailbox is outside Capera's control (forwarding, phones). Default is summary and workbook; the choice is per report. For a strict customer, consider "summary only" as the default, or a switch for administrators to forbid attachments.
- [ ] An administrator cannot yet set up a schedule for another manager (they must do it themselves or switch user); no "send to my team" option; no delivery tracking beyond the email log.
- [ ] Requires **migration 0054** (`npx tsx scripts/demo/applyMigration.ts migrations/0054_report_schedules.sql report_schedules`) and a server restart; no new packages.
- [x] **Dependencies:** none added. The Excel file is written with `jszip` (already used) and the infographic picture is drawn with built-in browser code (`client/src/lib/domToPng.ts`), so a build needs **no `npm install`**. Two earlier attempts (`exceljs`, then `html-to-image`) were dropped because the Replit package firewall blocks parts of any new dependency tree, and a customer security review would question them. Note for later: the lock file pins versions the firewall now calls critical (`proxy-addr` 2.0.7, `vite` 5.4.21), so a **fresh** install on Replit is blocked; update those with the packages when the company platform is chosen.

## Contractor management and the QR check (built 21 Nov 2026, branch feature/contractor-management, migration 0053)

- [x] **Contractor administrator** (new role, primary): ties to one contracting company (`users.contract_company_id`). Create them in User Management: role Contractor Administrator, employment type Contractor, and the company (the server refuses the role otherwise). They see only that company's people (`accessiblePersonIds` in `services/personAccess.ts` and `server/contractorRoutes.ts`), at **My Contractor People** (`/contractor`): add people, mark them as left, record training and competence, review and revoke what they declared. Host administrators use the same page (Contractor Management) with a company picker, plus a tab to approve or decline people a contractor added.
- [x] **Decisions recorded (Bruce, 21 Nov 2026):** contractor entries count straight away but are marked "declared by the contractor" (table `contractor_declarations`; the record itself is an ordinary completed enrolment or competent assessment, so every figure includes it) and can be revoked, which switches the record off; contractors can add and remove their people, but a person they add stays pending and inactive until a host administrator approves them (`users.approval_status`); approving assigns the job role's requirements.
- [x] **QR check**: the code now opens `/check/<person id>` (older printed `/badge?userId=` codes redirect). The scanner signs in and is sent straight back (`/api/login?returnTo=`, same-site paths only). Administrators, managers, assessors and internal verifiers see the full record of anyone; external verifiers and contractor administrators only people they are responsible for; everyone else sees only name, photo and the ready / not ready answer. Pending, left or inactive people are never "ready". Every full check is written to the audit log (who scanned whom). Mobile layout, problems listed first.
- [x] **Placement (Bruce, 21 Nov 2026):** contractor management and the QR check are **Gold**.
- [ ] **Self-declaration risk (accepted):** a contractor company can mark its own people competent and it counts immediately. The flag, the audit log and revocation are the controls. Consider sampling contractor-declared competence through internal verification, and an expiry check against the host's standard where the contractor enters a longer one.
- [ ] Contractor administrators cannot upload certificate files, only a reference. Add file upload if the host wants the evidence kept.
- [ ] No email yet when a contractor adds a person or when the host approves or declines; administrators see a prompt on their home screen and the Contractor Management page.
- [ ] A lost or stolen badge cannot be cancelled (the code is the person's id and shows nothing without a sign-in; the full check needs a checker's sign-in). A rotatable badge token is the next step if a customer wants one.
- [ ] `/api/badge/:userId` and the old `CompetenceBadge` page are no longer used; remove once the old codes have been reprinted.
- [x] Demo data: `npx tsx scripts/demo/seedContractorDemo.ts` adds two contracting companies, a contractor administrator for each (Carla Harbour, Ravi Nair), seven contractor people (ready, not ready, expired, two pending) with declared records, and an external verifier (Eva Outside) allocated to two assessors; `--reset` removes and re-adds. The **Switch User** menu now lists a sample person for every kind of login, grouped by role. The host administrators' contractor page is at `/admin/contractors`.
- Deploy: `npx tsx scripts/demo/applyMigration.ts migrations/0053_contractor_management.sql contractor_declarations`. Tests: `tests/security/contractor.e2e.cjs` (52 checks).

## Training course evaluations (built 25 Nov 2026, migration 0058)

Feedback from each person after each course, a follow-up on use at work, and suitability results for administrators. Candidate: **My Course Feedback** (menu, home screen item, banner on My Training). Administrator: **Training Evaluations** (Courses, Compare, Waiting for replies, Safety concerns, Settings and forms; course decisions are recorded on each course). Who may see or manage is on **Training Permissions** under "Training evaluations". Four forms (e-learning, practical technical, classroom or virtual, on-the-job); six rated areas on each, wording editable. Requests come from a booking marked completed, e-learning finished, or a completion recorded. Invitation, then reminders every 7 days up to 3 times; reply within 30 days; follow-up after 90 days; names off; results held back below 3 replies. All adjustable. Silver licence (to confirm). Code: `shared/trainingEvaluation.ts`, `server/services/trainingEvaluations.ts`, `server/services/trainingEvaluationAnalysis.ts`, `server/trainingEvaluationRoutes.ts`, `client/src/components/evaluations/`. Tests: `evaluations.unit.ts` and `evaluations.e2e.cjs`.

- [ ] **Apply migration 0058 before running this code against any database**: `npx tsx scripts/demo/applyMigration.ts migrations/0058_training_evaluations.sql training_evaluations`.
- [ ] **Only recorded attendance is asked about.** A booking that stays "confirmed" after the session asks nothing: someone must mark it completed. There is no attendance register or bulk "mark the whole session attended" in these changes. Changing a completed booking back does not undo the person's training record (that is how booking and record already behaved), so the feedback request stays until the record is corrected too, or an administrator withdraws it.
- [ ] **Starts from the day it is first used**; older training is not chased. On a demo, set "Ask about training from" back (it also never asks about anything older than the reply time).
- [ ] **Reminders need email set up** (not tried with real email). Without it, people see the item on their home screen and My Training, and no reminder is counted as used. The job runs hourly while the server is up, so an autoscaled or sleeping host would send late.
- [ ] **Standard wording and rating thresholds are a first proposal.** Have a training lead check the statements and the thresholds (fixed in `trainingEvaluationAnalysis.ts` and shown on the Courses tab). Ratings are a prompt to look, not a validated measure.
- [ ] Not built: a line manager's view of whether performance changed; evaluation by the instructor or provider; linking results to later competence assessment outcomes or test scores; a share link for providers; reminders to the administrator when a course's "look again" date arrives; other languages.
- Demo sample data: `scripts/demo/seedTrainingFeedbackDemo.ts` (invented; `--reset` before a demonstration, because waiting requests close after the reply time; `--remove` to clear). The waiting requests are for example.com addresses: with real email set up, reminders would be attempted to them after the reminder interval.
- [ ] **Privacy:** names off by default, but the database keeps the link (needed for reminders). Small groups can still be narrowed down (see DPIA risk 14). Instructor comparisons are information about people (risk 15). Retention period for evaluations not decided: they stay until a leaver's details are removed, when written answers go and ratings stay.

## Site visitor forms (built 25 Nov 2026, migration 0057)

Contracting companies tell the host who is coming on a short visit. Contractor administrator: **Site visitors** tab (menu **Site Visitor Forms**, and a shortcut on their home screen). Host administrator: the same tab on Contractor Management, plus **Visitor form settings** (email addresses, days' notice, late forms accepted-and-marked or refused, checklist for every visit or safety critical only, longest visit, access places, protective equipment, site notes, privacy notice, checklist lines, removal period, whether the email carries attachments). One form per person, filed on that person's record (**Site visits** when you open them). Workflow: draft, submitted, accepted or sent back, cancelled. Code: `shared/visitorForm.ts`, `server/visitorRoutes.ts`, `server/services/visitorForms.ts`, `client/src/components/visitors/`. Tests: `tests/security/visitors.e2e.cjs` (71).

- [ ] **Apply migration 0057 before running this code against any database** (the home screen reads the new table): `npx tsx scripts/demo/applyMigration.ts migrations/0057_visitor_forms.sql visitor_settings`.
- [ ] **Source of the form.** It was designed from photos of a customer's visitor form (marked "Internal Use Only") and contractor competence checklist. All declarations, notices, notes and checklist lines in Capera were written afresh and name no customer; the photos are not in the project. Bruce should confirm they may use it (ties to the IP and confidentiality points under contractor status), especially before any IP sale.
- [ ] **Checklist lines to confirm.** The photos did not show: the evidence wanted for "permit to work", any rows of the supervision section before its last one (Capera has one supervision line), or anything after the equipment section. Add lines on the settings screen if the real checklist has more. A separate safety critical visitor competence form mentioned in the source is covered by the checklist.
- [ ] **Not tried with real file storage or real email** (storage is Replit-only; tested with a local folder via `LOCAL_OBJECT_STORAGE_DIR`). On the demo Repl: a bucket is needed; upload and download a certificate; set up email and send a form to a test address; check what arrives in Outlook. The attached form is an HTML file, which some mail systems block: a PDF would need a PDF library (a new package).
- [ ] **No virus scanning** of uploaded certificates (type and content are checked). Same gap as other uploads.
- [ ] **Privacy:** by default the email carries the form (emergency contact, support needs) and certificates. Removal of personal details after the visit is **off until a number of days is set**. The notice, lawful basis and period need the customer's DPO. Removal does not reach emails already sent. Certificates and the visitor's name and email are kept until removed through leaver removal; a visitor who is never marked as left is never removed that way. Decide a retention rule for visitor records.
- [ ] Not built: one form for several people or "copy from last visit"; reminders to the contractor before the deadline; an arrivals list for security on the day; a security or reception role that sees only accepted visitors; the QR check showing an accepted visit; reusing equipment certificates across forms; demo seed data for visitor forms.
- [ ] A certificate that runs out before the visit ends is flagged to the contractor and host but does not stop submission. Decide whether it should.

## Security hardening against ASVS 5.0.0 level 2 (started 18 Nov 2026, branch feature/security-hardening)

The assessment of all 253 requirements is in `security/asvs/` (CSV and SUMMARY.md). First round of fixes, with tests in `tests/security/`
(`npm run test:security` and `tests/security/api.e2e.cjs`; 99 checks, all passing on the demo copy):

- Sign-in and session: one gate on every /api route (closed by default); idle limit 60 min and absolute limit 12 h (`SESSION_IDLE_MINUTES`,
  `SESSION_ABSOLUTE_HOURS`); SameSite=Lax cookie; the server refuses to start in production with `LOCAL_DEV_AUTH` or a `SESSION_SECRET` under 32
  characters; the leaver check refuses if it cannot be made; a first sign-in is matched to an admin-created account by email only if that account
  has no identity yet and the email is not marked unverified (`REQUIRE_EMAIL_VERIFIED=true` for Entra ID and similar); roles are never taken from the identity provider.
- Records: per-record access checks for CVs, assessments, feedback, evidence and self-assessments (`server/services/personAccess.ts`); user edit and booking edit
  are allow-lists; a person cannot create or re-date their own training record; assessors cannot assess or sign off themselves; a verifier cannot verify their own work;
  seat capacity is enforced under a lock; only a super administrator can give or remove the top two roles or act as one.
- Browser: strict content policy in production, nosniff, framing off, no-store on API data, cross-site change requests refused, uploads limited by type and content,
  files served safely, print view escaped, spreadsheet-formula-safe exports, link checks, rate limits on sign-in and AI calls.
- Errors and logs: no response bodies in the log; failures on our side show a plain message.
- Dependencies: `npm audit fix` (compatible versions only): 49 advisories down to 22; critical 0.

**Deploy notes (do these when this branch goes to the demo Repl or to a company):**
- [ ] `SESSION_SECRET` must be at least 32 characters in production or the server will not start. Check the demo Repl's secret first.
- [ ] The demo and test tools (Create Test Data, seed data, test users, test scenarios) answer "not found" in production unless `ENABLE_DEMO_TOOLS=true` is set. **Set it on the demo Repl only.**
- [ ] Everyone is asked to sign in again once after this deploy. Sessions now end after 60 minutes idle and 12 hours in total.
- [ ] A verifier now sees an assessment only if allocated to its assessor (or if they are its assessor, candidate, manager, or an administrator). Check the allocations are complete.
- [ ] The training record routes (`/api/training-certificates`, `/api/training/records/:id/dates`) are unimplemented stubs in storage and always fail; they are now locked down but not built.
- [ ] Only compatible package updates were applied. The remaining high advisories need testing one at a time: drizzle-orm, zod, openai, nodemailer, tailwind build tools; xlsx has no fix.

**Round two (21 Nov 2026, uncommitted until asked):** one person's skills gap, training compliance, competence badge, role-transition plan, content progress, onboarding, skills, certifications, expiry alerts and absences now need a reason to see that person (themself, administrator, manager or supervisor at any depth, their assessor, or a verifier allocated to their assessor: `accessiblePersonIds` in `server/services/personAccess.ts`); the assessments list and an assessor's verifications are cut down the same way; succession plans are for administrators only. A scan of every list route as four kinds of user (scratchpad `leak_scan.cjs`) went from 39-43 other people visible on skills and assessments to the person's own people. 108 checks.
- [x] **Decided 23 Nov 2026: managers see only their own team in the company-wide reports.** Built: Compliance Explorer, Competence Detail, compliance overview (and the Executive Dashboard figures), Element 3 KPIs and the Team Compliance Matrix now use the same person scope as the rest of the system (`accessiblePersonIds`: themself and everyone who reports to them as manager or supervisor at any depth; an assessor's allocated candidates; a verifier's assessors' candidates). Administrators, super administrators and developers still see everyone, and so do their exports and scheduled reports (which read through the same calls). The headline percentages and totals are recalculated for the team only. Naming a person outside the team in a filter returns nothing.
  - **Duty to operate** shows a manager every requirement with the **whole-site** counts and status (a shortfall is a shortfall), but names only people in their own team; the rest show as "Someone outside your team" with no job role, and the internal list of who is alerted is hidden.
  - **360 people picker** (`/api/performance/people`): a manager is offered their own people, their own manager and peers, and people at their own site, not the whole company (administrators still see everyone). A rater from another site is therefore not offered.
  - Tests: `tests/security/scope.e2e.cjs` (22: manager, assessor, administrator, every endpoint above, exports).
  - [ ] Not scoped (by design, for now): the org chart (names and reporting lines only), Training Completions and the training cost report (these follow the admin-granted training permissions, not roles), job role / location / team lookup lists.
  - [ ] Pages do not yet say "showing your team" for a manager; a manager who sees fewer people than before may wonder why. A one-line note on each page would help.

**External verifier and 360 (21 Nov 2026, uncommitted):** a read-only **External Verifier** role (primary role, or granted as additional access). An administrator allocates them to assessors on Internal Verification Management (same allocation as internal verifiers); they see only those assessors' completed assessments, the assessor's comments, verification records, the comment thread and the evidence, at **External Verification** (Silver). They cannot change anything and cannot reach CVs or people lists. Assessor comments and assessments can now be read by the assessor, the candidate, an allocated internal or external verifier, the candidate's manager and administrators. The **360 results** (averages and comments) are now seen only by the line manager and administrators: not by the person reviewed (even after the report is shared) and not by a supervisor; everyone still sees who has been asked and how many have answered, and colleagues can still give feedback. The score snapshot is hidden from supervisors in the team list. Tests: 136 checks.
- [x] External verifier views are now logged and allocations can be end-dated (round three, below).

**Security round three (23 Nov 2026, uncommitted; migration 0055):**
- [x] **Appraisal records.** Every appraisal route was already checking the person; now proved: 17 routes tried as three outsiders (a manager of someone else, an assessor, another manager), none refused wrongly, none changed or showed anything; the person reviewed never gets scores, potential rating or calibration note; 360 results only for line manager and administrators. New: an administrator opening an appraisal they have no part in writes a "view" entry (who, whose) to the audit log (`recordRecordView` in `services/auditLog.ts`).
- [x] **External verifiers.** (1) Every record an external verifier opens is written to the audit log as a "view" (list or record, who really did it and who they were acting as); lookup lists and page housekeeping are skipped (`watchViews` in `services/auditLog.ts`). (2) `verifier_allocations.ends_on` (migration 0055): set on Internal Verification Management (date box when allocating, "End date" button per row, "Ended" badge); enforced in every query that reads an allocation (external verification routes, `canAccessAssessment`, `accessiblePersonIds`, the assessor-verifications check, the home briefing, storage lookups). An administrator still sees ended allocations to extend them. Allocator is now taken from the signed-in administrator, and only named fields are accepted.
- [x] **End date on the external verifier's account** (built 24 Nov 2026 at Bruce's request, **migration 0056**, `users.access_ends_on`): set on Internal Verification Management ("External verifier accounts" card, "End date" button), via `PATCH /api/users/:id/access-end` (administrators only; external verifiers only, never an administrator or yourself; logged in the audit log). After the date the gate in `replitAuth.ts` (`accountState`) refuses them on every route, as for a leaver, with code ACCESS_ENDED and its own screen ("Your access has ended"); within a minute for someone already signed in. Tested in `tests/security/auth.unit.ts` and `round3.e2e.cjs`.
  - [ ] **Apply migration 0056 before running this code against any database** (every user query now reads the column): `npx tsx scripts/demo/applyMigration.ts migrations/0056_user_access_end_date.sql users.access_ends_on`.
  - [ ] Not built: a monthly look at the "view" and "refused" entries (someone at the customer needs to own it); an end date on accounts other than external verifiers.
- [x] **Learning packages from a separate address** (`server/services/contentOrigin.ts`, wired first in `server/index.ts`). Set `CONTENT_ORIGIN=https://content.<company domain>` (a second host name pointing at the same server; plain http only outside production). Packages are then served only there, on `/c/<signed link>/<file>`; the application's own `/scorm/*` route answers "not found". The link names one package, one learner and the application's address and runs out after 4 hours; the content address never gets the sign-in cookie, answers nothing but package files, and sets a policy that only the application may frame it. A small runtime script is put at the top of each package page (SCORM 1.2 `API` and 2004 `API_1484_11`, values kept for the visit) and tells the player by `postMessage` when the package commits; the player checks origin and package and saves as the signed-in person. Tests: `content.unit.ts` (52) and the `CONTENT_E2E=1` part of `round3.e2e.cjs`.
  - [ ] **Not active on the demo Repl** (one address only), so nothing changes there. Needs a second host name and certificate in the company environment, `CONTENT_ORIGIN` set, and `APP_ORIGIN` if the server cannot work out its own public address.
  - [ ] **Not yet tried with a real package** (storage is Replit-only, so the handler is tested with stand-in storage). On the demo Repl, set `CONTENT_ORIGIN` only if a second address exists, then launch a real SCORM 1.2 and 2004 package and check resume, completion and a multi-page course. Known limit: a package that looks for the API only in a parent window (not its own) will not find it; ADL's standard search checks its own window first.
  - [ ] **Downloads** (CVs, evidence, certificates) still come from the application's own address: they are sent as attachments with safe headers and a restrictive policy, which is the control; they are not moved to the separate address.
- [x] **Fonts** are served by Capera (`client/public/fonts`, Latin and Latin-extended: Inter, Bricolage Grotesque, Instrument Sans, JetBrains Mono, SIL Open Font Licence); the policy no longer lists Google; a browser check showed no request leaving the site.
- [x] **CI** (`.github/workflows/ci.yml`, `.github/dependabot.yml`): on every push and pull request: install from the lock file, **no new type errors** (the older 67 are recorded in `security/type-error-baseline.json`; `scripts/security/typeErrorRatchet.cjs`), the unit tests that need no database, the production build, `npm audit` (fails on critical in production packages), and a database job (empty throwaway Postgres, `drizzle-kit push`, the sign-in test). Weekly grouped dependency updates. `package.json` scripts: `test:security:nodb`, `test:security:db`.
  - [ ] **The pipeline has not run on GitHub yet.** Push the branch and watch the first run; the database job (`drizzle-kit push --force` into an empty database) is the most likely to need a fix. The end-to-end tests are still run by hand (they need the demo database); wire in a throwaway database with demo data to run them in CI.
  - [ ] Move the audit gate from critical to high once the six high advisories are dealt with (`security/PATCHING_POLICY.md`).
- [x] **Data protection documents** (drafts for the customer's DPO, not legal advice): `security/DPIA_DRAFT.md`; `security/DATA_INVENTORY.md` and `security/data-inventory.csv` (every table and column, classified by name; regenerate with `npx tsx scripts/security/dataInventory.ts`; the "Reviewed" column is for a person); `security/PATCHING_POLICY.md` (proposed time frames, the exceptions table); `security/PENTEST_SCOPE.md` (brief for the testers).
  - [ ] The classification is by name and over-cautious in places (a few company-standard tables are marked special-risk because of "score" in a column name). The data owner needs to go through the CSV.
  - [ ] **Decisions the DPIA lists for the controller:** lawful basis, special-category data (absence type, date of birth), retention periods, consultation, which AI services are acceptable, who the processor is, who handles subject requests. No "everything about me" export exists for a data subject access request.
- [ ] **Penetration test**: not booked. `PENTEST_SCOPE.md` is the brief to send once a slot and a test instance exist. Nothing is called "compliant" until a tester who did not write the code has reported.
- [x] **Refused requests are logged** (ASVS 16.3.2, built 23 Nov 2026 at Bruce's request): every 403 is written to the audit log as a "refused" entry saying who (and who they were acting as), the method and the route, with the address; cross-site refusals too (no person). One entry per person, route and minute and at most 120 a minute, so it cannot flood the log. Filter on "refused" in the audit log screen.
  - [ ] Left out on purpose: 401 (not signed in); routes that answer 404 to hide that a record exists; validation failures (400). Nobody is alerted yet: the entries are there to be reviewed, and the DPO/security team will want to decide who watches them and how often.

**Still open from the assessment (largest first):** validation on the remaining update routes (allow-lists instead of passing the body through); status-transition checks in the database; identity as (issuer, tenant, subject) once the company identity provider is known; secret handling and rotation (the Neon password still needs rotating); the six high library advisories; independent penetration test; logging of refused attempts; the CI pipeline's first real run.

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

## Announcements (built, migration 0050)

- [ ] Only administrators can write announcements. Decide whether managers should be able to message their own team or site.
- [ ] Plain text only: no formatting, links, images or attachments. Fine for notices, limiting for a policy document.
- [ ] Editing a published announcement marks it "updated" but does not reset anyone's confirmation or email anyone again. For a safety
      notice where a material change should be re-confirmed, add "ask everyone to confirm again". The audit log keeps before and after.
- [ ] Opening the page does not mark a notice read: the person clicks. That is deliberate (so "read" means something) but could be
      relaxed for ordinary notices.
- [ ] The audience is worked out live. Someone who joins a business unit or job role after a notice went out will see it (and be asked to
      confirm it), but is not emailed. People with no email address only get it in the app (the form says how many).
- [ ] Business units are only labels on the org chart today (one organisation per deployment). Targeting licensed companies needs the
      multi-company design.
- [ ] Confirmation records (who confirmed, when) can be viewed but not exported to CSV for an auditor yet.
- [ ] The administrator list works out each audience by reading all current people for every announcement. Fine for hundreds of people;
      if a customer has many thousands it should be cached or counted in SQL.
- [ ] English only, no categories or pinning, no replies or questions from readers. Expired notices stay visible for 120 days under
      "Earlier", then are hidden (the records remain).

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

- [x] Training permissions: the `training_administrator` mismatch is fixed by the training permission matrix (built 18 Nov 2026, see below).
- [ ] Course booking and e-learning completion are fixed, but a wider review of the training routes' permission rules is still worth doing.
- [ ] Deleting a user is only a soft delete (hidden). It never removes anything. Retention now covers leavers, not "deleted" people.

## Planned features not built yet

- [x] E-learning certificates on completion, with an automatic or manual switch and a "pending" state (built 6 Nov 2026, see below).
- [ ] SCORM / e-learning version tracking, for audit. **Partly done:** each certificate records the SCORM standard (1.2 or 2004), score and result at completion (see below). Still to build: a history of package versions when a SCORM package is replaced, and which version each learner completed.
- [x] Communications and announcements to everyone, business units or job roles (built 7 Nov 2026, see below).
- [ ] Support or helpdesk tickets.
- [x] Notification rules, templates, frequency and recipients, with a log of every email and resend (built 7 Nov 2026, see below).
- [x] Training permission matrix (built 18 Nov 2026, migration 0052, see below).
- [ ] Allocating e-learning to licensed business units, then all, job role or individual. Needs the multi-company design decision first:
      today there is one organisation per deployment and business units are labels only.

## Training permission matrix (built 18 Nov 2026, migration 0052)

- [x] One table of 14 training areas x actions (view, create, edit, delete, approve) x 10 user types, defined in `shared/trainingPermissions.ts`.
      Administrators change it on **Training Permissions** (Administration, Learning and training); changes are stored as differences from the
      defaults, take effect at once, and are in the Audit Log. Super administrators always have everything and cannot be changed or locked out.
- [x] The server (55 routes), the router, the menu and the home screen's approvals all read it, so they can no longer disagree. A person holds a
      permission if any of their roles (their own plus granted ones) has it.
- [x] Fixes the old mismatch: a training administrator can now actually save on providers, venues, courses, sessions and the policy matrix (the
      screens always offered it, the server refused). Developers are now treated as administrators across training, as the screens already did.
- [x] Default behaviour is unchanged for everyone, except these inconsistencies now resolved the sensible way: assessors see the Training Completions
      report they could always open; administrators see Training Approvals; developers see the training screens the router already admitted them to.
- [ ] **The guard uses the person being "viewed as"**, not the real signed-in administrator. An administrator viewing as a candidate is held to
      what that candidate may do. Other admin screens still check the real person; decide whether to align them.
- [ ] Reading the lists the booking and request flows need stays open to everyone signed in (by design). A customer who wants those hidden needs
      a separate decision.
- [ ] Not on the matrix: the training-certificate routes (owner or administrator), `admin/repair-training-completions` and `admin/seed-training-data`
      (maintenance, admin only), and about 27 routes that lead to unfinished code. The table covers training only; competence, assessment and
      user administration still use fixed role lists.
- [ ] Notification recipients ("all training administrators", "all training approvers") still use the granted role, not the matrix. A role
      given approve through the matrix is not emailed about new approvals.
- [ ] Apply migration 0052 before using it: `npx tsx scripts/demo/applyMigration.ts migrations/0052_training_permissions.sql training_permissions`.

## Bronze, Silver and Gold (built 8 Nov 2026)

- [x] `shared/licence.ts` is the one place that says which level each page and each part of the server belongs to. Everything not listed is
      Bronze. The menu, hub tiles, search, breadcrumb, a typed-in address (a "This is part of Capera Gold" page), the home screen's links and the
      server (refuses with a 403 that names the level) all read it. Moving something between levels is a one-line change there.
- [x] The level is set with the `CAPERA_TIER` setting on the server (bronze, silver or gold). It is Gold when not set, so nothing is hidden by default.
      Tested at all three levels: 29 pages on Bronze, 53 on Silver, 60 on Gold; Bronze sits inside Silver sits inside Gold for every role.
- [ ] **Confirm where these belong** (the landing page's feature table does not mention them, so I placed them): external training (catalogue,
      bookings, providers, venues, sessions, policy matrix, cost report) and training approvals on Silver; Duty to Operate, the Audit Log and the
      OPITO / Audit Centre evidence page on Silver; Archived People, Org Chart and Competence Document Import on Bronze.
- [ ] Keep `client/src/pages/Landing.tsx`'s feature table and `shared/licence.ts` in step. They are separate lists today.
- [ ] Not built: a licence that differs per company inside one deployment (needs the multi-company work), a screen to change the level, usage
      limits (the 300 users), and licensing of individual business units. The level is one setting per deployment.
- [ ] Standards translation (Gold on the landing page) is not gated, because the language picker is used on every page. Gating it needs the picker
      split from the translation of standards themselves.
- [ ] A person's data created while on a higher level (for example appraisals) stays in the database if the level is lowered; it is hidden and
      refused, not deleted.

## Appraisals by period: reporting lines, schedule, conversation, completion (built 8 Nov 2026, migration 0051)

Built from Bruce's brief: administrators set who appraises whom; reviews happen at set times (quarterly, mid-year, year-end) with email
reminders; the person self-assesses and responds to comments; administrators see everyone's completion; finished reviews feed the Talent Score.

- [x] **Reporting lines** (Performance admin, Reporting lines tab). Each person has a manager (the appraiser: rates, shares, signs off) and an
      optional supervisor (follows the review, adds comments, cannot rate or sign off, does not see the potential rating or score snapshot).
      One person or many at a time; loops, self-reporting and manager = supervisor are refused. Changing a manager moves their unfinished reviews;
      signed-off reviews stay with the manager who did them. The user edit screen keeps reviews in step too.
- [x] **Who has the appraisal functions follows the reporting lines**, not the role name: anyone set as a manager or supervisor gets Team Performance,
      its menu entry and the review items on their home screen (an "appraiser" capability added to the signed-in user's roles; nobody is given it).
- [x] **Review periods**: "Schedule the year" creates annual, mid-year and year-end, or quarterly periods with dates filled in. Each can open by itself on
      its date (daily job, also at start-up), creating a review for everyone who has a manager, emailing each person, emailing each manager and
      supervisor how many people they have, and telling administrators who was left out. Self assessments open on their own date for people whose
      objectives are agreed. Later periods can carry the year's agreed (unfinished) objectives forward and start at the self assessment.
- [x] **Conversation**: comments and replies on each review. The person's own comments are seen by the team at once; the team's comments are seen by
      the person once the report is shared. Emails go to whoever can see the comment. Closed once the review is signed off.
- [x] **Completion** (Performance admin, Completion tab): every active person against a period, with stage, who it is waiting on, due date, overdue,
      by-manager roll-up, filters, spreadsheet download, and people with nobody set to appraise them. Also on the administrator's home screen.
- [x] **Talent Score** now averages every signed-off review inside the window (it used only the latest), so quarterly reviews all count.
- [ ] Apply migration 0051 before using this: `npx tsx scripts/demo/applyMigration.ts migrations/0051_performance_periods.sql users.supervisor_id`.
- [ ] Reminders go to the employee and the manager only (from 30 days before each due date). Supervisors are emailed when a period opens and when
      comments are added, but do not get due-date reminders. Add them if wanted.
- [ ] A manager who is away cannot hand a review to someone else; an administrator has to change the reporting line or act for them.
- [ ] A person with several signed-off reviews in the window gets the plain average. A weighting that favours the most recent is a decision for
      customers who want it.
- [ ] A period whose end date has already passed is not opened automatically (an administrator launches it by hand if they still want it).
- [ ] People with nobody set to appraise them are left out of an automatic opening. Fixing their reporting line and using "Add people who joined
      since" on the open period includes them.
- [ ] The directory scope uses the person's location (or manager and supervisor links). A company that wants a wider or narrower rule for who can
      be asked for 360 feedback needs a setting for it.
- [ ] Carry-forward copies objectives from the person's most recent earlier review in the same year. It does not recheck that the weightings
      still add up to 100 after finished objectives are left out.

## Performance reviews and Talent Score (built earlier, migrations 0042 and 0043)

- [ ] Not built: AI extraction of experience and qualifications from an uploaded CV, 9-box talent grid, score and potential on succession
      plans, behaviour gap in role transition, objective cascade screen, entitlement gating by licence level (Gold).
- [ ] DPIA before real data (see top).

## Navigation and look (redesigned 7 Nov 2026)

- [ ] **Add a page in one place.** Every page that should be reachable from the menu, the tiles, the search and the breadcrumb is listed in
      `client/src/lib/navigation.ts` (with a title, one-line description, icon and the roles that see it), as well as having its route in
      `App.tsx`. A page with a route but no entry there works but cannot be found from the menu. Do both when adding a page.
- [ ] The roles listed in `navigation.ts` repeat the guards in `App.tsx` by hand. They can drift: a link could show for a role the route then
      refuses (or the reverse). The server still decides what anyone may do. A shared role list would remove the duplication.
- [ ] Only the shell was redesigned (sidebar, tiles, top bar, colours, shadows, type). The pages themselves still have their own headings,
      widths and spacing, and some use fixed colours that ignore the theme. A shared page header, then a pass through the busiest screens
      (User Management, the dashboards, Training Manager), would finish the job.
- [ ] Search finds pages only, not people, courses or records.
- [ ] No "recently used" or pinned tiles. No unread count on My Work (the banner covers important announcements).
- [ ] The landing page (before sign-in) has its own separate styling and was not part of this.

## Role-specific home screens (built 7 Nov 2026)

- [ ] **Confirm the role design with the people who will use it.** The briefings are my reading of what each role needs: worker, assessor,
      verifier, manager, administrator, super administrator (adds governance: activity, sign-ins, retention) and developer (platform health).
      A person with several roles gets the most senior one's briefing (developer, super administrator, administrator, manager, verifier,
      assessor, worker). Training administrators and approvers keep their own briefing and gain their queue on top.
- [ ] The red/amber/green rule is fixed: green from 90%, amber from 75%, red below. It ignores the KPI targets screen. Decide whether each
      customer sets their own thresholds.
- [ ] Not yet on any briefing: absence and long-term leave, onboarding progress, performance review cycle progress for administrators,
      e-learning progress for workers, a per-site breakdown for managers who run several sites, and "what changed since you last looked".
- [ ] The assessor's "ready", "self-assessments to review" and "overdue" counts repeat the definitions in the Assessor Dashboard, worked out
      separately on the server. If one changes, change the other.
- [ ] Managers and assessors get their figures from the compliance explorer for their own people. That is fine for teams of tens. The
      organisation-wide figures are cached for a minute. Very large teams would need the figures pre-computed.
- [ ] Charts are drawn with plain bars and meters (no donuts, one hue per meaning, status colours always with an icon and a label). They have
      native hover text and screen-reader labels, but no "view as table" toggle yet.
- [ ] The old Executive Dashboard moved to `/dashboard/executive` (and the candidate one to `/my-dashboard`), linked from each briefing and the
      menu. Any bookmark to `/dashboard` now lands on the briefing.
- [ ] Sections are named for the role (a manager's is "My Team", an assessor's "Assessing", a verifier's "Verification", a developer's
      "Platform"). The page lists in `client/src/lib/navigation.ts` are the same for everyone; only visibility and the names change.

## Assessment planning on the home screens (built 6 Nov 2026)

- [x] Workers and assessors see an assessment plan: assigned, ready, planned, past their date, and competence to reassess with nothing
      arranged. The look-ahead is the person's choice (3, 6, 12, 24, 36 months or all; 12 by default, remembered on that device). Nothing
      is cut off at a fixed date. The month-by-month chart runs from now to the last booked or due month.
- [x] Assessors set or change a date from the plan (Set date, Change date, Reschedule). This works before, on or after the expiry date. It
      re-uses an open assessment if there is one, otherwise it creates one for the reassessment, then emails the candidate. An assessor can
      only plan for candidates allocated to them (administrators can plan for anyone). Dates cannot be in the past or more than five years away.
- [ ] "To reassess" only counts competence the person's job role requires and that has an expiry date. Competence with no expiry never appears.
- [ ] A reassessment planned from here is created as a placeholder assessment (origin `reassessment_plan`). It is cleared when the assessor
      signs it off in the normal way. If an assessor never does, it stays open and shows as "past its date".
- [ ] Managers, verifiers and administrators do not get the plan panel yet (only workers and assessors were asked for). The same panel could
      be added with a team or organisation scope.
- [ ] The chart has hover text but no "view as table" toggle.

## Found by the full every-role check (6 Nov 2026)

How it was checked: every API route (475) was called as each of eight genuine user levels and compared with what the route's own guard
allows, and every screen (68) was opened in the browser as each level, with every sidebar and hub link followed. Done on a throwaway copy
of the database, not the working one. All the feature test suites were then re-run (home 43, planning 48, Vantage 34, notifications 41,
announcements 61, certificates 43 and 22, retention 31, audit 15): all pass.

Fixed during the check:
- [x] **Any signed-in user could make themselves a developer** (`POST /api/auth/promote-to-developer`). Nothing used it. Removed.
- [x] **One request could crash the whole server.** The ownership check in front of the training-certificate routes called a method that
      is not built (`getTrainingCertificate`), and a failure inside permission checks was not caught. Permission checks now fail cleanly (a 500
      for that one request), and the server logs an unexpected failure instead of exiting.

Still open:
- [x] `GET /api/performance/people` (the directory behind the 360 and appraisal pickers) is no longer open to everyone: administrators and
      anyone who manages or supervises people see everyone, everybody else sees only themselves, their own manager and supervisor, colleagues
      under the same manager or supervisor, and colleagues at their location. Decided with Bruce on 8 Nov 2026.
- [ ] Several older screens' routes are open to everyone at the page level (assessor workspace and dashboard, verifier dashboard, training
      approvals, team compliance). The server refuses the data, so a candidate sees an empty shell or "403", not anyone else's information.
      Add page guards that match the menu, taking care not to lock out people who hold more than one role.
- [ ] About 27 storage methods are stubs that throw "Method not implemented" (training certificates, training levels, competence
      certifications, expiry alerts, bulk user create, standards import, training records with status, and others). No screen calls them,
      but the routes exist. Remove the dead routes, or build them.
- [ ] `GET /api/my-assessments/summary` reads a database view (`my_assigned_elements_status`) that does not exist in the demo database. No
      screen uses it.
- [ ] Editing or deleting a record that does not exist (many `PATCH`, `PUT`, `DELETE` routes) answers 500 "Failed to update" instead of 404.
      Only reachable by hand-made requests.
- [ ] `POST /api/training-content/:id/progress` accepts a content id that does not exist and records progress for it. `POST /api/upload` is a
      placeholder that stores nothing and returns a made-up link (nothing uses it).
- [ ] `POST /api/auth/setup-test-scenario` (developer tool in the user switcher) creates sample people. Keep it out of customer tenants.

## Housekeeping and technical debt

- [ ] The type-check has 67 pre-existing errors (for example `DbStorage` not matching `IStorage`, missing methods on `IStorage`, session typing in routes). Keep it
      at 67 or below; reducing it would make future checks more useful.
- [ ] The clean demo Repl is updated by unzipping a rebuilt zip. It has no git history, so a normal merge cannot work there. After any
      update, restart the server from the Shell with `nohup npm run dev` (the Run button uses Replit's own empty database).
- [x] Landing page rebuild committed on its own branch, `feature/landing-page-rebuild` (18 Nov 2026), branched from build 2. Merge it with
      build 2 when you merge to the main line. Keep its feature table in step with `shared/licence.ts`.
- [ ] Several internal documents and the clean-demo zips sit untracked in the project folder. Decide where they should live.

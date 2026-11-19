# Capera follow-ups and known gaps

A running list of things that are not finished, not verified, or need a decision, so they are not forgotten.
Internal note: it is kept out of the clean demo zip. Add to it whenever something is built with a known limit,
and tick items off (with the date) when they are dealt with.

Last updated: 18 November 2026.

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

**Still open from the assessment (largest first):** per-record checks on the other record types (appraisals, skills, succession, certificates, reports);
validation on the remaining update routes; SCORM and downloads from a separate address (needs the hosting decision); web fonts hosted by Capera;
identity as (issuer, tenant, subject) once the company identity provider is known; DPIA and data classification; secret handling and rotation;
independent penetration test; CI that runs the tests on every change.

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

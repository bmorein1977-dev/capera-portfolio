# Clean demo tenant

A second, separate copy of Capera for showing prospects, with an entirely fictional company
("Northgate Energy Services": 41 people, 12 roles, 13 standards, training, assessments, internal
verification, skills, succession and workforce plans). Nothing in it comes from a customer.

It is a separate **database** plus a separate **Replit app** pointing at it. Your existing demo is
untouched and cannot see this data (and this data cannot see yours).

## Contents

| File | What it does |
|---|---|
| `seedCleanDemo.ts` | Fills an empty database with the fictional company. `--reset` wipes and re-seeds. |
| `seedDemoCvs.ts` | Makes a fictional one-page CV (PDF) per person from their own data. `--out <folder>` writes files; `--upload` attaches them in the app (Replit only). |
| `seedPerformanceDemo.ts` | Adds career history, qualifications, a completed 2025 review (objectives, behaviours, 360 feedback), an open 2026 cycle with reviews at every stage and due dates, and an open 2027 cycle with no reviews yet so a manager can start one live. Run after `seedCleanDemo.ts`. |
| `applyMigration.ts` | Applies one migration file to a demo database in a single transaction, and skips it if already applied. |
| `promoteAdmin.ts` | Makes one email a super_admin, if you logged in with a different email than the seed used. |

All of these scripts refuse to run unless the database name contains `demo`.

## One-off setup of the demo Replit app

1. Replit: **Create Repl > Import from GitHub**, repo `capera-portfolio`, branch `main`. Do not use
   the Agent on this Repl.
2. **Secrets** (Tools > Secrets):
   - `DATABASE_URL` = your existing Neon URL with the database name changed from `neondb` to
     `capera_demo_clean`. If the Repl already has a `DATABASE_URL` (Replit's own database), replace it.
   - `SESSION_SECRET` = any long random string.
3. **Object Storage** (Tools > Object Storage): create a bucket. Needed for opening CVs and photos.
4. **Do not run `npm run db:push`.** The schema is already in the demo database.
5. Press Run, open the webview and log in with Replit. If your Replit email matches the seed's
   admin email you land as super admin. If you land as a candidate, run in the Shell:
   `npx tsx scripts/demo/promoteAdmin.ts <your-login-email>` then refresh.
6. Attach the CVs (Shell): `npx tsx scripts/demo/seedDemoCvs.ts --upload`

## Resetting before a demo

`npx tsx scripts/demo/seedCleanDemo.ts --reset` (Shell, or locally with the demo `DATABASE_URL`)
wipes and re-seeds in about a minute. Dates are relative to the day you run it, so the standards
review dates, expiring training and planned assessments stay realistic. Re-run `seedDemoCvs.ts
--upload` afterwards, because a reset also removes the CV links.

## Things to know

- Reports are slow-ish against a remote database (a few seconds). The browser caches pages once
  loaded, so open the reports you plan to show beforehand and do not hard-refresh them.
- Learning content and SCORM packages are not seeded (they need uploaded files).
- All demo email addresses use `example.com`.

## Performance reviews and the Talent Score (added with migration 0042)

The performance feature adds 11 new tables (0042), and 0043 adds per-person due dates and the "report shared" marker. A demo database built before them needs both migrations, then the demo data:

1. `npx tsx scripts/demo/applyMigration.ts migrations/0042_performance_360.sql performance_cycles`
2. `npx tsx scripts/demo/applyMigration.ts migrations/0043_performance_dates.sql appraisals.self_review_due_date`
3. `npx tsx scripts/demo/seedPerformanceDemo.ts` (add `--reset` to rebuild only the performance data)

A database that already has 0042 only needs step 2. Both steps are safe to run twice.

For a live demo: sign in as a manager (impersonate one), open Team Performance, choose **Start an appraisal**, pick someone from the list of direct reports in the open 2027 cycle and set their dates. The 2026 cycle already has reviews at every stage; **My Performance** shows the To do list and the 30-day reminder dates.

`seedCleanDemo.ts --reset` empties every table, performance data included, so re-run step 3 after it (steps 1 and 2 are only needed once).

Daily reminder emails need email configured (`EMAIL_SERVICE` and its credentials). Without it the same reminders are recorded as "skipped" and still appear in each person's To do list.

## Duty to operate, Vantage numbers and the audit log (migrations 0044 and 0045)

0044 adds the minimum-staffing tables, an "offshore installation" flag on locations and a Vantage number on people. 0045 adds the audit log. A demo database built before them needs both, then the staffing demo data:

1. `npx tsx scripts/demo/applyMigration.ts migrations/0044_staffing_vantage.sql users.vantage_number`
2. `npx tsx scripts/demo/applyMigration.ts migrations/0045_audit_events.sql audit_events`
3. `npx tsx scripts/demo/seedStaffingDemo.ts` (add `--reset` to rebuild only the staffing data; run after `seedCleanDemo.ts`)

Both migrations are safe to run twice. The staffing seed gives Northfield Terminal a mix of met, at-risk and short requirements (including emergency response team numbers and a responsible electrical person) with reviews waiting for a decision, so **Duty to Operate** has something to show. To show Vantage numbers, tick **Offshore installation** on a location in Organisation Structure; people based there are then asked for a number and flagged on User Management until they have one.

The audit log (Admin Area, **Audit Log**) starts empty and fills as people make changes, so a demo needs a few changes made first. It cannot be edited or cleared from the application.

## Archived people and retention (migration 0046)

Adds the retention rule and the hold/removal fields. Apply it the same way: `npx tsx scripts/demo/applyMigration.ts migrations/0046_leaver_retention.sql retention_settings` (safe to run twice). Admin Area, **Archived People** then shows everyone archived with the date their personal details will be removed, with Restore, Keep (hold) and Remove now. Automatic removal is OFF until an administrator turns it on there, and removal cannot be undone. Competence and training history is kept under "Former employee". People who have left (leaving date passed) can no longer use the system even if their login still works.

## E-learning certificates (migration 0047)

Adds the certificate tables, the organisation setting and a per-training override. Apply both: `npx tsx scripts/demo/applyMigration.ts migrations/0047_elearning_certificates.sql certificate_settings` and `npx tsx scripts/demo/applyMigration.ts migrations/0048_certificate_branding.sql certificate_settings.logo_data` (each safe to run twice). The Settings tab sets the logo, heading, colour, signatory and the automatic or manual switch, with a sample certificate to preview. Admin Area, **E-learning Certificates** has the approval queue, every certificate, a per-course setting and the automatic or manual switch (default: automatic). A certificate is created when someone finishes all the e-learning for a training; learners see it on My Training with a green tick and can print it. **Create for earlier completions** makes certificates for completions that happened before this was installed (using the current mode).

## Email notifications (migration 0049)

Replaces the old Email Notifications screen. Apply it the same way: `npx tsx scripts/demo/applyMigration.ts migrations/0049_notification_rules.sql notification_rules` (safe to run twice). Admin Area, **Email Notifications** lists every email the system sends (about 26) by area. Each can be switched off, sent to more people (roles, named people, the person's manager), bundled into a daily or weekly digest, reworded with placeholders, previewed and tested. The **Email log** records every email, including ones that could not be sent, and can resend any of them. The competence expiry reminders are new and start switched off.

The demo has no email set up, so everything shows as "Not sent". That is the honest state, and the log still shows exactly what would have gone out. To send real email, see the "Turning on email" section in DEMO_SETUP.md.

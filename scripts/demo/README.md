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
| `seedPerformanceDemo.ts` | Adds career history, qualifications, a completed 2025 review (objectives, behaviours, 360 feedback) and an open 2026 cycle. Run after `seedCleanDemo.ts`. |
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

The performance feature adds 11 new tables, so a demo database built before it needs the migration, then the demo data:

1. `npx tsx scripts/demo/applyMigration.ts migrations/0042_performance_360.sql performance_cycles`
2. `npx tsx scripts/demo/seedPerformanceDemo.ts` (add `--reset` to rebuild only the performance data)

`seedCleanDemo.ts --reset` empties every table, performance data included, so re-run step 2 after it (step 1 is only needed once).

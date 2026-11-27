# Security tests

Tests that prove the protections recorded in `security/asvs/` still hold. A change is not finished until these pass (see `security/ASVS_LEVEL2.md`).

| File | What it checks | Needs |
|---|---|---|
| `helpers.unit.ts` | escaping, spreadsheet-formula safety, link checking, upload type and content checks, safe download headers | nothing |
| `auth.unit.ts` | the sign-in gate on every `/api` route, session idle and absolute limits, leaver block, account end dates, linking a first sign-in by email, role claims ignored | a database (`DATABASE_URL`, a **demo or throwaway copy**) |
| `api.e2e.cjs` | cross-site refusal, who may open a CV / assessment / feedback / evidence, upload refusals, separation of duties, seat limits, booking and user field limits, print view, link limits, request limits | a running demo server on port 5056 with `LOCAL_DEV_AUTH=true NODE_ENV=development`, and the demo database in `DATABASE_URL` |

| `reports.unit.ts`, `layouts.unit.ts`, `schedule.unit.ts` | the report engine, the hand-made report layouts, the schedule maths, the pass a scheduled report reads with, the email | nothing |
| `content.unit.ts` | learning packages from a separate address: the address setting, the signed link, the runtime script given to a package, the handler that answers on that address and nothing else | nothing |
| `scope.e2e.cjs` | managers (and assessors) see only their own people in reports, lists, exports and the 360 picker; administrators see everyone | a running demo server and the demo database |
| `round3.e2e.cjs` | every appraisal route refused to outsiders; administrators opening appraisals logged; refused (403) requests logged once per person and route a minute; external verifier views logged and ended by an allocation's end date; the end date on an external verifier's account. With `CONTENT_E2E=1` and the server started with `CONTENT_ORIGIN=http://127.0.0.1:5056`, also the separate content address | a running demo server (fresh start: rate limits) and the demo database |
| `visitors.e2e.cjs` | site visitor forms: settings, who can reach a form (other companies get "not found"), certificate checks, notice period, accept and send back, nothing personal in the audit log or exports, removal after the visit. Needs `LOCAL_OBJECT_STORAGE_DIR` (an empty scratch folder) set for **both** the server and the test, and `SESSION_SECRET=test` | a running demo server (fresh start: rate limits) and the demo database |
| `evaluations.unit.ts` | training evaluations: the four forms, what is accepted from a browser, which form a course uses, how a course is rated and why, results held back when too few replied without names | nothing |
| `evaluations.e2e.cjs` | training evaluations: requests made from bookings, e-learning and records (once each), who can reach a form, the promise about names, what viewers and managers can see, safety concerns, reminders (with a pretend mail sender, `runEvaluationReminders.ts`), exports, the audit log, leavers. Needs `SESSION_SECRET=test` and **email not set up** | a running demo server (fresh start: rate limits) and the demo database |
| `myrecords.e2e.cjs` | Evidence Portal and My Profile: only your own records, what is saved with evidence and who sees it, no adding to a signed-off or someone else's assessment, nothing secret sent, not exported. Needs `LOCAL_OBJECT_STORAGE_DIR` for **both** the server and the test | a running demo server (fresh start: rate limits) and the demo database |
| `evidenceReuse.e2e.cjs` | one candidate's evidence reused across their assessments and **never** another's: every way across is tried (the picker, uploads of the same file, old routes, result recording, moving an assessment, the database itself), and who may attach or remove. Needs `LOCAL_OBJECT_STORAGE_DIR` for **both** the server and the test, and migration 0060 | a running demo server (fresh start: rate limits) and the demo database |

Run:

```
npm run test:security:nodb        # every unit test that needs no database (this is what the pipeline runs)
npm run test:security:db          # the sign-in test, which needs DATABASE_URL (a throwaway database)
npm run test:security             # both
node tests/security/api.e2e.cjs   # with the demo server running
node scripts/security/typeErrorRatchet.cjs   # fails if a change adds a type error (the older ones are recorded in security/type-error-baseline.json)
```

The end-to-end tests are run by hand for now. Start a **fresh** server for each (`LOCAL_DEV_AUTH=true NODE_ENV=development SESSION_SECRET=test`), because the rate limits remember earlier runs.

`api.e2e.cjs` creates a few rows (a course session, bookings, an evidence row) and removes them when it finishes. Never point it at a real company's data.

## Added 26 November 2026

| Test | Needs | Covers |
|---|---|---|
| `competence.unit.ts` | nothing | the one rule for competence status and expiry |
| `platform.unit.ts` | nothing | single sign-on rules, filesystem and Azure Blob storage (stand-in), AI switches and the report privacy safeguards |
| `reviewfixes.e2e.cjs` | server on 5056 with `ENABLE_DEMO_TOOLS=true`; upgrades 0061+ | expiry on every screen, verification follow-up, assessor allocation, separation of duties, record access, Element 3 scope. Run again with `STRICT=1` against a server without demo tools. |
| `capabilities.e2e.cjs` | as above, plus `LOCAL_OBJECT_STORAGE_DIR` and upgrade 0062 | standard versions and change control, audit evidence repository, append-only audit log, booking approvals, attendance and expiry |
| `integration.e2e.cjs` | as above | integration keys and /api/v1, HR feed, skills gap, sampling methods, standardisation, import trial run, per-person download |
| `migration.e2e.cjs` | server on 5056 with `ENABLE_DEMO_TOOLS=true` and `LOCAL_OBJECT_STORAGE_DIR` | moving from a previous system: the bulk evidence loader (trial run, one person per file, fingerprints, signed-off records protected, safe to run twice) and the reconciliation report (what passes, what is explained, what fails) |
| `hosting.e2e.mjs` | `npm run build`, and `DATABASE_URL` set to an EMPTY database upgraded with `scripts/db/migrate.mjs` | a company installation: production build, standard sign-in provider (stand-in), files on disk, nothing from Replit |

The tests that tidy up their own audit entries switch the append-only trigger off for that one statement and on again.

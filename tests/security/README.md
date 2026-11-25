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

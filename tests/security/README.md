# Security tests

Tests that prove the protections recorded in `security/asvs/` still hold. A change is not finished until these pass (see `security/ASVS_LEVEL2.md`).

| File | What it checks | Needs |
|---|---|---|
| `helpers.unit.ts` | escaping, spreadsheet-formula safety, link checking, upload type and content checks, safe download headers | nothing |
| `auth.unit.ts` | the sign-in gate on every `/api` route, session idle and absolute limits, leaver block, linking a first sign-in by email, role claims ignored | a database (`DATABASE_URL`, a **demo or throwaway copy**) |
| `api.e2e.cjs` | cross-site refusal, who may open a CV / assessment / feedback / evidence, upload refusals, separation of duties, seat limits, booking and user field limits, print view, link limits, request limits | a running demo server on port 5056 with `LOCAL_DEV_AUTH=true NODE_ENV=development`, and the demo database in `DATABASE_URL` |

Run:

```
npm run test:security          # the two unit tests
node tests/security/api.e2e.cjs   # with the demo server running
```

`api.e2e.cjs` creates a few rows (a course session, bookings, an evidence row) and removes them when it finishes. Never point it at a real company's data.

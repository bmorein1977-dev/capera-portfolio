# Capera - current state, gaps, and roadmap

Snapshot dated **2026-10-04**. It is evidence to start from, not truth to rely on: re-verify the
items that matter to the question (commands at the bottom) and update this file when they change.

## Contents
- What exists today
- Strengths to build on
- Gaps, ranked
- Customer-specific coupling to remove
- Incidents and the lessons they encode
- Roadmap: Now / Next / Later
- Refresh commands

## What exists today

**Stack.** React + TypeScript + Vite + Tailwind/shadcn client; Express + TypeScript server;
Drizzle ORM over PostgreSQL (Neon serverless driver when `DATABASE_URL` contains `neon.tech`,
node-postgres otherwise; a `pgmem://local` option exists for local dev). One shared codebase;
`shared/schema.ts` is the single schema source.

**Single-customer by construction.**
- `shared/schema.ts` contains no tenant/organisation, licence, entitlement, or feature-flag concept
  (grep count was 0 on the snapshot date).
- `server/db.ts` exports one global `db`; `DbStorage` is constructed once in `server/index.ts`; the
  very large `storage.ts` and `routes.ts` use it directly. That single seam is the opportunity: a
  request-scoped tenant database can be introduced behind the existing `db` import without
  rewriting every query (see tenancy file).
- Process-global configuration via environment variables: `DATABASE_URL`, `SESSION_SECRET`,
  `REPL_ID`, `ISSUER_URL`, `REPLIT_DOMAINS`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, SMTP/Resend/
  SendGrid settings. All of these are one-company-wide today.

**Auth.** Replit OIDC (`server/replitAuth.ts`) with a `LOCAL_DEV_AUTH` bypass; sessions stored in
Postgres; eight roles plus additional-role grants; an in-app impersonation feature
(`session.impersonatedUserId`). Enterprise customers' employees will not have Replit accounts -
there is no per-company SSO. Verify whether impersonation is audit-logged.

**Files.** Replit Object Storage (avatars, CVs, SCORM packages, training content, OPITO
documents, certificates). It is unreachable outside Replit (a local upload test failed with
"fetch failed" - confirmed on the pre-existing avatar route too), and keys carry no tenant prefix.

**Background work.** In-process `setInterval` (competence-standard review notifier, every 24h, with
a notification_logs dedup check). No job queue. `.replit` declares an **autoscale** deployment, so
several instances can run the same scheduler; the dedup is check-then-insert and therefore racy
across instances.

**Email / AI.** Email service is wired but not configured in the observed environments, so
notifications are logged as skipped. AI features call Anthropic (SME wizard, standards review,
translation) and OpenAI (theming) with global keys; an expired Anthropic key once broke the SME
wizard in production use. No per-company metering or per-company AI switch.

**Migrations.** 42 generated SQL files in `/migrations` (0000-0041) plus a stray `db/migrations`
folder (confirm which is authoritative). Applied locally by one-off scripts and on Replit by
`npm run db:push` (interactive `drizzle-kit push`). Consequence: the target database's
`__drizzle_migrations` ledger is probably empty, so adopting `migrate` needs a baseline step.

**Delivery.** Manual: verify locally (`tsc --noEmit` against a baseline of 75 pre-existing errors;
`vite build`), push to GitHub, then on Replit `git fetch github && git merge github/main`,
`npm run db:push`, Stop/Run. `.replit` also defines a production deployment (`npm run build` /
`npm run start`, autoscale) - confirm whether one is published, which database it uses, and that
the dev workspace never points at it. **No CI, no Dockerfile, no automated tests, no IaC.**

**Supply chain.** `npm install` reports dozens of advisories (36 on the snapshot date). Replit's
package firewall blocked `fast-xml-parser@5.2.5` (critical CVE, pinned by a transitive dependency);
fixed with an npm `overrides` entry.

## Customer context (as told by the founder, 2026-10-04; confirm details with the customer)

- Likely first licensee: Centrica (Energy Storage populated the existing real data). The founder
  reports Centrica uses Azure/Microsoft platforms - a strong hosting signal (see the Azure section
  of the hosting file) but not yet a confirmed requirement. Open questions for them: vendor-hosted
  vs their own subscription, region/residency, Entra ID SSO/SCIM, supplier security assessment,
  acceptability of external AI providers.
- Real personal data from that customer currently lives on the prototype stack (Replit + Neon).
  Confirm region, access, and data-processing terms before it becomes a licensed live service.
- Prospects will want demos in their own matrix/standards formats - served by branch-cloned demo
  tenants (tenancy file), never by touching the live customer's data.

## Strengths to build on

- A clean-ish storage seam (one `DbStorage`, one `db`) - makes tenant-scoped data access tractable.
- Good data-hygiene habits already in the model: soft delete/archival (`isActive`, `isArchived`,
  `leftAt`), append-only histories (`assessmentExpiryHistory`, `competencyElementReviewHistory`,
  `notification_logs`), Zod validation at API boundaries.
- A proven preview-then-apply pattern for bulk changes (training matrix import, lifecycle import)
  - the same pattern is the right model for tenant data onboarding.
- Migration SQL is already generated and committed; schema history exists.
- Rich, sellable feature surface, and `replit.md` documents intent.

## Gaps, ranked

**P0 - blocks selling to a second company safely**

| # | Gap | Why it matters | Effort |
|---|---|---|---|
| 1 | No tenancy | Two companies cannot safely share a deployment; today "second customer" means a second full copy | L |
| 2 | Replit-account auth, no per-company SSO | Enterprise buyers require their own IdP (Entra ID/Okta), usually with SCIM; also the highest-friction item in security reviews | L |
| 3 | Production upgrades = interactive `db:push` from a workspace | One wrong prompt orphans data; an autonomous agent can alter the tree being deployed | M |
| 4 | No evidence of tested backup/restore | "Historical data must never be lost" is unprovable without a rehearsed restore, RPO and RTO | S-M |
| 5 | Files on a proprietary store, no tenant prefix | Lock-in plus a cross-tenant leak path once two companies share a bucket | M |

**P1 - needed to operate more than one customer calmly**

No CI/tests (nothing proves a release is safe); no entitlements/flags (cannot sell modules or ship
dark); customer-specific config in code (below); in-process scheduler vs autoscale; env-global AI
and email config; type debt (75 baseline errors) hides real defects; migration baseline/ledger
missing; impersonation audit trail unverified.

**P2 - needed to scale and to pass audits**

Per-tenant observability and cost metering; white-label theming; SCIM; certifications (Cyber
Essentials Plus -> ISO 27001 -> SOC 2); pooled low-cost tier; control-plane UI.

## Customer-specific coupling to remove (verify each)

The product grew around one real customer (Centrica Energy Storage). Anything below should become
*data* in a versioned "vertical pack" or tenant config rather than code, so company #2 does not
inherit company #1's shape:

- `server/services/disciplineLocationConfig.ts` - training-matrix sheet -> site/discipline mapping.
- The Workday "Leavers/Movers and Starters" import - make it one connector among several.
- OPITO certification area and category list; EI PSM KPI reports (industry/regulator specific).
- Demo/seed data (`localDevSeed.ts`) and brand assets; terminology and default role catalogues.

## Incidents and the lessons they encode

| What happened | Lesson |
|---|---|
| Replit's autonomous Agent committed an unrequested Clerk auth migration to the Repl's `main` and later edited `server/index.ts` outside Git history; it caused a merge conflict and strange behaviour until reverted | The Git remote must be the only source of truth; production deploys come from tagged commits built by automation; restrict or disable the agent on any Repl that holds production |
| `drizzle-kit push` prompted "created or renamed?" for a table rename | Interactive tooling must never decide data fate in production; renames are explicit reviewed SQL |
| An expired API key silently broke a feature | Secrets need expiry monitoring and a health check per integration; per-tenant keys multiply this risk |
| Storage upload untestable locally | Hide platform services behind interfaces with a local/test implementation |
| Several "bugs" were stale caches or environment artefacts, not code | Per-tenant smoke tests and request logging with tenant id make "is it the code or the environment?" a 30-second question |

## Roadmap

**Now (weeks 0-4): make today's single customer safe and the next step cheap**
1. Separate production from development: production = published deployment from a tagged commit
   with its own database; the dev workspace never holds production credentials.
2. Contain autonomy: GitHub branch protection on `main`; restrict/disable the Replit Agent for
   this Repl; record "do not touch auth, server startup, migrations" in `replit.md`.
3. Backups: confirm the Neon history/PITR window; add a nightly logical dump to an independent
   store; perform one full restore rehearsal into a branch; write down RPO/RTO.
4. Replace production `db:push` with reviewed `migrate`: baseline existing migrations, add a
   snapshot-before-migrate step and a migration linter (rules in the schema file).
5. Add the first control-plane primitives cheaply: `entitlements` and `feature_flags` tables with
   `requireEntitlement()` / `isEnabled()` helpers; gate the newest modules (SCORM, Talent
   Catalog, AI authoring) behind them. Forward-compatible with multi-tenancy.
6. A smoke-test script (login -> key pages -> key APIs) runnable against any base URL.

**Next (months 1-3): be able to host company #2**
7. CI on GitHub Actions: tsc-no-new-errors gate against the baseline, build, migration lint,
   smoke test against an ephemeral database branch, container image tagged by commit SHA.
8. Tenant context: AsyncLocalStorage + a tenant-resolving `db`; tenant registry in a control DB;
   host -> tenant resolution; per-tenant object-store prefix; scheduler iterates tenants under a
   Postgres advisory lock; per-tenant sessions and email/AI settings.
9. One-command provisioning (create DB -> migrate -> seed pack -> admin -> register -> smoke) and
   a demo tenant cloned from a golden dataset, reset nightly.
10. Move customer-specific config into versioned packs.
11. Auth decision (ADR) and per-company OIDC/SAML SSO.

**Later (months 3-9): scale and certify**
12. Hosting decision and migration to containers on a managed platform in a customer-acceptable
    region (see hosting file); ring-based rollouts and per-tenant upgrade windows.
13. Control-plane UI (licences, flags, versions, health); usage metering and billing.
14. Cyber Essentials Plus, then ISO 27001/SOC 2; SCIM; optional pooled tier for small customers.

## Refresh commands

```bash
grep -rniE "tenant|organisation|licen|entitlement|feature" shared/schema.ts | head
grep -rn "process.env" server/ | grep -v node_modules
cat package.json | grep -nE "db:|migrate|\"(dev|build|start)\""
cat drizzle.config.ts; ls migrations | tail -3; ls db 2>/dev/null
cat .replit; ls .github Dockerfile* 2>/dev/null
git log --oneline -15; git status --short
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

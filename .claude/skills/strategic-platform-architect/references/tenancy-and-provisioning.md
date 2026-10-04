# Tenancy, isolation, and onboarding new companies

## Contents
- The four tenancy models
- Recommendation and when to revisit it
- Implementation blueprint for Capera
- Proving isolation
- Provisioning pipeline (company #2 in hours)
- Vertical packs: configuration as data
- Importing a new company's existing data
- Demo and sandbox tenants
- Offboarding

## The four tenancy models

| Model | What it is | Isolation | Upgrade independence | Ops load | Cost per tenant | Code change |
|---|---|---|---|---|---|---|
| **Silo** | App + DB per customer | Strongest | Total (also a trap: drift) | High - N things to run | Highest | None |
| **Bridge** *(recommended)* | Shared stateless app, **DB per tenant** | Strong (separate DB, creds, backups) | Per-tenant schema timing; one code build | Low-medium; one fleet + one orchestrator | Medium (DBs can scale to zero) | Moderate - tenant-aware data access |
| **Pool** | Shared app, shared DB, `tenant_id` column + row-level security | Logical only; a missed filter = breach | None - everyone moves together | Lowest | Lowest | Large - every table and query |
| **Hybrid** | Bridge for enterprise, Pool for small | As above, per tier | Per tier | Two models to run | Tuned | Both |

Criteria that decide it for this product: records are audit evidence in safety-critical
industries; customers will ask about residency, per-customer restore, and exit; customers are
few and high-value (so per-tenant cost is affordable); and one operator must run it all.

## Recommendation and when to revisit it

Adopt **Bridge**. Revisit toward a **Hybrid** pooled tier only when *both* hold: (a) there is a
real segment of small customers whose price cannot cover a database each, and (b) there are
enough of them (tens, not a handful) that per-tenant provisioning cost or limits bite. Verify
current database-per-tenant limits and pricing on the chosen provider before committing - they
change. Pooling later is cheaper than un-pooling, and Bridge's code changes (tenant context,
resolver) are a prerequisite for either.

Do not build Silo-per-customer "just for now". It is a one-way door: each hand-built instance is
a snowflake you will have to unpick.

## Implementation blueprint for Capera

The existing seam makes this a contained refactor, not a rewrite.

1. **Tenant context.** Resolve tenant from the request host (and later a custom domain) in an
   early middleware; store it in Node's `AsyncLocalStorage` for the life of the request.
2. **Tenant-aware `db`.** Keep `import { db } from "./db"` working, but make `db` a thin proxy
   that reads the current tenant from the async context and returns that tenant's Drizzle
   instance from a bounded cache of connection pools (LRU, hard cap on total connections). Result:
   `storage.ts` and `routes.ts` need almost no edits. Outside a request (jobs, scripts) the proxy
   must *refuse* to run without an explicit tenant - failing closed prevents silent cross-tenant
   work.
3. **Control plane.** A small separate database (or schema) holding the tenant registry:
   `tenants(id, slug, display_name, status, db_connection_ref, region, ring, schema_version,
   created_at)`, `tenant_domains`, plus entitlements/flags (see licensing file). Store connection
   strings encrypted or as secret-manager references, never as plain rows.
4. **Sessions and auth.** Sessions live in the tenant DB (or are keyed by tenant). Auth config
   (OIDC/SAML client, issuer, allowed domains) is per tenant, loaded from the registry.
5. **Files.** Put all object keys under `tenants/{tenantId}/...`; wrap storage behind an interface
   (`put/get/delete/signedUrl`) with a local-disk implementation for tests and dev.
6. **Background jobs.** The scheduler iterates active tenants and takes a Postgres advisory lock
   per job/tenant so autoscaled replicas cannot double-run (the current notifier would).
7. **Per-tenant integrations.** Email sender/branding, AI on/off and key (platform key with
   metering by default; optional customer-supplied key), SSO, logo/colours, terminology.
8. **Observability.** Every log line, error, and metric carries `tenant_id` and app version.
9. **Cold starts.** Scale-to-zero databases add latency to the first query after idle; keep active
   tenants warm (cheap periodic ping) or accept it for low-use tenants. Measure before tuning.

Effort: roughly M-L for a solo founder, best done after backups/migrate hygiene and CI exist.

## Proving isolation

Isolation that is not tested is a hope. Add an automated cross-tenant test that runs in CI:
provision two throwaway tenants, create records in each, then assert that (a) tenant A's session
cannot read or modify tenant B's records by guessing IDs on every route family, (b) a request with
a forged/missing host fails closed, (c) files from B are unreachable from A, (d) a job run for A
touches nothing in B. Treat a failure as a release blocker.

## Provisioning pipeline - a new company in hours

Make it one idempotent, resumable command (later a button in the control plane). Each step records
its result so a failure resumes instead of restarting.

1. Create the tenant record (`status = provisioning`) and reserve the slug/domain.
2. Create the database (and its backup/retention settings) and store the credential reference.
3. Run all migrations to the current schema version; record `schema_version`.
4. Apply the **vertical pack** and base reference data (idempotently, by stable keys).
5. Create the first admin and send the invite; configure SSO if provided.
6. Apply branding (logo, colours, name) and email sender identity.
7. Run the tenant smoke test.
8. Set `status = active`; write an audit event; assign the upgrade ring.

Target: under 15 minutes unattended; the remaining time is human (contract, SSO details, data
import). Use `assets/tenant-onboarding-checklist.md` for the full human + automated list.

## Vertical packs: configuration as data

Companies differ in *content*, not in code or schema. Package that content as versioned,
declarative packs applied at provisioning and re-applicable on upgrade:

- Competence frameworks and standards, role catalogues, training matrix templates.
- KPI definitions and regulator-specific reports (e.g. an energy/offshore pack).
- Terminology, default roles and permissions, notification templates, import mappings.

Rules: packs address records by **stable keys** (codes/slugs), never generated IDs, so applying a
pack twice is safe; a pack upgrade never overwrites a tenant's own edits (merge with ownership
flags: `source = pack | tenant`); and every pack version is recorded per tenant. Today's
Centrica-shaped config (site/discipline mapping, OPITO categories, EI PSM KPIs) is the seed of
the first pack.

## Importing a new company's existing data

Reuse the preview-then-apply pattern already built for the training matrix and lifecycle imports.
For each source (training matrix, competence documents, historical achievements, user list):
dry-run into a database *branch* of the new tenant, produce a reconciliation report (counts,
unmatched rows, duplicates, warnings), have the customer sign it off, then apply to the real
tenant database. Keep the original files as evidence. Never import straight into a live tenant on
the first attempt.

## Demo and sandbox tenants

A "golden demo" dataset (synthetic people, realistic matrices) lives as a maintained database.
Each prospect demo is a **branch/clone** of it with the prospect's logo and, optionally, their
own matrix format imported on top; it auto-expires and can be reset in minutes. This lets the
founder customise per prospect without ever touching a live customer's data. Never put real
personal data in a demo tenant.

## Offboarding

A defined, boring process: suspend access -> deliver a complete export in documented formats ->
hold for the contractual retention window -> delete the database and files -> issue a deletion
certificate. Backups age out on their normal schedule; record when. Offboarding is also a sales
asset: customers trust a vendor who makes leaving easy.

# Hosting, and the path off a prototype platform

## Contents
- What the hosting decision must satisfy
- Options compared
- Netlify, Supabase and similar: why they don't fit Capera (and what they're good for)
- First-licensee context: an Azure-centric enterprise customer
- Indicative costs (dated)
- Recommendation
- Make the app portable first (do this on Replit, before moving)
- Containerisation checklist
- Triggers that mean "time to move"
- Zero-data-loss cutover plan
- Region, residency, and sub-processors (including AI)
- Identity and SSO hosting concerns

## What the hosting decision must satisfy

Not "which is cheapest" but: can it keep the five promises for enterprise buyers? Concretely:
data residency (UK/EU region choice), private networking and IP controls, SSO/SCIM, audit
logging, an SLA you can resell, infrastructure-as-code (so environments are reproducible), secrets
management, and independence from any single autonomous tool that can edit production.
A prototype platform is superb for building and for early pilots; enterprise procurement
questionnaires tend to ask for things it was not designed to give.

## Options compared

| Option | Strengths | Weaknesses | Fits when |
|---|---|---|---|
| **Stay on Replit** (autoscale deployment) | Fastest iteration; zero infrastructure work; already running | Limited network/residency controls; no IaC; platform-specific services (Object Storage, REPL_ID auth); autonomous-agent edits to the deployed tree have occurred; harder to evidence for security reviews | Prototype and first pilot customer, *with* the safeguards in the roadmap |
| **Managed container platform** (Azure Container Apps, AWS ECS Fargate/App Runner, Google Cloud Run) | Real SLAs, regions, private networking, IaC, scale to demand, no cluster to run | You own the Dockerfile, CI, secrets, and observability setup | **Recommended destination** for a solo operator selling to enterprises |
| **PaaS** (Render, Fly.io, Railway) | Simpler than hyperscalers; good DX | Fewer enterprise controls/certifications; region and compliance story varies | A stepping stone or SMB tier |
| **Netlify** (static + serverless functions) | Excellent for front-end/marketing sites; easy previews | Short-lived functions with tight time and request-size limits; not a home for a long-running Express server, in-process scheduler, 200MB SCORM uploads, or long imports | The marketing site or a purely static client - not the Capera application tier |
| **Supabase** (Postgres + auth + storage + edge functions) | Convenient backend-in-a-box; S3-compatible storage; London region (verify) | Does not host a long-running Node/Express server (its functions are short-lived, a different runtime); branches are not instant copy-on-write clones of live data (verify) which weakens "rehearse every upgrade on a copy"; a project per tenant has per-project cost (verify) | Could supply database, files or login *components*, but you still need an app host; adopting its auth/storage APIs adds lock-in |
| **Azure** (Container Apps + Postgres Flexible Server + Blob + Entra ID + Key Vault, UK South) | Same cloud as an Azure-centric enterprise buyer; UK residency; native Entra SSO; private networking, audit, IaC | You own Dockerfile, CI and the provisioning automation | **Recommended destination** when the first licensee is Azure-centric |
| **Kubernetes** | Maximum flexibility | Large permanent ops burden | Not justified for this team; revisit only with a platform engineer |
| **Customer-hosted / on-prem** | Some regulated buyers insist | Support and upgrade burden multiplies; every install is a snowflake | Only as a priced, deliberately limited option, using signed licence tokens and the same container image |

For data: keep a managed Postgres. Neon is a good fit for database-per-tenant (branching for
rehearsal, per-project isolation, scale-to-zero) - verify its current region availability
(especially UK/EU), retention/PITR limits, per-account project limits, and pricing before
committing. Alternatives with stronger enterprise posture: Azure Database for PostgreSQL
(Flexible Server) or AWS RDS/Aurora, which then need their own provisioning automation and a
different rehearsal story (snapshots/restores instead of instant branches).

## Netlify, Supabase and similar: why they don't fit Capera (and what they're good for)

Judge a platform by the *shape of the workload*, not its popularity. Capera is a stateful,
long-running server: the competence-standard scheduler runs inside the process, SCORM packages up
to 200MB are received into memory and unzipped server-side, bulk imports (training matrix,
lifecycle, historical) run as long requests, and sessions live in Postgres.

- **Netlify** is built for static front ends plus short serverless functions. Fitting Capera would
  mean rewriting uploads to go direct-to-storage, turning imports into background jobs, and
  replacing the scheduler - a re-platforming project that buys no enterprise capability. Good home
  for a marketing site or documentation; not for the application tier. Verify current function
  time and payload limits before relying on this reasoning.
- **Supabase** bundles Postgres, auth, storage and short-lived edge functions. It does not run an
  Express server, so it cannot be the app host. As a *component* it could replace the database,
  object store or login, but weigh: (1) branching and preview environments there are not the
  instant data-cloning copies that make Neon excellent for rehearsing upgrades on production-shaped
  data (verify current behaviour); (2) database-per-tenant means project-per-tenant with real
  per-project cost and limits (verify); (3) using its auth/storage APIs creates lock-in you then
  have to unwind for an Azure-hosted customer. Net: reasonable for a prototype or small-customer
  tier, not the enterprise path.
- **General rule:** BaaS and serverless platforms accelerate apps designed for them. Moving a
  working server app onto them trades a known problem (hosting) for an unknown one (re-architecture)
  at the exact moment the founder most needs engineering time for tenancy, SSO and safe upgrades.

## First-licensee context: an Azure-centric enterprise customer

If the first licensee (e.g. Centrica) runs on Azure/Microsoft, treat that as a strong signal, not
yet a requirement, and confirm it. What Azure buys: same cloud as the customer's own estate (easier
third-party security review); UK South/UK West regions for residency; Microsoft Entra ID for SSO
(they already run it) with SCIM later; Key Vault, private networking, audit logging, Front Door/WAF,
Monitor; reproducible environments via Bicep/Terraform; and, later, optional Azure Marketplace
listing for procurement convenience.

**Questions to put to the customer (these decide the design):**
1. Vendor-hosted in the vendor's Azure subscription, or deployed into the customer's own
   subscription (changes packaging: the same container image, deployed via their landing zone)?
2. Required region(s) and residency rules for data, backups and support access.
3. SSO must be Entra ID? Do they want automatic user provisioning (SCIM) and group-based roles?
4. Their supplier/third-party security assessment: process, evidence required, timeline.
5. Are external AI providers acceptable as sub-processors, or must AI processing stay inside their
   trust boundary (an Azure-hosted model offering may be possible - verify current model
   availability, region and data terms)?

**Design choices inside Azure:**
- App tier: one container (Express serving the built client + API) on Azure Container Apps, or App
  Service for Containers if the team prefers; min/max replicas; scheduler under advisory locks.
- Database: Azure Database for PostgreSQL Flexible Server in UK South. For database-per-tenant,
  either one server per customer (strongest isolation, higher cost - appropriate for a first
  enterprise licensee) or separate databases with separate roles on a shared server (cheaper,
  weaker blast-radius separation - acceptable for smaller tiers). Rehearse upgrades by restoring
  to a new server (slower than an instant branch but proven). Neon's Azure regions are deprecated for
  new projects (checked 2026-10-04), so Neon would mean its AWS London region: cross-cloud from an
  Azure-hosted app and an extra sub-processor. Acceptable only if the customer agrees; default to
  Azure Database for PostgreSQL.
- Files: Azure Blob Storage behind the storage interface, tenant-prefixed, private access only.
- Identity: Entra ID app registration per tenant behind the identity adapter.
- Secrets in Key Vault with managed identity (no keys in env files); IaC for everything.

**Data-location check (do early):** real staff data from the first customer may already sit on the
prototype stack (Replit + Neon). Confirm the region it is stored in, who can access it, and that
an appropriate data-processing agreement covers it *before* it becomes a licensed live service.
Raise this matter-of-factly - it is a normal diligence item, not an accusation.

## Indicative costs (researched 2026-10-04 - prices move; re-verify before deciding)

Treat hosting as a small line item next to people time, certification, support and AI usage; the
decision should turn on fit and risk, not on a few tens of pounds a month.

**Verified from vendor pages/APIs on the date above**

| Item | Price found |
|---|---|
| Azure PostgreSQL Flexible Server, UK South, Burstable | B1ms £0.0143/hr (~£10/mo); B2s £0.0574/hr (~£42/mo) compute only; storage and backup extra |
| Azure Container Apps, UK South | Requests £0.3019 per million; **dedicated** plan vCPU £0.061/hr, memory £0.005/GiB-hr, plan management £0.0755/hr; free grant 180k vCPU-s, 360k GiB-s, 2M requests per subscription per month |
| Neon (USD) | Launch: $0.106/CU-hr, $0.35/GB-month, PITR up to 7 days. Scale: $0.222/CU-hr, PITR up to 30 days, 1,000 projects. Free: 100 CU-hr/project. Regions include AWS London; Azure regions deprecated for new projects |
| Supabase (USD) | Pro from $25/mo incl. $10 compute credit; each extra project adds its compute (Micro $10, Small $15, Medium $60); PITR add-on $100/mo per 7 days retention; SAML SSO 50 included then $0.015/MAU; branching $0.01344/branch-hour; Team from $599/mo |
| Netlify (USD) | Free $0, Personal $9, Pro $20, Enterprise custom (adds SSO/SCIM, 99.99% SLA). Functions (secondary source): 60s sync, 6 MB buffered payload, 15 min background, 1024 MB memory |
| Replit (USD) | Core $20 ($18 billed annually), Pro $100 ($90), Enterprise custom (SSO/SAML, single-tenant, static IPs). Deployment pricing not shown on the pricing page - check the account's actual usage bill |

**Not retrievable here - estimate or look up:** Container Apps *consumption* vCPU/memory rates
(returned only the free-grant tier; from memory the list rates are roughly $0.000024 per vCPU-second
and $0.000003 per GiB-second, i.e. ~£25-30/month for one small 0.5 vCPU / 1 GiB always-on
replica - confirm in the Azure Pricing Calculator); General Purpose PostgreSQL compute; Front
Door, Key Vault, Container Registry, Log Analytics. Budget tens of pounds a month combined for the
supporting services until priced.

**Scenario sketch (monthly, hosting only; assumes light traffic and a few GB per tenant)**

| Scenario | App tier | Databases | Supporting services | Rough total |
|---|---|---|---|---|
| 1 customer (pilot/first licensee) | 1-2 small replicas ~£25-60 | one Burstable B2s ~£42 + storage | £30-80 | **~£100-£180** |
| 5 customers, DB per tenant | shared fleet ~£50-100 | separate databases on 1-2 shared servers ~£42-85, or a server each ~£210 | £50-120 | **~£250-£500** |
| 20 customers | shared fleet ~£100-200 | mix: dedicated servers for large customers, shared for small | £100-250 | **~£600-£1,500** (a pooled small-customer tier would cut this) |

Reading the numbers: per-customer hosting is roughly £50-£150 a month, tiny against an enterprise
licence. Neon's scale-to-zero can make *small* tenants cheaper (an idle tenant costs little), while
an always-on Azure server has a floor of ~£10-£42 each; that is the main cost argument for Neon,
now weighed against it being cross-cloud for an Azure-hosted app. Supabase's per-project compute
plus a PITR add-on makes backup-per-tenant comparatively expensive. Always rebuild this table with
live prices and the real measured load before quoting it to anyone.

## Recommendation

1. **Now:** stay on Replit but harden it (production separated from dev; Git as sole truth; agent
   contained; backups proven; `migrate` not `push`) - see the roadmap in the current-state file.
2. **While onboarding company #2:** containerise, add CI, build the tenant layer. These are
   prerequisites for *any* destination, so they are never wasted.
3. **Before the first enterprise security review that demands it (or the second tenant,
   whichever comes first):** move the stateless app tier to a managed container platform in a
   region the customer accepts. Probable choice is the cloud the first enterprise customer already
   uses and trusts (large UK energy and industrial firms are frequently Microsoft/Azure-centric;
   confirm with the customer's IT rather than assume).
4. **Keep the database independent of the app host** so the app move is a deploy, not a data move.

## Make the app portable first (do this on Replit, before moving)

Introduce an interface for each platform-specific dependency, with a local/test implementation:

- **Object storage** - `put/get/delete/signedUrl` interface; local-disk and S3/Blob/Replit
  implementations; tenant-prefixed keys. (The inability to test uploads locally already cost time.)
- **Auth** - keep `req.user` shape stable; hide the IdP behind an adapter (OIDC/SAML per tenant).
- **Scheduler/jobs** - one jobs module that can later become a queue or managed scheduler; tenant
  iteration + advisory locks from day one.
- **Config** - read once at start into a typed, validated config object (fail fast on missing
  values); no scattered `process.env`.
- **Email/AI** - provider adapters with per-tenant settings and usage metering hooks.

## Containerisation checklist

Multi-stage Dockerfile (build, then slim runtime); non-root user; reproducible install from the
lockfile; `GET /healthz` (liveness) and `/readyz` (checks DB + control plane); graceful shutdown
on SIGTERM (already added) with in-flight request draining; stateless (no local file writes that
must survive); structured JSON logs to stdout with tenant id and version; all config from
environment; image scanned and signed in CI; resource limits and a sensible min/max replica count.

## Triggers that mean "time to move"

Any of: a prospect's security review requires controls the current platform cannot evidence
(residency, private networking, SSO, audit logs, contractual SLA); the second paying tenant
arrives; a production incident traceable to platform behaviour or autonomous edits; or an
uptime/latency requirement the current setup cannot guarantee. Write the trigger list into an ADR
so the decision is made calmly in advance, not in a crisis.

## Zero-data-loss cutover plan

For the database (if it moves) and for the app:

1. Stand up the new environment fully, from IaC, empty; deploy the same tagged image.
2. Replicate data: logical replication or dump/restore plus a final delta; verify with row
   counts, checksums on key tables, and golden figures. Rehearse the whole thing on a clone first
   and time it.
3. Lower DNS TTL days ahead. Agree a short maintenance window with the customer.
4. Freeze writes on the old system, apply the final delta, verify again, switch DNS/traffic.
5. Keep the old environment read-only and intact for a defined fallback period; roll back by
   pointing traffic back if verification fails.
6. Archive verification output as evidence; decommission the old environment only after the
   fallback period and a final backup is stored.

## Region, residency, and sub-processors (including AI)

Decide and document where each tenant's database, files, and backups live. List every
sub-processor that touches customer data: hosting, database, email, error tracking - **and the AI
providers**: AI-assisted features send customer-authored text (standards, CV content, training
records) to third-party model APIs. Provide a per-tenant AI switch, minimise and redact what is
sent, confirm provider data-retention/training terms in the DPA, and expose the sub-processor list
to customers. Enterprise buyers will ask on day one.

## Identity and SSO hosting concerns

The current Replit-account login cannot serve a customer's workforce. Per-company SSO (OIDC/SAML
to their IdP, typically Microsoft Entra ID, with SCIM provisioning later) is the highest-value
auth capability. Options: build on a standards library, use a managed identity broker that offers
organisation-scoped SSO/SCIM, or federate with each customer's IdP directly. This is a one-way-ish
door - write an ADR comparing cost, per-connection pricing, lock-in, and how it handles tenant
scoping before choosing, and keep the app behind an identity adapter so the choice is reversible.
Do not let an autonomous tool make this decision for you; an unrequested auth migration has
already been attempted on this project.

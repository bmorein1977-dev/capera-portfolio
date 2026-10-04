# Release and upgrade strategy - shipping to existing customers safely

## Contents
- Deploy is not release
- Build once, deploy many; versioning
- Environments
- The ring model
- Customer-controlled change (regulated customers)
- Flags, entitlements, config - keep them apart
- CI/CD pipeline
- Post-deploy verification and rollback
- Hotfixes and freeze windows
- Safe deploy procedure while still on Replit

## Deploy is not release

Separate the two. **Deploy** puts new code on servers; **release** makes new behaviour visible to
a customer. Ship features *dark* (code present, flag off, no entitlement), then enable per tenant.
This turns the scariest moment - a big-bang upgrade - into a series of small, reversible switches,
and it is what lets you "dynamically upgrade licensed companies": enabling a module is a data
change, not a deployment.

## Build once, deploy many; versioning

- One immutable build artifact (container image tagged with the Git SHA and a semantic version)
  is promoted through environments. Never rebuild per environment or per customer; configuration
  arrives via environment/registry, not code.
- Track three versions per tenant in the control plane: **app version** (which ring/fleet serves
  them), **schema version** (migration ledger head), **pack version(s)**.
- Compatibility contract: app version N must run against schema N and N-1. This is what makes
  rolling deploys and instant app rollback safe (see schema file).
- Public/integration APIs (imports, any customer integrations): version them and give deprecation
  notice; internal APIs may change with the client in the same release.

## Environments

| Env | Purpose | Data |
|---|---|---|
| Local | Development; may use `push` on a throwaway DB | Synthetic |
| Preview (per PR) | Automated tests and review | Ephemeral database branch, synthetic/seeded |
| Staging | Release rehearsal | Anonymised, production-shaped clone (never raw customer PII) |
| Canary tenant | Real usage by internal/demo tenant | Golden demo + internal |
| Production rings | Customers | Their own |

## The ring model

| Ring | Who | Soak before next ring | Promotion gate |
|---|---|---|---|
| 0 | Internal + demo tenants | hours | Smoke + migration verification green |
| 1 | Friendly/opt-in customers | 2-5 days | Error rate and support tickets normal |
| 2 | General availability | 1-2 weeks | Same, plus no data-verification anomalies |
| 3 | Regulated / pinned customers | By their change-control calendar | Release notes + impact assessment delivered |

Automate promotion on measurable gates (smoke pass, migration verification, error budget) and
require a human click only for ring 2 -> 3. A tenant belongs to a ring in the registry; rings map
to separate app fleets/deployments so versions can differ safely.

## Customer-controlled change (regulated customers)

This product's customers run competence-assurance programmes inside regulated, audited
industries; many have formal change management. Offer, as product features:

- Release notes and an **impact assessment** per release (what changed, what data/behaviour is
  affected, what to re-verify).
- **Upgrade windows** and the ability to defer within a support window (e.g. up to N-2 releases),
  with security fixes backported.
- A **validation pack** for major releases (test evidence, migration verification output) they can
  file in their own quality system.
- Maintenance freeze periods aligned to their audit calendars.

Evergreen automatic upgrades for small customers; pinned/windowed upgrades for enterprise - same
code, different ring and policy.

## Flags, entitlements, config - keep them apart

| Concept | Question it answers | Who sets it | Changes when |
|---|---|---|---|
| **Entitlement** | What has this company paid for? | Commercial / control plane | Contract changes |
| **Feature flag** | Is this behaviour rolled out yet (or killed)? | Engineering | Rollout / incident |
| **Tenant config** | How does this company want it to work? | Tenant admin | Their preference |

Mixing them creates un-debuggable states ("why can't they see it - unpaid, unrolled, or turned
off?"). Evaluate in a fixed order: entitlement -> flag -> config. Start with a simple DB-backed
flag table and typed helper; adopt a standard (e.g. OpenFeature) or a vendor only when needed.
Every flag has an owner and a removal date - dead flags are technical debt with a delay fuse.

## CI/CD pipeline

Minimum viable (GitHub Actions), in order:

1. Type-check with a **no-new-errors gate** against the recorded baseline (the repo has 75
   pre-existing type errors; fail if the count rises, and burn the baseline down over time).
2. Build client and server.
3. Migration lint (rules in schema file); fail on destructive statements without approval marker.
4. Spin an ephemeral database branch; apply all migrations from scratch *and* from the previous
   release's schema; run the smoke suite and the cross-tenant isolation test.
5. Dependency/advisory scan with a triaged allowlist; generate an SBOM; licence scan.
6. Build the image, tag by SHA, push to the registry.
7. Deploy to ring 0 automatically; promote through rings on gates.

Branch protection on `main` (required checks, no direct pushes, no force-push) is part of the
pipeline, not a nicety - it is the control that keeps unrequested or autonomous edits out of
production.

## Post-deploy verification and rollback

Per tenant after each deploy: automated smoke (login, key pages, key APIs, one write/read round
trip), golden-figure comparison, error-rate and latency within budget. Rollback ladder:
flag off -> roll the app back to the previous image -> forward-fix -> restore that tenant's
database (last resort). Keep the previous image and the previous commit hash recorded in the
release record.

## Hotfixes and freeze windows

Hotfixes branch from the released tag, include no schema contraction, and go through the same
pipeline in compressed form (ring 0 -> targeted tenants). Avoid starting a multi-tenant
migration rollout late in the week or inside a customer's audit/freeze window; a half-rolled
upgrade over a weekend is the classic avoidable incident.

## Safe deploy procedure while still on Replit

Until the hosting move, the interim discipline (see the upgrade runbook for the full version):

1. Git remote is the only source of truth; tag the release commit.
2. Production is a published deployment pointing at its own database; the dev workspace has no
   production credentials.
3. Snapshot/branch the production database and confirm it; apply reviewed SQL with `migrate`
   (not `push`); run verification queries.
4. Deploy the tag (merge/pull that exact commit; never edit files in the production workspace).
5. Run the smoke script; compare golden figures; keep the previous commit hash for code rollback.
6. If anything in the workspace changed that you did not do (`git status`, `git log`), stop and
   investigate before deploying - autonomous agent edits have occurred on this project.

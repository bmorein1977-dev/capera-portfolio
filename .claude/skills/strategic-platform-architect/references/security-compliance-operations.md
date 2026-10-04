# Security, compliance, and operations for an enterprise-sold platform

## Contents
- What enterprise buyers will ask
- Isolation and access controls
- Backups and disaster recovery
- Observability and support access
- Data protection and retention
- Secure delivery and supply chain
- Certifications roadmap
- Domain-specific integrity for competence records
- Third-party code and IP hygiene

## What enterprise buyers will ask

Prepare standing answers (a living "security pack") before the first questionnaire arrives:
architecture and data-flow diagram; where data lives and who can touch it; tenant isolation model;
encryption in transit/at rest; SSO/SCIM and role model; audit logging; backup/restore and RPO/RTO;
incident response and notification times; sub-processors (including AI providers); pen-test
summary; vulnerability and patch policy; business continuity; data return and deletion on exit;
certifications held or in progress. A prepared pack shortens sales cycles more than any feature.

## Isolation and access controls

- Database-per-tenant with separate credentials, so one compromised credential exposes one
  company; least-privilege DB roles (app role cannot DDL; migration role is separate and
  short-lived).
- Tenant context fails closed; an automated cross-tenant leakage test blocks releases.
- Secrets in a managed secret store (not in Git, not in `.env` on shared machines); rotation
  schedule; **expiry monitoring and a health check per integration key** (an expired AI key has
  already silently broken a feature).
- Production access by named individuals, MFA, short-lived, logged. No shared admin logins.
- TLS everywhere; encryption at rest by the data platform; consider per-tenant keys only if a
  customer requires it and the provider supports it cleanly.
- Application roles reviewed periodically; the existing role model plus additional-role grants is
  a good base - add an audit trail for role changes.

## Backups and disaster recovery

- Define **RPO** (acceptable data loss) and **RTO** (acceptable downtime) per tier and publish
  them; design to them.
- Layers: provider point-in-time recovery (know the exact retention window and what it costs to
  extend) **plus** an independent logical dump to a separate account/region on a schedule, so a
  provider-level or account-level failure is survivable.
- **A backup that has not been restored is a hope.** Schedule a restore rehearsal at least
  quarterly: restore a tenant into a fresh database/branch, run the verification queries and the
  smoke test, record elapsed time (your real RTO) and any gaps.
- Per-tenant restore is a core advantage of database-per-tenant; test that path specifically.
- Document a runbook: who declares a disaster, how to restore one tenant, how to fail over the app
  tier, how to communicate.

## Observability and support access

- Structured logs, metrics, and error tracking all carry `tenant_id` and app version; per-tenant
  health dashboard (error rate, latency, job success, schema version, last backup, licence state).
- Uptime checks per tenant plus synthetic login; alert on symptoms customers feel, with an
  error budget per tier.
- **Support access / impersonation** (the app has an impersonation feature): make it time-boxed,
  reason-required, visible to the tenant admin, and written to an immutable audit log. Prefer
  "view as" read-only by default; writing as a user requires explicit elevation. Customers will
  ask, and auditors will expect, to see who accessed what.

## Data protection and retention

- Roles: the customer is typically the data controller and you are the processor - have a standard
  DPA, sub-processor list, and breach-notification commitment.
- Support data-subject requests (access, rectification, erasure) *and* reconcile erasure with
  regulatory retention of competence/training records: usually pseudonymise or restrict rather than
  delete records the customer must keep; make this a documented, per-tenant retention policy.
- Retention schedules per data class (audit logs, evidence files, certificates, backups) with
  automated enforcement and a record of what was deleted and when.
- Data minimisation for AI features (see hosting file) and no secondary use of customer data.

## Secure delivery and supply chain

- Branch protection, required reviews/checks, signed or provenance-tracked builds, and a single
  automated path to production. Treat any autonomous coding tool as an untrusted contributor:
  confine it to branches/PRs, never to the production deploy path.
- Dependency hygiene: scheduled advisory scans with a triage policy (fix critical/high that are
  reachable; document accepted risk with an expiry); lockfile-based reproducible installs; use
  `overrides`/updates for transitive CVEs (as was done for `fast-xml-parser`); generate an SBOM per
  release. Respect and learn from platform package firewalls rather than bypassing them.
- Static analysis and secret scanning in CI; container image scanning; minimal base images.
- Annual (or per major release) independent penetration test; track findings to closure.

## Certifications roadmap

Sequence by sales value per effort: **Cyber Essentials / Cyber Essentials Plus** (quick, UK
procurement-friendly) -> **ISO 27001** or **SOC 2 Type II** (whichever the target customers ask
for; both need months of evidence, so start collecting evidence - change records, access reviews,
restore tests, incident drills - well before the audit). Many controls fall out of the
architecture above; the rest is process, which one person can run if automated and documented.
Consider compliance-automation tooling only when evidence gathering, not engineering, is the
bottleneck.

## Domain-specific integrity for competence records

This product's records are evidence in safety-critical industries, which raises the bar beyond
generic SaaS:

- **Tamper-evident audit trail** for assessments, sign-offs, verifications, role/competence
  changes: append-only, who/what/when/before/after, with integrity protection (hash chaining or
  database-level immutability) and export for auditors.
- **Sign-off integrity**: a signed-off assessment cannot be silently edited; corrections create
  new versions with reason codes (the re-assessment history is the model).
- **Evidence retention**: files and certificates retained for the customer's required period,
  retrievable with their metadata, surviving upgrades and tenant moves.
- **Time integrity**: trusted server timestamps in UTC; historical expiry computed from the rules
  in force at the time.
- **Reproducibility**: the ability to answer "what did the system show about person X on date Y?"
  - which is what append-only history and per-tenant restore deliver.

## Third-party code and IP hygiene

Enterprise buyers and acquirers inspect licences. Maintain an automated open-source licence scan
and SBOM; keep a record of third-party and contractor contributions with written IP assignment;
note any embedded third-party code that needs an explicit carve-out in licence agreements; be
ready to offer source-code escrow to enterprise customers who ask. Align these with the IP
licensing checklist already prepared for this product.

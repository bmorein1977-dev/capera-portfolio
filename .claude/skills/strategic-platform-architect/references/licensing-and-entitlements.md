# Licensing, entitlements, and upgrading a company to new features

## Contents
- The uniform-schema rule
- Vocabulary
- Modules and tiers
- Data model sketch
- Enforcement points
- Licence lifecycle (and what never happens)
- Seats and metering
- Offline / customer-hosted licences
- Enabling a new module for an existing company
- Packaging and pricing alignment

## The uniform-schema rule

Every tenant runs the **identical schema and identical code**. What differs between companies is
data (configuration, packs) and **entitlements** (what they've licensed). Never fork the schema or
the code per customer. This single rule is what makes it possible to upgrade a licensed company to
new functionality with a data change instead of a project, and it is what keeps N customers from
becoming N products.

## Vocabulary

| Term | Meaning |
|---|---|
| **Licence** | The commercial agreement: term, seats, modules, support level |
| **Entitlement** | The machine-readable result of the licence: "tenant X may use module Y, up to limit Z, until date D" |
| **Feature flag** | Engineering rollout control, independent of payment |
| **Tenant config** | A company's own preferences |
| **Module** | A sellable bundle of capability (a coarse unit; avoid per-button entitlements) |

## Modules and tiers

Draw module boundaries along what the buyer understands and what the code can cleanly gate. For
Capera a plausible starting map (the founder owns the commercial split):

- **Core**: users, roles, job roles, competence frameworks, assessments and sign-off, dashboards.
- **Training management**: training matrix, enrolments, certificates, external training/booking.
- **Workforce planning**: initiatives, succession, skills inventory, talent catalog.
- **Learning content**: hosted content and SCORM.
- **AI authoring and review**: standards wizard, AI reviews, translation (also the main variable
  cost - meter it).
- **Integrations/imports**: HR-system lifecycle import, SSO/SCIM, API access.

Tiers add limits (seats, storage, AI allowance) and service levels (ring, support, retention),
not different code paths.

## Data model sketch

In the control plane (not duplicated per tenant DB, though a read-only cached copy is fine):

```
licences(id, tenant_id, plan, status, starts_at, ends_at, seats, support_level, notes)
entitlements(tenant_id, module, enabled, limit_json, source_licence_id, valid_from, valid_to)
feature_flags(key, default, description, owner, remove_by)
tenant_flag_overrides(tenant_id, key, value)
usage_events(tenant_id, metric, quantity, at)          -- seats, AI tokens, storage
```

Until multi-tenancy exists, the same shapes can live in the single database as one-row/one-company
tables - the helpers below keep the call sites unchanged when they later move.

## Enforcement points

Enforce on the **server**; the client only reflects it. A hidden menu item is not a control.

- **API:** `requireEntitlement('training')` middleware on the route families of that module,
  returning a clear 403 body the UI can turn into an "upgrade" prompt.
- **Client:** one `/api/entitlements` response drives navigation, routes, and "upgrade" teasers.
- **Jobs:** background work checks entitlements per tenant (no AI batch for a tenant without the
  AI module).
- **Cost-bearing calls:** AI and storage check allowance *before* spending money.
- **Data:** gating never hides or blocks access to a tenant's own existing records - see lifecycle.

Cache entitlements briefly with explicit invalidation when the control plane changes them; a
licence change should take effect within seconds, not at the next deploy.

## Licence lifecycle (and what never happens)

`trial -> active -> grace (renewal overdue, full access, warnings) -> read-only/suspended ->
terminated (export window) -> deleted per retention policy`.

Non-negotiable: **a lapsed licence never deletes or corrupts data.** It reduces *capability*
(read-only, then suspended) while preserving *access to export*. Auditors and the customer's own
regulators may need those records years later; destroying them to enforce payment is both
commercially reckless and, for this domain, potentially a compliance breach for the customer.

## Seats and metering

Define a seat as something auditable and fair (e.g. distinct active users in a rolling 30 days) and
show usage to the tenant admin. Meter variable costs (AI tokens, storage GB) as `usage_events`
tagged by tenant; this both bills fairly and protects margin if one tenant is heavy. Soft-warn
before hard-limiting. Reconcile metering against provider invoices monthly.

## Offline / customer-hosted licences

If a customer insists on hosting it themselves (priced and deliberately limited): issue a **signed
licence token** (asymmetric signature; tenant id, modules, seat cap, expiry, grace) that the app
verifies with an embedded public key and re-checks periodically, with generous grace and read-only
degradation - never a data-destroying kill switch. Keep tamper-resistance proportional: enterprise
contracts, not DRM, are the real enforcement. Ship the same container image used in SaaS.

## Enabling a new module for an existing company

The "dynamic upgrade" in practice, for a company already live:

1. The code is already deployed everywhere, **dark** (flag + no entitlement). The schema for it is
   already present in every tenant database (uniform schema) from an earlier expand-only release.
2. Commercial agreement signed -> control plane grants the entitlement (and any limits).
3. An idempotent **module enable hook** runs for that tenant: applies the module's pack/seed data,
   creates default roles/permissions, schedules any backfill, and records it.
4. Optionally flip the rollout flag to expose it to a pilot group first.
5. Tenant admin sees the new navigation immediately; nothing was redeployed, no downtime, and no
   existing data was touched.

Disabling is the reverse at the access level only: the module's data stays in place and reappears
intact if the entitlement returns.

## Packaging and pricing alignment

Architecture and pricing should fit each other: price what you can meter (seats, AI usage,
storage), bundle what you can gate cleanly (modules), and put the expensive-to-operate
commitments (dedicated region, pinned versions, validation packs, short RTO) in higher tiers. If a
proposed price promise cannot be enforced or measured by the platform, flag it before the contract
is signed.

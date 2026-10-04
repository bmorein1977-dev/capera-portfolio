# New company onboarding checklist

Company: ________  Slug: ________  Ring: ____  Target go-live: ________  Owner: ________

Automated steps are marked **[auto]**; they should be one command (or a control-plane button).
Everything else is human and needs a named owner and date.

## 1. Commercial and legal (before any provisioning)
- [ ] Order form / licence signed; modules, seats, term, support level recorded
- [ ] DPA signed; sub-processor list shared (including AI providers); AI features on/off decided
- [ ] Data residency/region confirmed; retention periods and exit/export terms agreed
- [ ] Upgrade policy agreed: ring, windows, deferral allowance, notice period, validation-pack needs
- [ ] Security questionnaire answered from the standing security pack

## 2. Provision [auto]
- [ ] Tenant record created (`provisioning`), slug and domain reserved
- [ ] Isolated database created; backup/retention configured; credential stored as a secret reference
- [ ] All migrations applied; schema version recorded
- [ ] Vertical pack(s) applied (versions recorded); base roles, permissions, templates seeded
- [ ] Object-store prefix created; storage test write/read passed
- [ ] Entitlements granted from the licence; flags set to ring defaults
- [ ] Scheduler registered for the tenant; advisory locks verified
- [ ] Tenant smoke test passed; isolation test passed against a second tenant

## 3. Identity and access
- [ ] First admin(s) created and invited
- [ ] SSO configured (OIDC/SAML) and tested with a real login; allowed email domains set
- [ ] SCIM/user-sync decided (now/later); leavers process agreed (e.g. HR export import)
- [ ] Role mapping reviewed with the customer; impersonation/support-access policy explained

## 4. Branding and communications
- [ ] Logo, colours, product name, terminology applied
- [ ] Email sender identity verified (SPF/DKIM) and a test notification delivered
- [ ] Custom domain and TLS (if applicable)

## 5. Data onboarding (use preview-then-apply, never first-time into live)
- [ ] Source files received and archived as evidence (org structure, users, job roles, matrix, competence documents, historical achievements)
- [ ] Each import dry-run on a **database branch** of the new tenant
- [ ] Reconciliation report produced (counts, unmatched, duplicates, warnings) and **signed off by the customer**
- [ ] Applied to the real tenant; counts re-verified; golden figures agreed with the customer
- [ ] Spot-check real records end to end (a person, an assessment, a training certificate)

## 6. Go-live readiness
- [ ] Backup taken and a restore of this tenant rehearsed (record elapsed time)
- [ ] Monitoring, alerts and uptime checks active with tenant tag
- [ ] Support contacts, escalation path and status-page subscription shared
- [ ] Admin training done; quick-start material delivered
- [ ] Rollback/contingency understood by both sides
- [ ] `status = active`; go-live recorded; audit event written

## 7. First 30 days
- [ ] Week 1 check-in; usage and error review
- [ ] Data quality sweep and fixes
- [ ] First upgrade ring assignment confirmed; first release notes delivered
- [ ] Success review: adoption, open issues, expansion opportunities (modules to entitle)

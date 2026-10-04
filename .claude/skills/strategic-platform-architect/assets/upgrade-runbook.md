# Zero-data-loss release runbook

Release: v______  Commit/tag: ________  Includes migration(s): yes / no  Date/window: ________
Operator: ________  Approver: ________  Previous known-good tag: ________

Rule of the day: if anything is unexpected, **stop and investigate**. Never improvise on production data.

## A. Before the window
- [ ] Release is a tagged commit built by CI; green on ring 0 and on a rehearsal tenant cloned from production-shaped data
- [ ] `git status` / `git log` on the deploy source show **only** expected commits (no unrequested or autonomous edits)
- [ ] Migration SQL reviewed; linter clean; changes are **expand-only** (any contract/destructive step has written approval and a delayed release)
- [ ] Rehearsal: migrations applied to a branch clone; baseline vs post facts matched; app N and N-1 both run against the new schema
- [ ] Backfills (if any) are separate idempotent jobs, rehearsed, scheduled for **after** the release
- [ ] Release notes and impact assessment drafted; pinned/regulated customers notified per contract
- [ ] Not inside a customer audit/freeze window; not late-week for a multi-tenant rollout

## B. Per tenant, in ring order (canary first). Halt on the first failure.
1. [ ] Take snapshot/branch; **confirm it exists and is restorable** (restore tested within the last quarter)
2. [ ] Capture baseline: row counts for all tables; FK-orphan counts; golden figures
       (compliance overview %, signed-off assessments, completed training records, active users, ...)
3. [ ] Apply reviewed migrations with `migrate` (never interactive `push`); `lock_timeout` set; record ledger entry + new schema version
4. [ ] Run post-flight: same facts; unchanged tables identical; changes explainable; zero new orphans
5. [ ] Spot-check old records end to end (an old assessment, certificate, audit entry open and download)
6. [ ] Deploy app version (N-1 schema compatible); health/readiness green
7. [ ] Tenant smoke test passes; error rate and latency normal for the agreed soak
8. [ ] Mark tenant at new app + schema version in the registry; archive verification output as evidence

## C. Promotion gates
- [ ] Ring 0 -> 1: smoke + verification green, soak complete
- [ ] Ring 1 -> 2: error/support signals normal, no data anomalies
- [ ] Ring 2 -> 3 (regulated/pinned): impact assessment delivered, their window reached, human approval

## D. If something goes wrong - recovery ladder
1. Feature flag off (kill switch)
2. Roll the application back to the previous image/tag (safe because schema is N-1 compatible)
3. Forward-fix with a new migration/patch
4. Restore **that tenant's** database from the snapshot/PITR (decision owner: ________; expected RTO: ____ min)
   - Note exact restore point, communicate to the customer, replay/communicate any lost window explicitly

## E. After
- [ ] Tenants-not-at-target-version report is empty (or each exception is justified)
- [ ] Release record stored: tag, previous tag, ledger output, verification output, who/when
- [ ] Release notes sent; support briefed; status page updated
- [ ] Schedule the contract/cleanup release (not this one) and any backfills
- [ ] Retrospective note for anything that surprised us; update this runbook and the migration linter

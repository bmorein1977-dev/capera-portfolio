# Schema evolution and data safety - never losing a customer's history

This is the most important reference in the skill. A schema change is the single highest-risk
operation in a multi-customer product, and the Continuity promise lives or dies here.

## Contents
- The risk ladder
- Expand -> migrate -> contract
- push vs migrate (and the rename trap)
- Adopting `migrate` when history was applied with `push`
- Migration linter rules
- Lock safety and large tables
- Backfills are not migrations
- Orchestrating across tenants
- Pre-flight and post-flight verification
- Rollback reality
- Design rules that make history unlosable
- The "publish with all historical data intact" checklist

## The risk ladder

| Class | Examples | Rule |
|---|---|---|
| **Safe** | add table; add nullable column; add column with constant default; add index *concurrently* | Ship any release. Still rehearse. |
| **Careful** | add NOT NULL; add FK/unique constraint; widen a type; add enum value | Add as `NOT VALID` / nullable first, backfill, then validate/enforce in a later step |
| **Dangerous** | rename column/table; drop column/table; narrow a type; change meaning of a column | Never in one step. Expand/contract over >= 2 releases, explicit approval |
| **Forbidden without ceremony** | TRUNCATE; DELETE without WHERE; DROP in production by tool prompt | Written approval, verified backup, rehearsal on a clone, logged |

## Expand -> migrate -> contract

The pattern that makes zero-loss, zero-downtime upgrades possible:

1. **Expand** - add the new structure alongside the old. Old code keeps working (the schema is
   backward compatible with the *previous* app version, so a rolling deploy or app rollback is safe).
2. **Migrate** - deploy code that writes both, then run a **backfill job** to copy historical
   data into the new structure, then switch reads to the new structure.
3. **Contract** - only after the old structure has been unused for a full release cycle and
   data is verified equivalent: remove it. Even then, take a snapshot first and keep it for the
   retention window.

A rename is "add new, dual-write, backfill, switch reads, drop old" - four releases of safety, not
one `ALTER ... RENAME` that breaks the running app and any in-flight deploy.

## push vs migrate (and the rename trap)

| | `drizzle-kit push` | `drizzle-kit generate` + `migrate` |
|---|---|---|
| What it does | Diffs `schema.ts` against the live DB and applies changes directly | Writes reviewable SQL files; `migrate` applies them in order and records each in a ledger |
| Reviewable before running | No | Yes - SQL is in Git and in the PR |
| Interactive prompts | Yes (e.g. "created or renamed?") | No |
| Per-tenant ledger / version | No | Yes |
| Right for | Throwaway local databases | **Every shared or production database** |

The rename trap, concretely: when a table disappears from `schema.ts` and a similar one appears,
`push` asks whether it is a rename. Answer "create" and the old table (with data) is orphaned and
may later be dropped; answer "rename" and data survives. A tired human at a terminal is not a
safe control. This project nearly hit it (OPTIO -> OPITO). Policy: renames are written by hand as
explicit SQL in a committed migration, reviewed, and rehearsed.

## Adopting `migrate` when history was applied with `push`

Capera's production-like databases were built by `push`, so the migration ledger table
(`drizzle.__drizzle_migrations`) is probably empty or incomplete even though the SQL files exist.
Switching safely requires a **baseline**:

1. Prove the live schema equals what the migration files produce: build a fresh empty database
   from all migrations, `pg_dump --schema-only` both it and production, diff them. Reconcile any
   drift deliberately (it is information, not noise).
2. On a *branch clone* first, mark the existing migrations as already applied (the Drizzle
   migrator decides what to run from the ledger's last-applied timestamp and each file's hash;
   `migrations/meta/_journal.json` holds each file's timestamp). Verify exact behaviour against
   the `drizzle-orm`/`drizzle-kit` versions in `package.json` and rehearse - do not hand-edit the
   ledger on production until the rehearsal reproduces cleanly.
3. Confirm `migrate` against the baselined clone is a no-op, then add one trivial new migration and
   confirm it applies exactly once.
4. Only then switch production's deploy step from `db:push` to `migrate`.

Also resolve the stray second migrations folder (`db/migrations`) so there is exactly one
authority.

## Migration linter rules (run in CI on every PR touching `migrations/`)

Fail the build on: `DROP TABLE`, `DROP COLUMN`, `RENAME`, `ALTER COLUMN ... TYPE` that narrows,
`TRUNCATE`, `DELETE`/`UPDATE` without `WHERE`, adding `NOT NULL` without a default or prior
backfill, `CREATE INDEX` without `CONCURRENTLY` on non-trivial tables, and any statement inside a
transaction that cannot run in one. Allow an explicit, reviewed override marker in the file
(`-- approved-destructive: <reason/ticket>`) so the exception is visible in review. The point is
not to forbid; it is to make dangerous operations impossible to do by accident.

## Lock safety and large tables

Set `lock_timeout` (seconds, not minutes) and a sane `statement_timeout` for DDL so a migration
that cannot get its lock fails fast instead of queueing behind - and then blocking - live traffic.
Retry off-peak. Adding a column with a constant default is cheap on modern Postgres; adding a
constraint should use `NOT VALID` then `VALIDATE CONSTRAINT`; build indexes `CONCURRENTLY`
(outside a transaction). Check current Postgres version behaviours before relying on any of these.

## Backfills are not migrations

Data movement runs as separate, idempotent, resumable, **batched** jobs recorded in a
`data_migrations` table (name, status, cursor, started/finished, rows touched) - never inside the
DDL migration. They can be paused, re-run safely, and verified independently, and they do not hold
schema locks. Verify equivalence (counts + checksums on key columns) before the contract step.

## Orchestrating across tenants

With a database per company, an upgrade is a controlled rollout of migrations:

- A migration orchestrator reads the registry, and for each tenant in ring order: snapshot ->
  apply pending migrations -> record the ledger entry and new `schema_version` -> run the tenant
  smoke test -> continue. Canary/internal tenant first.
- **Halt on first failure.** Do not push a failing migration across fifteen customers.
- Make it resumable and safe to re-run; a tenant already at the target version is skipped.
- Expose "tenants not at target version" as a first-class report. Version drift between tenants is
  the early warning for every bad upgrade story.

## Pre-flight and post-flight verification

**Pre-flight (per tenant):** restorable snapshot taken and confirmed; migration SQL reviewed and
already rehearsed on a clone of *this* tenant's data (or a representative one); capture baseline
facts: row counts for every table, orphan-FK counts, and a handful of **golden figures** that the
business would instantly notice if wrong - for Capera, e.g. compliance overview percentages,
number of signed-off assessments, number of completed training records, number of active users.

**Post-flight:** the same facts must match exactly for unchanged tables and be explainable for
changed ones; FK orphan count unchanged; tenant smoke test passes; a few real records spot-checked
end-to-end (an old assessment, an old training certificate, an old audit entry still render and
download). "The app loads" is not verification.

## Rollback reality

Most DDL cannot be cleanly un-run. Safety therefore comes from rehearsal, snapshots, and
expand/contract - not from hoping a down-migration works. Hierarchy of recovery: (1) feature flag
off; (2) roll the *application* back to the previous image (safe because the schema is N-1
compatible); (3) forward-fix with a new migration; (4) point-in-time restore of **that one
tenant's** database - possible without touching others precisely because tenants are separate
databases. Know and document who decides on (4) and how long it takes (the RTO).

## Design rules that make history unlosable

- **Append-only for audit facts.** If something was true on a date, never overwrite it. The
  assessment re-sign-off originally overwrote the earlier outcome and an expiry-history table had
  to be added to preserve it; build history in at design time (history table, or insert-new-row
  with `valid_from/valid_to`).
- **Soft delete and archival by default** (`isActive`, `isArchived`, `leftAt`, as already used).
  Hard deletion only via a logged, confirmed retention/erasure process.
- **Never change what an existing column means.** Add a new column; deprecate the old.
- **Document allowed values** for text columns used as enums (they are free-form varchars here),
  and add a CHECK or application validation, so old rows stay interpretable forever.
- **Version JSON blobs** (e.g. SCORM `cmi_data`) with a `schemaVersion` field so old documents
  remain readable after the format evolves.
- **Stable keys for reference data** so packs and re-imports match rather than duplicate.
- **Keep generated IDs out of business meaning** (codes/slugs for anything humans or packs
  reference).
- **Time:** store UTC timestamps; never recompute historical expiry from *current* rules - store
  the rule or the computed result that applied at the time.

## The "publish with all historical data intact" checklist

Use this (or `assets/upgrade-runbook.md`) for every production release that includes a migration:

1. Release is a tagged commit, built by automation, already deployed and green on a rehearsal
   tenant cloned from production-shaped data.
2. Migration SQL reviewed; linter clean; expand-only (or contract explicitly approved).
3. Snapshot/backup of each target tenant taken and **restore-tested within the last quarter**.
4. Baseline facts + golden figures captured.
5. Apply per ring: canary -> early -> general -> pinned/regulated, halting on first failure.
6. Post-flight verification passes per tenant; discrepancies stop the rollout.
7. App deployed (N-1 schema compatible), smoke test green, error rates normal.
8. Backfills/contract steps scheduled for a *later* release, not this one.
9. Release notes sent to tenants; ledger and verification output archived as audit evidence.
10. Previous image/commit retained for instant application rollback.

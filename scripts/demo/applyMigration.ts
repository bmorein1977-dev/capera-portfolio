/**
 * Applies one generated migration file (migrations/00NN_*.sql) to a database, in a single transaction.
 * Safe to run twice: if the sentinel table already exists the migration is treated as applied.
 *
 * Why this exists: the demo database was built from the schema, not from the migration history, so
 * `drizzle-kit push` is awkward to re-run against it. Applying the reviewed SQL file directly is
 * predictable and is the same SQL a production upgrade would run.
 *
 *   DATABASE_URL=<demo db url> npx tsx scripts/demo/applyMigration.ts migrations/0042_performance_360.sql performance_cycles
 *
 * Refuses to run unless the database name contains "demo" (override with ALLOW_NON_DEMO_DB=yes after
 * taking a snapshot/branch of that database).
 */
import fs from "fs";
import { pool } from "../../server/db";

const [file, sentinel] = process.argv.slice(2); // sentinel: a table name, or table.column when the migration only adds columns
const dbName = (() => { try { return new URL(process.env.DATABASE_URL || "").pathname.replace(/^\//, ""); } catch { return ""; } })();
if (!file || !sentinel) { console.error("Usage: npx tsx scripts/demo/applyMigration.ts <migration.sql> <sentinel table>"); process.exit(1); }
if (!/demo/i.test(dbName) && process.env.ALLOW_NON_DEMO_DB !== "yes") {
  console.error(`Refusing to run against "${dbName}": name must contain "demo" (or set ALLOW_NON_DEMO_DB=yes after taking a snapshot).`);
  process.exit(1);
}

(async () => {
  const client = await pool.connect();
  try {
    const [sTable, sColumn] = sentinel.split(".");
    const exists = sColumn
      ? (await client.query(`select 1 from information_schema.columns where table_schema = 'public' and table_name = $1 and column_name = $2`, [sTable, sColumn])).rowCount
      : (await client.query(`select to_regclass($1) as t`, [`public.${sTable}`])).rows[0].t;
    if (exists) { console.log(`"${sentinel}" already exists in ${dbName}: migration treated as already applied.`); return; }
    const statements = fs.readFileSync(file, "utf8").split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean);
    await client.query("BEGIN");
    for (const s of statements) await client.query(s);
    await client.query("COMMIT");
    console.log(`Applied ${statements.length} statements from ${file} to ${dbName}.`);
  } catch (e: any) {
    try { await client.query("ROLLBACK"); } catch { /* nothing to roll back */ }
    console.error("Migration failed and was rolled back:", e?.message || e);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();

// Brings a database up to date, and keeps a record of every upgrade applied to it.
//
//   node scripts/db/migrate.mjs                 apply whatever has not been applied, in order, each in its own transaction
//   node scripts/db/migrate.mjs --status        say what has and has not been applied; change nothing
//   node scripts/db/migrate.mjs --baseline TAG  for a database that already has the structure up to TAG: record those as applied
//                                               without running them (do this once, before the first ordinary run)
//
// DATABASE_URL says which database. Take a backup first. Plain Node, so it runs inside the production container.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const folder = path.resolve(here, "..", "..", "migrations");

async function connect(url) {
  if (url.includes("neon.tech")) {
    const { Pool, neonConfig } = await import("@neondatabase/serverless");
    neonConfig.webSocketConstructor = (await import("ws")).default;
    return new Pool({ connectionString: url });
  }
  const pg = (await import("pg")).default;
  return new pg.Pool({ connectionString: url });
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL to the database to upgrade.");
  const args = process.argv.slice(2);
  const statusOnly = args.includes("--status");
  const baselineAt = args.indexOf("--baseline");
  const baseline = baselineAt >= 0 ? args[baselineAt + 1] : null;
  const journal = JSON.parse(fs.readFileSync(path.join(folder, "meta", "_journal.json"), "utf8")).entries;
  const files = journal.map((e) => {
    const text = fs.readFileSync(path.join(folder, `${e.tag}.sql`), "utf8").replace(/\r\n/g, "\n");
    return { tag: e.tag, text, checksum: createHash("sha256").update(text).digest("hex") };
  });
  if (baseline && !files.some((f) => f.tag === baseline)) throw new Error(`There is no upgrade called ${baseline}`);

  const pool = await connect(url);
  const client = await pool.connect();
  try {
    await client.query("create table if not exists capera_migrations (tag text primary key, checksum text not null, applied_at timestamptz not null default now(), how text not null)");
    // only one upgrade run at a time
    await client.query("select pg_advisory_lock(hashtext('capera-migrate'))");
    const done = new Map((await client.query("select tag, checksum from capera_migrations")).rows.map((r) => [r.tag, r.checksum]));
    const changed = files.filter((f) => done.has(f.tag) && done.get(f.tag) !== f.checksum);
    if (changed.length) console.warn(`Warning: these files have changed since they were applied: ${changed.map((f) => f.tag).join(", ")}`);

    if (statusOnly) {
      for (const f of files) console.log(`${done.has(f.tag) ? "applied " : "pending "} ${f.tag}`);
      return;
    }
    if (baseline) {
      if (done.size) throw new Error("This database already has a record of upgrades; a baseline can only be set once.");
      const upto = files.findIndex((f) => f.tag === baseline);
      for (const f of files.slice(0, upto + 1)) await client.query("insert into capera_migrations (tag, checksum, how) values ($1, $2, 'baseline')", [f.tag, f.checksum]);
      console.log(`Recorded ${upto + 1} upgrades as already in place, up to ${baseline}.`);
      return;
    }
    const empty = !(await client.query("select 1 from information_schema.tables where table_schema = 'public' and table_name = 'users'")).rowCount;
    if (!empty && !done.size) throw new Error("This database already holds Capera's tables but has no record of upgrades. Run with --baseline <last upgrade it has> first.");
    const pending = files.filter((f) => !done.has(f.tag));
    for (const f of pending) {
      const statements = f.text.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);
      try {
        await client.query("begin");
        for (const s of statements) await client.query(s);
        await client.query("insert into capera_migrations (tag, checksum, how) values ($1, $2, 'applied')", [f.tag, f.checksum]);
        await client.query("commit");
        console.log(`applied  ${f.tag}`);
      } catch (e) {
        await client.query("rollback").catch(() => {});
        throw new Error(`${f.tag} failed and was rolled back: ${e.message}`);
      }
    }
    console.log(pending.length ? `Done: ${pending.length} upgrade(s) applied.` : "The database is already up to date.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });

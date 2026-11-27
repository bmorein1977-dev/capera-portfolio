// A complete, readable copy of the database, for a customer taking its data away or checking a backup: one JSON Lines file for each table,
// and a manifest with the row counts. Sign-in sessions and key fingerprints are left out. Uploaded files are copied from the file storage
// itself (the storage container or folder).
//
//   DATABASE_URL=... node scripts/db/export-all.mjs <empty output folder>
import fs from "node:fs";
import path from "node:path";

async function connect(url) {
  if (url.includes("neon.tech")) {
    const { Pool, neonConfig } = await import("@neondatabase/serverless");
    neonConfig.webSocketConstructor = (await import("ws")).default;
    return new Pool({ connectionString: url });
  }
  const pg = (await import("pg")).default;
  return new pg.Pool({ connectionString: url });
}

const out = process.argv[2];
if (!process.env.DATABASE_URL || !out) { console.error("Usage: DATABASE_URL=... node scripts/db/export-all.mjs <empty output folder>"); process.exit(1); }
if (fs.existsSync(out) && fs.readdirSync(out).length) { console.error(`${out} is not empty.`); process.exit(1); }
fs.mkdirSync(out, { recursive: true });
const pool = await connect(process.env.DATABASE_URL);
const client = await pool.connect();
try {
  // one consistent moment for every table
  await client.query("begin transaction isolation level repeatable read read only");
  const tables = (await client.query("select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name")).rows.map((r) => r.table_name).filter((t) => t !== "sessions");
  const manifest = { exportedAt: new Date().toISOString(), tables: [] };
  for (const table of tables) {
    const columns = (await client.query("select column_name, data_type from information_schema.columns where table_schema = 'public' and table_name = $1 order by ordinal_position", [table])).rows;
    const keep = columns.filter((c) => !/^key_hash$/.test(c.column_name));
    const rows = (await client.query(`select ${keep.map((c) => `"${c.column_name}"`).join(", ")} from "${table}"`)).rows;
    fs.writeFileSync(path.join(out, `${table}.jsonl`), rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : ""));
    manifest.tables.push({ table, rows: rows.length, columns: keep.map((c) => ({ name: c.column_name, type: c.data_type })) });
  }
  await client.query("commit");
  fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`Exported ${manifest.tables.length} tables, ${manifest.tables.reduce((n, t) => n + t.rows, 0)} rows, to ${path.resolve(out)}`);
} finally {
  client.release();
  await pool.end();
}

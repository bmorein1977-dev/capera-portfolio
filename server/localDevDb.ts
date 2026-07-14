import { newDb, DataType } from "pg-mem";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Local-dev-only: an in-memory Postgres-compatible database (no server, no download)
// used when a real Postgres instance isn't available. Schema is built from the
// Drizzle-generated migration SQL; data does not persist across restarts.
export function createLocalDevPgMemPool() {
  const memDb = newDb({ autoCreateForeignKeyIndices: true });

  memDb.public.registerFunction({
    name: "gen_random_uuid",
    returns: DataType.uuid,
    impure: true, // must be called fresh per row, not simplified/memoized to a single value
    implementation: () => randomUUID(),
  });

  const migrationsDir = path.join(__dirname, "..", "migrations");
  const sqlFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith(".sql")).sort();

  for (const file of sqlFiles) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) {
        memDb.public.none(trimmed);
      }
    }
  }

  const adapter = memDb.adapters.createPg();
  const pgMemPool = new adapter.Pool();

  // drizzle-orm's node-postgres driver relies on two pg features pg-mem's adapter
  // doesn't support: a custom `types` type-parser (unneeded - pg-mem already returns
  // native JS values) and `rowMode: 'array'` (drizzle expects rows as positional arrays
  // when it supplies rowMode). Strip the former and emulate the latter ourselves.
  const originalQuery = pgMemPool.query.bind(pgMemPool);
  pgMemPool.query = (async (config: any, ...rest: any[]) => {
    if (!config || typeof config !== "object") {
      return originalQuery(config, ...rest);
    }
    const { types, rowMode, ...passthroughConfig } = config;
    const result = await originalQuery(passthroughConfig, ...rest);
    if (rowMode === "array") {
      // pg-mem's `result.fields` metadata is unreliable (sometimes empty), so use each
      // row object's own key insertion order instead - it reflects the SELECT column order.
      result.rows = result.rows.map((row: any) => Object.values(row));
    }
    return result;
  }) as typeof pgMemPool.query;

  return pgMemPool;
}

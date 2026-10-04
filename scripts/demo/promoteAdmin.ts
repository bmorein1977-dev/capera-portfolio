/**
 * Makes one person a super_admin in the clean demo database - the fallback if the email you log in
 * to Replit with is not the one the seed used (so you landed as a plain candidate).
 *
 * Log in to the demo app once first (that creates your user), then from the Replit shell:
 *   npx tsx scripts/demo/promoteAdmin.ts you@example.com
 *
 * Refuses to run unless the database name contains "demo".
 */
import { db, pool } from "../../server/db";
import * as S from "../../shared/schema";
import { sql } from "drizzle-orm";

const dbName = (() => { try { return new URL(process.env.DATABASE_URL || "").pathname.replace(/^\//, ""); } catch { return ""; } })();
if (!/demo/i.test(dbName)) { console.error(`Refusing to run against "${dbName}": database name must contain "demo".`); process.exit(1); }
const email = process.argv[2];
if (!email) { console.error("Usage: npx tsx scripts/demo/promoteAdmin.ts <email>"); process.exit(1); }

(async () => {
  const updated = await db.update(S.users).set({ role: "super_admin" }).where(sql`lower(${S.users.email}) = lower(${email})`).returning({ id: S.users.id });
  console.log(updated.length ? `${email} is now a super_admin (${updated.length} row).` : `No user with email ${email} found - log in to the demo app once first, then re-run.`);
  await pool.end();
})().catch(async (e) => { console.error(e?.message || e); try { await pool.end(); } catch {} process.exit(1); });

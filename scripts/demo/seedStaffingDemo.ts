/**
 * Adds a realistic "duty to operate" scenario to the fictional demo company, so the Duty to Operate screen has
 * something to show: requirements that are met, one that is met only just (a counted person is leaving), and
 * some that are short with a review waiting for a decision. Run after seedCleanDemo.ts.
 *
 *   npx tsx scripts/demo/seedStaffingDemo.ts            (add / refresh)
 *   npx tsx scripts/demo/seedStaffingDemo.ts --reset    (remove the staffing requirements and reviews first)
 *
 * Changes the demo people's secondary job roles and adds emergency response roles. Refuses to run unless the
 * database name contains "demo".
 */
import { db, pool } from "../../server/db";
import * as S from "../../shared/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { runStaffingChecks, evaluateAll } from "../../server/services/staffingCompliance";

const dbName = (() => { try { return new URL(process.env.DATABASE_URL || "").pathname.replace(/^\//, ""); } catch { return ""; } })();
if (!/demo/i.test(dbName)) { console.error(`Refusing to run against "${dbName}": database name must contain "demo".`); process.exit(1); }
const RESET = process.argv.includes("--reset");
const DAY = 86400000;

// People who currently hold a valid, signed-off assessment of an element (the same test the staffing check uses)
async function validHolders(elementId: string): Promise<Set<string>> {
  const rows = (await db.execute(sql`
    select distinct candidate_id from assessments
    where is_active and element_id = ${elementId} and not coalesce(is_assignment, false)
      and outcome in ('competent', 'competent_with_minor_needs') and (expiry_date is null or expiry_date > now())`)).rows as any[];
  return new Set(rows.map(r => r.candidate_id));
}

// The role requires the two elements of a source role that the most people actually hold, so the demo role has real holders
async function ensureRole(name: string, code: string, description: string, borrowFromRole: string, take: number) {
  const existing = (await db.select().from(S.jobRoles).where(eq(S.jobRoles.name, name)))[0];
  if (existing) return existing;
  const src = (await db.select().from(S.jobRoles).where(eq(S.jobRoles.name, borrowFromRole)))[0];
  if (!src) throw new Error(`Cannot find the role "${borrowFromRole}" to borrow competence requirements from. Run seedCleanDemo.ts first.`);
  const role = (await db.insert(S.jobRoles).values({ name, code, description, department: "Emergency response", location: src.location, businessUnit: src.businessUnit, level: src.level }).returning())[0];
  const els = await db.select().from(S.roleElements).where(and(eq(S.roleElements.roleId, src.id), eq(S.roleElements.isActive, true), eq(S.roleElements.required, true)));
  const scored = [];
  for (const e of els) scored.push({ e, n: (await validHolders(e.elementId)).size });
  scored.sort((a, b) => b.n - a.n);
  for (const { e } of scored.slice(0, take)) await db.insert(S.roleElements).values({ roleId: role.id, elementId: e.elementId, requirementLevel: "M", activityType: e.activityType, validityYears: e.validityYears, safetyCritical: true });
  return role;
}

(async () => {
  if (RESET) {
    await db.delete(S.staffingShortfallReviews);
    await db.delete(S.staffingRequirements);
    await db.execute(sql`delete from notification_logs where setting_id = 'staffing-shortfall'`);
    console.log("reset: staffing requirements, reviews and their alerts removed");
  }
  const roleByName = async (n: string) => { const r = (await db.select().from(S.jobRoles).where(eq(S.jobRoles.name, n)))[0]; if (!r) throw new Error(`Role "${n}" not found. Run seedCleanDemo.ts first.`); return r; };
  const location = async (n: string) => { const l = (await db.select().from(S.locations).where(eq(S.locations.name, n)))[0]; if (!l) throw new Error(`Location "${n}" not found.`); return l; };

  const fieldOp = await roleByName("Field Operator");
  const electrical = await roleByName("Electrical Maintenance Technician");
  const stl = await roleByName("Shift Team Leader");
  const ertMember = await ensureRole("Emergency Response Team Member", "ERT-M", "Member of the installation's emergency response team", "Field Operator", 2);
  const ertLeader = await ensureRole("Emergency Response Team Leader", "ERT-L", "Leads the emergency response team", "Shift Team Leader", 2);
  const rep = await ensureRole("Responsible Electrical Person", "REP", "Authorised responsible electrical person for the site", "Electrical Maintenance Technician", 2);
  const north = await location("Northfield Terminal");
  const harbour = await location("Harbour Point Plant");

  // people at a site who hold every element a role requires, whatever their primary role
  const holdersAt = async (loc: string, roleId: string) => {
    const els = await db.select().from(S.roleElements).where(and(eq(S.roleElements.roleId, roleId), eq(S.roleElements.isActive, true), eq(S.roleElements.required, true)));
    let ids: Set<string> | null = null;
    for (const e of els) { const h = await validHolders(e.elementId); ids = ids ? new Set([...ids].filter(x => h.has(x))) : h; }
    const people = await db.select().from(S.users).where(and(eq(S.users.location, loc), eq(S.users.isActive, true)));
    return people.filter(p => ids?.has(p.id));
  };
  const setSecondary = async (userIds: string[], roleId: string) => { if (userIds.length) await db.update(S.users).set({ secondaryJobRoleId: roleId }).where(inArray(S.users.id, userIds)); };

  // Northfield emergency response: give the role to every person who holds its competence (up to 3, so a minimum of 4 is
  // short), plus one person who does not hold it, who therefore is not counted. One of the holders is on long-term sick leave.
  const ertHolders = await holdersAt("Northfield Terminal", ertMember.id);
  const notHolders = (await db.select().from(S.users).where(and(eq(S.users.location, "Northfield Terminal"), eq(S.users.isActive, true)))).filter(u => !ertHolders.some(h => h.id === u.id) && u.jobRoleId === (fieldOp.id));
  await setSecondary([...ertHolders.slice(0, 3).map(u => u.id), ...notHolders.slice(0, 1).map(u => u.id)], ertMember.id);
  if (ertHolders.length > 1) {
    const person = ertHolders[1];
    const open = await db.select().from(S.absences).where(and(eq(S.absences.userId, person.id), sql`${S.absences.actualReturnDate} IS NULL`));
    if (!open.length) await db.insert(S.absences).values({ userId: person.id, absenceType: "long_term_sick", startDate: new Date(Date.now() - 20 * DAY), expectedReturnDate: new Date(Date.now() + 40 * DAY), isFrozen: true, notes: "Demo data" });
  }
  await setSecondary((await holdersAt("Northfield Terminal", ertLeader.id)).slice(0, 1).map(u => u.id), ertLeader.id);
  await setSecondary((await holdersAt("Northfield Terminal", rep.id)).slice(0, 1).map(u => u.id), rep.id);

  const wanted: Array<Partial<S.InsertStaffingRequirement> & { scopeId: string; jobRoleId: string; minimumCount: number }> = [
    { scopeType: "location", scopeId: north.id, jobRoleId: rep.id, minimumCount: 1, countBy: "either", legalReference: "Safety case, electrical safety", notes: "Responsible electrical person for the installation." },
    { scopeType: "location", scopeId: north.id, jobRoleId: fieldOp.id, minimumCount: 3, countBy: "primary", legalReference: "Safety case, minimum manning", notes: "Operations technicians needed to operate the installation." },
    { scopeType: "location", scopeId: north.id, jobRoleId: ertMember.id, minimumCount: 4, countBy: "secondary", legalReference: "Safety case, emergency response", notes: "Emergency response team members." },
    { scopeType: "location", scopeId: north.id, jobRoleId: ertLeader.id, minimumCount: 1, countBy: "secondary", legalReference: "Safety case, emergency response" },
    { scopeType: "location", scopeId: harbour.id, jobRoleId: fieldOp.id, minimumCount: 1, countBy: "primary", legalReference: "Site operating procedure 12", notes: "Minimum operators for a safe shift." },
  ];
  for (const w of wanted) {
    const dup = await db.select().from(S.staffingRequirements).where(and(eq(S.staffingRequirements.scopeType, w.scopeType!), eq(S.staffingRequirements.scopeId, w.scopeId), eq(S.staffingRequirements.jobRoleId, w.jobRoleId), eq(S.staffingRequirements.isActive, true)));
    if (!dup.length) await db.insert(S.staffingRequirements).values({ ...w, onlyCompetent: true, excludeAbsent: true, dutyToOperate: true, notifyUserIds: [] } as any);
  }

  // Harbour Point is met by one competent operator, who is leaving soon: an early warning rather than a shortfall
  const hp = (await evaluateAll()).find(s => s.scopeName === "Harbour Point Plant" && s.roleName === "Field Operator");
  const counted = hp?.people.find(p => p.counted);
  if (counted) await db.update(S.users).set({ leftAt: new Date(Date.now() + 45 * DAY) }).where(eq(S.users.id, counted.userId));

  const out = await runStaffingChecks();
  console.log("check:", JSON.stringify(out));
  for (const s of await evaluateAll()) {
    console.log(`  ${s.status.toUpperCase().padEnd(9)} ${s.scopeName} / ${s.roleName}: ${s.actual} of ${s.required}${s.atRiskCount ? ` (${s.atRiskCount} at risk)` : ""}`);
  }
  await pool.end();
})().catch(async (e) => { console.error("SEED FAILED:", e?.message || e); try { await pool.end(); } catch { /* */ } process.exit(1); });

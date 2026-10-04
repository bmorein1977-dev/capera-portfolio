/**
 * Seeds a CLEAN, entirely fictional demo tenant ("Northgate Energy Services") into an empty database.
 *
 * Why this exists: demonstrating Capera to a prospect without any customer-derived content on
 * screen. Every name, site, standard, course and person below is invented for this script. Nothing
 * is read from, or copied from, another database.
 *
 * Safety: refuses to run unless the target database name contains "demo" (override only with
 * ALLOW_NON_DEMO_DB=yes), and refuses if the users table already has rows unless --reset is given
 * (which truncates every table in the target database, so it is guarded by the same name check).
 *
 * Usage (PowerShell / bash):
 *   DATABASE_URL=<url of capera_demo_clean> DEMO_ADMIN_EMAIL=<your login email> npx tsx scripts/demo/seedCleanDemo.ts [--reset]
 *
 * DEMO_ADMIN_EMAIL: the first Replit login with this email is reconciled onto the seeded super_admin
 * row (see makeUpsertUser in server/replitAuth.ts), so you land as an admin rather than a candidate.
 */
import { db, pool } from "../../server/db";
import * as S from "../../shared/schema";
import { sql } from "drizzle-orm";

// ---------- safety guards ----------
const dbUrl = process.env.DATABASE_URL || "";
const dbName = (() => { try { return new URL(dbUrl).pathname.replace(/^\//, ""); } catch { return ""; } })();
if (!/demo/i.test(dbName) && process.env.ALLOW_NON_DEMO_DB !== "yes") {
  console.error(`Refusing to seed database "${dbName}": name must contain "demo".`);
  process.exit(1);
}
const RESET = process.argv.includes("--reset");

// ---------- deterministic randomness, so re-seeding gives the same story ----------
let seedState = 20261004;
const rnd = () => {
  seedState |= 0; seedState = (seedState + 0x6d2b79f5) | 0;
  let t = Math.imul(seedState ^ (seedState >>> 15), 1 | seedState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T,>(a: T[]): T => a[Math.floor(rnd() * a.length)];
const between = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const chance = (p: number) => rnd() < p;

const DAY = 86400000;
const now = new Date();
const daysFromNow = (d: number) => new Date(now.getTime() + d * DAY);
const addMonths = (d: Date, m: number) => { const x = new Date(d); x.setMonth(x.getMonth() + m); return x; };

async function ins<T extends object>(table: any, rows: T[]): Promise<any[]> {
  const out: any[] = [];
  for (let i = 0; i < rows.length; i += 300) {
    const chunk = rows.slice(i, i + 300);
    if (chunk.length) out.push(...(await db.insert(table).values(chunk as any).returning()));
  }
  return out;
}

async function main() {
  const existing = await db.select({ n: sql<number>`count(*)::int` }).from(S.users);
  if (existing[0].n > 0) {
    if (!RESET) { console.error(`users table already has ${existing[0].n} rows. Re-run with --reset to wipe and re-seed this demo database.`); process.exit(1); }
    const tables = await pool.query(`select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE'`);
    const names = tables.rows.map((r: any) => `"${r.table_name}"`).join(", ");
    await pool.query(`truncate table ${names} restart identity cascade`);
    console.log(`reset: truncated ${tables.rows.length} tables in ${dbName}`);
  }

  // ---------- organisation structure ----------
  const defaultLevels = ["Apprentice", "Trainee Technician", "Technician", "Lead Technician", "Graduate Engineer",
    "Engineer", "Lead Engineer", "Technical Authority", "Planner", "Scheduler", "HSE Advisor", "OIM", "Superintendent", "Supervisor"];
  const levels = await ins(S.standardLevels, defaultLevels.map((name, order) => ({ name, order })));
  const lvl = (n: string) => levels.find((l) => l.name === n)?.id as string;

  const locs = await ins(S.locations, [
    { name: "Northfield Terminal", code: "NFT", assetType: "Onshore Terminal", region: "North" },
    { name: "Harbour Point Plant", code: "HBP", assetType: "Onshore Plant", region: "South" },
    { name: "Riverside Office", code: "RSO", assetType: "Office", region: "Central" },
  ]);
  const L: Record<string, any> = Object.fromEntries(locs.map((l) => [l.code, l]));

  const bus = await ins(S.businessUnits, [
    { name: "Operations", code: "OPS" }, { name: "Engineering & Maintenance", code: "EM" },
    { name: "HSE & Assurance", code: "HSEA" }, { name: "Learning & Competence", code: "LC" },
  ]);
  const B: Record<string, any> = Object.fromEntries(bus.map((b) => [b.code, b]));

  const fams = await ins(S.jobFamilies, [
    { name: "Operations", code: "FOPS", description: "Plant and control room operations" },
    { name: "Maintenance", code: "FMNT", description: "Mechanical, electrical and instrument maintenance" },
    { name: "Technical", code: "FTEC", description: "Engineering and technical authority roles" },
    { name: "Leadership & Support", code: "FLDR", description: "Supervision, management and specialist support" },
  ]);
  const F: Record<string, any> = Object.fromEntries(fams.map((f) => [f.code, f]));

  await ins(S.teams, [
    { name: "Day Shift", code: "NFT-D", locationId: L.NFT.id }, { name: "Night Shift", code: "NFT-N", locationId: L.NFT.id },
    { name: "Day Shift", code: "HBP-D", locationId: L.HBP.id }, { name: "Night Shift", code: "HBP-N", locationId: L.HBP.id },
  ]);
  const cc = await ins(S.contractCompanies, [{ name: "Meridian Contracting Ltd", code: "MER" }, { name: "Apex Technical Services", code: "APX" }]);

  // ---------- training catalogue ----------
  const prov = await ins(S.trainingProviders, [
    { name: "Northgate Learning Academy", description: "Internal training team", website: "https://example.com/academy" },
    { name: "Fieldstone Safety Training", description: "External safety and emergency courses", website: "https://example.com/fieldstone" },
    { name: "Summit Technical Institute", description: "External technical and leadership courses", website: "https://example.com/summit" },
  ]);
  const P = (n: string) => prov.find((p) => p.name.startsWith(n))?.id as string;

  const tcats = await ins(S.trainingCategories, [
    { name: "Safety & Emergency", description: "Core safety and emergency response", color: "#dc2626", order: 1 },
    { name: "Technical - Operations", description: "Operating the plant", color: "#2563eb", order: 2 },
    { name: "Technical - Maintenance", description: "Maintaining plant and equipment", color: "#16a34a", order: 3 },
    { name: "Leadership & Management", description: "Supervision and people leadership", color: "#9333ea", order: 4 },
    { name: "Regulatory & Compliance", description: "Statutory and company requirements", color: "#ea580c", order: 5 },
  ]);
  const TC = (n: string) => tcats.find((c) => c.name.startsWith(n))?.id as string;

  // code, name, category, validity (months|null), safety critical, delivery (I/E), source (E/TC/OJT), hours, provider
  const trainDefs: [string, string, string, number | null, boolean, string, string, string, string][] = [
    ["10101", "Basic Site Safety Induction", "Safety", 24, true, "I", "E", "4", "Northgate"],
    ["10108", "Contractor Site Induction", "Safety", 24, true, "I", "E", "3", "Northgate"],
    ["10102", "Working at Height Practitioner", "Safety", 36, true, "E", "TC", "8", "Fieldstone"],
    ["10103", "Confined Space Entry (Entrant)", "Safety", 36, true, "E", "TC", "16", "Fieldstone"],
    ["10104", "First Aid at Work", "Safety", 36, false, "E", "TC", "24", "Fieldstone"],
    ["10105", "Fire Warden", "Safety", 24, false, "I", "TC", "4", "Northgate"],
    ["10106", "Breathing Apparatus", "Safety", 12, true, "E", "TC", "16", "Fieldstone"],
    ["10107", "Emergency Response Team Member", "Safety", 24, false, "I", "TC", "16", "Northgate"],
    ["20201", "Process Safety Fundamentals", "Technical - Operations", 36, false, "I", "E", "8", "Northgate"],
    ["20202", "Control Room Operations", "Technical - Operations", null, false, "I", "OJT", "TBC", "Northgate"],
    ["20203", "Plant Walk-down and Field Rounds", "Technical - Operations", null, false, "I", "OJT", "TBC", "Northgate"],
    ["20204", "Permit to Work Receiver", "Technical - Operations", 36, true, "I", "TC", "6", "Northgate"],
    ["20205", "Gas Testing Equipment", "Technical - Operations", 24, true, "E", "TC", "8", "Summit"],
    ["30301", "Mechanical Maintenance Fundamentals", "Technical - Maintenance", null, false, "E", "TC", "40", "Summit"],
    ["30302", "Electrical Safety Rules", "Technical - Maintenance", 36, true, "E", "TC", "16", "Summit"],
    ["30303", "Instrument Loop Testing", "Technical - Maintenance", null, false, "E", "TC", "24", "Summit"],
    ["30304", "Lifting Operations Awareness", "Technical - Maintenance", 24, false, "E", "TC", "8", "Fieldstone"],
    ["30305", "Hot Work Awareness", "Technical - Maintenance", 24, true, "I", "E", "2", "Northgate"],
    ["40401", "First Line Leadership", "Leadership", null, false, "E", "TC", "24", "Summit"],
    ["40402", "Coaching Skills", "Leadership", null, false, "I", "TC", "8", "Northgate"],
    ["40403", "Incident Investigation Techniques", "Leadership", 36, false, "E", "TC", "16", "Summit"],
    ["50501", "Data Protection Awareness", "Regulatory", 12, false, "I", "E", "1", "Northgate"],
    ["50502", "Environmental Awareness Briefing", "Regulatory", 24, false, "I", "E", "2", "Northgate"],
    ["50503", "Manual Handling Essentials", "Regulatory", 36, false, "I", "E", "2", "Northgate"],
  ];
  const trainings = await ins(S.trainings, trainDefs.map(([code, name, cat, validity, safety, dm, src, hrs, pv]) => ({
    code, name, categoryId: TC(cat), validityPeriod: validity, isSafetyCritical: safety, deliveryMethod: dm,
    trainingSource: src, estimatedHours: hrs, preferredProviderId: P(pv), description: `${name} - demonstration course.`,
  })));
  const T = (code: string) => trainings.find((t) => t.code === code)!;

  // ---------- job roles ----------
  type JR = { code: string; name: string; family: string; bu: string; loc: string; level: string; std?: string; critical?: boolean; desc: string };
  const roleDefs: JR[] = [
    { code: "OPS-CRO", name: "Control Room Operator", family: "FOPS", bu: "OPS", loc: "NFT", level: "technician", std: "Technician", desc: "Monitors and controls the process from the control room." },
    { code: "OPS-SCRO", name: "Senior Control Room Operator", family: "FOPS", bu: "OPS", loc: "NFT", level: "senior_technician", std: "Lead Technician", desc: "Leads the control room team and coaches operators." },
    { code: "OPS-FO", name: "Field Operator", family: "FOPS", bu: "OPS", loc: "NFT", level: "technician", std: "Technician", desc: "Carries out plant rounds, isolations and routine operations in the field." },
    { code: "OPS-STL", name: "Shift Team Leader", family: "FLDR", bu: "OPS", loc: "NFT", level: "supervisor", std: "Supervisor", critical: true, desc: "Leads a shift team and is the site's first point of command." },
    { code: "MNT-MT", name: "Mechanical Technician", family: "FMNT", bu: "EM", loc: "NFT", level: "technician", std: "Technician", desc: "Maintains rotating and static mechanical equipment." },
    { code: "MNT-ET", name: "Electrical Maintenance Technician", family: "FMNT", bu: "EM", loc: "NFT", level: "technician", std: "Technician", desc: "Maintains electrical systems and carries out electrical isolations." },
    { code: "MNT-ICT", name: "Instrument & Control Technician", family: "FMNT", bu: "EM", loc: "HBP", level: "technician", std: "Technician", desc: "Calibrates and maintains instruments, control and safety systems." },
    { code: "MNT-SUP", name: "Maintenance Supervisor", family: "FLDR", bu: "EM", loc: "NFT", level: "supervisor", std: "Supervisor", critical: true, desc: "Plans and supervises maintenance work across disciplines." },
    { code: "ENG-PE", name: "Process Engineer (Operations Support)", family: "FTEC", bu: "EM", loc: "HBP", level: "engineer", std: "Graduate Engineer", desc: "Supports plant performance, start-ups and process safety studies." },
    { code: "HSE-ADV", name: "HSE Advisor", family: "FLDR", bu: "HSEA", loc: "RSO", level: "advisor", std: "HSE Advisor", desc: "Advises on health, safety and environment and leads investigations." },
    { code: "LC-LEAD", name: "Competence & Training Lead", family: "FLDR", bu: "LC", loc: "RSO", level: "specialist", std: "Technical Authority", desc: "Owns the competence assurance system and assessor network." },
    { code: "MGT-SM", name: "Site Manager", family: "FLDR", bu: "OPS", loc: "NFT", level: "manager", std: "Superintendent", critical: true, desc: "Accountable for safe, reliable operation of a site." },
  ];
  const roles = await ins(S.jobRoles, roleDefs.map((r) => ({
    code: r.code, name: r.name, description: r.desc, department: bus.find((b) => b.code === r.bu)!.name,
    location: L[r.loc].name, businessUnit: bus.find((b) => b.code === r.bu)!.name, level: r.level,
    standardLevelId: r.std ? lvl(r.std) : null, locationId: L[r.loc].id, businessUnitId: B[r.bu].id,
    jobFamilyId: F[r.family].id, successionCritical: !!r.critical,
  })));
  const R = (code: string) => roles.find((r) => r.code === code)!;

  // ---------- competence standards (invented, generic) ----------
  const cats = await ins(S.competencyCategories, [
    { name: "Safe Systems of Work", code: "SSW", description: "Controlling hazardous work", order: 1 },
    { name: "Process & Operations", code: "OPS", description: "Operating the plant safely", order: 2 },
    { name: "Maintenance & Integrity", code: "MNI", description: "Keeping equipment safe and reliable", order: 3 },
    { name: "Emergency Response", code: "EMR", description: "Responding to incidents", order: 4 },
    { name: "HSE & Learning", code: "HSE", description: "Learning from events and developing people", order: 5 },
  ]);
  const CAT = (c: string) => cats.find((x) => x.code === c)!.id as string;

  type EL = { code: string; cat: string; name: string; crit: string; months: number; desc: string; K: string[]; P: string[] };
  const E: EL[] = [
    { code: "SSW-01", cat: "SSW", name: "Permit to Work - Issuing and Control", crit: "High", months: 36, desc: "Issue, control and close permits so work starts and ends safely.",
      K: ["Explain the purpose, scope and limits of the permit-to-work system", "Describe the roles of issuer, receiver and performing authority", "State the conditions under which a permit must be suspended or cancelled"],
      P: ["Assess a work request and identify hazards and controls before issuing", "Issue a permit with accurate scope, isolations and gas-test requirements", "Handle a permit handback and confirm the plant is safe to return to service"] },
    { code: "SSW-02", cat: "SSW", name: "Process Isolation and Lock-Out", crit: "High", months: 36, desc: "Plan, apply and prove isolations before intrusive work.",
      K: ["Describe the isolation methods used on site and when each is appropriate", "Explain how isolation integrity is proven before work starts", "Identify the risks of trapped pressure and stored energy"],
      P: ["Plan an isolation using the approved isolation schedule", "Apply, test and record locks and tags correctly", "Verify de-pressurisation and prove the isolation is effective"] },
    { code: "SSW-03", cat: "SSW", name: "Gas Testing and Atmospheric Monitoring", crit: "High", months: 24, desc: "Test and monitor atmospheres for work and entry.",
      K: ["Explain the hazards of flammable, toxic and oxygen-deficient atmospheres", "State the action levels for the gases monitored on site", "Describe calibration and bump-test requirements for portable detectors"],
      P: ["Bump-test and zero a portable gas detector before use", "Carry out a gas test in a work area and record the readings", "Respond correctly to an alarm or out-of-range reading"] },
    { code: "OPS-01", cat: "OPS", name: "Plant Start-up and Shutdown", crit: "High", months: 36, desc: "Bring units on and off line within the operating envelope.",
      K: ["Describe the sequence and critical checks for a normal start-up", "Explain the key process limits and trip settings", "Identify the hazards present during transient operation"],
      P: ["Carry out pre-start-up checks against the approved procedure", "Bring a unit on line within the operating envelope", "Shut down a unit safely and secure it for maintenance"] },
    { code: "OPS-02", cat: "OPS", name: "Alarm Management and Response", crit: "Medium", months: 36, desc: "Respond to process alarms promptly and correctly.",
      K: ["Explain the alarm priority scheme and expected response times", "Describe how nuisance and standing alarms are managed", "State when an alarm requires escalation"],
      P: ["Acknowledge and respond to a high-priority alarm correctly", "Use trends and graphics to diagnose the cause of an alarm", "Log and hand over alarm status at shift change"] },
    { code: "OPS-03", cat: "OPS", name: "Hazardous Area Awareness", crit: "High", months: 36, desc: "Work safely in classified areas.",
      K: ["Explain hazardous area classification and zone definitions", "Describe the types of protected equipment and their markings", "State the controls for ignition sources in classified areas"],
      P: ["Identify zone boundaries on site drawings and on the ground", "Inspect equipment for suitability in a classified area", "Apply the correct controls before introducing a potential ignition source"] },
    { code: "MNI-01", cat: "MNI", name: "Rotating Equipment Maintenance", crit: "Medium", months: 48, desc: "Inspect and maintain pumps and similar rotating plant.",
      K: ["Describe the main failure modes of pumps and compressors", "Explain alignment, lubrication and vibration monitoring basics", "State the safe-isolation requirements for rotating plant"],
      P: ["Carry out a routine inspection and condition check on a pump set", "Perform a shaft alignment to the required tolerance", "Complete the work order with accurate findings and parts used"] },
    { code: "MNI-02", cat: "MNI", name: "Electrical Safety and Isolation", crit: "High", months: 24, desc: "Isolate, prove dead and restore electrical systems safely.",
      K: ["Explain safe working distances and the hierarchy of electrical controls", "Describe the isolation, proving dead and earthing sequence", "State the limits of authority for low and high voltage work"],
      P: ["Isolate and prove dead a low-voltage circuit", "Apply personal protective grounding and record it", "Restore supply safely following completion of work"] },
    { code: "MNI-03", cat: "MNI", name: "Instrument Calibration and Loop Checking", crit: "Medium", months: 36, desc: "Calibrate and check measurement and control loops.",
      K: ["Explain the principles of common measurement technologies on site", "Describe the as-found and as-left calibration process", "State the consequences of overriding or bypassing safety instrumentation"],
      P: ["Calibrate a pressure transmitter and record as-found and as-left data", "Perform a loop check from field device to control system", "Apply and remove an authorised override using the correct procedure"] },
    { code: "EMR-01", cat: "EMR", name: "Emergency Response - Incident Controller", crit: "High", months: 24, desc: "Take command of an emergency and manage the response.",
      K: ["Describe the emergency organisation and the incident controller's authority", "Explain the site emergency plans and mustering arrangements", "State the communication and notification requirements for an escalating incident"],
      P: ["Take command during a simulated emergency and establish priorities", "Direct response teams and maintain a clear incident log", "Stand down the response and run a structured debrief"] },
    { code: "EMR-02", cat: "EMR", name: "Fire and Gas Detection Response", crit: "Medium", months: 36, desc: "Respond to fire and gas detection events.",
      K: ["Describe the fire and gas detection layout and voting logic", "Explain the automatic actions on confirmed fire or gas", "State the manual response steps for a detector alarm"],
      P: ["Verify a detector alarm and decide the appropriate response", "Operate emergency shutdown or isolation when required", "Reset the system and confirm normal status after an event"] },
    { code: "HSE-01", cat: "HSE", name: "Incident Investigation", crit: "Medium", months: 48, desc: "Investigate events and drive learning.",
      K: ["Explain the incident reporting and classification requirements", "Describe structured methods for finding root causes", "State what evidence must be preserved after an incident"],
      P: ["Gather evidence and interview witnesses fairly and accurately", "Build a timeline and identify causal factors", "Write recommendations that are specific, owned and time-bound"] },
    { code: "LC-01", cat: "HSE", name: "Coaching and Assessing Competence", crit: "Medium", months: 48, desc: "Plan and carry out fair, valid workplace assessments.",
      K: ["Explain the principles of valid, reliable and fair assessment", "Describe how to plan an assessment and select suitable methods", "State the record-keeping and verification requirements"],
      P: ["Plan and brief a candidate for a workplace assessment", "Observe, question and judge evidence against the criteria", "Give constructive feedback and record the outcome accurately"] },
  ];

  // ---------- people ----------
  type Person = { key: string; first: string; last: string; role: string; jr: string; loc: string; mgr?: string; years: number; shift?: string; contractor?: boolean };
  const adminEmail = process.env.DEMO_ADMIN_EMAIL || "demo.admin@example.com";
  const staff: Person[] = [
    { key: "helen", first: "Helen", last: "Marsh", role: "manager", jr: "MGT-SM", loc: "NFT", years: 22 },
    { key: "raj", first: "Raj", last: "Patel", role: "manager", jr: "MGT-SM", loc: "HBP", years: 19 },
    { key: "ian", first: "Ian", last: "Dunmore", role: "manager", jr: "MNT-SUP", loc: "NFT", mgr: "helen", years: 17 },
    { key: "claire", first: "Claire", last: "Hobson", role: "manager", jr: "OPS-STL", loc: "NFT", mgr: "helen", years: 12, shift: "Day Shift" },
    { key: "tom", first: "Tom", last: "Bellamy", role: "manager", jr: "OPS-STL", loc: "HBP", mgr: "raj", years: 15, shift: "Night Shift" },
    { key: "sophie", first: "Sophie", last: "Whitfield", role: "admin", jr: "LC-LEAD", loc: "RSO", years: 14 },
    { key: "liam", first: "Liam", last: "Fenwick", role: "assessor", jr: "OPS-SCRO", loc: "NFT", mgr: "claire", years: 16, shift: "Day Shift" },
    { key: "priya", first: "Priya", last: "Nair", role: "assessor", jr: "ENG-PE", loc: "HBP", mgr: "raj", years: 11 },
    { key: "dan", first: "Dan", last: "Kowalski", role: "assessor", jr: "MNT-MT", loc: "NFT", mgr: "ian", years: 18 },
    { key: "fiona", first: "Fiona", last: "Gallagher", role: "assessor", jr: "MNT-ICT", loc: "HBP", mgr: "raj", years: 13 },
    { key: "neil", first: "Neil", last: "Ashworth", role: "internal_verifier", jr: "LC-LEAD", loc: "RSO", mgr: "sophie", years: 20 },
    { key: "yasmin", first: "Yasmin", last: "Qureshi", role: "internal_verifier", jr: "HSE-ADV", loc: "RSO", mgr: "sophie", years: 12 },
  ];
  const firsts = ["Aisha", "Ben", "Callum", "Dani", "Ewan", "Farah", "Gareth", "Hannah", "Imran", "Jess", "Kieran", "Laura", "Mohammed", "Nina", "Owen", "Paula", "Rosa", "Sam", "Tariq", "Una", "Vikram", "Wendy", "Yusuf", "Zoe", "Alfie", "Bethan", "Connor", "Deepa", "Grace"];
  const lasts = ["Abbott", "Brennan", "Castillo", "Dhillon", "Ellison", "Foster", "Gupta", "Haines", "Iqbal", "Jennings", "Kerr", "Lowe", "Mahmood", "Nolan", "O'Neill", "Pryce", "Rahman", "Stirling", "Thakur", "Underwood", "Vance", "Walsh", "Yates", "Zielinski", "Archer", "Blake", "Chaudhry", "Doyle", "Okafor"];
  // role code, location code, count, manager key
  const crew: [string, string, number, string][] = [
    ["OPS-CRO", "NFT", 3, "claire"], ["OPS-CRO", "HBP", 2, "tom"], ["OPS-SCRO", "HBP", 1, "tom"],
    ["OPS-FO", "NFT", 4, "claire"], ["OPS-FO", "HBP", 4, "tom"],
    ["MNT-MT", "NFT", 3, "ian"], ["MNT-MT", "HBP", 1, "raj"], ["MNT-ET", "NFT", 3, "ian"],
    ["MNT-ICT", "HBP", 2, "raj"], ["MNT-ICT", "NFT", 1, "ian"],
    ["ENG-PE", "HBP", 2, "raj"], ["ENG-PE", "NFT", 1, "helen"], ["HSE-ADV", "RSO", 1, "sophie"],
  ];
  const people: Person[] = [...staff];
  let n = 0;
  for (const [jr, loc, count, mgr] of crew) {
    for (let i = 0; i < count; i++, n++) {
      const first = firsts[n % firsts.length]; const last = lasts[(n * 7 + 3) % lasts.length];
      people.push({ key: `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, ""), first, last, role: "candidate", jr, loc, mgr, years: between(1, jr === "OPS-SCRO" ? 20 : 15),
        shift: jr.startsWith("OPS") ? pick(["Day Shift", "Night Shift"]) : undefined, contractor: (jr === "MNT-ET" || jr === "MNT-ICT") && chance(0.35) });
    }
  }
  const keys = new Set<string>(); for (const p of people) { while (keys.has(p.key)) p.key += "x"; keys.add(p.key); }
  const uid = (k: string) => `demo-${k}`;

  const userRows: any[] = [{
    id: uid("admin"), email: adminEmail, firstName: "Demo", lastName: "Administrator", role: "super_admin",
    department: "Learning & Competence", location: L.RSO.name, locationId: L.RSO.id, businessUnitId: B.LC.id,
    companyNumber: "NG1000", employmentType: "employee", startDate: addMonths(now, -60), yearsOfExperience: 25, isActive: true,
  }];
  people.forEach((p, i) => {
    const role = R(p.jr); const bu = roleDefs.find((r) => r.code === p.jr)!.bu;
    userRows.push({
      id: uid(p.key), email: `${p.first}.${p.last}`.toLowerCase().replace(/[^a-z.]/g, "") + "@example.com",
      firstName: p.first, lastName: p.last, role: p.role, department: B[bu].name, location: L[p.loc].name, teamShift: p.shift ?? null,
      jobRoleId: role.id, companyNumber: `NG${1001 + i}`, locationId: L[p.loc].id, businessUnitId: B[bu].id,
      managerId: p.mgr ? uid(p.mgr) : (p.jr === "LC-LEAD" || p.jr === "MGT-SM" ? null : uid("admin")),
      employmentType: p.contractor ? "contractor" : "employee", contractCompanyId: p.contractor ? pick(cc).id : null,
      startDate: addMonths(now, -between(8, 180)), yearsOfExperience: p.years, isActive: true,
    });
  });
  await ins(S.users, userRows);
  // asset leaders for the org chart
  await db.update(S.businessUnits).set({ leaderId: uid("helen") }).where(sql`${S.businessUnits.code} = 'OPS'`);
  await db.update(S.businessUnits).set({ leaderId: uid("ian") }).where(sql`${S.businessUnits.code} = 'EM'`);
  await db.update(S.businessUnits).set({ leaderId: uid("sophie") }).where(sql`${S.businessUnits.code} IN ('LC','HSEA')`);

  // ---------- competence standards into the DB ----------
  const elementRows = await ins(S.competencyElements, E.map((e, i) => ({
    categoryId: CAT(e.cat), name: e.name, code: e.code, description: e.desc, proficiencyScale: "one-point", proficiencyScheme: 1,
    safetyCriticality: e.crit, reassessmentYears: Math.round(e.months / 12), validityMonths: e.months, isCurrent: true, order: i,
  })));
  const EL = (code: string) => elementRows.find((e) => e.code === code)!;
  const subs = await ins(S.competenceSubcategories, E.flatMap((e) => [
    { elementId: EL(e.code).id, name: "Knowledge", type: "knowledge", order: 1 },
    { elementId: EL(e.code).id, name: "Performance", type: "performance", order: 2 },
  ]));
  const crit: any[] = [];
  for (const e of E) {
    const el = EL(e.code);
    const kSub = subs.find((s) => s.elementId === el.id && s.type === "knowledge")!;
    const pSub = subs.find((s) => s.elementId === el.id && s.type === "performance")!;
    e.K.forEach((t, i) => crit.push({ elementId: el.id, subcategoryId: kSub.id, code: `K 1.${i + 1}`, criteriaText: t, description: t, type: "knowledge", subcategoryNumber: 1, criteriaNumber: i + 1, required: true }));
    e.P.forEach((t, i) => crit.push({ elementId: el.id, subcategoryId: pSub.id, code: `P 2.${i + 1}`, criteriaText: t, description: t, type: "performance", subcategoryNumber: 2, criteriaNumber: i + 1, required: true }));
  }
  await ins(S.competenceCriteria, crit);

  // review cycles for the "Competence Standards Review" page: a spread of overdue / due soon / healthy
  const review: [string, number, number][] = [ // code, cycle months, months since last review
    ["SSW-01", 24, 25.2], ["SSW-02", 12, 11.6], ["SSW-03", 24, 22.2], ["OPS-01", 36, 33.1], ["EMR-01", 12, 2.5], ["MNI-02", 24, 6.0],
  ];
  for (const [code, cycle, since] of review) {
    const last = new Date(now.getTime() - since * 30.44 * DAY);
    await db.update(S.competencyElements).set({
      reviewCycleMonths: cycle, lastReviewedAt: last, lastReviewedBy: uid("neil"),
      standardOwnerId: uid("sophie"), standardApproverId: uid("helen"), standardReviewerId: uid("neil"),
    }).where(sql`${S.competencyElements.code} = ${code}`);
  }
  await ins(S.competencyElementReviewHistory, [
    { elementId: EL("EMR-01").id, reviewedBy: uid("neil"), reviewedAt: new Date(now.getTime() - 2.5 * 30.44 * DAY), comment: "Reviewed after the annual emergency exercise - no changes needed.", previousDueDate: daysFromNow(-60) },
    { elementId: EL("MNI-02").id, reviewedBy: uid("neil"), reviewedAt: new Date(now.getTime() - 6 * 30.44 * DAY), comment: "Updated isolation steps to match the revised electrical safety rules.", previousDueDate: daysFromNow(-170) },
    { elementId: EL("SSW-02").id, reviewedBy: uid("sophie"), reviewedAt: new Date(now.getTime() - 11.6 * 30.44 * DAY), comment: "Clarified proving requirements for trapped pressure.", previousDueDate: daysFromNow(-340) },
  ]);

  // ---------- role requirements ----------
  const roleEls: Record<string, [string, string][]> = {
    "OPS-CRO": [["SSW-01", "M"], ["SSW-02", "M"], ["OPS-01", "M"], ["OPS-02", "M"], ["OPS-03", "M"], ["EMR-02", "R"]],
    "OPS-SCRO": [["SSW-01", "M"], ["SSW-02", "M"], ["OPS-01", "M"], ["OPS-02", "M"], ["OPS-03", "M"], ["EMR-02", "R"], ["EMR-01", "R"], ["LC-01", "R"]],
    "OPS-FO": [["SSW-02", "M"], ["SSW-03", "M"], ["OPS-03", "M"], ["OPS-01", "R"], ["EMR-02", "R"]],
    "OPS-STL": [["SSW-01", "M"], ["OPS-01", "M"], ["EMR-01", "M"], ["HSE-01", "M"], ["LC-01", "R"]],
    "MNT-MT": [["SSW-02", "M"], ["MNI-01", "M"], ["OPS-03", "M"], ["SSW-03", "R"]],
    "MNT-ET": [["SSW-02", "M"], ["MNI-02", "M"], ["OPS-03", "M"]],
    "MNT-ICT": [["SSW-02", "M"], ["MNI-03", "M"], ["OPS-03", "M"], ["OPS-02", "R"]],
    "MNT-SUP": [["SSW-01", "M"], ["MNI-01", "M"], ["MNI-02", "R"], ["LC-01", "R"], ["HSE-01", "M"]],
    "ENG-PE": [["OPS-01", "M"], ["OPS-02", "M"], ["HSE-01", "M"], ["SSW-01", "R"]],
    "HSE-ADV": [["HSE-01", "M"], ["SSW-03", "R"], ["EMR-01", "R"], ["SSW-01", "R"]],
    "LC-LEAD": [["LC-01", "M"], ["HSE-01", "R"]],
    "MGT-SM": [["EMR-01", "M"], ["HSE-01", "M"], ["SSW-01", "R"], ["LC-01", "R"]],
  };
  await ins(S.roleElements, Object.entries(roleEls).flatMap(([jr, list]) => list.map(([code, lvlCode]) => ({
    roleId: R(jr).id, elementId: EL(code).id, requirementLevel: lvlCode, required: lvlCode !== "D", activityType: "both",
  }))));

  const common: [string, string][] = [["10101", "M"], ["50503", "M"], ["50501", "M"], ["50502", "R"]];
  const roleTr: Record<string, [string, string][]> = {
    "OPS-CRO": [["20201", "M"], ["20202", "R"], ["20204", "M"], ["10105", "D"]],
    "OPS-SCRO": [["20201", "M"], ["20202", "R"], ["20204", "M"], ["10107", "R"], ["40402", "R"]],
    "OPS-FO": [["20201", "M"], ["20203", "M"], ["20205", "M"], ["10102", "M"], ["10103", "M"], ["10106", "R"], ["10105", "R"]],
    "OPS-STL": [["20201", "M"], ["40401", "M"], ["40402", "R"], ["10107", "M"], ["10105", "M"]],
    "MNT-MT": [["30301", "M"], ["30304", "M"], ["30305", "M"], ["10102", "M"], ["10103", "M"]],
    "MNT-ET": [["30302", "M"], ["30305", "R"], ["10102", "M"], ["10103", "M"]],
    "MNT-ICT": [["30303", "M"], ["30302", "R"], ["10103", "M"], ["10102", "M"]],
    "MNT-SUP": [["40401", "M"], ["30301", "M"], ["30302", "M"], ["40403", "M"]],
    "ENG-PE": [["20201", "M"], ["40403", "R"]],
    "HSE-ADV": [["40403", "M"], ["20205", "R"], ["10104", "M"]],
    "LC-LEAD": [["40402", "M"]],
    "MGT-SM": [["40401", "M"], ["10107", "M"]],
  };
  // "any one of" group: roles that can satisfy site induction with either the staff or contractor course
  const groupRoles = ["OPS-FO", "MNT-MT", "MNT-ET", "MNT-ICT"];
  const groups = await ins(S.trainingRequirementGroups, groupRoles.map((jr) => ({ roleId: R(jr).id, label: "Site Safety Induction (any one)" })));
  const roleTrRows: any[] = [];
  for (const [jr, list] of Object.entries(roleTr)) {
    const grp = groups.find((g) => g.roleId === R(jr).id);
    for (const [code, lvlCode] of list) roleTrRows.push({ roleId: R(jr).id, trainingId: T(code).id, requirementLevel: lvlCode, required: lvlCode !== "D" });
    for (const [code, lvlCode] of common) {
      if (code === "10101" && grp) continue; // handled by the group below
      roleTrRows.push({ roleId: R(jr).id, trainingId: T(code).id, requirementLevel: lvlCode, required: lvlCode !== "D" });
    }
    if (grp) { roleTrRows.push({ roleId: R(jr).id, trainingId: T("10101").id, requirementLevel: "M", required: true, groupId: grp.id }); roleTrRows.push({ roleId: R(jr).id, trainingId: T("10108").id, requirementLevel: "M", required: true, groupId: grp.id }); }
  }
  await ins(S.roleTrainings, roleTrRows);

  // ---------- allocations, enrollments and assessments ----------
  const assessorFor = (p: Person): string => {
    if (p.jr.startsWith("OPS")) return uid(p.loc === "HBP" ? "priya" : "liam");
    if (p.jr === "MNT-ICT" || p.loc === "HBP") return uid("fiona");
    if (p.jr.startsWith("MNT")) return uid("dan");
    return uid(pick(["liam", "dan", "fiona", "priya"]));
  };
  const methods = [["Observation", "Questioning"], ["Observation", "Simulation"], ["Questioning", "Product evidence"], ["Demonstration", "Questioning"]];

  const allocRows: any[] = [], enrolRows: any[] = [], assessRows: any[] = [];
  for (const p of people) {
    const profile = (() => { const r = rnd(); return r < 0.35 ? "strong" : r < 0.8 ? "average" : "behind"; })();
    const pTrain = profile === "strong" ? 0.95 : profile === "average" ? 0.78 : 0.45;
    const pComp = profile === "strong" ? 0.92 : profile === "average" ? 0.66 : 0.3;
    const me = uid(p.key);
    // assessors are assessed by a peer assessor; everyone else by the assessor covering their site/discipline
    const peer: Record<string, string> = { liam: "dan", dan: "liam", priya: "fiona", fiona: "priya" };
    const assessor = p.role === "assessor" ? uid(peer[p.key]) : assessorFor(p);
    if (!["admin", "internal_verifier"].includes(p.role)) allocRows.push({ assessorId: assessor, candidateId: me, allocatedBy: uid("sophie") });

    // training enrolments for this role's requirements (group members counted once as alternatives)
    const rows = roleTrRows.filter((r) => r.roleId === R(p.jr).id);
    const handledGroup = new Set<string>();
    for (const r of rows) {
      if (r.requirementLevel === "D" && chance(0.5)) continue;
      if (r.groupId) { if (handledGroup.has(r.groupId)) continue; handledGroup.add(r.groupId); }
      const t = trainings.find((x) => x.id === r.trainingId)!;
      const v: number | null = t.validityPeriod;
      const trainingId = r.groupId ? (p.contractor ? T("10108").id : T("10101").id) : r.trainingId;
      if (chance(pTrain)) {
        let ach = daysFromNow(-between(30, v ? Math.max(60, v * 30 - 40) : 1400));
        const roll = rnd();
        if (v && roll < 0.08) ach = addMonths(now, -(v + between(1, 5)));          // lapsed
        else if (v && roll < 0.2) ach = addMonths(daysFromNow(between(5, 70)), -v); // expiring soon
        enrolRows.push({ userId: me, trainingId, allocatedBy: uid("sophie"), allocatedDate: new Date(ach.getTime() - between(10, 40) * DAY),
          dueDate: new Date(ach.getTime() - between(1, 10) * DAY), status: "completed", achievementDate: ach, expiryDate: v ? addMonths(ach, v) : null });
      } else if (chance(0.5)) {
        enrolRows.push({ userId: me, trainingId, allocatedBy: uid("sophie"), allocatedDate: daysFromNow(-between(10, 60)), dueDate: daysFromNow(between(15, 120)), status: "in_progress" });
      } else {
        enrolRows.push({ userId: me, trainingId, allocatedBy: uid("sophie"), allocatedDate: daysFromNow(-between(20, 120)), dueDate: chance(0.2) ? daysFromNow(-between(5, 40)) : daysFromNow(between(10, 150)), status: "allocated" });
      }
    }

    // competence assessments for the role's elements
    const stdLevel = roleDefs.find((r) => r.code === p.jr)!.std || "";
    const scored = ["Graduate Engineer", "Engineer", "Technical Authority"].includes(stdLevel);
    for (const [code, lvlCode] of roleEls[p.jr] || []) {
      if (lvlCode === "D") continue;
      const el = E.find((e) => e.code === code)!; const elRow = EL(code);
      const base: any = { candidateId: me, elementId: elRow.id, assessorId: assessor, isActive: true };
      if (chance(pComp)) {
        let signOff = daysFromNow(-between(25, Math.max(60, el.months * 30 - 50)));
        const roll = rnd();
        if (roll < 0.07) signOff = addMonths(daysFromNow(between(10, 80)), -el.months);       // expiring soon
        else if (roll < 0.10) signOff = addMonths(now, -(el.months + between(1, 4)));          // lapsed
        const minor = chance(0.1);
        assessRows.push({ ...base, assessmentDate: signOff, outcome: minor ? "competent_with_minor_needs" : "competent", assessmentMethods: pick(methods),
          assessorComments: pick(["Good command of the procedure and sound judgement.", "Confident, safe and consistent throughout.", "Met all criteria; evidence well documented.", "Strong practical performance and clear explanations."]),
          knowledgeOutcomes: "Met", performanceOutcomes: "Met", overallComment: "Competent.", signOffAt: signOff, signOffAssessorId: assessor,
          minorNeedsComment: minor ? "Tidy up record-keeping on handback." : null, minorNeedsDueDate: minor ? daysFromNow(between(14, 60)) : null,
          expiryDate: addMonths(signOff, el.months), isAssignment: false, isReassessment: chance(0.3), createdAt: signOff,
          ...(scored ? { selfScore: between(2, 4), assessorScore: between(3, 4), selfScoreAt: new Date(signOff.getTime() - 10 * DAY) } : {}) });
      } else if (chance(0.3)) {
        const when = daysFromNow(-between(15, 120));
        assessRows.push({ ...base, assessmentDate: when, outcome: "not_yet_competent", assessmentMethods: pick(methods),
          assessorComments: "Gaps in applying the procedure under time pressure; development actions agreed.",
          knowledgeOutcomes: "Met", performanceOutcomes: "Not yet met", overallComment: "Further practice required before reassessment.",
          signOffAt: when, signOffAssessorId: assessor, isAssignment: false, createdAt: when });
      } else {
        const assigned = daysFromNow(-between(10, 200));
        const planned = chance(0.35);
        assessRows.push({ ...base, assessmentDate: assigned, outcome: "not_yet_competent", assessmentMethods: [], assessorComments: "Auto-assigned from job role",
          isAssignment: true, origin: "role_assignment", createdAt: assigned,
          plannedAssessmentDate: planned ? daysFromNow(between(3, 45)) : null,
          plannedAssessmentLocation: planned ? L[p.loc === "RSO" ? "NFT" : p.loc].name : null,
          plannedAssessmentNotes: planned ? "Bring your logbook and recent work records." : null,
          candidateReadyAt: chance(0.2) ? daysFromNow(-between(1, 14)) : null });
      }
    }
  }
  await ins(S.candidateAllocations, allocRows);
  await ins(S.trainingEnrollments, enrolRows);
  const assessInserted = await ins(S.assessments, assessRows);

  // ---------- internal verification: IVs evaluate assessors' decisions and report quality ----------
  // Each IV is allocated two assessors and holds a sampling plan for each. A sample of signed-off
  // assessments is verified against the 17-point Internal Verification Record; assessors differ in
  // how often their judgements are agreed, so the IV reporting has something real to show.
  const verifierOf: Record<string, string> = { liam: "neil", dan: "neil", priya: "yasmin", fiona: "yasmin" };
  await ins(S.verifierAllocations, Object.entries(verifierOf).map(([a, v]) => ({ verifierId: uid(v), assessorId: uid(a), allocatedBy: uid("sophie") })));
  const planTarget: Record<string, number> = { liam: 10, dan: 15, priya: 20, fiona: 25 };
  await ins(S.samplingPlans, Object.entries(verifierOf).map(([a, v]) => ({
    verifierId: uid(v), assessorId: uid(a), targetPercentage: planTarget[a],
    periodStartDate: new Date(now.getFullYear(), 0, 1), periodEndDate: new Date(now.getFullYear(), 11, 31),
  })));
  const agreeRate: Record<string, number> = { liam: 0.93, dan: 0.86, priya: 0.75, fiona: 0.6 };
  const checklist = (bad: number[]) => Object.fromEntries(S.INTERNAL_VERIFICATION_CHECKLIST.map((c) => [String(c.item), bad.includes(c.item) ? "no" : (c.item === 12 && chance(0.2) ? "na" : "yes")]));
  const verRows: any[] = [], pendingTasks: any[] = [], verSource: any[] = [];
  for (const a of Object.keys(verifierOf)) {
    const signed = assessInserted.filter((x) => x.assessorId === uid(a) && x.signOffAt && !x.isAssignment && x.candidateId !== uid(a))
      .sort(() => rnd() - 0.5);
    const nVer = Math.max(3, Math.round(signed.length * 0.45));
    signed.slice(0, nVer).forEach((as) => {
      const r = rnd();
      const outcome = r < agreeRate[a] ? "agreed" : r < agreeRate[a] + (1 - agreeRate[a]) * 0.65 ? "further_evidence_required" : "disagreed";
      const vDate = new Date(Math.min(now.getTime() - 2 * DAY, new Date(as.signOffAt).getTime() + between(3, 25) * DAY));
      const bad = outcome === "agreed" ? [] : outcome === "disagreed" ? [5, 6, 11] : pick([[6, 14], [9, 10], [14, 15]]);
      verSource.push(as);
      verRows.push({
        assessmentId: as.id, verifierId: uid(verifierOf[a]), verificationDate: vDate, outcome,
        verifierComments: outcome === "agreed" ? pick(["Judgement supported by the evidence; the assessment report is clear and complete.", "Sound decision, well-documented evidence and constructive candidate feedback."])
          : outcome === "further_evidence_required" ? "Outcome is reasonable but performance evidence is thin for one criterion; add the observation record before this is closed."
          : "The evidence presented does not support the competent judgement against the performance criteria; reassessment recommended.",
        verificationType: pick(["summative", "formative"]), assessmentLocation: pick([L.NFT.name, L.HBP.name]),
        samplingRateAtVerification: planTarget[a], technicalExpertName: chance(0.25) ? "Dan Kowalski" : null, checklistAnswers: checklist(bad),
        developmentNeedsRequired: outcome !== "agreed",
        developmentNeedsPlan: outcome === "agreed" ? null : "Assessor to refresh on evidence sufficiency and co-assess one candidate with the verifier next cycle.",
        emailSent: true, emailSentDate: new Date(vDate.getTime() + 3600000),
        acknowledgedAt: chance(0.7) ? new Date(vDate.getTime() + between(1, 6) * DAY) : null, acknowledgedBy: uid(a), createdAt: vDate,
      });
    });
    signed.slice(nVer, nVer + 4).forEach((as) => pendingTasks.push({ assessmentId: as.id, assessorId: uid(a), verifierId: uid(verifierOf[a]), status: "pending" }));
  }
  const verInserted = await ins(S.verifications, verRows);
  // link each verified assessment back to its verification, as storage.createVerification does
  for (let i = 0; i < verInserted.length; i += 10) {
    await Promise.all(verInserted.slice(i, i + 10).map((v) =>
      db.update(S.assessments).set({ verificationId: v.id, verificationStatus: "verified" }).where(sql`${S.assessments.id} = ${v.assessmentId}`)));
  }
  await ins(S.verificationTasks, [
    ...verInserted.map((v) => ({ assessmentId: v.assessmentId, assessorId: assessInserted.find((x) => x.id === v.assessmentId)!.assessorId, verifierId: v.verifierId,
      status: v.outcome === "disagreed" ? "rejected" : "verified", createdAt: new Date(new Date(v.verificationDate).getTime() - 2 * DAY), decidedAt: v.verificationDate })),
    ...pendingTasks,
  ]);
  const fbRows: any[] = [];
  for (const v of verInserted.filter((x) => x.outcome !== "agreed")) {
    const as = assessInserted.find((x) => x.id === v.assessmentId)!;
    fbRows.push({ assessmentId: v.assessmentId, authorId: v.verifierId, authorRole: "verifier", comment: v.verifierComments, createdAt: new Date(new Date(v.verificationDate).getTime() + 3600000) });
    if (chance(0.6)) fbRows.push({ assessmentId: v.assessmentId, authorId: as.assessorId, authorRole: "assessor", comment: "Understood - I will add the supporting record and arrange a follow-up observation.", createdAt: new Date(new Date(v.verificationDate).getTime() + 2 * DAY) });
  }
  for (const as of verSource.filter(() => chance(0.15)).slice(0, 5)) fbRows.push({ assessmentId: as.id, authorId: as.candidateId, authorRole: "candidate", comment: "Thanks - the feedback was clear and helped me plan my next steps.", createdAt: new Date(new Date(as.signOffAt).getTime() + DAY) });
  await ins(S.assessmentFeedback, fbRows);

  // ---------- skills inventory ----------
  const skillDefs: [string, string][] = [
    ["Process control (DCS)", "Technical"], ["PLC programming", "Technical"], ["Rotating equipment maintenance", "Technical"], ["Instrument calibration", "Technical"],
    ["Electrical isolation and switching", "Technical"], ["Isolation planning", "Technical"], ["Root cause analysis", "Technical"], ["Maintenance planning (CMMS)", "Technical"],
    ["Hazard identification (HAZID/HAZOP)", "Technical"], ["Project management", "Business"], ["Contract management", "Business"], ["Budget management", "Business"],
    ["Team leadership", "Leadership"], ["Coaching and mentoring", "Leadership"], ["Stakeholder management", "Leadership"],
    ["Permit-to-work auditing", "Compliance"], ["Environmental management", "Compliance"], ["French", "Language"],
  ];
  const skills = await ins(S.skills, skillDefs.map(([name, category]) => ({ name, category, description: `${name} - demonstration skill.` })));
  const SK = (name: string) => skills.find((s) => s.name.startsWith(name))!.id as string;
  const affinity: Record<string, string[]> = {
    "OPS-CRO": ["Process control", "Hazard identification"], "OPS-SCRO": ["Process control", "Team leadership", "Coaching"], "OPS-FO": ["Isolation planning", "Hazard identification"],
    "OPS-STL": ["Team leadership", "Stakeholder", "Process control"], "MNT-MT": ["Rotating equipment", "Isolation planning"], "MNT-ET": ["Electrical isolation", "Isolation planning"],
    "MNT-ICT": ["Instrument calibration", "PLC programming"], "MNT-SUP": ["Maintenance planning", "Team leadership", "Contract management"],
    "ENG-PE": ["Process control", "Hazard identification", "Root cause analysis", "Project management"], "HSE-ADV": ["Root cause analysis", "Permit-to-work auditing", "Environmental management"],
    "LC-LEAD": ["Coaching", "Stakeholder", "Permit-to-work auditing"], "MGT-SM": ["Team leadership", "Budget management", "Stakeholder", "Contract management"],
  };
  const profs = ["beginner", "intermediate", "advanced", "expert"];
  const usRows: any[] = [];
  for (const p of people) {
    const mine = new Set<string>((affinity[p.jr] || []).map(SK));
    while (mine.size < Math.min(6, 3 + Math.floor(rnd() * 3))) mine.add(pick(skills).id);
    for (const sid of mine) {
      const yrs = Math.max(1, Math.min(p.years, between(1, Math.max(2, p.years))));
      const pr = yrs > 14 ? pick(["advanced", "expert"]) : yrs > 6 ? pick(["intermediate", "advanced"]) : pick(["beginner", "intermediate"]);
      usRows.push({ userId: uid(p.key), skillId: sid, proficiency: pr, yearsExperience: yrs, source: pick(["self_reported", "manager_assessed", "verified"]), lastUsedAt: daysFromNow(-between(1, 400)) });
    }
  }
  await ins(S.userSkills, usRows);
  await ins(S.jobRoleSkills, Object.entries(affinity).flatMap(([jr, names]) => names.map((nm, i) => ({ jobRoleId: R(jr).id, skillId: SK(nm), requiredProficiency: i === 0 ? "advanced" : "intermediate" }))));

  // ---------- strategic workforce planning ----------
  const inits = await ins(S.workforceInitiatives, [
    { name: "Train 2 Commissioning", description: "Bring the second processing train into service.", locationId: L.NFT.id, businessUnitId: B.OPS.id, targetDate: daysFromNow(270), status: "active" },
    { name: "Night-shift Resilience Programme", description: "Strengthen night-shift cover and succession.", locationId: L.HBP.id, businessUnitId: B.OPS.id, targetDate: daysFromNow(120), status: "planned" },
  ]);
  await ins(S.initiativeRoleRequirements, [
    { initiativeId: inits[0].id, jobRoleId: R("OPS-FO").id, headcountNeeded: 4, requiredByDate: daysFromNow(210), notes: "New field operator posts for Train 2." },
    { initiativeId: inits[0].id, jobRoleId: R("OPS-CRO").id, headcountNeeded: 2, requiredByDate: daysFromNow(240) },
    { initiativeId: inits[0].id, jobRoleId: R("MNT-ICT").id, headcountNeeded: 2, requiredByDate: daysFromNow(200) },
    { initiativeId: inits[1].id, jobRoleId: R("OPS-STL").id, headcountNeeded: 1, requiredByDate: daysFromNow(100) },
    { initiativeId: inits[1].id, jobRoleId: R("OPS-CRO").id, headcountNeeded: 2, requiredByDate: daysFromNow(110) },
  ]);
  const first = (jr: string, skip = 0) => people.filter((p) => p.jr === jr && p.role === "candidate")[skip];
  const plans = await ins(S.successionPlans, [
    { jobRoleId: R("OPS-STL").id, incumbentUserId: uid("claire"), riskLevel: "high", notes: "Two incumbents within five years of retirement." },
    { jobRoleId: R("MNT-SUP").id, incumbentUserId: uid("ian"), riskLevel: "medium", notes: "Strong bench but limited cross-discipline cover." },
    { jobRoleId: R("MGT-SM").id, incumbentUserId: uid("helen"), riskLevel: "medium", notes: "Both site manager roles share the same candidate pool." },
  ]);
  const cro = first("OPS-CRO"), mt = first("MNT-MT", 1);
  await ins(S.successionCandidates, [
    { successionPlanId: plans[0].id, candidateUserId: uid("liam"), readiness: "ready_now", rank: 1, developmentPlanDescription: "Shadow the shift team leader for two rotations and complete First Line Leadership.", developmentPlanDueDate: daysFromNow(90) },
    { successionPlanId: plans[0].id, candidateUserId: uid(cro.key), readiness: "ready_1_2_years", rank: 2, developmentPlanDescription: "Complete Emergency Response Team Member and act up on nights.", developmentPlanDueDate: daysFromNow(200) },
    { successionPlanId: plans[1].id, candidateUserId: uid("dan"), readiness: "ready_now", rank: 1, developmentPlanDescription: "Lead the next planned shutdown work pack.", developmentPlanDueDate: daysFromNow(120) },
    { successionPlanId: plans[1].id, candidateUserId: uid(mt.key), readiness: "ready_3_5_years", rank: 2 },
    { successionPlanId: plans[2].id, candidateUserId: uid("claire"), readiness: "ready_1_2_years", rank: 1, developmentPlanDescription: "Complete site manager development programme.", developmentPlanDueDate: daysFromNow(300) },
    { successionPlanId: plans[2].id, candidateUserId: uid("ian"), readiness: "ready_3_5_years", rank: 2 },
  ]);

  // ---------- summary ----------
  const count = async (t: any, label: string) => `${label}=${(await db.select({ n: sql<number>`count(*)::int` }).from(t))[0].n}`;
  console.log("Seeded clean demo tenant into", dbName);
  console.log([
    await count(S.users, "users"), await count(S.jobRoles, "roles"), await count(S.competencyElements, "elements"), await count(S.competenceCriteria, "criteria"),
    await count(S.trainings, "trainings"), await count(S.roleTrainings, "role_trainings"), await count(S.trainingEnrollments, "enrolments"),
    await count(S.assessments, "assessments"), await count(S.skills, "skills"), await count(S.userSkills, "user_skills"),
    await count(S.verifications, "verifications"), await count(S.verificationTasks, "verification_tasks"), await count(S.assessmentFeedback, "feedback"), await count(S.successionPlans, "succession_plans"), await count(S.workforceInitiatives, "initiatives"),
  ].join("  "));
  await pool.end();
}

main().catch(async (e) => { console.error("SEED FAILED:", e); try { await pool.end(); } catch {} process.exit(1); });

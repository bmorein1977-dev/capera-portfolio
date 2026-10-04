/**
 * Generates a fictional CV (PDF) for every seeded demo person, and optionally attaches them.
 *
 * The CV is built from what is already in the demo database (role, years of experience, skills,
 * completed training, signed-off competences), so what a reviewer reads in the CV agrees with what
 * the Talent Catalog search finds. Employers, qualifications and achievements are invented.
 *
 * Modes:
 *   --out <dir>   write PDFs to a local folder (default ./demo-cvs-out). Works anywhere.
 *   --upload      store each PDF in Object Storage and set users.cv* fields, exactly as
 *                 POST /api/users/:id/cv does. Object Storage only exists on Replit, so run this
 *                 mode from the Replit shell of the demo Repl (it fails elsewhere, by design).
 *
 * Safety: refuses to run unless the database name contains "demo".
 *
 *   DATABASE_URL=<demo db url> npx tsx scripts/demo/seedDemoCvs.ts --out ./demo-cvs-out
 *   DATABASE_URL=<demo db url> npx tsx scripts/demo/seedDemoCvs.ts --upload
 */
import fs from "fs";
import path from "path";
import { db, pool } from "../../server/db";
import * as S from "../../shared/schema";
import { eq } from "drizzle-orm";

const dbUrl = process.env.DATABASE_URL || "";
const dbName = (() => { try { return new URL(dbUrl).pathname.replace(/^\//, ""); } catch { return ""; } })();
if (!/demo/i.test(dbName)) { console.error(`Refusing to run against "${dbName}": database name must contain "demo".`); process.exit(1); }
const UPLOAD = process.argv.includes("--upload");
const outIdx = process.argv.indexOf("--out");
const OUT_DIR = outIdx > -1 ? process.argv[outIdx + 1] : "./demo-cvs-out";

// ---------- deterministic randomness per person ----------
function rngFor(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  let s = h >>> 0;
  return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pickFrom = <T,>(r: () => number, a: T[]): T => a[Math.floor(r() * a.length)];
const mon = (d: Date | string | null | undefined) => d ? new Date(d).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : "";

// ---------- invented career material ----------
const EMPLOYERS = ["Harbourline Gas Ltd", "Calder Process Systems", "Brightwater Utilities", "Ironbridge Engineering", "Kestrel Offshore Services", "Stonegate Power Services", "Meadowbank Water Treatment"];
const LADDER: Record<string, string[]> = {
  FOPS: ["Trainee Plant Operator", "Plant Operator"], FMNT: ["Apprentice Technician", "Maintenance Technician"],
  FTEC: ["Graduate Engineer", "Process Engineer"], FLDR: ["Technician", "Senior Technician"],
};
const WINS: Record<string, string[]> = {
  FOPS: ["Operated a multi-unit process plant safely across rotating shifts, with no recordable incidents.", "Led start-ups and shutdowns, and coached new operators through their first isolations.", "Reduced standing alarms by reviewing set-points with the process team.", "Completed routine plant rounds and escalated defects promptly through the maintenance system.", "Prepared and reviewed work instructions with the permit-to-work team.", "Took part in emergency exercises and acted as a nominated responder.", "Trained colleagues in new operating procedures after a plant modification.", "Handled shift handovers using a structured log that reduced missed actions."],
  FMNT: ["Carried out planned and corrective maintenance to schedule, with accurate work-order records.", "Improved equipment reliability by resolving repeat failures with root cause analysis.", "Supported major shutdowns, including isolations, lifting plans and handback checks.", "Mentored apprentices and signed off their workplace tasks.", "Diagnosed instrument and electrical faults using fault-finding records and drawings.", "Worked closely with operations to plan isolations that kept downtime short.", "Maintained calibration and test records to audit standard.", "Introduced a simple checklist that cut repeat call-outs."],
  FTEC: ["Supported start-up and performance of process units, and prepared operating procedures.", "Contributed to hazard studies and tracked actions to close-out.", "Analysed plant data to identify efficiency and stability improvements.", "Presented findings to operations and maintenance leadership.", "Reviewed management-of-change proposals for process safety impact.", "Helped investigate process upsets and recommended corrective actions.", "Supported training of operators on new control strategies.", "Maintained process flow diagrams and operating envelopes."],
  FLDR: ["Supervised a multidisciplinary team and managed the permit-to-work workload for the shift.", "Investigated incidents, and led corrective actions through to verification.", "Built a competence plan for the team and arranged assessments against the standards.", "Planned work packs with maintenance and operations to reduce delays.", "Ran toolbox talks and safety conversations that raised near-miss reporting.", "Tracked team training expiry and booked courses ahead of due dates.", "Supported audits by preparing evidence and following up actions.", "Acted as a coach for new starters during their first months on site."],
};
const QUALS: Record<string, string[]> = {
  "OPS-CRO": ["City & Guilds Level 3 Process Operations", "Level 3 Award in Process Safety"], "OPS-SCRO": ["City & Guilds Level 3 Process Operations", "ILM Level 3 Team Leading"],
  "OPS-FO": ["Level 2 Diploma in Process Operations", "Level 2 Award in Health & Safety at Work"], "OPS-STL": ["HNC Process Plant Operations", "ILM Level 4 First Line Management"],
  "MNT-MT": ["ONC Engineering (Mechanical)", "Level 3 Diploma in Mechanical Maintenance"], "MNT-ET": ["HNC Electrical & Electronic Engineering", "18th Edition Wiring Regulations"],
  "MNT-ICT": ["HNC Instrumentation & Control", "Level 3 Diploma in Control Systems"], "MNT-SUP": ["HNC Engineering Management", "ILM Level 4 First Line Management"],
  "ENG-PE": ["BEng (Hons) Chemical Engineering", "Process Safety Management Certificate"], "HSE-ADV": ["National General Certificate in Occupational Health & Safety", "Level 5 Diploma in Health & Safety Management"],
  "LC-LEAD": ["Level 3 Award in Assessing Competence", "CIPD Certificate in Learning & Development"], "MGT-SM": ["BSc (Hons) Engineering Management", "ILM Level 5 Leadership & Management"],
};

// ---------- tiny dependency-free PDF writer (A4, Helvetica) ----------
type Block = { t: string; size?: number; bold?: boolean; gap?: number; indent?: number };
const safe = (s: string) => s.replace(/[–—]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\x7e]/g, "?");
const esc = (s: string) => safe(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
function wrap(text: string, size: number, maxWidth: number): string[] {
  const maxChars = Math.max(10, Math.floor(maxWidth / (size * 0.52)));
  const words = safe(text).split(/\s+/); const lines: string[] = []; let cur = "";
  for (const w of words) { if ((cur + " " + w).trim().length > maxChars) { if (cur) lines.push(cur); cur = w; } else cur = (cur + " " + w).trim(); }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}
function renderPdf(blocks: Block[]): Buffer {
  const W = 595, H = 842, MARGIN = 50;
  const pages: string[] = []; let ops: string[] = []; let y = H - MARGIN;
  const flush = () => { pages.push(ops.join("\n")); ops = []; y = H - MARGIN; };
  for (const b of blocks) {
    const size = b.size ?? 10, indent = b.indent ?? 0;
    y -= b.gap ?? 0;
    for (const line of wrap(b.t, size, W - 2 * MARGIN - indent)) {
      if (y - size < MARGIN) flush();
      ops.push(`BT /${b.bold ? "F2" : "F1"} ${size} Tf ${MARGIN + indent} ${y - size} Td (${esc(line)}) Tj ET`);
      y -= size * 1.38;
    }
  }
  flush();
  const objs: string[] = [];
  objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objs[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objs[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  const kids: number[] = [];
  pages.forEach((content, i) => {
    const cId = 5 + i * 2, pId = 6 + i * 2; kids.push(pId);
    objs[cId] = `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`;
    objs[pId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${cId} 0 R >>`;
  });
  objs[2] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;
  let out = "%PDF-1.4\n"; const offsets: number[] = [];
  for (let i = 1; i < objs.length; i++) { offsets[i] = Buffer.byteLength(out, "latin1"); out += `${i} 0 obj\n${objs[i]}\nendobj\n`; }
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objs.length}\n0000000000 65535 f \n` + offsets.slice(1).map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, "latin1");
}

async function main() {
  const [users, roles, locs, userSkills, skills, enrolments, trainings, assessments, elements] = await Promise.all([
    db.select().from(S.users), db.select().from(S.jobRoles), db.select().from(S.locations), db.select().from(S.userSkills), db.select().from(S.skills),
    db.select().from(S.trainingEnrollments), db.select().from(S.trainings), db.select().from(S.assessments), db.select().from(S.competencyElements),
  ]);
  const families = await db.select().from(S.jobFamilies);
  const people = users.filter((u) => u.jobRoleId && u.role !== "super_admin");
  if (!people.length) { console.error("No seeded people found - run seedCleanDemo.ts first."); process.exit(1); }
  if (!UPLOAD) fs.mkdirSync(OUT_DIR, { recursive: true });
  let done = 0;

  for (const u of people) {
    const r = rngFor(u.id);
    const role = roles.find((x) => x.id === u.jobRoleId)!;
    const famCode = families.find((f) => f.id === role.jobFamilyId)?.code || "FLDR";
    const loc = locs.find((l) => l.id === u.locationId)?.name || "";
    const years = u.yearsOfExperience ?? 5;
    const tenure = Math.max(1, Math.min(years, Math.round(((Date.now() - new Date(u.startDate || Date.now()).getTime()) / (365.25 * 86400000)) * 10) / 10));
    const mySkills = userSkills.filter((x) => x.userId === u.id).map((x) => ({ ...x, name: skills.find((s) => s.id === x.skillId)?.name || "", category: skills.find((s) => s.id === x.skillId)?.category || "" }))
      .sort((a, b) => (b.yearsExperience ?? 0) - (a.yearsExperience ?? 0));
    const myTrain = enrolments.filter((e) => e.userId === u.id && e.status === "completed").map((e) => ({ ...e, name: trainings.find((t) => t.id === e.trainingId)?.name || "" }))
      .sort((a, b) => new Date(b.achievementDate || 0).getTime() - new Date(a.achievementDate || 0).getTime()).slice(0, 8);
    const myComp = assessments.filter((a) => a.candidateId === u.id && !a.isAssignment && a.signOffAt && a.outcome !== "not_yet_competent")
      .map((a) => ({ ...a, name: elements.find((e) => e.id === a.elementId)?.name || "" })).sort((a, b) => new Date(b.signOffAt!).getTime() - new Date(a.signOffAt!).getTime()).slice(0, 6);

    // career history: earlier posts (invented employers) covering the years before this employer
    const prior = Math.max(0, years - tenure);
    const posts: { title: string; employer: string; from: number; to: number; wins: string[] }[] = [];
    const thisYear = new Date().getFullYear();
    const startYear = Math.round(thisYear - tenure);
    posts.push({ title: role.name, employer: "Northgate Energy Services", from: startYear, to: thisYear, wins: [] });
    let cursor = startYear, left = prior;
    const ladder = LADDER[famCode] || LADDER.FLDR;
    const n = prior >= 8 ? 2 : prior >= 2 ? 1 : 0;
    for (let i = 0; i < n; i++) {
      const span = i === n - 1 ? left : Math.max(2, Math.round(left / 2)); left -= span;
      posts.push({ title: ladder[Math.min(ladder.length - 1, n - 1 - i)], employer: pickFrom(r, EMPLOYERS), from: Math.round(cursor - span), to: cursor, wins: [] });
      cursor = Math.round(cursor - span);
    }
    const winPool = WINS[famCode] || WINS.FLDR;
    const shuffled = [...winPool].sort(() => r() - 0.5); let wi = 0;
    posts.forEach((p, i) => { const take = i === 0 ? 3 : 2; p.wins = shuffled.slice(wi, wi + take); wi += take; });

    const top = mySkills.filter((s) => s.category !== "Language").slice(0, 3).map((s) => s.name);
    const blocks: Block[] = [
      { t: `${u.firstName} ${u.lastName}`, size: 20, bold: true },
      { t: `${role.name}  |  ${loc}  |  ${u.email}`, size: 10, gap: 2 },
      { t: "PROFILE", size: 11, bold: true, gap: 14 },
      { t: `${role.name} with ${years} years' experience in process and energy operations${top.length ? `, with particular strength in ${top.join(", ")}` : ""}. Currently based at ${loc} with Northgate Energy Services, working to documented competence standards and supporting colleagues' development.`, gap: 3 },
      { t: "CAREER HISTORY", size: 11, bold: true, gap: 12 },
    ];
    for (const p of posts) {
      blocks.push({ t: `${p.title} - ${p.employer}`, bold: true, gap: 6 });
      blocks.push({ t: `${p.from} - ${p.to === thisYear ? "present" : p.to}`, size: 9 });
      p.wins.forEach((w) => blocks.push({ t: `- ${w}`, indent: 10 }));
    }
    blocks.push({ t: "KEY SKILLS", size: 11, bold: true, gap: 12 });
    mySkills.slice(0, 8).forEach((s) => blocks.push({ t: `- ${s.name}: ${s.proficiency}${s.yearsExperience ? `, ${s.yearsExperience} ${s.yearsExperience === 1 ? "year" : "years"}` : ""}`, indent: 10 }));
    blocks.push({ t: "QUALIFICATIONS", size: 11, bold: true, gap: 12 });
    (QUALS[role.code] || []).forEach((q) => blocks.push({ t: `- ${q}`, indent: 10 }));
    if (myTrain.length) { blocks.push({ t: "TRAINING COMPLETED", size: 11, bold: true, gap: 12 }); myTrain.forEach((t) => blocks.push({ t: `- ${t.name} (${mon(t.achievementDate)})`, indent: 10 })); }
    if (myComp.length) { blocks.push({ t: "COMPETENCES SIGNED OFF", size: 11, bold: true, gap: 12 }); myComp.forEach((c) => blocks.push({ t: `- ${c.name} (${mon(c.signOffAt)})`, indent: 10 })); }
    blocks.push({ t: "Fictional demonstration CV. All people, employers and details are invented.", size: 8, gap: 18 });

    const pdf = renderPdf(blocks);
    const fileName = `${u.firstName}_${u.lastName}_CV.pdf`.replace(/[^A-Za-z0-9._-]/g, "_");
    if (UPLOAD) {
      const { uploadObject, buildObjectKey } = await import("../../server/services/objectStorage");
      const key = buildObjectKey("cvs", fileName);
      await uploadObject(key, pdf);
      await db.update(S.users).set({ cvObjectKey: key, cvFileName: fileName, cvContentType: "application/pdf", cvUploadedAt: new Date() }).where(eq(S.users.id, u.id));
    } else {
      fs.writeFileSync(path.join(OUT_DIR, fileName), pdf);
    }
    done++;
  }
  console.log(UPLOAD ? `Uploaded and attached ${done} CVs.` : `Wrote ${done} CVs to ${path.resolve(OUT_DIR)}`);
  await pool.end();
}
main().catch(async (e) => { console.error("CV GENERATION FAILED:", e?.message || e); try { await pool.end(); } catch {} process.exit(1); });

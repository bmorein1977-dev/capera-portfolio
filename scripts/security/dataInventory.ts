// Writes security/data-inventory.csv and security/DATA_INVENTORY.md: every table and column in the database, with a first-pass classification of what kind of
// data it holds (ASVS 14.1.1 and the starting point for the data protection impact assessment).
//
// The classification is made from names and is a DRAFT for the data owner to correct: a column called "notes" may hold anything, so free text is
// treated as personal until someone says otherwise. Rerun after a schema change; the CSV keeps a "Reviewed" column that a person fills in by hand, and
// the script carries forward whatever was written there for columns that still exist.
//
//   DATABASE_URL=<demo or throwaway database> npx tsx scripts/security/dataInventory.ts
import fs from "fs";
import path from "path";
import { pool } from "../../server/db";

type Level = "Credential" | "Special-risk" | "Personal" | "Internal" | "Reference";
const RANK: Record<Level, number> = { Credential: 5, "Special-risk": 4, Personal: 3, Internal: 2, Reference: 1 };

// Table names that are about people's performance, health, conduct or access, whatever their columns are called.
const SPECIAL_TABLES = /^(appraisals?|appraisal_.*|performance_.*|feedback_.*|objective_updates|talent_.*|absences|retention_holds|audit_events|contractor_declarations)$/;
const SECRET = /(^|_)(password|secret|token|api_?key|hash|salt|signature|sid|sess|credential|cmi)(_|$)/i;
const SPECIAL_COL = /(date_of_birth|^dob$|medical|health|disab|ethnic|religio|union|criminal|biometric|sexual|national_insurance|passport|ssn|potential_rating|calibration|performance_rating|manager_summary|development_plan|strengths_comment|development_comment|self_comment|manager_comment|talent_score|scores?$|absence_type|reason)/i;
const PERSONAL_COL = /(first_name|last_name|full_name|display_name|email|phone|mobile|address|postcode|photo|avatar|profile_image|cv_|cv$|company_num|vantage|helicopter|employee_num|ip_address|user_agent|provider_sub|manager_id|supervisor_id|user_id|candidate_id|assessor_id|verifier_id|person|owner_id|created_by|updated_by|actor_|acting_as|author|rater|subject_user|notes?$|comments?$|comment_|description$|summary$|body$|message$|text$|reason|location|team|shift|job_role)/i;

function classify(table: string, column: string, type: string): { level: Level; why: string } {
  if (SECRET.test(column) || /^session$/.test(table) || /^sessions$/.test(table)) return { level: "Credential", why: "secret, token or session value" };
  if (SPECIAL_COL.test(column)) return { level: "Special-risk", why: "performance, health, conduct or identity detail" };
  if (SPECIAL_TABLES.test(table) && PERSONAL_COL.test(column)) return { level: "Special-risk", why: "personal detail inside a performance, absence or audit record" };
  if (PERSONAL_COL.test(column)) return { level: "Personal", why: /note|comment|description|summary|body|message|text|reason/.test(column) ? "free text, may name or describe a person" : "identifies or is linked to a person" };
  if (/^(users)$/.test(table)) return { level: "Personal", why: "a column of the people table" };
  if (/(created_at|updated_at|id|order|is_active|code|name|title|status|type)$/.test(column) || /^(boolean|integer|numeric|smallint|bigint)$/.test(type)) return { level: "Reference", why: "housekeeping, status or catalogue value" };
  return { level: "Internal", why: "company data not directly about a person" };
}

(async () => {
  const cols = (await pool.query(`
    select c.table_name, c.column_name, c.data_type, c.is_nullable
    from information_schema.columns c join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public' and t.table_type = 'BASE TABLE' order by c.table_name, c.ordinal_position`)).rows as { table_name: string; column_name: string; data_type: string; is_nullable: string }[];
  const counts = new Map<string, number>();
  for (const t of Array.from(new Set(cols.map(c => c.table_name)))) {
    try { counts.set(t, Number((await pool.query(`select count(*)::int n from "${t}"`)).rows[0].n)); } catch { counts.set(t, -1); }
  }

  const csvFile = path.join(import.meta.dirname, "..", "..", "security", "data-inventory.csv");
  const carried = new Map<string, string>();
  if (fs.existsSync(csvFile)) {
    for (const line of fs.readFileSync(csvFile, "utf8").split(/\r?\n/).slice(1)) {
      const m = /^"([^"]*)","([^"]*)",.*,"([^"]*)"$/.exec(line);
      if (m && m[3]) carried.set(`${m[1]}.${m[2]}`, m[3]);
    }
  }
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = cols.map(c => { const k = classify(c.table_name, c.column_name, c.data_type); return { ...c, ...k }; });
  const csv = ["Table,Column,Type,Classification,Why,Rows in table,Reviewed"]
    .concat(rows.map(r => [q(r.table_name), q(r.column_name), q(r.data_type), q(r.level), q(r.why), String(counts.get(r.table_name) ?? ""), q(carried.get(`${r.table_name}.${r.column_name}`) ?? "")].join(",")));
  fs.writeFileSync(csvFile, csv.join("\n") + "\n");

  // table-level summary: the highest classification of any column
  const byTable = new Map<string, { level: Level; n: Record<Level, number> }>();
  for (const r of rows) {
    const t = byTable.get(r.table_name) ?? { level: "Reference" as Level, n: { Credential: 0, "Special-risk": 0, Personal: 0, Internal: 0, Reference: 0 } };
    t.n[r.level]++; if (RANK[r.level] > RANK[t.level]) t.level = r.level;
    byTable.set(r.table_name, t);
  }
  const order: Level[] = ["Credential", "Special-risk", "Personal", "Internal", "Reference"];
  const total = Object.fromEntries(order.map(l => [l, Array.from(byTable.values()).filter(t => t.level === l).length])) as Record<Level, number>;
  let md = `# Data inventory and classification (draft)\n\nGenerated ${new Date().toISOString().slice(0, 10)} from the structure of the demo database by \`scripts/security/dataInventory.ts\`. ` +
    `**A draft for the data owner to correct**: levels are worked out from table and column names, so free-text columns are treated as personal until someone says otherwise. ` +
    `Column by column detail is in \`security/data-inventory.csv\` (the "Reviewed" column is for a person's decision and is kept when the script is rerun).\n\n` +
    `## What the levels mean\n\n| Level | Meaning | Handling |\n|---|---|---|\n` +
    `| Credential | secrets, tokens, session values | never logged, never exported, never shown; protected at rest |\n` +
    `| Special-risk | performance ratings and appraisal text, 360 feedback, health or absence detail, date of birth, audit trail of who did what | named access only, every opening of someone else's record logged, kept out of reports and email |\n` +
    `| Personal | names, emails, photos, CVs, reporting lines, anything linked to a person, free text | role-based and per-record access; removed or anonymised on leaving after the retention period |\n` +
    `| Internal | company data not about a person (standards, requirements, courses) | signed-in staff only |\n` +
    `| Reference | catalogue values, statuses, housekeeping | no special handling |\n\n` +
    `## Tables by highest level held\n\n| Level | Tables |\n|---|---|\n` + order.map(l => `| ${l} | ${total[l]} |`).join("\n") + `\n\n` +
    order.filter(l => l === "Credential" || l === "Special-risk" || l === "Personal").map(l =>
      `### ${l}\n\n| Table | Rows | Columns at this level |\n|---|---|---|\n` +
      Array.from(byTable.entries()).filter(([, t]) => t.level === l).sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, t]) => `| ${name} | ${counts.get(name) ?? ""} | ${t.n[l]} |`).join("\n")).join("\n\n") +
    `\n\n## Where personal data also lives outside the tables\n\n` +
    `- **Session store**: the signed-in person's id, email and identity-provider tokens (a Credential-level table; see ASVS 14.2.2).\n` +
    `- **Object storage**: CV files, profile photos, evidence files, uploaded training content (named by random keys; the file names inside can name a person).\n` +
    `- **Email log**: the text of every email sent, which can include names and review stages.\n` +
    `- **Server log**: method, path, status and time only. Response bodies are never logged (ASVS 16.2.5).\n` +
    `- **Exports and scheduled reports**: an Excel file with names, held for 15 minutes by the server and, if emailed, in the owner's mailbox (outside Capera's control).\n` +
    `- **AI provider** (only if the AI step is switched on for a report): counts and category names only, never names, emails or free text.\n`;
  fs.writeFileSync(path.join(import.meta.dirname, "..", "..", "security", "DATA_INVENTORY.md"), md);
  console.log(`Tables: ${byTable.size}, columns: ${rows.length}`, total);
  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });

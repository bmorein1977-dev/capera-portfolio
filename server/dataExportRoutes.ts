// Everything Capera holds about one person, as one download, for a data subject access request or a transfer. Administrators only, and
// every export is recorded in the audit log. (A copy of the whole database is made with scripts/db/export-all.mjs.)
import type { Express } from "express";
import JSZip from "jszip";
import { sql, type SQL } from "drizzle-orm";
import { db } from "./db";
import { downloadObject } from "./services/objectStorage";
import { recordSystemEvent } from "./services/auditLog";
import { contentDisposition } from "./security";

// what is never included: secrets, and the internal addresses of stored files (the files themselves are put in the download)
const NEVER = /(^|_)(password|secret|token|hash|sid|sess)($|_)|object_key|^file_url$|provider_sub/i;

export function personQueries(id: string): Array<{ name: string; query: SQL }> {
  const mine = sql`select id from assessments where candidate_id = ${id}`;
  return [
    { name: "profile", query: sql`select * from users where id = ${id}` },
    { name: "assessments", query: sql`select * from assessments where candidate_id = ${id}` },
    { name: "assessment_evidence", query: sql`select * from assessment_evidence where assessment_id in (${mine})` },
    { name: "assessment_comments", query: sql`select * from assessment_feedback where assessment_id in (${mine})` },
    { name: "knowledge_answers", query: sql`select * from assessment_knowledge_answers where assessment_id in (${mine})` },
    { name: "verifications_of_their_assessments", query: sql`select * from verifications where assessment_id in (${mine})` },
    { name: "competence_renewals", query: sql`select * from assessment_expiry_history where candidate_id = ${id}` },
    { name: "training_records", query: sql`select * from training_enrollments where user_id = ${id}` },
    { name: "training_completions", query: sql`select * from training_completion_audit where user_id = ${id}` },
    { name: "course_bookings", query: sql`select * from course_bookings where user_id = ${id}` },
    { name: "training_requests", query: sql`select * from training_requests where user_id = ${id}` },
    { name: "elearning_certificates", query: sql`select * from elearning_certificates where user_id = ${id}` },
    { name: "course_feedback_given", query: sql`select * from training_evaluations where user_id = ${id}` },
    { name: "absences", query: sql`select * from absences where user_id = ${id}` },
    { name: "appraisals_about_them", query: sql`select * from appraisals where user_id = ${id}` },
    { name: "experience", query: sql`select * from user_experience where user_id = ${id}` },
    { name: "qualifications", query: sql`select * from user_qualifications where user_id = ${id}` },
    { name: "role_grants", query: sql`select * from user_role_assignments where user_id = ${id}` },
    { name: "emails_sent_to_them", query: sql`select * from notification_logs where recipient_id = ${id}` },
    { name: "actions_they_took", query: sql`select * from audit_events where actor_id = ${id} order by occurred_at` },
    { name: "audit_entries_about_them", query: sql`select * from audit_events where entity_id = ${id} order by occurred_at` },
  ];
}

export const clean = (row: Record<string, unknown>) => Object.fromEntries(Object.entries(row).filter(([k]) => !NEVER.test(k)));

export function registerDataExportRoutes(app: Express, deps: { requireRole: (...roles: string[]) => any; actingUser: (req: any) => Promise<{ id: string }>; ownNameOnly: any }) {
  const { requireRole, actingUser, ownNameOnly } = deps;
  app.get("/api/users/:id/data-export", requireRole("admin", "super_admin", "developer"), ownNameOnly, async (req: any, res) => {
    try {
      const id = String(req.params.id);
      const person = (await db.execute(sql`select id, first_name, last_name, cv_object_key, cv_file_name, avatar_object_key from users where id = ${id}`)).rows[0] as any;
      if (!person) return res.status(404).json({ error: "Person not found" });
      const zip = new JSZip();
      const contents: Array<{ file: string; records: number; note?: string }> = [];
      for (const q of personQueries(id)) {
        try {
          const rows = (await db.execute(q.query)).rows as Record<string, unknown>[];
          zip.file(`records/${q.name}.json`, JSON.stringify(rows.map(clean), null, 2));
          contents.push({ file: `records/${q.name}.json`, records: rows.length });
        } catch (e) {
          // a table this database does not have is said so, never silently left out
          contents.push({ file: `records/${q.name}.json`, records: 0, note: `could not be read: ${(e as Error).message}` });
        }
      }
      // the person's files
      const files = (await db.execute(sql`select e.id, e.file_name, e.file_url from assessment_evidence e join assessments a on a.id = e.assessment_id where a.candidate_id = ${id} and e.file_url is not null`)).rows as any[];
      const training = (await db.execute(sql`select id, certificate_file_name as file_name, certificate_object_key as file_url from training_enrollments where user_id = ${id} and certificate_object_key is not null`)).rows as any[];
      const all = [...files.map((f) => ({ ...f, folder: "evidence" })), ...training.map((f) => ({ ...f, folder: "training-certificates" })),
        ...(person.cv_object_key ? [{ id: "cv", file_name: person.cv_file_name, file_url: person.cv_object_key, folder: "cv" }] : []),
        ...(person.avatar_object_key ? [{ id: "photo", file_name: "photo", file_url: person.avatar_object_key, folder: "photo" }] : [])];
      let size = 0;
      for (const f of all) {
        const name = `files/${f.folder}/${String(f.id).slice(0, 8)}-${String(f.file_name ?? "file").replace(/[^\w.\- ]+/g, "_").slice(-100)}`;
        try {
          if (size > 400 * 1024 * 1024) { contents.push({ file: name, records: 0, note: "left out: the download reached its size limit" }); continue; }
          const bytes = await downloadObject(f.file_url);
          size += bytes.length;
          zip.file(name, bytes);
          contents.push({ file: name, records: 1 });
        } catch (e) {
          contents.push({ file: name, records: 0, note: "the stored file could not be read" });
        }
      }
      const me = await actingUser(req);
      zip.file("contents.json", JSON.stringify({ person: `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim(), preparedAt: new Date().toISOString(), note: "Records Capera holds about this person. Text written about them elsewhere (for example in another person's appraisal) is not included and needs a separate search before a subject access request is answered.", contents }, null, 2));
      const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
      await recordSystemEvent({ actorId: me.id, action: "Exported a person's data", entityType: "Person", entityId: id, entityLabel: `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim(), summary: `${contents.length} files in the download` }).catch(() => {});
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", contentDisposition("attachment", `capera-person-data-${id.slice(0, 8)}.zip`));
      res.setHeader("Cache-Control", "private, no-store");
      res.end(buffer);
    } catch (error) {
      console.error("Person data export failed:", error);
      res.status(500).json({ error: "The export could not be prepared" });
    }
  });
}

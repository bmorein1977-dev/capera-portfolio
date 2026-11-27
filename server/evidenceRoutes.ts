// A candidate's evidence is their portfolio. Their assessor can attach any item in it to any other assessment the same candidate has, so one piece of
// work can support several competences without being uploaded again. Nothing ever crosses from one candidate to another: that is checked here,
// again when files are uploaded, and by the database itself (migration 0060).
//
// Attaching makes a record on the second assessment that points at the same stored file and keeps the candidate's title, kind and description. It has
// its own accept or reject and its own AI review, because what suits one competence may not suit another. It may be attached to a signed-off
// assessment; it is then shown as attached after sign-off, so nobody can take it for something the decision was made on.
import type { Express } from "express";
import { createHash } from "crypto";
import { z } from "zod";
import { db } from "./db";
import { and, eq, sql } from "drizzle-orm";
import { assessmentEvidence, assessments } from "@shared/schema";
import { assessorsOf, canAccessAssessment } from "./services/personAccess";
import { recordRequestEvent } from "./services/auditLog";
import type { IStorage } from "./storage";

const norm = (r: string) => r.toLowerCase().trim().replace(/[\s-]+/g, "_");
const ADMINS = ["developer", "super_admin", "admin"];
class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
const rows = async (q: ReturnType<typeof sql>) => (await db.execute(q)).rows as any[];
const idList = (ids: string[]) => sql.join(ids.map(i => sql`${i}`), sql`, `);

export const fileHash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

/** Is any of these files already in another candidate's portfolio? */
export async function belongsToAnotherCandidate(hashes: string[], candidateId: string): Promise<boolean> {
  if (!hashes.length) return false;
  const found = await rows(sql`select 1 from assessment_evidence v join assessments a on a.id = v.assessment_id
    where v.content_hash in (${idList(hashes)}) and coalesce(v.is_active, true) and a.candidate_id <> ${candidateId} limit 1`);
  return found.length > 0;
}

/** For rows that were attached from the portfolio: where from, by whom, and whether that was after the assessment had been signed off. */
export interface LinkInfo { fromCode: string | null; fromName: string; byName: string | null; on: string; afterSignOff: boolean }
export async function linkInfoFor(evidenceIds: string[]): Promise<Map<string, LinkInfo>> {
  if (!evidenceIds.length) return new Map();
  const found = await rows(sql`select v.id, e.code, e.name, nullif(trim(concat_ws(' ', u.first_name, u.last_name)), '') by_name, v.linked_at::text linked_at,
      (a.sign_off_at is not null and v.linked_at > (a.sign_off_at at time zone 'utc')) after_sign_off
    from assessment_evidence v join assessments a on a.id = v.assessment_id
    join assessment_evidence s on s.id = v.linked_from_id join assessments sa on sa.id = s.assessment_id join competency_elements e on e.id = sa.element_id
    left join users u on u.id = v.linked_by where v.id in (${idList(evidenceIds)})`);
  return new Map(found.map(f => [f.id as string, { fromCode: f.code, fromName: f.name, byName: f.by_name, on: f.linked_at, afterSignOff: f.after_sign_off === true }]));
}

export function registerEvidenceRoutes(app: Express, { storage, isAuthenticated, requireRole }: { storage: IStorage; isAuthenticated: any; requireRole: (...roles: string[]) => any }) {
  async function actor(req: any) {
    const id: string = req.session?.impersonatedUserId || req.user?.claims?.sub;
    return { id, roles: (await storage.getEffectiveRoles(id)).map(norm) };
  }
  // Who may manage a candidate's evidence on an assessment: its assessor, an assessor allocated to the candidate, or an administrator. Never the
  // candidate themself in that capacity, and not managers or verifiers, who read but do not assess.
  async function assessing(req: any, assessmentId: string) {
    const a = await actor(req);
    const target = await storage.getAssessment(assessmentId);
    if (!target || target.isActive === false) throw new HttpError(404, "Assessment not found");
    const admin = a.roles.some(r => ADMINS.includes(r));
    const assessor = a.roles.includes("assessor") && (target.assessorId === a.id || (await assessorsOf(target.candidateId)).includes(a.id));
    if (a.id === target.candidateId || (!admin && !assessor)) throw new HttpError(403, "Only this candidate's assessor or an administrator can do this");
    return { a, target };
  }

  const handle = (fn: (req: any) => Promise<unknown>) => async (req: any, res: any) => {
    try { res.json(await fn(req)); }
    catch (e: any) {
      if (e instanceof HttpError) return res.status(e.status).json({ error: e.message });
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Choose the evidence to attach" });
      console.error(`Error in ${req.method} ${req.path}:`, e?.message ?? e);
      res.status(500).json({ error: "Something went wrong on our side. Please try again." });
    }
  };
  const guard = [isAuthenticated, requireRole("assessor", "admin", "super_admin", "developer")];

  /** everything in the candidate's portfolio that is on their record, with where each item sits */
  const portfolio = (candidateId: string) => rows(sql`select v.id, v.assessment_id, coalesce(v.linked_from_id, v.id) root, v.file_url, v.title, v.evidence_type, v.description, v.file_name, v.file_size,
      (coalesce(v.file_url, '') <> '') has_file, v.created_at::text created_at, v.rejected_at, v.rejection_reason, a.assessor_id, e.code, e.name,
      nullif(trim(concat_ws(' ', u.first_name, u.last_name)), '') uploaded_by_name
    from assessment_evidence v join assessments a on a.id = v.assessment_id join competency_elements e on e.id = a.element_id left join users u on u.id = v.uploaded_by
    where a.candidate_id = ${candidateId} and a.is_active and coalesce(v.is_active, true) order by v.created_at`);

  app.get("/api/assessments/:id/portfolio-evidence", ...guard, handle(async (req) => {
    const { a, target } = await assessing(req, req.params.id);
    const all = await portfolio(target.candidateId);
    const here = all.filter(r => r.assessment_id === target.id);
    const already = (r: any) => here.some(h => h.root === r.root || (r.has_file && h.file_url === r.file_url));
    const groups = new Map<string, any[]>();
    for (const r of all) if (r.assessment_id !== target.id && !already(r)) (groups.get(r.root) ?? groups.set(r.root, []).get(r.root)!).push(r);
    const items = await Promise.all(Array.from(groups.values()).map(async (list) => {
      const first = list.find(r => r.id === r.root) ?? list[0];
      return {
        id: first.id, title: first.title, evidenceType: first.evidence_type, description: first.description, fileName: first.file_name, fileSize: first.file_size, hasFile: first.has_file,
        createdAt: first.created_at, uploadedByName: first.uploaded_by_name,
        usedOn: Array.from(new Set(list.map(r => (r.code ? `${r.code}: ${r.name}` : r.name)))),
        // an assessor deciding whether to use it should know where it was turned down, and why
        notAccepted: list.filter(r => r.rejected_at).map(r => ({ on: r.code ?? r.name, reason: r.rejection_reason as string | null })),
        canOpen: await canAccessAssessment(a.id, a.roles, { candidateId: target.candidateId, assessorId: first.assessor_id }),
      };
    }));
    return { signedOff: !!target.signOffAt, items: items.sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt))) };
  }));

  app.post("/api/assessments/:id/portfolio-evidence", ...guard, handle(async (req) => {
    const { a, target } = await assessing(req, req.params.id);
    const wanted = Array.from(new Set(z.object({ evidenceIds: z.array(z.string().max(64)).min(1).max(30) }).strict().parse(req.body).evidenceIds));
    const all = await portfolio(target.candidateId);
    // every item must be in this candidate's own portfolio, or nothing at all is attached. Anything else, whether it does not exist or is someone
    // else's, gets the same answer.
    const chosen = wanted.map(id => all.find(r => r.id === id));
    if (chosen.some(c => !c || c.assessment_id === target.id)) throw new HttpError(404, "That evidence is not in this candidate's portfolio");
    const here = all.filter(r => r.assessment_id === target.id);
    const fresh = chosen.filter(c => !here.some(h => h.root === c!.root || (c!.has_file && h.file_url === c!.file_url))) as any[];
    const unique = fresh.filter((c, i) => fresh.findIndex(d => d.root === c.root) === i);
    if (!unique.length) throw new HttpError(409, "That evidence is already on this assessment");
    const sources = await db.select().from(assessmentEvidence).where(sql`${assessmentEvidence.id} in (${idList(unique.map(u => u.id))})`);
    const now = new Date();
    const added = await db.transaction(async (tx) => tx.insert(assessmentEvidence).values(unique.map((u) => {
      const s = sources.find(x => x.id === u.id)!;
      return {
        assessmentId: target.id, fileName: s.fileName, fileUrl: s.fileUrl, fileSize: s.fileSize, mimeType: s.mimeType, uploadedBy: s.uploadedBy,
        title: s.title, evidenceType: s.evidenceType, description: s.description, contentHash: s.contentHash, linkedFromId: u.root as string, linkedBy: a.id, linkedAt: now,
      };
    })).returning({ id: assessmentEvidence.id }));
    const element = await storage.getCompetencyElement(target.elementId);
    await recordRequestEvent(req, { action: "attach-evidence", entityType: "assessment", entityId: target.id, label: element?.name ?? "assessment", what: `attached ${added.length} item${added.length === 1 ? "" : "s"} from the candidate's portfolio to the assessment of` });
    return { attached: added.length, alreadyThere: wanted.length - added.length };
  }));

  // Taking back an attachment made by mistake. Only the attachment goes: the original stays where it was. Once a sign-off has happened with it in
  // place it is part of that record and stays.
  app.delete("/api/assessments/:id/portfolio-evidence/:evidenceId", ...guard, handle(async (req) => {
    const { target } = await assessing(req, req.params.id);
    const row = (await db.select().from(assessmentEvidence).where(and(eq(assessmentEvidence.id, req.params.evidenceId), eq(assessmentEvidence.assessmentId, target.id))))[0];
    if (!row || row.isActive === false || !row.linkedFromId) throw new HttpError(404, "There is no attachment there to remove");
    if (target.signOffAt && row.linkedAt && new Date(target.signOffAt) >= row.linkedAt) throw new HttpError(409, "The assessment has been signed off with this attached, so it stays on the record");
    await db.update(assessmentEvidence).set({ isActive: false, updatedAt: new Date() }).where(eq(assessmentEvidence.id, row.id));
    await recordRequestEvent(req, { action: "remove-attachment", entityType: "assessment", entityId: target.id, label: row.title ?? row.fileName, what: "removed an attachment made from the portfolio" });
    return { removed: true };
  }));
}

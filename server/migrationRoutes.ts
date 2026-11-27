// Moving from a previous system: loading evidence files in bulk, and the reconciliation report. Administrators only, in their own name.
import type { Express } from "express";
import multer from "multer";
import { createHash } from "crypto";
import { BATCH_LIMITS, BatchError, runEvidenceBatch } from "./services/evidenceBatch";
import { reconcile } from "./services/reconciliation";
import { parseImportSheet } from "./services/historicalImportRows";
import { recordRequestEvent } from "./services/auditLog";
import type { IStorage } from "./storage";

const RECORD_ROWS = 20_000;

export function registerMigrationRoutes(app: Express, { storage, isAuthenticated, requireRole, ownNameOnly }: { storage: IStorage; isAuthenticated: any; requireRole: (...roles: string[]) => any; ownNameOnly: any }) {
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: BATCH_LIMITS.zipBytes, files: 1, fields: 3, fieldSize: 8 * 1024 * 1024 } });
  const zipUpload = (req: any, res: any, next: any) => upload.single("batch")(req, res, (err: any) => {
    if (!err) return next();
    res.status(err.code === "LIMIT_FILE_SIZE" || err.code === "LIMIT_FIELD_VALUE" ? 413 : 400)
      .json({ error: err.code === "LIMIT_FILE_SIZE" ? `The zip is larger than ${BATCH_LIMITS.zipBytes / 1024 / 1024} MB. Split it into smaller batches.` : "The upload could not be read." });
  });
  const guard = [isAuthenticated, requireRole("admin", "super_admin"), ownNameOnly, zipUpload];
  const fail = (res: any, e: any, what: string) => {
    if (e instanceof BatchError) return res.status(400).json({ error: e.message });
    console.error(`${what}:`, e?.message ?? e);
    res.status(500).json({ error: "Something went wrong on our side. Please try again." });
  };

  let loading = false; // one load at a time: two at once could both pass the "already there" check
  app.post("/api/admin/migration/evidence", ...guard, async (req: any, res: any) => {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "Choose the zip file to load" });
    // anything other than an explicit "false" is a trial run, so that nothing is loaded by mistake
    const dryRun = req.body.dryRun !== "false";
    if (!dryRun && loading) return res.status(409).json({ error: "Another batch is being loaded. Wait for it to finish." });
    if (!dryRun) loading = true;
    try {
      const result = await runEvidenceBatch(file.buffer, storage, { dryRun, actorId: req.user?.claims?.sub });
      if (!dryRun) {
        const batchId = createHash("sha256").update(file.buffer).digest("hex");
        await recordRequestEvent(req, { action: "load-evidence-batch", entityType: "migration", entityId: batchId.slice(0, 32), label: file.originalname, what: `loaded ${result.loaded} of ${result.rows} evidence rows (${result.withProblems} not loaded) from the batch` });
      }
      res.json(result);
    } catch (e) { fail(res, e, "Evidence batch"); } finally { if (!dryRun) loading = false; }
  });

  app.post("/api/admin/migration/reconcile", ...guard, async (req: any, res: any) => {
    try {
      let data: unknown;
      try { data = JSON.parse(String(req.body.records ?? "")); } catch { return res.status(400).json({ error: "Choose the records spreadsheet to reconcile against" }); }
      if (!Array.isArray(data) || !data.length) return res.status(400).json({ error: "The records spreadsheet has no rows" });
      if (data.length > RECORD_ROWS) return res.status(413).json({ error: `The spreadsheet has more than ${RECORD_ROWS} rows. Reconcile it in parts, keeping each person's rows together.` });
      const result = await reconcile(parseImportSheet(data) as any, storage, { evidenceZip: req.file?.buffer });
      await recordRequestEvent(req, { action: "reconciliation-report", entityType: "migration", entityId: createHash("sha256").update(String(req.body.records)).digest("hex").slice(0, 32), label: `${data.length} rows`, what: `ran a reconciliation report (${result.acceptance.passed ? "passed" : "not passed"}, ${result.acceptance.unexplained} unexplained) on` });
      res.json(result);
    } catch (e) { fail(res, e, "Reconciliation"); }
  });
}

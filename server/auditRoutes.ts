import type { Express } from "express";
import { listAuditEvents, auditFilterOptions, auditCsv, type AuditFilter } from "./services/auditLog";

// Read-only access to the audit log. Administrators only: the log names people and shows what they changed.
interface Deps {
  isAuthenticated: any;
  requireRole: (...roles: string[]) => any;
}

export function registerAuditRoutes(app: Express, { isAuthenticated, requireRole }: Deps) {
  const guard = [isAuthenticated, requireRole("admin", "super_admin", "developer")];
  const filterFrom = (q: any): AuditFilter => ({
    from: typeof q.from === "string" && q.from ? q.from : undefined, to: typeof q.to === "string" && q.to ? q.to : undefined,
    actorId: q.actorId || undefined, entityType: q.entityType || undefined, entityId: q.entityId || undefined, action: q.action || undefined,
    q: typeof q.q === "string" ? q.q : undefined, limit: Number(q.limit) || undefined, offset: Number(q.offset) || undefined,
  });

  app.get("/api/audit-log", ...guard, async (req, res) => {
    try { res.json(await listAuditEvents(filterFrom(req.query))); }
    catch (error) { console.error("Error reading audit log:", error); res.status(500).json({ error: "Failed to read the audit log" }); }
  });

  app.get("/api/audit-log/filters", ...guard, async (_req, res) => {
    try { res.json(await auditFilterOptions()); }
    catch (error) { console.error("Error reading audit filters:", error); res.status(500).json({ error: "Failed to read the audit log filters" }); }
  });

  app.get("/api/audit-log/export", ...guard, async (req, res) => {
    try {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="capera-audit-log-${new Date().toISOString().slice(0, 10)}.csv"`);
      res.send("\uFEFF" + await auditCsv(filterFrom(req.query)));
    } catch (error) { console.error("Error exporting audit log:", error); res.status(500).json({ error: "Failed to export the audit log" }); }
  });
}

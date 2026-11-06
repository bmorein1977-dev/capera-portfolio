import type { Express, Request, Response } from "express";
import multer from "multer";
import type { IStorage } from "./storage";
import * as certs from "./services/elearningCertificates";
import { CertificateError } from "./services/elearningCertificates";

// E-learning certificates. Learners see and print their own issued certificates; administrators set automatic or manual issue,
// approve or decline the ones waiting, revoke one issued in error, and override the mode for a single course.
interface Deps {
  storage: IStorage;
  isAuthenticated: any;
  requireRole: (...roles: string[]) => any;
}

export function registerCertificateRoutes(app: Express, { storage, isAuthenticated, requireRole }: Deps) {
  const actorId = (req: any): string => req.session?.impersonatedUserId || req.user?.claims?.sub;
  const guard = [isAuthenticated, requireRole("admin", "super_admin", "developer")];
  const handle = (fn: (req: any) => Promise<unknown>, successStatus = 200) => async (req: Request, res: Response) => {
    try {
      res.status(successStatus).json(await fn(req));
    } catch (error: any) {
      if (error instanceof CertificateError) return res.status(error.status).json({ error: error.message });
      console.error(`Error in ${req.method} ${req.path}:`, error);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  };

  // my own certificates (pending ones are included so I can see it is waiting, but the page for them is not available)
  app.get("/api/certificates/mine", isAuthenticated, handle(async (req) => certs.listForUser(actorId(req))));

  // the customer's logo: a small image kept in the settings. Multer only buffers it; the service checks size and the real file type.
  const logoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1_500_000, files: 1 } }).single("logo");
  app.post("/api/certificates/logo", ...guard, (req: Request, res: Response) => {
    logoUpload(req, res, async (err: any) => {
      if (err) return res.status(400).json({ error: err.code === "LIMIT_FILE_SIZE" ? "The logo must be under 1 MB. Use a smaller image." : "Could not read that file" });
      try { res.json(await certs.setLogo((req as any).file, actorId(req))); }
      catch (error: any) {
        if (error instanceof CertificateError) return res.status(error.status).json({ error: error.message });
        console.error("Error saving certificate logo:", error);
        res.status(500).json({ error: "Something went wrong. Please try again." });
      }
    });
  });
  app.delete("/api/certificates/logo", ...guard, handle(async (req) => certs.removeLogo(actorId(req))));
  // a made-up certificate with the current logo, colour and heading, to check them before anyone has completed a course
  app.get("/api/certificates/preview", ...guard, async (_req: Request, res: Response) => {
    try { res.setHeader("Content-Type", "text/html; charset=utf-8"); res.setHeader("Cache-Control", "no-store"); res.send(await certs.renderSample()); }
    catch (error) { console.error("Error showing certificate preview:", error); res.status(500).json({ error: "Could not show the preview" }); }
  });
  app.get("/api/certificates/settings", ...guard, handle(async () => certs.getSettings()));
  app.put("/api/certificates/settings", ...guard, handle(async (req) => certs.updateSettings(req.body ?? {}, actorId(req))));
  app.get("/api/certificates/courses", ...guard, handle(async () => certs.listCourseModes()));
  app.put("/api/certificates/courses/:trainingId", ...guard, handle(async (req) => { await certs.setCourseMode(req.params.trainingId, req.body?.mode ?? null); return { success: true }; }));
  app.post("/api/certificates/backfill", ...guard, handle(async () => certs.backfill()));
  app.get("/api/certificates", ...guard, handle(async (req) => certs.listAll(typeof req.query.status === "string" ? req.query.status : undefined)));
  app.post("/api/certificates/:id/approve", ...guard, handle(async (req) => certs.approve(req.params.id, actorId(req))));
  app.post("/api/certificates/:id/decline", ...guard, handle(async (req) => certs.decline(req.params.id, actorId(req), req.body?.reason)));
  app.post("/api/certificates/:id/revoke", ...guard, handle(async (req) => certs.revoke(req.params.id, actorId(req), req.body?.reason)));

  // the printable certificate: the person it belongs to (once it has been issued) or an administrator
  app.get("/api/certificates/:id/view", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const cert = await certs.getOne(req.params.id);
      const me = actorId(req);
      const roles = (await storage.getEffectiveRoles(me)).map(r => String(r).toLowerCase().replace(/[\s-]+/g, "_"));
      const isAdmin = roles.some(r => r === "admin" || r === "super_admin" || r === "developer");
      if (!isAdmin) {
        if (cert.userId !== me) return res.status(403).json({ error: "This is not your certificate" });
        if (cert.status !== "issued" && cert.status !== "revoked") return res.status(403).json({ error: "This certificate has not been issued yet" });
      }
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.send(await certs.renderHtml(cert));
    } catch (error: any) {
      if (error instanceof CertificateError) return res.status(error.status).json({ error: error.message });
      console.error("Error showing certificate:", error);
      res.status(500).json({ error: "Could not show the certificate" });
    }
  });
}

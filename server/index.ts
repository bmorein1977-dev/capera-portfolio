import express, { type Request, Response, NextFunction } from "express";
import { execSync } from "child_process";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { emailService } from "./services/emailService";
import { DbStorage } from "./storage";
import { checkAndSendReviewNotifications } from "./services/competenceStandardReviewNotifier";
import { runPerformanceReminders } from "./services/performanceNotifications";
import { runCycleSchedule } from "./services/performance";
import { runStaffingChecks } from "./services/staffingCompliance";
import { runDueSchedules } from "./services/reportSchedule";
import { runRetention } from "./services/retention";
import { adoptLegacySettings, runCompetenceReminders, flushDigests } from "./services/notifications";
import { sendDueEmails as sendAnnouncementEmails } from "./services/announcements";
import { auditMiddleware } from "./services/auditLog";
import { securityHeaders, apiNoStore, sameOriginForChanges, rateLimit } from "./security";

const storage = new DbStorage();

// A failure in one request or background job must never take the service down for every other user: log it and carry on.
process.on("unhandledRejection", (reason) => console.error("Unhandled rejection (the server keeps running):", reason));
process.on("uncaughtException", (error) => console.error("Uncaught exception (the server keeps running):", error));

const app = express();
app.set("trust proxy", 1);
// headers on every response, no stored copies of API data, and changes only from Capera's own pages
app.use(securityHeaders);
app.use("/api", apiNoStore, sameOriginForChanges);
// sign-in is the one place a stranger can reach, so it gets a limit per address
app.use(["/api/login", "/api/callback"], rateLimit({ name: "signin", max: 30, windowMs: 10 * 60 * 1000 }));
app.use(express.json());
// records every successful change (who, what, which fields) in the audit log
app.use(auditMiddleware);

// Initialize email service from environment variables
emailService.initializeFromEnv();

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  // Only the method, path, status and time are logged. Response bodies hold people's details and are never written to the log (ASVS 16.2.5).
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
  });

  next();
});

(async () => {
  const server = await registerRoutes(app, { storage });

  // an /api address nobody serves answers with a plain 404 in JSON, never the web page (which would look like a broken answer)
  app.use("/api", (_req, res) => res.status(404).json({ message: "Not found" }));

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    // a failure on our side shows a plain message; the detail stays in the log (ASVS 16.5.1)
    const message = status >= 500 ? "Something went wrong on our side. Please try again." : (err.message || "Request could not be processed");

    console.error(err);
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);

  // Retries with a stale-port cleanup on EADDRINUSE - a previous instance's listener can still be
  // bound briefly right after a Replit restart, and without this the new process would just crash
  // instead of taking over the port a moment later.
  const startServer = (retries = 3) => {
    server.listen({
      port,
      host: "0.0.0.0",
      // SO_REUSEPORT isn't supported on Windows sockets (ENOTSUP)
      ...(process.platform !== "win32" && { reusePort: true }),
    }, () => {
      log(`serving on port ${port}`);
    });

    server.once("error", (err: any) => {
      if (err.code === "EADDRINUSE" && retries > 0) {
        log(`Port ${port} in use, clearing and retrying...`);
        try {
          execSync(`fuser -k ${port}/tcp 2>/dev/null || lsof -ti :${port} | xargs kill -9 2>/dev/null || true`);
        } catch (_) {}
        setTimeout(() => startServer(retries - 1), 1500);
      } else {
        throw err;
      }
    });
  };

  startServer();

  const shutdown = () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  // Competence standard review reminders (90/60/30 days before a standard's review cycle falls
  // due) - there's no external cron/scheduler in this deployment, so this runs in-process for as
  // long as the server stays up. Fires once on startup (so a review that fell due while the
  // server was down still gets caught), then every 24h. checkAndSendReviewNotifications itself is
  // idempotent per (element, threshold, due date) via notification_logs, so an extra run is a
  // no-op rather than a duplicate email.
  checkAndSendReviewNotifications(storage).catch(err => console.error("Error checking competence standard review notifications:", err));
  setInterval(() => {
    checkAndSendReviewNotifications(storage).catch(err => console.error("Error checking competence standard review notifications:", err));
  }, 24 * 60 * 60 * 1000);

  // Annual review reminders: from 30 days before each due date (then 14, 7, 3, 1 days, on the day, and
  // weekly once overdue). Same approach as above: once on startup, then every 24h, deduplicated through
  // notification_logs so a restart never sends the same reminder twice.
  // Review periods the administrator has set to open by themselves (quarterly, mid-year, year-end, annual): opens each on its date and
  // creates the reviews, then moves people on to their self assessment when that date comes. Runs first so the reminders below see them.
  const runReviewReminders = () => runCycleSchedule()
    .catch(err => console.error("Error opening scheduled review periods:", err))
    .then(() => runPerformanceReminders())
    .catch(err => console.error("Error sending performance review reminders:", err));
  runReviewReminders();
  setInterval(runReviewReminders, 24 * 60 * 60 * 1000);

  // Minimum staffing (duty to operate): opens a review and alerts when a requirement is not met, once on startup
  // and then daily. Deduplicated through notification_logs, so a restart never repeats an alert.
  const runStaffing = () => runStaffingChecks().catch(err => console.error("Error running staffing checks:", err));
  runStaffing();
  setInterval(runStaffing, 24 * 60 * 60 * 1000);
  // removes leavers' personal details once the retention period has passed (only when an administrator has turned that on)
  const runLeaverRetention = () => runRetention().catch(err => console.error("Error running leaver retention:", err));
  runLeaverRetention();
  setInterval(runLeaverRetention, 24 * 60 * 60 * 1000);
  // Email notifications: carry over any reminder days set up on the old screen (once), then once a day send the competence
  // expiry reminders (when switched on) and any daily or weekly digests that are due
  const runNotificationJobs = () => runCompetenceReminders().then(() => flushDigests()).catch(err => console.error("Error running notification jobs:", err));
  adoptLegacySettings().finally(() => { runNotificationJobs(); setInterval(runNotificationJobs, 24 * 60 * 60 * 1000); });
  // announcements set to email people go out when they go live, which for a scheduled one may be between daily runs, so check hourly
  const runAnnouncementEmails = () => sendAnnouncementEmails().catch(err => console.error("Error sending announcement emails:", err));
  runAnnouncementEmails();
  setInterval(runAnnouncementEmails, 60 * 60 * 1000);
  // Scheduled reports (a manager's weekly or monthly emailed report): look every ten minutes for any that are due. The first look waits a minute so the server is
  // taking calls (a report reads its data through the server's own address). Each due report is claimed by one server only, so a second copy cannot send it twice.
  const runScheduledReports = () => runDueSchedules({ storage, base: `http://127.0.0.1:${port}` }).catch(err => console.error("Error running scheduled reports:", err));
  setTimeout(runScheduledReports, 60 * 1000).unref();
  setInterval(runScheduledReports, 10 * 60 * 1000).unref();
})();

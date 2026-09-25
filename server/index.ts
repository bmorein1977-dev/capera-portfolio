import express, { type Request, Response, NextFunction } from "express";
import { execSync } from "child_process";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { emailService } from "./services/emailService";
import { DbStorage } from "./storage";
import { checkAndSendReviewNotifications } from "./services/competenceStandardReviewNotifier";

const storage = new DbStorage();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Initialize email service from environment variables
emailService.initializeFromEnv();

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app, { storage });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

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
})();

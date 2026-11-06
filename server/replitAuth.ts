import * as client from "openid-client";
import { recordSignIn } from "./services/auditLog";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { users } from "@shared/schema";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import type { IStorage } from "./storage";
import { seedLocalDevData } from "./localDevSeed";

// Local-dev-only bypass: lets the app boot and authenticate without a real Replit
// OIDC environment (REPLIT_DOMAINS/REPL_ID). Never set LOCAL_DEV_AUTH in production —
// it logs every request in as a fixed local admin user with no credential check.
export const isLocalDevAuth = process.env.LOCAL_DEV_AUTH === "true";
const LOCAL_DEV_USER_ID = "local-dev-admin";

if (!isLocalDevAuth && !process.env.REPLIT_DOMAINS) {
  throw new Error("Environment variable REPLIT_DOMAINS not provided");
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

function makeUpsertUser(storage: IStorage) {
  async function upsertUser(
    claims: any,
  ) {
    // Try to find existing user by email first (for test scenario compatibility)
    const userByEmail = await storage.getUserByEmail(claims["email"]);
    
    // If a user exists with this email but different ID, reconcile
    if (userByEmail && userByEmail.id !== claims["sub"]) {
      console.log(`[AUTH] Reconciling user: email=${claims["email"]}, old_id=${userByEmail.id}, new_id=${claims["sub"]}`);
      await storage.reconcileUserId(userByEmail.id, claims["sub"], claims["sub"]);
      return; // Reconciliation handles the update
    }
    
    // Check if user already exists by ID
    const existingUser = await storage.getUser(claims["sub"]);
    
    // If user exists, preserve their role unless explicitly provided in claims
    const role = claims["role"] || (existingUser?.role ?? "candidate");
    
    await storage.upsertUser({
      id: claims["sub"],
      email: claims["email"],
      firstName: claims["first_name"],
      lastName: claims["last_name"],
      profileImageUrl: claims["profile_image_url"],
      providerSub: claims["sub"], // Store the OIDC provider subject identifier
      role: role,
    });
  }
  return upsertUser;
}

export async function setupAuth(app: Express, storage: IStorage) {
  app.set("trust proxy", 1);

  if (isLocalDevAuth) {
    await storage.upsertUser({
      id: LOCAL_DEV_USER_ID,
      email: "local-dev@example.com",
      firstName: "Local",
      lastName: "Dev",
      role: "developer",
    });

    await seedLocalDevData(storage);

    // In-memory session (no Postgres session store needed) so req.session.impersonatedUserId
    // still works for the app's built-in impersonation/user-switcher feature.
    app.use(session({
      secret: process.env.SESSION_SECRET || "local-dev-only-secret",
      resave: false,
      saveUninitialized: true,
      cookie: { httpOnly: true, secure: false },
    }));

    // Every request is auto-authenticated as the local dev user - no OIDC needed.
    app.use((req: any, _res, next) => {
      const now = Math.floor(Date.now() / 1000);
      req.user = { claims: { sub: LOCAL_DEV_USER_ID }, expires_at: now + 3600 };
      req.isAuthenticated = () => true;
      next();
    });

    app.get("/api/login", (_req, res) => res.redirect("/"));
    app.get("/api/callback", (_req, res) => res.redirect("/"));
    app.get("/api/logout", (_req, res) => res.redirect("/"));
    return;
  }

  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const upsertUser = makeUpsertUser(storage);
  
  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    void recordSignIn(String(tokens.claims()?.sub));
    verified(null, user);
  };

  for (const domain of process.env
    .REPLIT_DOMAINS!.split(",")) {
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `https://${domain}/api/callback`,
      },
      verify,
    );
    passport.use(strategy);
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

// Someone who has left (archived, with a leaving date that has passed) or whose details have been removed cannot use the system,
// even if their login with the identity provider still works. Looked up at most once a minute per person.
const closedCache = new Map<string, { at: number; closed: boolean }>();
export async function isAccountClosed(userId: string): Promise<boolean> {
  const hit = closedCache.get(userId);
  if (hit && Date.now() - hit.at < 60_000) return hit.closed;
  const u = (await db.select({ isArchived: users.isArchived, leftAt: users.leftAt, anonymisedAt: users.anonymisedAt }).from(users).where(eq(users.id, userId)))[0];
  const closed = !!u && (!!u.anonymisedAt || (!!u.isArchived && (!u.leftAt || new Date(u.leftAt).getTime() <= Date.now())));
  closedCache.set(userId, { at: Date.now(), closed });
  return closed;
}
export function forgetAccountState(userId: string) { closedCache.delete(userId); }

const authenticate: RequestHandler = async (req: any, res, next) => {
  if (isLocalDevAuth) {
    return next();
  }

  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};

export const isAuthenticated: RequestHandler = (req: any, res, next) =>
  authenticate(req, res, async (err?: any) => {
    if (err) return next(err);
    if (isLocalDevAuth) return next();
    try {
      const id = req.user?.claims?.sub;
      if (id && await isAccountClosed(id)) {
        return res.status(403).json({ code: "ACCOUNT_CLOSED", message: "This account has been closed because the person has left. Ask an administrator if you think this is wrong." });
      }
    } catch (error) {
      console.error("Could not check whether the account is closed:", error);
    }
    next();
  });

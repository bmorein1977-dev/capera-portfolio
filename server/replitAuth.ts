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
const isProduction = process.env.NODE_ENV === "production";

// ASVS 6.3.2 / 7.2.1 / 13.4.2: the sign-in bypass must be impossible to switch on by accident in a real deployment.
if (isLocalDevAuth && (isProduction || process.env.REPLIT_DEPLOYMENT)) {
  throw new Error("LOCAL_DEV_AUTH is set in a production deployment. It signs every visitor in as an administrator, so the server will not start. Remove it.");
}

if (!isLocalDevAuth && !process.env.REPLIT_DOMAINS) {
  throw new Error("Environment variable REPLIT_DOMAINS not provided");
}

// ASVS 11.2.3 / 7.2.4: the session cookie is signed with this secret, so a short or missing one lets cookies be forged.
if (!isLocalDevAuth && isProduction && (process.env.SESSION_SECRET ?? "").length < 32) {
  throw new Error("SESSION_SECRET must be set to a random value of at least 32 characters in production.");
}

// ASVS 7.3.1 / 7.3.2: how long a session may sit idle and how long it may last in total before the person must sign in again.
// Set per company with SESSION_IDLE_MINUTES and SESSION_ABSOLUTE_HOURS.
const numEnv = (name: string, fallback: number) => { const n = Number(process.env[name]); return Number.isFinite(n) && n > 0 ? n : fallback; };
const IDLE_MS = numEnv("SESSION_IDLE_MINUTES", 60) * 60 * 1000;
const ABSOLUTE_MS = numEnv("SESSION_ABSOLUTE_HOURS", 12) * 60 * 60 * 1000;

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
      // ASVS 3.3.2: a cookie is not sent on requests started by another site (the sign-in redirect back is a normal top-level visit, which Lax allows)
      sameSite: "lax",
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

export class SignInRefused extends Error {}

export function makeUpsertUser(storage: IStorage) {
  async function upsertUser(
    claims: any,
  ) {
    if (!claims?.sub) throw new SignInRefused("the identity provider sent no subject");
    const email = typeof claims["email"] === "string" ? claims["email"].trim() : "";
    // ASVS 6.8.1 / 10.5.2: an email address is not an identity. Where the provider says the address is unverified, do not trust it.
    // Providers that do not send the claim at all (Replit) are accepted unless REQUIRE_EMAIL_VERIFIED=true (set that for Entra ID and similar).
    const verifiedClaim = claims["email_verified"];
    const emailTrusted = process.env.REQUIRE_EMAIL_VERIFIED === "true" ? verifiedClaim === true : verifiedClaim !== false;

    // A person an administrator created before they ever signed in is matched to the sign-in by email, once.
    const userByEmail = email ? await storage.getUserByEmail(email) : undefined;
    if (userByEmail && userByEmail.id !== claims["sub"]) {
      if (!emailTrusted) throw new SignInRefused(`the email address ${email} is not verified by the identity provider`);
      // Never move an account that is already tied to a different identity: that is how an account would be taken over.
      if (userByEmail.providerSub && userByEmail.providerSub !== claims["sub"]) {
        throw new SignInRefused(`the account for ${email} is already linked to a different identity`);
      }
      console.log(`[AUTH] Linking first sign-in to the account an administrator created: email=${email}, old_id=${userByEmail.id}, new_id=${claims["sub"]}`);
      await storage.reconcileUserId(userByEmail.id, claims["sub"], claims["sub"]);
      return; // Reconciliation handles the update
    }

    // Check if user already exists by ID
    const existingUser = await storage.getUser(claims["sub"]);

    // The role is never taken from the identity provider (ASVS 10.5.2): it is set only inside Capera.
    const role = existingUser?.role ?? "candidate";
    
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
    const user: any = {};
    updateUserSession(user, tokens);
    user.authenticated_at = Date.now(); // start of this sign-in, for the absolute session limit
    try {
      await upsertUser(tokens.claims());
    } catch (error) {
      if (error instanceof SignInRefused) {
        console.warn("[AUTH] Sign-in refused:", error.message);
        return verified(null, false);
      }
      return verified(error as Error);
    }
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

  app.get("/api/login", (req: any, res, next) => {
    // where to come back to after signing in (a scanned QR code): only a path inside Capera, never another address
    const back = typeof req.query.returnTo === "string" ? req.query.returnTo : "";
    if (/^\/[A-Za-z0-9][A-Za-z0-9\/_\-?=&.%]{0,200}$/.test(back) && !back.startsWith("/api/")) req.session.returnTo = back;
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login-refused",
      keepSessionInfo: true, // keeps returnTo across the login
    })(req, res, next);
  });

  // Shown when the identity provider signed the person in but Capera would not accept it (see SignInRefused). Not a redirect back to
  // the login, which would loop.
  app.get("/api/login-refused", (_req, res) => {
    res.status(403).type("html").send("<!doctype html><meta charset=utf-8><title>Sign-in refused</title><body style='font-family:system-ui;max-width:34rem;margin:4rem auto;padding:0 1rem'><h1>Sign-in not accepted</h1><p>Your sign-in worked, but Capera could not match it to your account. Please ask your administrator to check the account set up for you.</p><p><a href='/api/logout'>Sign out</a></p></body>");
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

  // ASVS 7.3.1 / 7.3.2: a sign-in has a total lifetime and an idle limit. Sessions that began before this check existed have no start
  // time and are asked to sign in again once.
  const nowMs = Date.now();
  const startedAt = Number(user.authenticated_at);
  const lastSeen = Number(req.session?.lastSeen) || 0;
  if (!startedAt || nowMs - startedAt > ABSOLUTE_MS || (lastSeen && nowMs - lastSeen > IDLE_MS)) {
    const expired = () => res.status(401).json({ message: "Unauthorized", code: "SESSION_EXPIRED" });
    if (req.session?.destroy) { req.session.destroy(expired); return; }
    return expired();
  }
  if (req.session && nowMs - lastSeen > 60_000) req.session.lastSeen = nowMs;

  const now = Math.floor(nowMs / 1000);
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
      // ASVS 16.5.3: if the check cannot be made, refuse rather than let a possible leaver through
      console.error("Could not check whether the account is closed:", error);
      return res.status(503).json({ message: "The service could not check your account just now. Please try again in a moment." });
    }
    next();
  });

// Everything under /api needs a signed-in, in-date, not-closed person unless it is listed here (ASVS 8.3.1: closed by default, so a new
// route cannot be left open by forgetting to add a check). Paths are relative to /api.
const PUBLIC_API_PATHS = new Set(["/login", "/callback", "/logout", "/login-refused", "/health"]);
export const requireSignedInForApi: RequestHandler = (req, res, next) => {
  if (PUBLIC_API_PATHS.has(req.path)) return next();
  return isAuthenticated(req, res, next);
};

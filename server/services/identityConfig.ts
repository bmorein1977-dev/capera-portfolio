// Single sign-on settings. Capera signs people in with any OpenID Connect provider, including Microsoft Entra ID. It keeps no passwords.
//
//   OIDC_ISSUER_URL            the provider, for Entra ID: https://login.microsoftonline.com/<tenant id>/v2.0
//   OIDC_CLIENT_ID             the application registration's client id
//   OIDC_CLIENT_SECRET         its secret, where the registration is a confidential client
//   APP_BASE_URL               the address people use, for example https://competence.company.com  (redirect URI: <this>/api/callback)
//   OIDC_ALLOWED_TENANT        only accept sign-ins from this tenant (the "tid" claim)
//   OIDC_REQUIRE_MFA=true      refuse any sign-in whose token does not show multi-factor authentication
//   OIDC_MFA_AMR / OIDC_MFA_ACR  which values count (defaults below)
//   OIDC_SCOPES, OIDC_PROMPT   optional
// The older Replit settings (REPLIT_DOMAINS, REPL_ID, ISSUER_URL) still work and are used when the ones above are not set.

export interface IdentityConfig {
  issuer: string; clientId: string; clientSecret?: string; baseUrls: string[]; scopes: string; prompt?: string; allowedTenant?: string;
  requireMfa: boolean; mfaAmr: string[]; mfaAcr: string[]; allowInsecureIssuer: boolean; replit: boolean;
}

const list = (v: string | undefined) => (v ?? "").split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);

export function identityConfig(env: NodeJS.ProcessEnv = process.env): IdentityConfig {
  const replit = !env.OIDC_CLIENT_ID && !!env.REPL_ID;
  const issuer = env.OIDC_ISSUER_URL || env.ISSUER_URL || "https://replit.com/oidc";
  const clientId = env.OIDC_CLIENT_ID || env.REPL_ID || "";
  const baseUrls = env.OIDC_CLIENT_ID && env.APP_BASE_URL
    ? [env.APP_BASE_URL.replace(/\/+$/, "")]
    : list(env.REPLIT_DOMAINS).map((d) => `https://${d}`).concat(env.APP_BASE_URL && !env.REPLIT_DOMAINS ? [env.APP_BASE_URL.replace(/\/+$/, "")] : []);
  let allowInsecureIssuer = false;
  try {
    const u = new URL(issuer);
    // plain http is only ever accepted for a provider on this same machine, for testing
    allowInsecureIssuer = u.protocol === "http:" && ["localhost", "127.0.0.1"].includes(u.hostname) && env.OIDC_ALLOW_HTTP === "true";
  } catch { /* reported by problems() */ }
  return {
    issuer, clientId, clientSecret: env.OIDC_CLIENT_SECRET || undefined, baseUrls,
    scopes: env.OIDC_SCOPES || "openid email profile offline_access",
    prompt: env.OIDC_PROMPT || (replit ? "login consent" : undefined),
    allowedTenant: env.OIDC_ALLOWED_TENANT || undefined,
    requireMfa: env.OIDC_REQUIRE_MFA === "true",
    mfaAmr: list(env.OIDC_MFA_AMR).length ? list(env.OIDC_MFA_AMR) : ["mfa", "ngcmfa", "hwk", "otp", "fido", "swk"],
    mfaAcr: list(env.OIDC_MFA_ACR),
    allowInsecureIssuer, replit,
  };
}

/** what is missing or wrong, in words an administrator can act on; empty when sign-in can start */
export function identityProblems(c: IdentityConfig): string[] {
  const out: string[] = [];
  if (!c.clientId) out.push("Set OIDC_CLIENT_ID (the application's client id at your identity provider).");
  if (!c.baseUrls.length) out.push("Set APP_BASE_URL (the https address people use to reach Capera).");
  try { const u = new URL(c.issuer); if (u.protocol !== "https:" && !c.allowInsecureIssuer) out.push("OIDC_ISSUER_URL must start with https://."); }
  catch { out.push("OIDC_ISSUER_URL is not a usable address."); }
  if (c.allowedTenant && /\/(common|organizations|consumers)(\/|$)/i.test(c.issuer)) out.push("With OIDC_ALLOWED_TENANT set, use your own tenant's issuer address, not the shared 'common' one.");
  return out;
}

/** why a sign-in the provider accepted must still be refused, or null */
export function signInProblem(claims: Record<string, any>, c: IdentityConfig): string | null {
  if (c.allowedTenant && claims.tid !== c.allowedTenant) return "the sign-in is from a different organisation";
  if (c.requireMfa) {
    const amr: string[] = Array.isArray(claims.amr) ? claims.amr.map(String) : [];
    const ok = amr.some((m) => c.mfaAmr.includes(m)) || (!!claims.acr && c.mfaAcr.includes(String(claims.acr)));
    if (!ok) return "the sign-in did not use multi-factor authentication";
  }
  return null;
}

/** providers name these differently; Entra ID uses the standard OpenID names */
export function profileFrom(claims: Record<string, any>) {
  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  const fromName = text(claims.name)?.split(/\s+/);
  const username = text(claims.preferred_username);
  return {
    email: text(claims.email) ?? (username && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(username) ? username : undefined),
    firstName: text(claims.first_name) ?? text(claims.given_name) ?? fromName?.[0],
    lastName: text(claims.last_name) ?? text(claims.family_name) ?? (fromName && fromName.length > 1 ? fromName.slice(1).join(" ") : undefined),
    profileImageUrl: text(claims.profile_image_url),
  };
}

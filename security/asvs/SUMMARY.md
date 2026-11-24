# ASVS 5.0.0 level 2: gap assessment summary

Assessed 253 requirements (level 1 and 2). This is a **self-assessment from reading the code**; nothing here is a claim of compliance, and "Met" needs independent review of sign-in, session and permission code plus a penetration test before it is relied on.

## Overall

| Status | Requirements |
|---|---|
| Met | 55 |
| Partly met | 77 |
| Not met | 29 |
| Platform | 47 |
| Not applicable | 44 |
| Unverified | 1 |

## By chapter

| Chapter | Met | Partly met | Not met | Platform | Not applicable | Unverified | Total |
|---|---|---|---|---|---|---|---|
| V1 Encoding and Sanitization | 10 | 8 | 0 | 0 | 9 | 0 | 27 |
| V2 Validation and Business Logic | 0 | 8 | 3 | 0 | 0 | 0 | 11 |
| V3 Web Frontend Security | 10 | 4 | 4 | 0 | 1 | 0 | 19 |
| V4 API and Web Service | 0 | 2 | 0 | 2 | 6 | 0 | 10 |
| V5 File Handling | 2 | 5 | 2 | 0 | 0 | 0 | 9 |
| V6 Authentication | 3 | 2 | 3 | 24 | 3 | 0 | 35 |
| V7 Session Management | 9 | 3 | 5 | 1 | 0 | 0 | 18 |
| V8 Authorization | 0 | 6 | 0 | 0 | 1 | 0 | 7 |
| V9 Self-contained Tokens | 5 | 1 | 0 | 0 | 1 | 0 | 7 |
| V10 OAuth and OIDC | 5 | 2 | 1 | 14 | 7 | 0 | 29 |
| V11 Cryptography | 4 | 2 | 2 | 0 | 6 | 0 | 14 |
| V12 Secure Communication | 0 | 3 | 0 | 3 | 3 | 0 | 9 |
| V13 Configuration | 4 | 5 | 0 | 3 | 0 | 1 | 13 |
| V14 Data Protection | 2 | 5 | 2 | 0 | 0 | 0 | 9 |
| V15 Secure Coding and Architecture | 0 | 9 | 4 | 0 | 0 | 0 | 13 |
| V16 Security Logging and Error Handling | 1 | 12 | 3 | 0 | 0 | 0 | 16 |
| V17 WebRTC | 0 | 0 | 0 | 0 | 7 | 0 | 7 |

## Effort to close the gaps (conventional engineering days, summed over partly-met and not-met requirements)

- Before a controlled pilot (gate P): **56 days**
- For full adoption (gate F): **107 days**
- Later (gate L): **3 days**

Many requirements share one fix, so these sums overstate the real work; see the grouped plan.

## Gaps before a pilot (gate P)

| Requirement | Status | Gap | Fix | Days |
|---|---|---|---|---|
| V1.3.5 | Partly met | SCORM content from anyone who may upload it runs on Capera's own address. Needs a separate cookieless address (depends on the hosting decision) and tighter upload rights. | Serve SCORM and user files from a separate sandbox origin (cookieless subdomain) with a postMessage bridge for SCORM API calls; restrict upload permission to trusted roles meanwhile. | 6 |
| V2.2.1 | Partly met | Most other routes still pass the request body through. | Validate every request body with a strict Zod schema (allowlisted fields, lengths, formats) via one shared middleware, starting with the routes listed. | 6 |
| V2.2.2 | Partly met | Other update routes (providers, venues, courses, sessions, policy, appraisal and others) are not yet done. | Replace deny-lists with allowlisted Zod schemas per role on user PATCH and booking PUT, and reject unknown keys everywhere. | 3 |
| V2.3.1 | Partly met | Assessment sign-off has no required previous state; training requests have no step check. | Add explicit status-transition checks (and DB conditions on the update) to assessment sign-off, verification, booking and request routes. | 3 |
| V3.5.4 | Partly met | Separate cookieless address for SCORM and downloads. | Serve SCORM packages and user-supplied files from a separate hostname (cookieless, via short-lived signed URLs) and drop allow-same-origin from the iframe sandbox with a postMessage-based SCORM bridge. | 4 |
| V6.8.1 | Partly met | Identity is still (subject) alone, not (issuer, tenant, subject); the company identity provider needs to be settled. | Store and look up identity as (issuer, tenant id, stable object id); stop auto-linking by email except through an admin-confirmed one-off mapping; require email_verified where used; ignore the role claim; strip email from non-admin self-updates. | 2 |
| V7.6.1 | Partly met | Capera sessions are not tied to a maximum time between IdP authentications and IdP logout or disablement does not terminate them, so behaviour cannot match a documented policy. | Enforce an absolute lifetime and a global refresh/expiry check (V7.3.2, V7.4.2), and add OIDC back-channel logout if the customer IdP supports it. | 2 |
| V8.2.1 | Partly met | Some read routes (succession plans, everyone's skills, certificates, expiry data) still need only a sign-in, not a role. | Mount isAuthenticated once on all of /api after setupAuth (deny by default), put explicit role/permission gates on succession plans, user-skills, certificates and AI routes, and make PATCH /api/users/:id apply the same privileged-role rule as user creation. | 3 |
| V8.2.2 | Partly met | Many other record types (competence records, appraisals, skills, succession, certificates, reports) still check the role only. | Add per-record checks (self, direct report/supervisee, allocated candidate via candidate_allocations, allocated assessor via verifier_allocations, or admin) through one shared helper used by every :id or userId-filtered route, remove the body.userId fallback, and add authorization tests per role against these routes. | 6 |
| V8.2.3 | Partly met | Other update routes; responses still return whole records (V15.3.1). | Replace spread-the-body updates with per-role allow-listed Zod schemas (users: self vs admin vs HR; bookings: owner may only cancel), and add a response mapper per role that removes internal fields (retention*, *ObjectKey, providerSub, dateOfBirth where not needed). | 3 |
| V10.5.2 | Partly met | Same as V6.8.1. | Identify users only by issuer plus sub; make email re-linking a one-off, admin-approved migration using a pre-loaded mapping; require email_verified; ignore the role claim. | 1 |
| V12.3.1 | Partly met | Encryption of the database link and of outbound email is left to configuration, and a misconfigured SMTP or database URL would silently send personal data unencrypted. | Set requireTLS for SMTP, require ssl (verify-full) for the database and session store with a start-up check in production, and confirm the replacement object store client uses https only. | 1 |
| V13.3.1 | Partly met | Secrets are handled correctly in code but there is no vault integration or documented create/rotate/destroy process, and a known-exposed database password has not been rotated; the working .env is cloud-synced by OneDrive. | Rotate the exposed database password now, move .env out of the synced folder, and have the company vault inject all secrets at runtime with a documented rotation process. | 0.5 |
| V13.4.1 | Partly met | Nothing prevents a 'COPY . .' container build from packaging .git, .env, the internal IP briefings and attached_assets into the image, where the application process can read them. | Add a multi-stage Dockerfile that copies only dist and production node_modules, plus a .dockerignore excluding .git, .env, attached_assets, *.docx, *.zip and logs. | 1 |
| V14.1.1 | Not met | Personal data (identity, date of birth, helicopter-travel number, CVs, appraisals, 360 feedback, Talent Score, email text) has not been inventoried or classified into protection levels, including data held in session JSON and logs. | Produce a data inventory and classification table (public/internal/personal/special-risk) covering tables, files, logs, sessions and email log, and complete the DPIA. | 1.5 |
| V14.2.2 | Partly met | Authenticated API responses carry no cache directives and tokens are stored unencrypted in the session table, so correct behaviour depends on the unconfigured proxy and database. | Add a global Cache-Control: no-store middleware for /api, and have the platform encrypt the DB at rest (optionally encrypt tokens in the session). | 0.5 |
| V14.2.3 | Partly met | User IP and browser data go to Google, a third-party Replit script executes with full access to the logged-in page, and personal data goes to an AI provider with no documented approval or opt-out. | Remove the replit.com banner script, self-host fonts, and make AI features an explicit per-organisation setting with the provider named in the data-protection documentation. | 1 |
| V15.2.1 | Partly met | Remaining high ones need larger upgrades (drizzle-orm, zod, openai, nodemailer, tailwind build tools) or have no fix (xlsx); need testing one at a time. No policy yet on how fast advisories are fixed. | Update express, multer, nodemailer, ws, drizzle-orm, zod and openai to patched versions, replace xlsx with a maintained parser, run npm audit fix for transitive packages and retest. | 5 |
| V15.3.1 | Not met | Responses return the full user record, so date of birth, company number, internal storage keys and retention notes are exposed to roles that only need a name and job role. | Introduce explicit response DTOs per audience (self, admin, colleague/summary) and restrict the DOB/company number/vantage fields to HR/admin. | 3 |
| V15.3.3 | Partly met | Provider, venue, course, session and policy routes and others still pass the body through. | Replace raw req.body with allowlisted zod schemas per action (self vs admin) on /api/users/:id, course-bookings, providers, venues, courses, sessions and policy matrix. | 3 |

## Needs a test or penetration test (Unverified)

- V13.4.4: Express has no TRACE handler and the app does not echo requests, but the catch-all app.use('*') at server/vite.ts:82-84 answers any method (including TRACE) wit

## Needed from the company platform

- V4.1.2: The application has no HTTP-to-HTTPS redirect of its own (grep of server/ finds none; session cookie is Secure at server/replitAuth.ts:52). The platform must terminate TLS and eith
- V4.2.1: The app uses Node's built-in HTTP server behind Express (server/index.ts); request framing is done by the Node parser and the company's load balancer. The platform must use a curre
- V6.2.1: The application stores and verifies no passwords: no bcrypt/argon2/scrypt/passport-local use anywhere in server/, shared/ or client/src (no LocalStrategy matches); sign-in is OIDC 
- V6.2.2: No change-password feature in the app (no password route or field in server/routes.ts or client/src). Identity provider must offer self-service password change (e.g. Entra My Accou
- V6.2.3: No password change in the app. The provider's change flow must require current and new password (Entra does for signed-in change; SSPR reset is a separate flow requiring MFA proof)
- V6.2.4: No password registration in the app. Provider must enforce a banned-password check of at least the top 3000 (Entra Password Protection global banned list, enabled and in enforced m
- V6.2.5: No password rules in the app. Caveat: Entra cloud accounts enforce a fixed 3-of-4 character-class composition rule that cannot be switched off, which conflicts with this requiremen
- V6.2.6: No password input field exists in client/src (no type=password; sign-in is a redirect, client/src/pages/Landing.tsx:71). The provider's sign-in page must mask entry.
- V6.2.7: No password field in the app; paste and password managers are a property of the provider's sign-in page, which must not block them.
- V6.2.8: The app never receives or verifies a password (no password handling in server/). Provider verifies as received.
- V6.2.9: No password handling in the app. Provider must accept at least 64 characters (Entra accepts up to 256).
- V6.2.10: No password lifetime logic in the app. Provider must not force periodic rotation (Entra: set passwords not to expire, rotate only on compromise).
- V6.2.11: No password creation in the app. Provider's custom banned password list must be loaded with the documented context words (see V6.1.2, which is not yet documented).
- V6.2.12: No password creation in the app. Provider must check against breached passwords (Entra Password Protection global list; Identity Protection leaked-credential detection if licensed)
- V6.3.1: No credential-verifying endpoint in the app (no password or OTP check in server/; /api/login only redirects to the provider, server/replitAuth.ts:174-179). Provider must provide sm
- V6.3.3: The app delegates all authentication (server/replitAuth.ts:157-186) and does not read acr/amr claims (grep finds none in server/), so MFA cannot be confirmed by the app. Provider m
- V6.4.2: No hints or secret questions in the app (grep of client/src and server/ finds none). Provider must have security-question reset methods disabled (Entra SSPR: use Authenticator/phon
- V6.4.3: No password reset in the app. Provider's reset must require MFA and not bypass enabled factors (Entra SSPR with two methods and combined registration).
- V6.4.4: No factor management in the app. Company helpdesk/provider process must identity-proof at enrolment level when a factor is lost (e.g. Temporary Access Pass issued after verified id
- V6.5.1: The app has no lookup secrets, out-of-band codes or TOTP (no otp/totp logic in server/; client/src/components/ui/input-otp.tsx is an unused UI component with no importers). MFA is 
- V6.5.3: The app generates no MFA secrets. Provider must use CSPRNG-generated codes and seeds (Entra Authenticator does).
- V6.5.4: The app issues no codes (certificate numbers via crypto randomInt at server/services/elearningCertificates.ts:76 are not authentication codes). Provider's codes meet the 20-bit min
- V6.5.5: The app issues no out-of-band codes or TOTP. Provider lifetimes (Authenticator 30 s TOTP, OOB under 10 minutes) apply.
- V6.6.1: The app offers no PSTN OTP. Provider must disable SMS/voice authentication methods or offer them only with validated numbers alongside stronger methods (Authenticator, FIDO2).
- V6.6.2: The app has no out-of-band authentication of its own. OIDC authorization codes are bound to the request by PKCE S256 in node_modules/openid-client/build/passport.js (code_challenge
- V6.6.3: The app has no code-based out-of-band mechanism. Provider must rate-limit code entry (Entra smart lockout / MFA throttling).
- V7.4.3: Capera has no password, MFA or recovery management; authentication is delegated entirely to the OIDC provider (server/replitAuth.ts:101-198; passport-local is listed in package.jso
- V10.4.1: Capera is not an authorization server (no /authorize, /token, jwks or well-known routes: grep of server/ and shared/). Capera registers redirect https://DOMAIN/api/callback per dom
- V10.4.2: Authorization-server behaviour; Capera has no AS endpoints. The customer IdP (for example Entra ID) must make codes single-use and revoke on reuse
- V10.4.3: Authorization-server behaviour; Capera has no AS endpoints. IdP must keep authorization codes under 10 minutes
- V10.4.4: Authorization-server setting. Capera uses only the authorization code grant and refresh_token grant (server/replitAuth.ts:159-167, 237); the IdP app registration must disable impli
- V10.4.5: Authorization-server behaviour; IdP must rotate or sender-constrain refresh tokens. Client side stores the new refresh token each refresh (server/replitAuth.ts:62-65) but parallel 
- V10.4.6: Authorization-server enforcement; the Capera client always sends S256 challenge and verifier (node_modules/openid-client/build/passport.js:118-121, 211). IdP must require PKCE and 
- V10.4.8: Authorization-server setting: IdP must set an absolute maximum refresh token lifetime. Capera does not cap it itself (see V7.3.2)
- V10.4.9: IdP user interface must let users or administrators revoke refresh tokens (for Entra, My Apps and admin revoke sessions); Capera has no such UI and does not revoke at logout (serve
- V10.4.11: IdP registration must grant only what Capera needs. Capera requests openid email profile offline_access (server/replitAuth.ts:163,177); no API or Graph permissions are used. Confir
- V10.6.1: OpenID Provider setting. Capera uses the code response type (default, no response_type override: server/replitAuth.ts:159-167, 174-179); the IdP registration must disable implicit 
- V10.6.2: OpenID Provider behaviour: IdP must confirm logout with the user or validate id_token_hint. Note Capera sends client_id and post_logout_redirect_uri (derived from request host) but
- V10.7.1: Authorization-server consent function; Capera sends prompt login consent on every sign-in (server/replitAuth.ts:176). For an enterprise IdP, administrator consent for the app shoul
- V10.7.2: The consent screen is shown by the IdP; Capera only supplies scope and client identity (server/replitAuth.ts:163,177). IdP must show app name, scopes and lifetime
- V10.7.3: Review and revoke of consents is an IdP user interface function; Capera has no consent store (grep of server/ and shared/)
- V12.1.1: The app serves plain HTTP on 0.0.0.0:PORT (server/index.ts:87-100; http createServer at server/routes.ts:6044, no https/tls options anywhere) and expects a TLS-terminating proxy (t
- V12.1.2: Cipher suite selection is not in the application (no tls options in server/). Platform must provide: a current recommended cipher list with the strongest preferred (forward-secret 
- V12.2.2: Certificates are issued and installed on the company's TLS terminator, not in the app (server/index.ts:87-100 serves HTTP only). Platform must provide a certificate that the users'
- V13.2.4: Application layer has no allowlist mechanism, but every outbound destination is fixed in code or set by operator env vars (emailService.ts:62,136,155; replitAuth.ts:29; SDK default
- V13.2.5: Same as V13.2.4: the Node process has no host-level outbound restrictions in the repo (no Dockerfile, network policy or proxy config exists; .replit:13-14 only sets the Replit port
- V13.3.2: Code reads every secret from one process environment (single process holds DB, SMTP, AI and session secrets), so least privilege over who can read each secret is decided by the vau

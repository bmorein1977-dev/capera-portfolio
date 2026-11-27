# Hosting Capera on a company's own platform

What an IT team needs to run Capera on its own infrastructure. Nothing from Replit is required.

**What has been proved, and how.** `tests/security/hosting.e2e.mjs` starts the production build against an empty database created by the
upgrade tool, with a stand-in OpenID Connect provider and files on local disk (28 checks, 26 November 2026). Azure Blob Storage is tested
against a stand-in with the same web interface (`tests/security/platform.unit.ts`). **Still to be proved on the real platform:** a real
Microsoft Entra ID tenant, a real Azure storage account, a real mail service, and building the container image (Docker was not available
on the machine used). None of these should need code changes, but each must be tested there.

## What it needs

| Part | Requirement |
|---|---|
| Compute | Node.js 20 or later, or a container host (see `Dockerfile`). At least one instance that stays running, for the timed jobs. |
| Database | PostgreSQL 15 or later. Encrypted connections (add `sslmode=require` or `verify-full` to the address). Point-in-time recovery. |
| File storage | Azure Blob Storage, or a folder or mounted share with backup and restricted access. |
| Sign-in | Any OpenID Connect provider, for example Microsoft Entra ID. |
| Email | SMTP (including an internal relay), Resend or SendGrid. Optional while setting up. |
| Web | An HTTPS reverse proxy or load balancer in front, passing `X-Forwarded-Proto` and `X-Forwarded-Host`. |

## Settings

| Setting | What it is |
|---|---|
| `NODE_ENV=production` | Required. |
| `PORT` | Port the server listens on (5000 in the container). |
| `DATABASE_URL` | The PostgreSQL address. |
| `SESSION_SECRET` | A random value of at least 32 characters. The server will not start with less. |
| `APP_BASE_URL` | The address people use, for example `https://competence.company.com`. |
| `OIDC_ISSUER_URL` | Entra ID: `https://login.microsoftonline.com/<tenant id>/v2.0` |
| `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` | From the application registration. |
| `OIDC_ALLOWED_TENANT` | The tenant id. Sign-ins from any other organisation are refused. |
| `REQUIRE_EMAIL_VERIFIED` | `true` only if the provider sends `email_verified` (Entra ID does not by default: restrict by tenant). |
| `OIDC_REQUIRE_MFA` | `true` refuses any sign-in whose token does not show multi-factor authentication. |
| `OIDC_MFA_AMR`, `OIDC_MFA_ACR` | Which token values count, if the defaults do not match the provider. |
| `BOOTSTRAP_ADMIN_EMAILS` | The first administrator's email address. Used only while there is no super administrator. |
| `ALLOW_SELF_REGISTRATION` | Leave unset. Only people an administrator has added can use the system. |
| `STORAGE_DRIVER` | `azure` or `filesystem`. |
| `AZURE_STORAGE_CONTAINER_URL` | The container address with a SAS token (read, create, write, delete). Treat it as a secret and set an expiry and renewal date. |
| `STORAGE_DIR` | Full folder path, when `STORAGE_DRIVER=filesystem`. |
| `EMAIL_SERVICE` | `smtp`, `resend`, `sendgrid` or `none`. |
| `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | Mail settings. `SMTP_NO_AUTH=true` for a relay without an account. Encryption is required unless `SMTP_ALLOW_PLAINTEXT=true`. |
| `AI_FEATURES` | `off` (recommended to begin with), or a list: `evidence,standard_review,authoring,reports,translation,theming`. |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` | Only if AI features are wanted. |
| `AI_EVIDENCE_SEND_NAME` | `true` only if the candidate's name may be sent with an evidence review. Off by default. |
| `AI_ORGANISATION_CONTEXT` | A short description used in the standard review instruction. |
| `CAPERA_TIER` | `bronze`, `silver` or `gold`. |
| `CONTENT_ORIGIN` | A second web address for uploaded e-learning packages (recommended). |
| `SESSION_IDLE_MINUTES`, `SESSION_ABSOLUTE_HOURS` | 60 and 12 by default. |
| `ENABLE_DEMO_TOOLS` | **Never set on a company system.** It enables test-data tools and recording decisions while acting as another user. |

## Entra ID application registration

1. Register an application, single tenant. Platform: Web. Redirect URI: `<APP_BASE_URL>/api/callback`. Front-channel logout is not used.
2. Create a client secret (or agree certificate credentials, which would need a code change).
3. Token configuration: add the optional `email` claim to the ID token. `given_name` and `family_name` are read when sent.
4. Require multi-factor authentication with a Conditional Access policy for this application. If Capera should also check it, set
   `OIDC_REQUIRE_MFA=true` and confirm the tokens carry a value Capera accepts (`amr`), or set `OIDC_MFA_ACR` to an authentication context.
5. Assign the users or groups who may use the application.

Capera identifies a person by the token's subject. A person an administrator has already added is linked to their first sign-in by email
address, once, and never moved to a different identity afterwards. Roles are set in Capera, not taken from the provider.

## First installation

```
node scripts/db/migrate.mjs          # creates the database structure and records each upgrade
node dist/index.js                   # or run the container
```

Sign in as the address in `BOOTSTRAP_ADMIN_EMAILS`; that person becomes the first super administrator. Then remove the setting.

## Upgrading

1. Take a database backup and confirm it can be restored.
2. `node scripts/db/migrate.mjs --status` to see what will change.
3. `node scripts/db/migrate.mjs` (each upgrade runs in its own transaction and is recorded; a failure rolls that one back and stops).
4. Replace the application and check `/api/health` (it returns 503 if the database does not answer).

A database created before the upgrade record existed needs `--baseline <last upgrade it already has>` once.

## Backup and recovery

- Database: use the platform's point-in-time recovery, and keep a daily logical backup (`pg_dump -Fc`) in separate storage.
- Files: Azure Blob soft delete and versioning, or backup of the storage folder. Restore files and database to the same point.
- Test a restore before go-live and then on a schedule. `scripts/db/export-all.mjs` makes a readable copy of every table.

## Running more than one instance

Use one instance until the timed jobs have been reviewed for the platform: some of them check and then send, so two instances could send a
reminder twice. Prepared report downloads are held in one instance's memory for 15 minutes, so more than one instance needs session
affinity.

## Monitoring

`/api/health` for availability. The server writes method, path, status and time for each request, and errors; it does not write request or
response bodies. Collect standard output into the company's log service. Security-relevant actions are in the audit log inside Capera.

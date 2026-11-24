# How fast weaknesses in libraries are fixed (proposal)

*Needed for ASVS 15.2.1 ("only components that have not breached the documented update and remediation time frames"): there has to be a written time frame before it can be met or breached. These numbers are a **proposal** for the customer's IS architect to accept or change.*

## Time frames

Counted from the day an advisory is published for a library Capera actually ships (production packages, not build tools that never reach a user).

| Severity of the advisory | Fix, or a recorded exception, within |
|---|---|
| Critical | 7 days |
| High | 30 days |
| Moderate | 90 days |
| Low | the next planned release |

A weakness that is actively being used by attackers, or that the code is demonstrably exposed to (the vulnerable feature is used and reachable by an untrusted person), is treated as one level higher.

## How it is kept to

- **Every change** runs `npm audit --omit=dev --audit-level=critical` in the pipeline (`.github/workflows/ci.yml`). A critical advisory in a production package stops the build. High advisories are reported but do not stop it yet (see below).
- **Every week** Dependabot (`.github/dependabot.yml`) opens one grouped pull request of minor and patch updates, and a separate pull request straight away for a security fix. Each one runs the whole pipeline and the security tests before it can be merged.
- **Every month** the open advisories are reviewed against the table above, and any that have passed their time frame are listed with who accepted the exception and until when.

## Exceptions

An exception is a line in this file saying why a fix is not applied, what makes it acceptable, who accepted it and the date it expires. No expiry means it is not an exception.

As of 23 November 2026, `npm audit` for production packages reports no critical, 6 high and 9 moderate advisories. The high ones are all direct dependencies:

| Package | Fix available | Why not yet applied | Needed by |
|---|---|---|---|
| `drizzle-orm` | 0.45.4 | major upgrade of the database layer; needs a full test pass against the demo database | to be agreed |
| `nodemailer` | 10.6.1 | major version; email sending to be retested with a real mail account (also on the follow-up list) | to be agreed |
| `openai` | 7.62.0 | major version; the AI step is optional and was never run against the real service from the test setup | to be agreed |
| `zod` and `zod-validation-error` | 4.6.7 and 5.0.0 | validation rules are used throughout; a major upgrade changes error shapes | to be agreed |
| `xlsx` | none | no fixed version exists. It reads uploaded spreadsheets (training and people imports). To be replaced with a maintained reader; until then only administrators can upload, and files are size-limited | to be agreed |

Dates and owners in the last column are blank on purpose: they are for the customer and Bruce to agree, not for the code to assume.

## Moving the pipeline gate to "high"

Once the five fixes above are done, change `--audit-level=critical` to `--audit-level=high` in `ci.yml`, so the 30-day rule is enforced by the build and not only by review.

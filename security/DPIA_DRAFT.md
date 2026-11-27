# Data protection impact assessment: DRAFT for the customer's data protection officer

**Status: draft, 23 November 2026, with site visitor forms and training course evaluations added 25 November 2026. Not legal advice, and not a conclusion.** It sets out what Capera does with people's data, as read from the code and the tests on this date, so the customer's data protection officer (DPO) and the system owner can complete it. Every "decision needed" below belongs to the **controller** (the customer), not to Capera's builder. Nothing here has been reviewed by a DPO or a lawyer.

Companion files: `security/DATA_INVENTORY.md` and `security/data-inventory.csv` (every table and column, classified), `security/asvs/` (the security assessment), `security/PENTEST_SCOPE.md`.

## 1. What is being assessed

Capera is a competence-assurance and skills platform. A company uses it to show that each person is competent for the work they do, to run training and assessment, to meet a duty to operate safely, and to run annual performance appraisal with 360 feedback.

**Whose data:** employees, contractors (declared by their contracting company), external verifiers (outsiders from an awarding or auditing body), and the administrators and managers who use it.

**Why a DPIA:** the platform holds performance appraisals, 360 feedback, a "Talent Score", absence records, a full audit trail of staff actions, and competence records that decide whether someone is allowed to do safety-critical work. Evaluating or scoring employees, systematically, is a case where an assessment is normally expected.

## 2. The processing

| Purpose | Data | Who sees it |
|---|---|---|
| Competence and training records (is this person competent and current for their role) | name, job role, location, team, assessments, sign-offs, evidence, training completions, expiry dates, certificates | the person; their manager and supervisors (reporting lines at any depth); their assessor and verifier; administrators |
| Duty to operate (are enough competent people on duty) | counts by role and site; names only for the viewer's own team | managers (own team named, others shown as "someone outside your team"); administrators |
| Annual appraisal | objectives, self review, manager review, ratings, comments | the person (their own half at once, the manager's half only after the discussion); their line manager; their supervisor (without ratings, potential rating or calibration notes); administrators (HR) |
| 360 feedback | raters' scores and comments about a person | the line manager and administrators only; **not the person reviewed, not a supervisor**; no rater is named next to a rating; results appear only once enough people have answered |
| Talent Score | a calculated score from appraisal, competence and 360 | administrators only |
| Absence and leave | type, dates | administrators; the person's managers where their role allows (**to be confirmed** against the real screens before this is signed) |
| Contractor management | contractor people, declared records, approval status | the contracting company's administrator (own people only); host administrators |
| Site visitor forms (people on a short visit) | name, business contact details, vehicle registration, **emergency contact (a third party)**, **access or health support needs**, host and visit details, competence checklist, certificates for the person and equipment | the contracting company's administrator (own company only); host administrators; **whoever reads the mailbox the form is emailed to**. Never in page exports; request contents are never copied into the audit log; opening a form is logged |
| Training course evaluations | each attendee's ratings and written comments about a course, any safety concern, whether it has been used at work; **ratings and comments about named instructors**, who are people too | the person (own replies); people given "view" (results **without names**); people given "manage" (administrators and training administrators by default): who has replied, safety concerns **with the name**, and names beside answers **only if switched on before the reply was sent** (off by default). Reply wording is never copied into the audit log or the safety alert email |
| Evidence of competence | files, and the title, kind and written description of each item (stored from 26 November 2026; before that the words were only emailed to the assessor) | the person; their assessor, manager and allocated verifiers; an external verifier for allocated assessors; administrators; sent to the AI review only when someone runs it. A file belongs to one candidate: an assessor may attach it to that candidate's other assessments, never to another candidate's (checked by the application and the database) |
| External verification | assessments, assessor comments, verification records, evidence list for allocated assessors | the external verifier, read-only, for the allocated assessors and period only; every view is logged |
| Reports (on screen, Excel, infographic, emailed) | the same records, cut to what the requester may see | the requester; a scheduled report only ever goes to its owner |
| Audit log | who changed what, when, and from which address; sign-ins; opened appraisals (by non-participants); everything an external verifier opens | administrators |

**Technical flows (verify these against the real deployment):**

- Sign-in goes to the **customer's identity provider** (OpenID Connect); Capera stores no passwords.
- **Email** (SMTP, Resend or SendGrid, whichever is configured) carries notifications and scheduled report summaries. Summaries hold counts and category names only, from an approved list of columns; an Excel attachment (names) goes only to the report's owner.
- **Object storage** holds CVs, photos, evidence and learning packages under random keys.
- **Optional AI services**, each off unless a key is configured:
  - report infographic wording (Anthropic): **counts and category names only**, from an approved list of columns, and nothing is sent if a person's name appears in the request (fixed 26 November 2026; before that, names under some headings could be sent). The step can be switched off for a deployment (`AI_REPORTS=off`) and per report;
  - competence-standard review and text translation (Anthropic) and brand theming (OpenAI): these take text the user enters or that is part of the company's standards; **to be confirmed against each feature's real inputs before any use with live data**.
- Web fonts are served by Capera itself, so no one's address or browser details go to a font provider. Learning packages can be served from a separate cookie-free address (`CONTENT_ORIGIN`).
- The server log holds method, path, status and time only; response bodies are never logged.

**Retention:** the default for leavers is 24 months after leaving (a placeholder, not advice). Removing a leaver **anonymises** the person (name, email, photo, CV, identifiers) so competence history survives. A hold can stop it per person. Free text written about a person (appraisal and 360 comments, assessor and verifier comments) is **not yet removed** (see risk 9).

## 3. Necessity and proportionality (what is built, and what is for the controller to decide)

**Built to limit what is collected and who sees it:**

- Access follows role **and the specific person**: a manager sees their own people only, in lists, reports, exports and the people picker (`accessiblePersonIds`); an assessor their allocated candidates; a verifier their assessors' candidates; a contractor administrator their own company. Tests: `tests/security/scope.e2e.cjs`, `api.e2e.cjs`, `round3.e2e.cjs`.
- Appraisal routes check the person on every request (employee, manager, supervisor or administrator); seventeen routes were tried as three outsiders and none changed or revealed anything.
- An administrator opening someone else's appraisal is written to the audit log with who and whose.
- 360 results are held back until enough raters have answered and are never shown to the person reviewed.
- External verifiers can be given an **end date** on each allocation; after it their access ends at once.
- Visitor forms keep the details only needed around the visit (emergency contact, support needs, mobile, employer emergency number, vehicle) apart from the record of the checks. An administrator can set them to be removed a number of days after the visit (**off until a number is set**), with a hold for an incident or enquiry. The privacy notice shown on the form states whichever is set. Tests: `tests/security/visitors.e2e.cjs`.
- Exports, scheduled reports and the infographic can never contain more than the person could see on screen, and the AI step receives no names.

**Decisions needed from the controller (not made by Capera):**

1. **Lawful basis** for each purpose in section 2 (for employment records this is usually not consent; legal obligation, contract and legitimate interests are the usual candidates; competence for safety-critical work may rest on a legal duty).
2. **Whether any data is special category.** Absence type can reveal health; visitor forms can hold access or health support needs; date of birth is held; confirm whether either is needed at all and, if absence types are kept, whether to hold a coarser category.
3. **Retention** for each kind of record (the 24-month leaver figure, appraisal and 360 text, audit log, email log, evidence files).
4. **Consultation** with employees or their representatives about performance scoring and 360, if the controller's policies or local law require it.
5. **The AI services:** whether any are acceptable, under what contract, in which region, and whether the optional ones should be disabled for the customer.
6. **Where it runs** and who the processor is (the customer's own infrastructure, or a host): contracts, location of data and of support access.
7. **Subject rights process** (see below): who handles a request and how fast.

## 4. Rights of the people concerned

| Right | Today |
|---|---|
| Access (a copy of their data) | the person sees most of their own records on screen; **there is no one-click "everything about me" export**. A request would be answered by an administrator using the inventory and the audit log. Build a subject export if the customer wants it self-service. |
| Rectification | a person edits some of their own details; administrators edit the rest; the audit log records every change with before and after values |
| Erasure | leaver anonymisation after the retention period (built, tested as a rule); full deletion is a separate and larger piece of work because competence evidence may have to be kept |
| Restriction | a hold per person stops removal |
| Objection and automated decisions | no decision is taken by software alone: scores inform a person; the Talent Score is for administrators only. Confirm with the DPO whether it counts as profiling that needs a notice |

## 5. Risks and what stands between them and harm

Likelihood and severity are for the DPO to score. "Controls" are things that exist and are tested; "Further" is what is not done.

| # | Risk | Controls | Further |
|---|---|---|---|
| 1 | Someone reads another person's appraisal or 360 | per-record checks on every appraisal route (tested as outsiders); 360 results for line manager and administrators only; opening by a non-participant administrator logged | independent penetration test; refused attempts are now logged; decide who reviews them |
| 2 | A manager sees or exports people outside their team | team scope in lists, reports, exports and scheduled reports; naming an outside person returns nothing | note on each page "showing your team"; org chart (names and reporting lines only) not yet limited |
| 3 | An outsider (external verifier) sees more than they should, or after their engagement | read-only role; only allocated assessors; end date enforced in every query; every view in the audit log | the account can now have an end date too; review the log on a schedule |
| 4 | Personal data leaves in a report or email | report engine reads as the person; summaries carry no names; attachments only to the owner; every export written to the audit log; spreadsheet-formula safe | an Excel file in a mailbox is outside Capera's control (forwarding, phones): consider a switch to forbid attachments |
| 5 | Personal data sent to an AI provider | infographic sends approved counts and categories only, and nothing if a name is present; each AI feature can be switched off; evidence review withholds the name by default; off by switch; falls back to rules | confirm inputs of the other AI features; decide whether to allow them |
| 6 | A learning package's scripts act with someone's session | separate cookie-free content address with a signed, expiring, learner-specific link; package cannot call the API | **not active on the demo** (needs a second address); until then only trusted roles may upload |
| 7 | Third parties learn who uses the system | fonts now served by Capera; no analytics or trackers | none known |
| 8 | Account takeover | sign-in delegated to the customer's identity provider (their MFA applies); session limits; closed accounts blocked | the identity provider is the customer's to configure (many ASVS items are "platform") |
| 9 | Data kept longer than needed | leaver anonymisation with a hold; audit trail of retention actions | free text about a person is not yet removed; retention periods not agreed |
| 10 | Misuse of access by an administrator | audit log of every change; appraisal views by non-participants logged; Talent Score and scores hidden from managers | no alert on unusual administrator activity; consider two-person rule for destructive actions |
| 11 | Breach not noticed | audit log; error logging | refused attempts and repeated failures are not alerted on; no security-event definition yet (ASVS 16.3.3) |
| 12 | Re-identification of a rater in a small 360 | minimum number of raters before any result is shown; comments shuffled; no rater named next to a rating | review the minimum with the DPO |
| 13 | Visitor emergency contacts, support needs or certificates reach the wrong people | company-by-company access; host administrators only; not exportable; not copied into logs; email goes only to the addresses set, and its log keeps no personal details | **by default the email carries the form and certificates**: confirm the mailbox is controlled or switch attachments off; set the removal period; the privacy notice wording is a general starting point that the controller must replace or approve |
| 14 | A person is picked out from feedback given without a name, or is treated badly for what they said | names off by default and the promise shown before answering is kept with each reply; results held back below a minimum number of replies (3 by default), including when filters narrow the group; month only beside comments, in no order of arrival; tested in `tests/security/evaluations.e2e.cjs` | **this lowers the risk and cannot remove it**: Capera keeps the link to run reminders, so the database holds it; comparing filtered and unfiltered totals, or the list of who has not replied, can narrow things down in small groups; a comment can identify its writer; say this in the staff notice |
| 15 | Instructor figures are used to judge a person unfairly | comparisons say that different courses are mixed within a row; a rating needs at least three replies; instructor rows are left out of infographics and anything sent to an AI provider | decide who may see instructor comparisons, tell instructors (including a provider's staff) it happens, and how they can respond |

## 6. Evidence that the controls work

Automated checks run on every change (`.github/workflows/ci.yml`: unit tests, build, no new type errors, dependency audit) and the end-to-end checks in `tests/security/` (run by hand against the demo database): several hundred checks in all across record access, team scope, external verifiers, appraisals, the content address, reports and sign-in. These are the builder's own tests. **They are not independent assurance**; an independent penetration test is planned (`security/PENTEST_SCOPE.md`).

## 7. Residual risk and sign-off

To be completed by the DPO after the decisions in section 3 and the penetration test. Suggested wording once done: "Residual risk is accepted by [name, role] on [date] on condition that [actions] are completed by [date]."

| Role | Name | Decision | Date |
|---|---|---|---|
| System owner | | | |
| Data protection officer | | | |
| Information security | | | |
| Controller's representative | | | |

## Added 26 November 2026

| Processing | Data | Who sees it |
|---|---|---|
| Integration interface (/api/v1) | people (name, email, employee number, role, site, team, manager, dates), competence and training status | a company system holding a key with the matching scope; keys are named, limited, dated, revocable and logged |
| HR feed | the same people fields, written | as above, scope people:write; cannot change roles or administrators |
| Per-person data download | everything held about one person, including their files | administrators; each download is logged. It does not include text about them held in other people's records |
| Full database export (script) | everything except sign-in sessions and key fingerprints | whoever runs it on the server; treat the output as the most sensitive copy there is |
| Standard versions | wording, and who wrote, submitted and decided each version | authors and approvers |
| Audit evidence repository | documents, who uploaded, approved and opened them | administrators; external verifiers only for documents shared with them |
| Standardisation records | attendees, discussion and actions | verifiers, administrators, external verifiers; assessors who attended |

The audit log is now protected in the database against edits and deletions; the single exception is removing a person's name under the retention rule. Company hosting places all storage under the controller's own platform.


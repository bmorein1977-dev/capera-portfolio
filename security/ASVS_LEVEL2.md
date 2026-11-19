# Security standard: OWASP ASVS 5.0.0, level 2

**Decision (18 November 2026):** Capera is built and verified to the OWASP Application Security Verification Standard, version 5.0.0,
level 2. Level 2 is every requirement marked level 1 or level 2 in the standard: **253 of its 345 requirements** (70 + 183).
Level 3 (92 requirements) is out of scope unless a customer asks for it.

Why: Capera holds personal data (people's competence, training, performance reviews, 360 feedback) and is adopted by organisations that
will test it. Level 2 is the usual bar for business applications of that kind, and gives a security review something concrete to check.

If a customer's standard is ASVS 4.0.3, the requirements are mapped across; the work is not repeated.

## What this does and does not mean

- It is a **target and a method**, not a certificate. "Compliant" is only said of a requirement when evidence for it is recorded.
- Evidence is a code reference, a test, a scan result, a configuration, or the company platform providing it (with who confirmed that).
- Self-assessment comes first. Before anyone says "level 2", the sign-in, session and permission code is reviewed by a person other than
  the author, and an independent penetration test is done and its findings fixed and retested.
- Some requirements are met by the platform the company runs Capera on (for example transport security, key management, logging
  infrastructure). Those are recorded as "platform" with exactly what the platform must provide, and IT confirms them.

## Status of each requirement

| Status | Meaning |
|---|---|
| Met | Verified in the code or configuration, with evidence recorded |
| Partly met | Some of it is in place; the gap is described |
| Not met | Absent or contradicted |
| Platform | Provided by the hosting platform or company services; what is needed from them is recorded |
| Not applicable | The feature does not exist or the requirement does not apply, with the reason |
| Unverified | Cannot be decided by reading the code; needs a test, scan or penetration test |

## Where the assessment lives

- `security/asvs/asvs-5.0.0-level2-assessment.csv` : one row per requirement, with status, evidence, gap, fix, effort and gate
- `security/asvs/SUMMARY.md` : counts by chapter and the ranked list of gaps
- Requirement text is from ASVS 5.0.0 (Creative Commons Attribution-ShareAlike 4.0, owasp.org).

## Definition of done for any change

A change is not finished until these are true, in addition to the feature working:

1. **Permissions:** every new or changed route checks who may call it on the server (not only in the screen), and a test proves a person who
   should be refused is refused.
2. **Input:** everything coming from a person is validated on the server (type, length, range, allowed values) before it is used.
3. **Data access:** queries use parameters; no user input is joined into a query, a path, a command or a URL.
4. **Output:** anything shown in a page or put in an email is encoded for where it goes. No raw HTML from user data.
5. **Secrets and personal data:** no secret in the code or logs; personal data is only logged or returned where needed.
6. **Errors:** a failure returns a plain message to the person and the detail goes to the log, never the other way round.
7. **Changes to who can see what** are recorded in the audit log.
8. **Dependencies:** a new package is justified, its licence recorded, and it has no open high or critical advisory.
9. **Tests:** the change is covered by an automated check that runs in the pipeline.
10. **Follow-ups:** any known gap against ASVS is written in `security/asvs/` and `FOLLOW_UPS.md`, not left in someone's head.

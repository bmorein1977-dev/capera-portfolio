# Capera follow-ups and known gaps

A running list of things that are not finished, not verified, or need a decision, so they are not forgotten.
Internal note: it is kept out of the clean demo zip. Add to it whenever something is built with a known limit,
and tick items off (with the date) when they are dealt with.

Last updated: 6 November 2026.

## Needs a decision or advice before real use

- [ ] **Retention periods (leavers).** The default of 24 months after leaving is a placeholder, not advice. Agree the real period with
      whoever owns data protection for the customer, and write it into the retention rule (Admin Area, Archived People).
- [ ] **Data protection impact assessment (DPIA).** Needed before real people's data goes into the performance reviews, 360 feedback and
      Talent Score, and worth doing for retention and the audit log too.
- [ ] **Vantage number format.** Validation only checks 4 to 20 letters, digits or hyphens. Confirm the real format with Vantage and tighten it.
- [ ] **Contractor status and written consent.** Written consent from the agency and a solicitor's review before commercial talks (see the
      IP provenance briefing). Not a code task, listed so it is not lost.
- [ ] **Neon database password.** Rotate it (it has appeared in session logs).
- [ ] **`attached_assets` provenance.** Review where those files came from before any IP sale.

## Leaver retention (built, migration 0046)

- [ ] Free text written about a person is **not** removed when their details are: performance review comments, 360 feedback, assessor and
      verifier comments, standard-draft notes. It sits across many tables. Decide whether to blank or delete these after the period.
- [ ] Removal is anonymising, not deleting the record, so competence history survives. If a customer insists on full deletion, that is a
      separate and larger piece of work (many tables, audit evidence implications).
- [ ] The sign-in block was tested as a rule, not against the real Replit/OIDC login. Try it once with a real archived account.
- [ ] A block can lag up to a minute after someone is archived or restored (cached lookup).
- [ ] Stored files (CV, photo) are deleted from object storage on a best-effort basis. If that fails it is only logged. Add a retry or a report.
- [ ] No demo data for archived people in the clean demo seed, so the page is empty until someone is archived.
- [ ] Hold is per person with a free-text reason. No expiry or review date on a hold yet.

## Duty to operate (built, migration 0044)

- [ ] Counts people by role at a location. It does **not** know who is on shift or on the rota, so it cannot say "short on nights".
- [ ] A risk assessment is only a reference text on the decision. There is no link to a risk assessment document or register.
- [ ] No history or trend report, no export, and no dashboard tile yet.
- [ ] Alerts go by email only. If email is not configured they are logged as "skipped" and show on screen only.
- [ ] Counts someone as competent from their valid sign-offs for the role's required elements. Confirm that is how the customer's safety
      case defines "competent" for each role.

## Vantage number (built, migration 0044)

- [ ] Not on a person's own profile page (only in User Management). Check the bulk and CSV user imports and the HR lifecycle import
      carry it, and add it if not.
- [ ] No expiry date or helicopter booking link. It is a recorded number only.

## Audit log (built, migration 0045)

- [ ] Only records changes made through the application. Direct database changes are not seen.
- [ ] Only the main records show before and after values (people, job roles, locations, teams, business units, trainings, competence
      elements, notification settings, absences, staffing requirements). Everything else shows which fields were sent.
- [ ] Learner progress (SCORM and video position) is deliberately left out as noise. Failed attempts are not recorded.
- [ ] No archive or size limit. The table grows for ever. Decide a retention period for the log itself.
- [ ] Impersonated actions: the log records both the real person and who they acted as, but the business records themselves
      (assessments, bookings) are still attributed to the person being impersonated.
- [ ] When someone's details are removed, their name is taken out of the audit entries about them. That is the one exception to "append only".

## Found while checking the system, not yet fixed

- [ ] **Email notification settings do not save properly.** The form sends type, target roles, subject and body, but the table expects
      different field names, so recipients and templates are ignored. Rebuild (planned).
- [ ] The scheduler never runs the notification service, and not every email is logged. Rebuild together with the above (planned).
- [ ] Training permissions: the screen offers a `training_administrator` role that the server does not honour. Replace the hard-coded
      role checks with a permission matrix (view, create, edit, delete, approve per user type) (planned).
- [ ] Course booking and e-learning completion are fixed, but a wider review of the training routes' permission rules is still worth doing.
- [ ] Deleting a user is only a soft delete (hidden). It never removes anything. Retention now covers leavers, not "deleted" people.

## Planned features not built yet

- [ ] E-learning certificates on completion, with an automatic or manual switch and a "pending" state.
- [ ] SCORM / e-learning version tracking, for audit.
- [ ] Communications and announcements to everyone, business units or job roles.
- [ ] Support or helpdesk tickets.
- [ ] Notification rules, templates, frequency and recipients, with a log of every email and resend (see above).
- [ ] Training permission matrix (see above).
- [ ] Allocating e-learning to licensed business units, then all, job role or individual. Needs the multi-company design decision first:
      today there is one organisation per deployment and business units are labels only.

## Performance reviews and Talent Score (built earlier, migrations 0042 and 0043)

- [ ] Not built: AI extraction of experience and qualifications from an uploaded CV, 9-box talent grid, score and potential on succession
      plans, behaviour gap in role transition, objective cascade screen, entitlement gating by licence level (Gold).
- [ ] DPIA before real data (see top).

## Housekeeping and technical debt

- [ ] The type-check has 75 pre-existing errors (for example `DbStorage` not matching `IStorage`, missing methods on `IStorage`, `user` possibly
      undefined in the sidebar). Keep it at 75 or below; reducing it would make future checks more useful.
- [ ] The clean demo Repl is updated by unzipping a rebuilt zip. It has no git history, so a normal merge cannot work there. After any
      update, restart the server from the Shell with `nohup npm run dev` (the Run button uses Replit's own empty database).
- [ ] Landing page rebuild is uncommitted on this PC (client/index.html, Landing.tsx, landing.css) and goes into the demo zip from the
      working copy. Commit it on its own branch when agreed.
- [ ] Several internal documents and the clean-demo zips sit untracked in the project folder. Decide where they should live.

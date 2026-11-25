// Helper for visitors.e2e.cjs. With a number, runs the daily removal of visitor forms' personal details as it would run that many days from now.
// With "scrub <person id>", does what removing a person's details altogether does to their visitor forms.
// It changes data: only ever point DATABASE_URL at the demo or a throwaway database.
import { runVisitorPrivacyPurge, scrubVisitsFor } from "../../server/services/visitorForms";

const [first, second] = process.argv.slice(2);
(first === "scrub" ? scrubVisitsFor(second).then(() => ({ scrubbed: second })) : runVisitorPrivacyPurge(new Date(Date.now() + Number(first ?? 0) * 86400_000)))
  .then(r => { console.log(JSON.stringify(r)); process.exit(0); })
  .catch(e => { console.error(e); process.exit(1); });

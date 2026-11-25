// Helper for evaluations.e2e.cjs. Runs the reminder job as it would run some days from now, with a pretend mail sender, and says what it would
// have sent. No email leaves the machine. It changes data: only ever point DATABASE_URL at the demo or a throwaway database.
//   <days>              reminders as of that many days ahead
//   <days> fail         the same, with every email failing to send
//   <days> off          the same, with email not set up
//   close <days>        close whatever is past its date as of that many days ahead
//   scrub <person id>   what removing a person's details does to their course feedback
import { emailService } from "../../server/services/emailService";
import { sendReminders, closeOverdue, scrubEvaluationsFor } from "../../server/services/trainingEvaluations";

const [a, b] = process.argv.slice(2);
const sent: Array<{ to: string; subject: string; html: string }> = [];
const later = (days: string) => new Date(Date.now() + Number(days) * 86400_000);

async function main() {
  if (a === "scrub") { await scrubEvaluationsFor(b); return { scrubbed: b }; }
  if (a === "close") return { closed: await closeOverdue(later(b)) };
  (emailService as any).isConfigured = () => b !== "off";
  (emailService as any).sendEmail = async (m: any) => { if (b === "fail") throw new Error("pretend failure"); sent.push({ to: m.to, subject: m.subject, html: m.html }); };
  const result = await sendReminders(later(a));
  return { ...result, emails: sent };
}
main().then(r => { console.log("RESULT " + JSON.stringify(r)); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });

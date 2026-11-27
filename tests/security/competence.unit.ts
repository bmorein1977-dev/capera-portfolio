// The one rule for "is this person competent, and until when" (shared/competence.ts). No database needed.
import { addMonths, effectiveExpiry, governingRow, standingFor, statusFromExpiry, trainingExpiry, validityMonthsFor } from "../../shared/competence";

let passed = 0, failed = 0;
const check = (name: string, ok: boolean, detail?: unknown) => { if (ok) { passed++; console.log(`  PASS ${name}`); } else { failed++; console.log(`  FAIL ${name} ${detail !== undefined ? JSON.stringify(detail) : ""}`); } };
const now = new Date("2026-11-26T12:00:00Z");
const day = (n: number) => new Date(now.getTime() + n * 86_400_000);
const el = { validityMonths: 24 };
const row = (o: Record<string, unknown>) => ({ outcome: "competent", isAssignment: false, isActive: true, signOffAt: day(-100), assessmentDate: day(-100), expiryDate: null, createdAt: day(-200), updatedAt: day(-100), ...o }) as any;

check("months are added by calendar month, keeping to month ends", addMonths(new Date("2024-01-31T09:00:00Z"), 1).toISOString().startsWith("2024-02-29"));
check("the role's period wins over the standard's", validityMonthsFor({ validityMonths: 24, reassessmentYears: 5 }, { validityYears: 1 }) === 12);
check("with nothing set it is four years", validityMonthsFor({}) === 48);
check("a reassessment period of zero means it does not lapse", validityMonthsFor({ reassessmentYears: 0 }) === null);

const old = row({ signOffAt: day(-900), assessmentDate: day(-900) });
check("a signed record with no saved date still expires", standingFor([old], el, null, now).status === "expired", standingFor([old], el, null, now));
check("and says the date was worked out", standingFor([old], el, null, now).expiryCalculated === true);
check("a saved date is used as it is", effectiveExpiry(row({ expiryDate: day(45) }), el)!.getTime() === day(45).getTime());
check("the moment it expires it is expired", statusFromExpiry(now, now) === "expired");
check("expiry bands", statusFromExpiry(day(10), now) === "expiring_30" && statusFromExpiry(day(45), now) === "expiring_60" && statusFromExpiry(day(80), now) === "expiring_90" && statusFromExpiry(day(200), now) === "current");
check("competent with minor needs counts as competent", standingFor([row({ outcome: "competent_with_minor_needs" })], el, null, now).status === "current");
check("not yet competent does not", standingFor([row({ outcome: "not_yet_competent" })], el, null, now).status === "missing");

const planned = row({ outcome: "not_yet_competent", isAssignment: true, signOffAt: null, assessmentDate: day(-1), createdAt: day(-1), updatedAt: day(-1) });
check("a planned reassessment does not hide competence that is still valid", standingFor([row({}), planned], el, null, now).status === "current");
check("an assignment with no decision is missing", standingFor([planned], el, null, now).status === "missing");

const later = row({ outcome: "not_yet_competent", signOffAt: day(-5), assessmentDate: day(-5), createdAt: day(-10), updatedAt: day(-5) });
check("a later 'not yet competent' replaces an earlier pass", standingFor([row({}), later], el, null, now).status === "missing");
const renewed = row({ signOffAt: day(-2), assessmentDate: day(-2), createdAt: day(-3), updatedAt: day(-2), expiryDate: day(700) });
check("the latest decision gives the date", governingRow([old, renewed], now) === renewed);
check("the order the rows were last touched does not matter", governingRow([{ ...old, updatedAt: day(-1) }, renewed], now) === renewed);
check("an old imported record with no sign-off date still expires", standingFor([row({ signOffAt: null, assessmentDate: day(-900), createdAt: day(-3) })], el, null, now).status === "expired");

const exempt = row({ outcome: "not_required", signOffAt: null, updatedAt: day(-1), exemptionUntil: day(30) });
check("a current exemption wins", standingFor([row({}), exempt], el, null, now).exempt === true);
check("a lapsed exemption does not", standingFor([row({}), { ...exempt, exemptionUntil: day(-1) }], el, null, now).status === "current");
check("a removed row is ignored", standingFor([row({ isActive: false })], el, null, now).status === "missing");

check("training with no saved date runs out after the course's validity", trainingExpiry({ achievementDate: day(-800) }, { validityPeriod: 24 })!.getTime() < now.getTime());
check("training for a course with no validity period does not run out", trainingExpiry({ achievementDate: day(-800) }, { validityPeriod: null }) === null);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

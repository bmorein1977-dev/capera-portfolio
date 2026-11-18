import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { CaperaCrest } from "@/components/icons/CaperaCrest";
import "./landing.css";

// Public landing page, shown to anyone who is not signed in. Bronze, Silver and Gold are the three
// offers; every level includes the one before. Styles are scoped to .cl in landing.css.

type Theme = "light" | "dark";
const THEME_KEY = "capera-landing-theme";

// Optional: set VITE_DEMO_REQUEST_EMAIL to turn the demo form into a pre-filled email to that address.
// With nothing set, the form is replaced by a sign-in prompt, so the page never pretends to send anything.
const DEMO_EMAIL = (import.meta.env.VITE_DEMO_REQUEST_EMAIL as string | undefined)?.trim();

const CHAIN = [
  { tab: "Standard", title: "Define the standard", text: "Knowledge and performance criteria with a criticality rating, and a review cycle with a named owner, approver and reviewer." },
  { tab: "Assess", title: "Assess and sign off", text: "Assessments are scheduled, observed and signed off against each criterion, with the outcome and expiry date recorded." },
  { tab: "Verify", title: "Verify the assessors", text: "Internal verifiers sample assessments against a target and complete a 17-point record. Development needs go back to the assessor." },
  { tab: "Comply", title: "See compliance", text: "Role matrices and expiry alerts show who is current, expiring or overdue, with process-safety KPIs built from the same records." },
  { tab: "Plan", title: "Plan the workforce", text: "Search by competence, training and experience, see readiness for the next role, and keep succession plans live." },
];

type TierName = "Bronze" | "Silver" | "Gold";
const TIER_ORDER: TierName[] = ["Bronze", "Silver", "Gold"];

// [area, feature, first level that includes it: 0 Bronze, 1 Silver, 2 Gold]
const FEATURES: Array<[string, string, number]> = [
  ["Foundations", "Competence standards with knowledge and performance criteria", 0],
  ["Foundations", "Role requirements matrix (mandatory, role-specific, optional)", 0],
  ["Foundations", "Assessment scheduling, sign-off and outcomes", 0],
  ["Foundations", "Training records, certificates and expiry alerts", 0],
  ["Foundations", "Role dashboards and standard reports", 0],
  ["Foundations", "User, role and access administration", 0],
  ["Assurance", "Internal verification with sampling plans and the 17-point record", 1],
  ["Assurance", "Standards review cycles with 90, 60 and 30 day alerts", 1],
  ["Assurance", "Compliance explorer and process-safety KPI reporting", 1],
  ["Learning", "SCORM e-learning hosting and progress tracking", 1],
  ["Learning", "Onboarding and induction programmes", 1],
  ["Learning", "HR feed for leavers, movers and starters", 1],
  ["Workforce", "Talent Catalogue and skills inventory", 2],
  ["Workforce", "Workforce initiatives, succession plans and role transitions", 2],
  ["Workforce", "Annual performance reviews with 360 feedback", 2],
  ["Workforce", "Talent Score for HR, built from competence, training, experience and reviews", 2],
  ["AI and language", "AI-assisted standards authoring (SME wizard)", 2],
  ["AI and language", "AI standard-update suggestions and evidence review", 2],
  ["AI and language", "Standards translation into other languages", 2],
  ["Service", "Premium support and planned upgrade windows", 2],
];

const Icon = ({ children }: { children: ReactNode }) => (
  <div className="ic"><svg viewBox="0 0 24 24" aria-hidden="true">{children}</svg></div>
);

const prefersReducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function goTo(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
}

export default function Landing() {
  const [theme, setTheme] = useState<Theme | null>(() => {
    try { const t = localStorage.getItem(THEME_KEY); return t === "light" || t === "dark" ? t : null; } catch { return null; }
  });
  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(true);
  const [area, setArea] = useState("All");
  const [interest, setInterest] = useState<string>("Not sure yet");
  const [form, setForm] = useState({ name: "", email: "", org: "", msg: "" });

  const signIn = () => { window.location.href = "/api/login"; };

  const toggleTheme = () => {
    const current: Theme = theme ?? (window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark");
    const next: Theme = current === "dark" ? "light" : "dark";
    setTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* private window: the choice just is not remembered */ }
  };

  // the competence chain cycles until the visitor takes over
  useEffect(() => {
    if (!auto || prefersReducedMotion()) return;
    const t = setInterval(() => setStep(s => (s + 1) % CHAIN.length), 4200);
    return () => clearInterval(t);
  }, [auto]);

  const areas = useMemo(() => ["All", ...Array.from(new Set(FEATURES.map(f => f[0])))], []);
  const rows = FEATURES.filter(f => area === "All" || f[0] === area);

  const chooseTier = (t: TierName) => { setInterest(t); goTo("demo"); };

  const submitDemo = (e: FormEvent) => {
    e.preventDefault();
    if (!DEMO_EMAIL) return;
    const body = `Name: ${form.name}\nOrganisation: ${form.org}\nWork email: ${form.email}\nLevel of interest: ${interest}\n\n${form.msg}`;
    window.location.href = `mailto:${DEMO_EMAIL}?subject=${encodeURIComponent("Capera demo request")}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="cl" data-theme={theme ?? undefined} data-testid="page-landing">
      <header className="nav">
        <div className="wrap">
          <a className="brand" href="#top" aria-label="Capera home" onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" }); }}>
            <CaperaCrest className="h-7 w-auto" data-testid="img-capera-logo" />
            Capera
          </a>
          <nav className="nav-links" aria-label="Sections">
            {[["platform", "Platform"], ["tiers", "Bronze, Silver, Gold"], ["compare", "Compare"], ["groups", "For groups"]].map(([id, label]) => (
              <a key={id} href={`#${id}`} onClick={e => { e.preventDefault(); goTo(id); }}>{label}</a>
            ))}
          </nav>
          <div className="nav-end">
            <button className="icon-btn" type="button" onClick={toggleTheme} aria-label="Switch between light and dark theme" data-testid="button-landing-theme">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
            </button>
            <button className="btn ghost sm" type="button" onClick={signIn} data-testid="button-login">Sign in</button>
            <button className="btn primary sm" type="button" onClick={() => goTo("demo")} data-testid="button-nav-demo">Request a demo</button>
          </div>
        </div>
      </header>

      <main id="top">
        {/* HERO */}
        <div className="hero">
          <div className="wrap">
            <div>
              <div className="eyebrow mono"><i />Competence assurance for safety-critical teams</div>
              <h1>Competence you can prove, <em>and plan around.</em></h1>
              <p className="lead">Capera connects onboarding, training, competence standards, assessment, internal verification, performance reviews and workforce planning in one platform. You always know who is competent to do what, who is due for reassessment, and who is ready for the next role.</p>
              <div className="cta-row">
                <button className="btn primary" type="button" onClick={() => goTo("demo")} data-testid="button-get-started">Request a demo</button>
                <button className="btn ghost" type="button" onClick={() => goTo("tiers")}>Compare Bronze, Silver and Gold</button>
              </div>
              <div className="chips" aria-label="What Capera covers">
                {["Assessment and sign-off", "Internal verification", "Expiry and reassessment", "Succession and talent search"].map(c => <span key={c} className="chip">{c}</span>)}
              </div>
            </div>

            <div className="panel" aria-label="Example of the competence chain" onMouseEnter={() => setAuto(false)} onFocus={() => setAuto(false)}>
              <div className="panel-head"><span className="mono">Example data</span><span className="title">Control Room Operator, Northfield Terminal</span></div>
              <div className="stepper" role="tablist" aria-label="Competence chain steps">
                {CHAIN.map((c, i) => (
                  <button key={c.tab} role="tab" type="button" aria-selected={step === i} onClick={() => { setAuto(false); setStep(i); }} data-testid={`tab-chain-${i}`}>
                    <b>{String(i + 1).padStart(2, "0")}</b>{c.tab}
                  </button>
                ))}
              </div>
              <div className="blocks">
                <div className={`block${step === 0 ? " on" : ""}`}><h4>Standard</h4>
                  <p><strong>Process Isolation and Lock-Out</strong>, high criticality, review due in 12 days</p>
                  <div className="k-chips">{["K 1.1", "K 1.2", "K 1.3", "P 2.1", "P 2.2", "P 2.3"].map(k => <span key={k}>{k}</span>)}</div></div>
                <div className={`block${step === 1 ? " on" : ""}`}><h4>Assessment</h4>
                  <p><strong>Aisha Dhillon</strong> signed off as competent, valid for 36 months</p></div>
                <div className={`block${step === 2 ? " on" : ""}`}><h4>Verification</h4>
                  <p>Sampled by an internal verifier against a 15% target</p>
                  <div className="bar good"><i style={{ width: "100%" }} /></div></div>
                <div className={`block${step === 3 ? " on" : ""}`}><h4>Compliance</h4>
                  <div className="row2">
                    <div><p>Training current</p><div className="bar"><i style={{ width: "86%" }} /></div></div>
                    <div><p>Competence current</p><div className="bar"><i style={{ width: "78%" }} /></div></div>
                  </div></div>
                <div className={`block${step === 4 ? " on" : ""}`}><h4>Readiness</h4>
                  <p><strong>Shift Team Leader</strong>, 3 of 4 required standards met</p>
                  <div className="dots"><i /><i /><i /><i className="w" /></div></div>
              </div>
              <p className="caption" aria-live="polite"><strong>{CHAIN[step].title}. </strong>{CHAIN[step].text}</p>
            </div>
          </div>
        </div>

        {/* PLATFORM */}
        <section className="s alt" id="platform">
          <div className="wrap">
            <div className="s-head">
              <span className="mono">The platform</span>
              <h2>One record from the standard to the succession plan</h2>
              <p>Most tools hold a piece of this. Capera keeps every step on the same data, so an assessment result flows straight into compliance reporting and into planning.</p>
            </div>
            <div className="cards">
              <article className="card"><Icon><path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z" /><path d="M9 12l2 2 4-4" /></Icon>
                <span className="from bronze">From Bronze</span><h3>Standards that mean something</h3>
                <p>Write each standard as knowledge and performance criteria with a criticality rating, then attach it to the roles that need it.</p></article>
              <article className="card"><Icon><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4h6v3H9z" /><path d="M9 14l2 2 4-4" /></Icon>
                <span className="from bronze">From Bronze</span><h3>Assessment and sign-off</h3>
                <p>Schedule assessments, record outcomes against each criterion, set expiry dates and handle reassessment and time-limited exemptions.</p></article>
              <article className="card"><Icon><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></Icon>
                <span className="from silver">From Silver</span><h3>Check the assessors too</h3>
                <p>Internal verifiers sample assessors against a target, complete a 17-point record and feed development needs back to the assessor.</p></article>
              <article className="card"><Icon><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></Icon>
                <span className="from bronze">From Bronze</span><h3>Compliance you can show</h3>
                <p>See who is current, expiring or overdue by site, role and team. Silver adds process-safety KPI reporting built from the same records.</p></article>
              <article className="card"><Icon><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.5 3.2-5.5 6.5-5.5s5.9 2 6.5 5.5" /><circle cx="17.5" cy="9" r="2.5" /><path d="M17 14.5c2.4.2 4.2 1.8 4.7 4.5" /></Icon>
                <span className="from gold">From Gold</span><h3>Plan from assessed competence</h3>
                <p>Search the workforce by competence, training, skills and experience. Run annual reviews with 360 feedback, see readiness for the next role and manage succession.</p></article>
              <article className="card"><Icon><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5" /></Icon>
                <span className="from gold">From Gold</span><h3>AI-assisted standards</h3>
                <p>Draft knowledge questions and practical scenarios from your own procedures. A person reviews and approves before anything is published.</p></article>
            </div>
          </div>
        </section>

        {/* TIERS */}
        <section className="s" id="tiers">
          <div className="wrap">
            <div className="s-head">
              <span className="mono">Three levels</span>
              <h2>Start where you are. Add what you need.</h2>
              <p>Every level includes everything in the one before it. Move up as your assurance and planning needs grow.</p>
            </div>
            <div className="tiers">
              <article className="tier bronze">
                <div className="medal"><span className="coin">B</span><h3><small>Core</small>Bronze</h3></div>
                <p className="tag">The foundation for competence you can evidence.</p>
                <p className="for">For one site or team replacing spreadsheets.</p>
                <p className="incl">What is included</p>
                <ul>
                  <li>Competence standards with knowledge and performance criteria</li>
                  <li>Role requirements matrix: mandatory, role-specific and optional</li>
                  <li>Assessment scheduling, sign-off and outcomes</li>
                  <li>Training records, certificates and expiry alerts</li>
                  <li>Role dashboards and standard reports</li>
                  <li>User, role and access administration</li>
                </ul>
                <button className="btn ghost" type="button" onClick={() => chooseTier("Bronze")} data-testid="button-tier-bronze">Talk to us about Bronze</button>
              </article>
              <article className="tier silver">
                <div className="medal"><span className="coin">S</span><h3><small>Assure</small>Silver</h3></div>
                <p className="tag">Assurance you can show an auditor.</p>
                <p className="for">For regulated sites that must evidence assessor quality and keep standards current.</p>
                <p className="incl">Everything in Bronze, plus</p>
                <ul>
                  <li>Internal verification: sampling plans and the 17-point record</li>
                  <li>Standards review cycles with 90, 60 and 30 day alerts</li>
                  <li>Compliance explorer and process-safety KPI reporting</li>
                  <li>SCORM e-learning hosting and progress tracking</li>
                  <li>Onboarding and induction programmes</li>
                  <li>HR feed for leavers, movers and starters</li>
                </ul>
                <button className="btn primary" type="button" onClick={() => chooseTier("Silver")} data-testid="button-tier-silver">Talk to us about Silver</button>
              </article>
              <article className="tier gold">
                <div className="medal"><span className="coin">G</span><h3><small>Strategic</small>Gold</h3></div>
                <p className="tag">Plan the workforce from assessed competence.</p>
                <p className="for">For groups planning succession, growth and cross-site resourcing.</p>
                <p className="incl">Everything in Silver, plus</p>
                <ul>
                  <li>Talent Catalogue and skills inventory</li>
                  <li>Workforce planning: initiatives, succession plans and role transitions</li>
                  <li>Annual performance reviews with 360 feedback, and an HR-only Talent Score</li>
                  <li>AI-assisted standards authoring (SME wizard)</li>
                  <li>AI standard-update suggestions and evidence review</li>
                  <li>Standards translation, premium support and planned upgrade windows</li>
                </ul>
                <button className="btn ghost" type="button" onClick={() => chooseTier("Gold")} data-testid="button-tier-gold">Talk to us about Gold</button>
              </article>
            </div>
          </div>
        </section>

        {/* COMPARE */}
        <section className="s alt" id="compare">
          <div className="wrap">
            <div className="s-head">
              <span className="mono">Compare</span>
              <h2>Every feature, level by level</h2>
            </div>
            <div className="filters" role="group" aria-label="Filter features by area">
              {areas.map(a => (
                <button key={a} type="button" aria-pressed={area === a} onClick={() => setArea(a)} data-testid={`filter-${a.toLowerCase().replace(/\s+/g, "-")}`}>{a}</button>
              ))}
            </div>
            <div className="matrix-wrap">
              <table className="matrix" data-testid="table-compare">
                <thead><tr><th scope="col">Feature</th><th scope="col" className="bronze">Bronze</th><th scope="col" className="silver">Silver</th><th scope="col" className="gold">Gold</th></tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <FragmentRow key={r[1]} showArea={i === 0 || rows[i - 1][0] !== r[0]} row={r} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* GROUPS */}
        <section className="s" id="groups">
          <div className="wrap split">
            <div className="s-head" style={{ marginBottom: 0 }}>
              <span className="mono">For groups</span>
              <h2>Licensed for the way groups work</h2>
              <p>Start with one site or business unit, prove the value, then bring in the rest of the group under a single agreement.</p>
            </div>
            <ol className="steps3">
              <li><span className="n">1</span><div><strong>Start with one unit</strong><span>We import your existing training matrices and standards, so the first unit is live quickly.</span></div></li>
              <li><span className="n">2</span><div><strong>Add units as you grow</strong><span>Each business unit takes the level that suits it, under one group agreement.</span></div></li>
              <li><span className="n">3</span><div><strong>Keep each unit's records separate</strong><span>Every unit runs with its own people, standards and history.</span></div></li>
            </ol>
          </div>
        </section>

        {/* DEMO */}
        <section className="s alt" id="demo">
          <div className="wrap">
            <div className="form-card">
              <div className="side">
                <span className="mono">See it running</span>
                <h2>Request a demo</h2>
                <p>We will walk you through the competence chain using your own roles and standards as the example, and talk through which level fits.</p>
              </div>
              {DEMO_EMAIL ? (
                <form onSubmit={submitDemo} data-testid="form-demo">
                  <div className="f2">
                    <div className="field"><label htmlFor="fName">Name</label><input id="fName" type="text" autoComplete="name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                    <div className="field"><label htmlFor="fEmail">Work email</label><input id="fEmail" type="email" autoComplete="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                  </div>
                  <div className="f2">
                    <div className="field"><label htmlFor="fOrg">Organisation</label><input id="fOrg" type="text" autoComplete="organization" value={form.org} onChange={e => setForm({ ...form, org: e.target.value })} /></div>
                    <div className="field"><label htmlFor="fTier">Level of interest</label>
                      <select id="fTier" value={interest} onChange={e => setInterest(e.target.value)}>
                        {["Not sure yet", ...TIER_ORDER].map(o => <option key={o}>{o}</option>)}
                      </select></div>
                  </div>
                  <div className="field"><label htmlFor="fMsg">What would you like to see?</label><textarea id="fMsg" value={form.msg} onChange={e => setForm({ ...form, msg: e.target.value })} /></div>
                  <div><button className="btn primary" type="submit" data-testid="button-submit-demo">Request a demo</button></div>
                  <p className="note">This opens an email to our team, pre-filled with what you entered.</p>
                </form>
              ) : (
                <div style={{ display: "grid", gap: 14, alignContent: "center" }}>
                  <p className="note">Already have access? Sign in to see Capera running.</p>
                  <div><button className="btn primary" type="button" onClick={signIn} data-testid="button-demo-signin">Sign in</button></div>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap">
          <span className="brand" style={{ fontSize: 16 }}><CaperaCrest className="h-5 w-auto" />Capera</span>
          <span>Competence assurance and workforce planning</span>
          <span>© {new Date().getFullYear()} Capera</span>
          <a href="#top" onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" }); }}>Back to top</a>
        </div>
      </footer>
    </div>
  );
}

// one feature row, preceded by an area heading row when the area changes
function FragmentRow({ row, showArea }: { row: [string, string, number]; showArea: boolean }) {
  return (
    <>
      {showArea && <tr className="grp"><td colSpan={4}>{row[0]}</td></tr>}
      <tr>
        <td>{row[1]}</td>
        {TIER_ORDER.map((t, i) => (
          <td key={t}>{i >= row[2] ? <span className="yes" role="img" aria-label="Included" /> : <span className="no" aria-label="Not included">–</span>}</td>
        ))}
      </tr>
    </>
  );
}

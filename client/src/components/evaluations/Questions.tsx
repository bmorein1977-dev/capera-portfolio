// The questions of an evaluation form. Every choice is a real radio button or tick box, so it works with a keyboard and a screen reader; the button
// look is only styling.
import { Textarea } from "@/components/ui/textarea";
import { AGREE_LABELS, CONFIDENCE_LABELS, OVERALL_LABELS, NA, type Answers, type AnswerValue, type EvaluationForm, type Question } from "@shared/trainingEvaluation";

interface Choice { value: string | number; label: string }
const choicesFor = (q: Question): Choice[] => {
  if (q.kind === "rating") return [...AGREE_LABELS.map((label, i) => ({ value: i + 1, label })), { value: NA, label: "Does not apply" }];
  if (q.kind === "confidence") return CONFIDENCE_LABELS.map((label, i) => ({ value: i + 1, label }));
  if (q.kind === "stars") return OVERALL_LABELS.map((label, i) => ({ value: i + 1, label }));
  return q.options ?? [];
};

const CHIP = "flex min-h-9 cursor-pointer items-center rounded-md border px-3 py-1.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:disabled]:cursor-default";

function QuestionRow({ q, value, onChange, disabled, missing }: { q: Question; value: AnswerValue | undefined; onChange: (v: AnswerValue | undefined) => void; disabled: boolean; missing: boolean }) {
  const labelId = `q-${q.key}-label`;
  if (q.kind === "text") {
    return (
      <div className="space-y-1.5" id={`q-${q.key}`}>
        <label htmlFor={`input-${q.key}`} className="text-sm font-medium">{q.text}{!q.required && <span className="font-normal text-muted-foreground"> (optional)</span>}</label>
        <Textarea id={`input-${q.key}`} value={typeof value === "string" ? value : ""} maxLength={2000} disabled={disabled} rows={3} onChange={e => onChange(e.target.value || undefined)} aria-invalid={missing} data-testid={`input-${q.key}`} />
        {missing && <p className="text-sm text-destructive">Please answer this question.</p>}
      </div>
    );
  }
  const multi = q.kind === "multi";
  const picked = Array.isArray(value) ? value : [];
  const toggle = (v: string) => {
    if (picked.includes(v)) { const next = picked.filter(x => x !== v); return onChange(next.length ? next : undefined); }
    // "nothing is in the way" stands on its own
    return onChange(v === "none" ? ["none"] : [...picked.filter(x => x !== "none"), v]);
  };
  return (
    <div id={`q-${q.key}`} role={multi ? "group" : "radiogroup"} aria-labelledby={labelId} aria-invalid={missing} className={missing ? "space-y-2 rounded-md border border-destructive p-3" : "space-y-2"}>
      <p id={labelId} className="text-sm font-medium">{q.text}</p>
      {q.help && <p className="text-sm text-muted-foreground">{q.help}</p>}
      <div className="flex flex-wrap gap-2">
        {choicesFor(q).map(c => (
          <label key={String(c.value)} className={CHIP}>
            <input type={multi ? "checkbox" : "radio"} className="sr-only" name={`name-${q.key}`} disabled={disabled}
              checked={multi ? picked.includes(String(c.value)) : value === c.value} onChange={() => (multi ? toggle(String(c.value)) : onChange(c.value))} data-testid={`choice-${q.key}-${c.value}`} />
            {c.label}
          </label>
        ))}
      </div>
      {missing && <p className="text-sm text-destructive">Please answer this question.</p>}
    </div>
  );
}

export function Questions({ form, answers, onChange, disabled, missing }: { form: EvaluationForm; answers: Answers; onChange: (next: Answers) => void; disabled: boolean; missing: string[] }) {
  const set = (key: string, v: AnswerValue | undefined) => {
    const next = { ...answers };
    if (v === undefined) delete next[key]; else next[key] = v;
    onChange(next);
  };
  return (
    <div className="space-y-6">
      {form.sections.map(section => (
        <section key={section.key} className="space-y-4 rounded-lg border bg-card p-4 sm:p-5" aria-labelledby={`sec-${section.key}`}>
          <h2 id={`sec-${section.key}`} className="text-lg font-semibold">{section.title}</h2>
          {section.questions.filter(q => !q.onlyIf || answers[q.onlyIf.key] === q.onlyIf.value).map(q => (
            <QuestionRow key={q.key} q={q} value={answers[q.key]} onChange={v => set(q.key, v)} disabled={disabled} missing={missing.includes(q.key)} />
          ))}
        </section>
      ))}
    </div>
  );
}

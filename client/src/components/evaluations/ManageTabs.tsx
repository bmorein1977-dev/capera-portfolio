// For whoever manages evaluations: who has not replied, safety concerns to follow up, and the settings and forms.
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  FORM_TYPES, FORM_TYPE_LABEL, SECTION_KEYS, SECTION_TITLE, MAX_STATEMENTS, privacyStatement,
  type EvaluationSettings, type FormType, type SectionKey, type SectionStatements,
} from "@shared/trainingEvaluation";
import { dayText, problem, refreshEvaluations } from "./shared";

// ------------------------------------------------------------------------------------------------------------ waiting for replies
interface Line { id: string; person: string; course: string; stage: string; completedOn: string; dueOn: string; invitedAt: string | null; reminders: number; lastReminderAt: string | null; reason: string | null }

export function AwaitingTab() {
  const { toast } = useToast();
  const { data, isLoading, error } = useQuery<{ awaiting: Line[]; notAttended: Line[] }>({ queryKey: ["/api/training-evaluations/awaiting"], staleTime: 0 });
  const [withdraw, setWithdraw] = useState<Line | null>(null);
  const [reason, setReason] = useState("");
  const remind = useMutation({
    mutationFn: async (ids?: string[]) => (await apiRequest("POST", "/api/training-evaluations/remind", ids ? { ids } : {})).json() as Promise<{ message: string; people: number }>,
    onSuccess: r => { refreshEvaluations(); toast({ title: r.people ? "Reminders sent" : "Nothing sent", description: r.message }); },
    onError: e => toast({ title: "Could not send reminders", description: problem(e).message, variant: "destructive" }),
  });
  const remove = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/training-evaluations/${withdraw!.id}/withdraw`, { reason }),
    onSuccess: () => { setWithdraw(null); setReason(""); refreshEvaluations(); toast({ title: "Request withdrawn" }); },
    onError: e => toast({ title: "Could not withdraw it", description: problem(e).message, variant: "destructive" }),
  });
  const rows = (list: Line[], declined: boolean) => (
    <div className="divide-y">
      {list.map(l => (
        <div key={l.id} className="flex flex-wrap items-center gap-3 py-3" data-testid={`row-awaiting-${l.id}`}>
          <div className="min-w-0 flex-1">
            <div className="font-medium">{l.person}<span className="font-normal text-muted-foreground">, {l.course}</span></div>
            <div className="text-sm text-muted-foreground">
              {l.stage}. Attended {dayText(l.completedOn)}.{declined ? ` Says they did not attend: ${l.reason}` : ` Due ${dayText(l.dueOn)}. ${l.reminders ? `${l.reminders} reminder${l.reminders === 1 ? "" : "s"} sent, last on ${dayText(l.lastReminderAt)}` : "No reminder sent yet"}.`}
            </div>
          </div>
          {!declined && <Button size="sm" variant="outline" disabled={remind.isPending} onClick={() => remind.mutate([l.id])} data-testid={`button-remind-${l.id}`}>Remind</Button>}
          <Button size="sm" variant="ghost" onClick={() => setWithdraw(l)} data-testid={`button-withdraw-${l.id}`}>{declined ? "Close" : "Withdraw"}</Button>
        </div>
      ))}
    </div>
  );
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex-col items-start gap-3 space-y-0 sm:flex-row sm:justify-between">
          <div><CardTitle className="text-base">Waiting for a reply</CardTitle><CardDescription>Reminders also go out by themselves, as set under Settings. This list shows who has not replied, never what anyone said.</CardDescription></div>
          <Button size="sm" disabled={!data?.awaiting.length || remind.isPending} onClick={() => remind.mutate(undefined)} data-testid="button-remind-all">Remind everyone</Button>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="py-4 text-sm text-muted-foreground">Loading...</p>}
          {error && <p className="py-4 text-sm text-destructive">{problem(error).message}</p>}
          {data && data.awaiting.length === 0 && <p className="py-4 text-sm text-muted-foreground">Nobody is waiting to reply.</p>}
          {data && rows(data.awaiting, false)}
        </CardContent>
      </Card>
      {!!data?.notAttended.length && <Card><CardHeader><CardTitle className="text-base">Said they did not attend</CardTitle><CardDescription>Check their training record, correct it if it is wrong, then close the entry.</CardDescription></CardHeader><CardContent>{rows(data.notAttended, true)}</CardContent></Card>}
      <Dialog open={!!withdraw} onOpenChange={o => { if (!o) { setWithdraw(null); setReason(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Withdraw this request?</DialogTitle><DialogDescription>{withdraw?.person}, {withdraw?.course}. They will not be asked again.</DialogDescription></DialogHeader>
          <div className="space-y-1.5"><Label htmlFor="wd-reason">Why</Label><Textarea id="wd-reason" value={reason} maxLength={500} onChange={e => setReason(e.target.value)} /></div>
          <DialogFooter><Button variant="outline" onClick={() => setWithdraw(null)}>Cancel</Button><Button disabled={reason.trim().length < 5 || remove.isPending} onClick={() => remove.mutate()}>Withdraw</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------------------ safety concerns
interface Concern { id: string; course: string; stage: string; completedOn: string; raisedAt: string; person: string; concern: string; provider: string | null; instructor: string | null; venue: string | null; closedAt: string | null; closedBy: string | null; action: string | null }

function ConcernCard({ c }: { c: Concern }) {
  const { toast } = useToast();
  const [action, setAction] = useState("");
  const close = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/training-evaluations/${c.id}/safety-close`, { action }),
    onSuccess: () => { refreshEvaluations(); toast({ title: "Recorded" }); },
    onError: e => toast({ title: "Could not record it", description: problem(e).message, variant: "destructive" }),
  });
  return (
    <Card data-testid={`concern-${c.id}`}>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2"><CardTitle className="text-base">{c.course}</CardTitle><Badge variant={c.closedAt ? "outline" : "destructive"}>{c.closedAt ? "Dealt with" : "Open"}</Badge></div>
        <CardDescription>Raised by {c.person} on {dayText(c.raisedAt)} ({c.stage.toLowerCase()}, attended {dayText(c.completedOn)}){[c.provider, c.venue, c.instructor ? `instructor ${c.instructor}` : null].filter(Boolean).length ? `. ${[c.provider, c.venue, c.instructor ? `instructor ${c.instructor}` : null].filter(Boolean).join(", ")}` : ""}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="whitespace-pre-wrap text-sm">{c.concern}</p>
        {c.closedAt ? <p className="rounded-md bg-muted p-3 text-sm">{c.action}<span className="mt-1 block text-xs text-muted-foreground">{c.closedBy ?? "Someone"}, {dayText(c.closedAt)}</span></p> : (
          <div className="space-y-2">
            <Label htmlFor={`act-${c.id}`}>What was done about it</Label>
            <Textarea id={`act-${c.id}`} value={action} maxLength={1000} onChange={e => setAction(e.target.value)} data-testid={`input-safety-action-${c.id}`} />
            <Button size="sm" disabled={action.trim().length < 10 || close.isPending} onClick={() => close.mutate()} data-testid={`button-close-concern-${c.id}`}>Mark as dealt with</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SafetyTab() {
  const { data, isLoading, error } = useQuery<Concern[]>({ queryKey: ["/api/training-evaluations/safety"], staleTime: 0 });
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Raised by people in their course feedback. Each is shown with the person's name, which the form tells them will happen.</p>
      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {error && <p className="text-sm text-destructive">{problem(error).message}</p>}
      {data && data.length === 0 && <p className="text-sm text-muted-foreground">No safety concerns have been raised.</p>}
      {data?.map(c => <ConcernCard key={c.id} c={c} />)}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------------------ settings and forms
interface SettingsData { settings: EvaluationSettings; defaults: Record<FormType, SectionStatements>; courses: Array<{ id: string; name: string; worksOutAs: FormType }> }

const toText = (s: SectionStatements) => Object.fromEntries(SECTION_KEYS.map(k => [k, s[k].map(x => x.text).join("\n")])) as Record<SectionKey, string>;
/** a line that has not changed keeps its reference; a new or reworded line gets a new one */
function toStatements(text: Record<SectionKey, string>, before: SectionStatements): SectionStatements {
  return Object.fromEntries(SECTION_KEYS.map(k => [k, text[k].split("\n").map(l => l.trim()).filter(Boolean).map(line => before[k].find(x => x.text === line) ?? { key: `x-${Math.random().toString(36).slice(2, 10)}`, text: line })])) as SectionStatements;
}

function NumberField({ id, label, help, value, min, max, onChange }: { id: string; label: string; help: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label><Input id={id} type="number" min={min} max={max} value={Number.isNaN(value) ? "" : value} onChange={e => onChange(e.target.value === "" ? NaN : Number(e.target.value))} data-testid={`input-${id}`} /><p className="text-xs text-muted-foreground">{help}</p></div>
  );
}

export function SettingsTab() {
  const { toast } = useToast();
  const { data, error } = useQuery<SettingsData>({ queryKey: ["/api/training-evaluations/settings"], staleTime: 0 });
  const [form, setForm] = useState<EvaluationSettings | null>(null);
  const [type, setType] = useState<FormType>("practical");
  const [text, setText] = useState<Record<FormType, Record<SectionKey, string>> | null>(null);
  const [find, setFind] = useState("");
  const load = (s: EvaluationSettings) => { setForm(s); setText(Object.fromEntries(FORM_TYPES.map(t => [t, toText(s.statements[t])])) as Record<FormType, Record<SectionKey, string>>); };
  useEffect(() => { if (data && !form) load(data.settings); }, [data, form]);
  const save = useMutation({
    mutationFn: async () => {
      const statements = Object.fromEntries(FORM_TYPES.map(t => [t, toStatements(text![t], form!.statements[t])]));
      return (await apiRequest("PUT", "/api/training-evaluations/settings", { ...form, statements })).json() as Promise<{ settings: EvaluationSettings }>;
    },
    onSuccess: r => { load(r.settings); refreshEvaluations(); toast({ title: "Settings saved" }); },
    onError: e => toast({ title: "Could not save", description: problem(e).message, variant: "destructive" }),
  });
  if (error) return <p className="text-sm text-destructive">{problem(error).message}</p>;
  if (!data || !form || !text) return <p className="text-sm text-muted-foreground">Loading...</p>;
  const set = <K extends keyof EvaluationSettings>(k: K, v: EvaluationSettings[K]) => setForm({ ...form, [k]: v });
  const tooMany = SECTION_KEYS.some(k => text[type][k].split("\n").filter(l => l.trim()).length > MAX_STATEMENTS);
  const matching = data.courses.filter(c => (find.trim() ? c.name.toLowerCase().includes(find.trim().toLowerCase()) : form.courseForms[c.id] !== undefined));
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader><CardTitle className="text-base">When people are asked</CardTitle><CardDescription>A request is made when a course booking is marked completed, e-learning is finished, or a completion is recorded against someone's training.</CardDescription></CardHeader>
        <CardContent className="space-y-5">
          <label className="flex items-center gap-3"><Switch checked={form.enabled} onCheckedChange={v => set("enabled", v)} data-testid="switch-evaluations-enabled" /><span className="text-sm font-medium">Ask for feedback after training</span></label>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5"><Label htmlFor="start-from">Ask about training from</Label><Input id="start-from" type="date" value={form.startFrom} onChange={e => set("startFrom", e.target.value)} /><p className="text-xs text-muted-foreground">Nothing completed before this day is asked about, and nothing older than the reply time.</p></div>
            <NumberField id="window-days" label="Days to reply" help="After this the request closes." value={form.windowDays} min={3} max={180} onChange={n => set("windowDays", n)} />
            <NumberField id="reminder-every" label="Remind every (days)" help="Counted from the invitation, then from the last reminder." value={form.reminderEveryDays} min={1} max={60} onChange={n => set("reminderEveryDays", n)} />
            <NumberField id="max-reminders" label="Most reminders" help="0 sends none. One email lists everything a person still owes." value={form.maxReminders} min={0} max={10} onChange={n => set("maxReminders", n)} />
            <NumberField id="follow-up-days" label="Follow-up after (days)" help="Asks whether it has been used at work. 0 switches it off. Changes apply to training recorded from now on." value={form.followUpDays} min={0} max={365} onChange={n => set("followUpDays", n)} />
          </div>
          <p className="text-xs text-muted-foreground">Reminder emails need email to be set up. The wording is under Email Notifications. Without email, people still see the request on their home screen.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Names</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-3"><Switch checked={form.showNames} onCheckedChange={v => set("showNames", v)} data-testid="switch-show-names" /><span className="text-sm font-medium">Show names with answers to people who manage evaluations</span></label>
          <p className="rounded-md bg-muted p-3 text-sm">People are told: "{privacyStatement(form.showNames)}"</p>
          <p className="text-xs text-muted-foreground">A change applies to replies sent from now on. A reply already sent keeps the promise made when it was sent.</p>
          <div className="max-w-xs"><NumberField id="min-group" label="Fewest replies to show without names" help="Results for a smaller group are held back. This lowers the chance of picking someone out; it cannot remove it." value={form.minGroup} min={1} max={20} onChange={n => set("minGroup", n)} /></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">The forms</CardTitle><CardDescription>The statements people agree or disagree with, one per line, up to {MAX_STATEMENTS} in each area. Questions about confidence, level, length, safety and the overall rating are on every form and cannot be removed, because the ratings use them. A reworded line is reported separately from the old one.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-sm space-y-1.5"><Label>Form</Label>
            <Select value={type} onValueChange={v => setType(v as FormType)}><SelectTrigger data-testid="select-form-type"><SelectValue /></SelectTrigger><SelectContent>{FORM_TYPES.map(t => <SelectItem key={t} value={t}>{FORM_TYPE_LABEL[t]}</SelectItem>)}</SelectContent></Select></div>
          {SECTION_KEYS.map(k => (
            <div key={k} className="space-y-1.5"><Label htmlFor={`st-${k}`}>{SECTION_TITLE[type][k]}</Label>
              <Textarea id={`st-${k}`} rows={Math.max(3, text[type][k].split("\n").length + 1)} value={text[type][k]} onChange={e => setText({ ...text, [type]: { ...text[type], [k]: e.target.value } })} data-testid={`input-statements-${k}`} /></div>
          ))}
          {tooMany && <p className="text-sm text-destructive">An area has more than {MAX_STATEMENTS} lines.</p>}
          <Button variant="outline" size="sm" onClick={() => setText({ ...text, [type]: toText(data.defaults[type]) })}>Put this form back to the standard wording</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Which form each course uses</CardTitle><CardDescription>Capera works this out from how the course is delivered. Search for a course to choose a different form, or to ask nothing about it. Courses you have changed are listed below.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Search courses" aria-label="Search courses" value={find} onChange={e => setFind(e.target.value)} data-testid="input-find-course" />
          {matching.length === 0 && <p className="text-sm text-muted-foreground">{find.trim() ? "No course matches." : "No course has been changed."}</p>}
          {matching.slice(0, 30).map(c => (
            <div key={c.id} className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1 text-sm">{c.name}</div>
              <Select value={form.courseForms[c.id] ?? "auto"} onValueChange={v => { const next = { ...form.courseForms }; if (v === "auto") delete next[c.id]; else next[c.id] = v as FormType | "none"; set("courseForms", next); }}>
                <SelectTrigger className="w-72" aria-label={`Form for ${c.name}`}><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="auto">Automatic ({FORM_TYPE_LABEL[c.worksOutAs]})</SelectItem>{FORM_TYPES.map(t => <SelectItem key={t} value={t}>{FORM_TYPE_LABEL[t]}</SelectItem>)}<SelectItem value="none">Do not ask about this course</SelectItem></SelectContent>
              </Select>
            </div>
          ))}
          {matching.length > 30 && <p className="text-xs text-muted-foreground">Showing the first 30. Type more of the name to narrow it down.</p>}
        </CardContent>
      </Card>
      <Button onClick={() => save.mutate()} disabled={save.isPending || tooMany} data-testid="button-save-evaluation-settings">Save settings</Button>
    </div>
  );
}

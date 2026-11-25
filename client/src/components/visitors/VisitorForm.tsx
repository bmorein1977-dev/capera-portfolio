import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Paperclip, Printer, Trash2 } from "lucide-react";
import {
  DECLARATIONS, SUPPORT_TYPES, CERTIFICATE_EXTENSIONS, MAX_CERTIFICATE_BYTES, stillNeeded, checklistNeeded, retentionSentence, submitBy, longDay,
  type ChecklistSection, type VisitDetails, type VisitPrivate, type VisitChecklist, type VisitorSettings, type ChecklistAnswer, type FileCategory,
} from "@shared/visitorForm";
import { VISIT_STATUS, dayText, problem, refreshContractorData } from "./shared";

interface VisitFile { id: string; category: FileCategory; title: string; fileName: string; sizeBytes: number; expiryDate: string | null; expiresBeforeVisitEnds: boolean }
interface Visit {
  id: string; reference: string; status: string; companyName: string; userId: string; visitorFirstName: string; visitorLastName: string;
  arrivalDate: string | null; days: number | null; details: VisitDetails; privateDetails: VisitPrivate | null; privateRemovedAt: string | null; keepPrivate: boolean; keepPrivateReason: string | null;
  checklist: VisitChecklist; late: boolean; lateReason: string | null; reviewNote: string | null; emailStatus: string | null; submittedAt: string | null;
  history: Array<{ at: string; what: string; note?: string }>; files: VisitFile[]; canEdit: boolean; canReview: boolean;
  wording: { checklist: ChecklistSection[]; checklistRule: VisitorSettings["checklistRule"]; privacyNotice: string; siteNotes: string; siteName: string; privateRetentionDays: number | null; declarations: typeof DECLARATIONS };
  timing: { noticeDays: number; lateRule: "flag" | "block"; submitBy: string | null; isLateNow: boolean; maxVisitDays: number };
}
interface Draft { visitorFirstName: string; visitorLastName: string; arrivalDate: string; days: string; details: VisitDetails; privateDetails: VisitPrivate; checklist: VisitChecklist }

const draftOf = (v: Visit): Draft => ({
  visitorFirstName: v.visitorFirstName, visitorLastName: v.visitorLastName, arrivalDate: v.arrivalDate ?? "", days: v.days ? String(v.days) : "",
  details: v.details ?? {}, privateDetails: v.privateDetails ?? {}, checklist: v.checklist ?? {},
});
const body = (d: Draft) => ({
  visitorFirstName: d.visitorFirstName.trim() || undefined, visitorLastName: d.visitorLastName.trim() || undefined, arrivalDate: d.arrivalDate || null, days: d.days ? Number(d.days) : null,
  details: d.details, privateDetails: d.privateDetails, checklist: d.checklist,
});
const localToday = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`; };

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">{title}</CardTitle>{description && <CardDescription>{description}</CardDescription>}</CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Field({ label, value, onChange, type = "text", multiline, id, disabled, wide, hint }: { label: string; value: string; onChange: (v: string) => void; type?: string; multiline?: boolean; id: string; disabled?: boolean; wide?: boolean; hint?: string }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <Label htmlFor={id}>{label}</Label>
      {multiline
        ? <Textarea id={id} rows={3} value={value} disabled={disabled} onChange={e => onChange(e.target.value)} data-testid={id} />
        : <Input id={id} type={type} value={value} disabled={disabled} onChange={e => onChange(e.target.value)} data-testid={id} />}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Choice({ name, value, options, onChange, disabled, label }: { name: string; value: string; options: Array<[string, string]>; onChange: (v: string) => void; disabled?: boolean; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-x-4 gap-y-1">
      {options.map(([v, text]) => (
        <label key={v} className="flex items-center gap-1.5 text-sm">
          <input type="radio" name={name} checked={value === v} disabled={disabled} onChange={() => onChange(v)} data-testid={`${name}-${v}`} />
          {text}
        </label>
      ))}
    </div>
  );
}

function Tick({ checked, onChange, children, disabled, id }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode; disabled?: boolean; id: string }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" className="mt-1" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} data-testid={id} />
      <span>{children}</span>
    </label>
  );
}

function Certificates({ visit, category, title, hint, onChanged }: { visit: Visit; category: FileCategory; title: string; hint: string; onChanged: () => void }) {
  const { toast } = useToast();
  const [what, setWhat] = useState("");
  const [expiry, setExpiry] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const add = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append("category", category); fd.append("title", what.trim()); fd.append("expiryDate", expiry); fd.append("file", file!);
      const r = await fetch(`/api/contractor/visits/${visit.id}/files`, { method: "POST", body: fd, credentials: "include" });
      if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
    },
    onSuccess: () => { setWhat(""); setExpiry(""); setFile(null); if (input.current) input.current.value = ""; onChanged(); toast({ title: "Certificate added" }); },
    onError: (e) => toast({ title: "Not added", description: problem(e).message, variant: "destructive" }),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/contractor/visits/${visit.id}/files/${id}`); },
    onSuccess: onChanged,
    onError: (e) => toast({ title: "Not removed", description: problem(e).message, variant: "destructive" }),
  });
  const mine = visit.files.filter(f => f.category === category);
  const tooBig = !!file && file.size > MAX_CERTIFICATE_BYTES;
  return (
    <div className="space-y-2" data-testid={`certificates-${category}`}>
      <div className="font-medium">{title}</div>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {mine.length === 0 && <p className="text-sm text-muted-foreground">None attached yet.</p>}
      <ul className="divide-y">
        {mine.map(f => (
          <li key={f.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
            <Paperclip className="h-4 w-4 shrink-0" />
            <a className="min-w-0 flex-1 truncate underline" href={`/api/contractor/visits/${visit.id}/files/${f.id}/download`} target="_blank" rel="noreferrer">{f.title} <span className="text-muted-foreground">({f.fileName})</span></a>
            <span className="text-muted-foreground">{f.expiryDate ? `Expires ${dayText(f.expiryDate)}` : "No expiry given"}</span>
            {f.expiresBeforeVisitEnds && <Badge variant="destructive">Runs out before the visit ends</Badge>}
            {visit.canEdit && <Button size="sm" variant="ghost" aria-label={`Remove ${f.title}`} onClick={() => remove.mutate(f.id)} data-testid={`button-remove-file-${f.id}`}><Trash2 className="h-4 w-4" /></Button>}
          </li>
        ))}
      </ul>
      {visit.canEdit && (
        <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_10rem]">
          <div><Label htmlFor={`cert-title-${category}`}>What it is, and whose or which item</Label><Input id={`cert-title-${category}`} value={what} onChange={e => setWhat(e.target.value)} data-testid={`input-cert-title-${category}`} /></div>
          <div><Label htmlFor={`cert-expiry-${category}`}>Expiry date</Label><Input id={`cert-expiry-${category}`} type="date" value={expiry} onChange={e => setExpiry(e.target.value)} data-testid={`input-cert-expiry-${category}`} /></div>
          <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
            <input ref={input} type="file" accept={CERTIFICATE_EXTENSIONS.map(x => `.${x}`).join(",")} onChange={e => setFile(e.target.files?.[0] ?? null)} className="text-sm" aria-label={`Choose a file for ${title}`} data-testid={`input-cert-file-${category}`} />
            <Button size="sm" disabled={!what.trim() || !file || tooBig || add.isPending} onClick={() => add.mutate()} data-testid={`button-add-cert-${category}`}>{add.isPending ? "Adding..." : "Add certificate"}</Button>
            <span className={`text-xs ${tooBig ? "text-destructive" : "text-muted-foreground"}`}>PDF, picture or Word, up to 10 MB.</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function VisitorForm({ visitId, isHost, settings, onBack }: { visitId: string; isHost: boolean; settings: VisitorSettings; onBack: () => void }) {
  const { toast } = useToast();
  const url = `/api/contractor/visits/${visitId}`;
  const { data: visit, isLoading, error, refetch } = useQuery<Visit>({ queryKey: [url], staleTime: 0 });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [lateReason, setLateReason] = useState("");
  const [note, setNote] = useState("");
  const [dirty, setDirty] = useState(false);

  // the typed copy is taken from the server when the form is opened or moves to another state, not on every refresh, so adding a certificate never wipes what is being typed
  const stamp = visit ? `${visit.id}|${visit.status}` : "";
  useEffect(() => { if (visit) { setDraft(draftOf(visit)); setDirty(false); } }, [stamp]); // eslint-disable-line react-hooks/exhaustive-deps

  const changed = () => { refetch(); refreshContractorData(); };
  const fail = (title: string) => (e: unknown) => { const p = problem(e); toast({ title, description: p.needed?.length ? `Still needed: ${p.needed.join("; ")}` : p.message, variant: "destructive" }); };
  const save = useMutation({
    mutationFn: async () => { await apiRequest("PUT", url, body(draft!)); },
    onSuccess: () => { setDirty(false); changed(); toast({ title: "Saved", description: "It is not sent until you submit it." }); },
    onError: fail("Not saved"),
  });
  const submit = useMutation({
    mutationFn: async () => { await apiRequest("PUT", url, body(draft!)); return (await apiRequest("POST", `${url}/submit`, lateReason.trim() ? { lateReason: lateReason.trim() } : {})).json(); },
    onSuccess: (r: { message: string }) => { changed(); toast({ title: r.message }); },
    onError: (e) => { changed(); fail("Not submitted")(e); },
  });
  const act = useMutation({
    mutationFn: async (a: { path: string; body: unknown; done: string }) => { const r = await (await apiRequest("POST", `${url}/${a.path}`, a.body)).json(); return r.message || a.done; },
    onSuccess: (message: string) => { setNote(""); changed(); toast({ title: message }); },
    onError: fail("Could not do that"),
  });

  const missing = useMemo(() => {
    if (!visit || !draft || !visit.canEdit) return [];
    return stillNeeded({ ...body(draft), visitorFirstName: draft.visitorFirstName, visitorLastName: draft.visitorLastName, details: draft.details, privateDetails: draft.privateDetails, checklist: draft.checklist, files: visit.files },
      { ...settings, checklist: visit.wording.checklist, checklistRule: visit.wording.checklistRule, maxVisitDays: visit.timing.maxVisitDays }, localToday());
  }, [visit, draft, settings]);

  if (isLoading || (visit && !draft)) return <p className="py-10 text-center text-sm text-muted-foreground">Loading...</p>;
  if (error || !visit || !draft) return <div className="space-y-3"><Button variant="ghost" onClick={onBack}><ArrowLeft className="mr-1 h-4 w-4" />Back</Button><p className="text-sm text-destructive">{problem(error).message}</p></div>;

  const edit = visit.canEdit;
  const d = draft.details, p = draft.privateDetails, c = draft.checklist;
  const set = (patch: Partial<Draft>) => { setDraft({ ...draft, ...patch }); setDirty(true); };
  const setD = (patch: Partial<VisitDetails>) => set({ details: { ...d, ...patch } });
  const setP = (patch: Partial<VisitPrivate>) => set({ privateDetails: { ...p, ...patch } });
  const setAnswer = (key: string, patch: { answer?: ChecklistAnswer; comment?: string }) => set({ checklist: { ...c, answers: { ...(c.answers ?? {}), [key]: { ...(c.answers?.[key] ?? {}), ...patch } } } });
  const f = (label: string, id: string, value: string | undefined, on: (v: string) => void, more: Partial<Parameters<typeof Field>[0]> = {}) => <Field label={label} id={id} value={value ?? ""} onChange={on} disabled={!edit} {...more} />;
  const removed = !!visit.privateRemovedAt && !edit;
  const deadline = draft.arrivalDate ? submitBy(draft.arrivalDate, visit.timing.noticeDays) : null;
  const wouldBeLate = !!deadline && localToday() > deadline && !(visit.submittedAt && draft.arrivalDate === visit.arrivalDate);
  const needChecklist = checklistNeeded(visit.wording, d);
  const ppeRows = Array.from(new Set([...(edit ? settings.ppeItems : []), ...(d.ppe ?? []).map(x => x.item)]));
  const ppeOf = (item: string) => d.ppe?.find(x => x.item === item) ?? { item, required: false, size: "" };
  const setPpe = (item: string, patch: { required?: boolean; size?: string }) => setD({ ppe: [...(d.ppe ?? []).filter(x => x.item !== item), { ...ppeOf(item), ...patch }] });
  const status = VISIT_STATUS[visit.status] ?? VISIT_STATUS.draft;
  const locations = Array.from(new Set([...settings.accessLocations, ...(d.location ? [d.location] : [])]));

  return (
    <div className="space-y-4" data-testid="visitor-form">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => { if (!dirty || window.confirm("Leave without saving your changes?")) onBack(); }} data-testid="button-visit-back"><ArrowLeft className="mr-1 h-4 w-4" />All visitor forms</Button>
        <span className="font-mono text-sm">{visit.reference}</span>
        <Badge variant={status.tone} data-testid="badge-visit-status">{status.label}</Badge>
        {visit.late && <Badge variant="destructive">Late</Badge>}
        <Button variant="outline" size="sm" className="ml-auto" onClick={() => window.open(`${url}/print`, "_blank", "noopener")} data-testid="button-visit-print"><Printer className="mr-1 h-4 w-4" />Printable copy</Button>
      </div>

      {visit.status === "returned" && <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm" data-testid="text-returned-note"><strong>Sent back by the host:</strong> {visit.reviewNote}</p>}
      {visit.status === "accepted" && visit.reviewNote && <p className="rounded-md bg-muted p-3 text-sm">Host's note: {visit.reviewNote}</p>}
      {visit.late && visit.lateReason && <p className="rounded-md bg-muted p-3 text-sm">Sent late. Reason given: {visit.lateReason}</p>}
      {visit.emailStatus && <p className="rounded-md bg-muted p-3 text-sm" data-testid="text-email-status">{visit.emailStatus}</p>}
      {edit && <p className="rounded-md bg-muted p-3 text-sm" data-testid="text-deadline">This form must be submitted at least <strong>{visit.timing.noticeDays} day{visit.timing.noticeDays === 1 ? "" : "s"}</strong> before the visitor arrives{deadline ? <>: for this visit, by <strong>{longDay(deadline)}</strong></> : ""}.{visit.timing.lateRule === "block" ? " A late form cannot be sent." : " A late form can be sent with a reason, and is marked as late."}</p>}

      <details className="rounded-md border p-3 text-sm"><summary className="cursor-pointer font-medium">Privacy notice and site notes (read before you fill this in)</summary>
        <div className="mt-2 space-y-3">
          <ul className="list-disc space-y-1 pl-5">{visit.wording.privacyNotice.split("\n").filter(Boolean).map((x, i) => <li key={i}>{x}</li>)}<li>{retentionSentence(visit.wording.privateRetentionDays)}</li></ul>
          <ul className="list-disc space-y-1 pl-5">{visit.wording.siteNotes.split("\n").filter(Boolean).map((x, i) => <li key={i}>{x}</li>)}<li>This form is for a visit of {visit.timing.maxVisitDays} days or less.</li></ul>
        </div>
      </details>

      <Section title="1. Visitor">
        <div className="grid gap-3 sm:grid-cols-2">
          {f("Surname", "v-surname", draft.visitorLastName, v => set({ visitorLastName: v }))}
          {f("Forename(s)", "v-forename", draft.visitorFirstName, v => set({ visitorFirstName: v }))}
          {f("Preferred name (optional)", "v-preferred", d.preferredName, v => setD({ preferredName: v }))}
          <div><Label>Company</Label><Input value={visit.companyName} disabled /></div>
          {f("Business email", "v-email", d.businessEmail, v => setD({ businessEmail: v }), { type: "email" })}
          {f("Business or mobile number", "v-mobile", p.mobile, v => setP({ mobile: v }), { hint: "For arranging the visit and safety alerts." })}
          {f("Vehicle registration (if known)", "v-vehicle", p.vehicleReg, v => setP({ vehicleReg: v }))}
          {f("Employer's 24 hour emergency number (if any)", "v-employer-emergency", p.employerEmergencyPhone, v => setP({ employerEmergencyPhone: v }))}
          {f("Employer's address", "v-employer-address", d.employerAddress, v => setD({ employerAddress: v }), { multiline: true })}
          {f("Business telephone", "v-business-phone", d.businessPhone, v => setD({ businessPhone: v }))}
        </div>
      </Section>

      <Section title="2. The visit">
        <div className="grid gap-3 sm:grid-cols-2">
          {f("Date of arrival", "v-arrival", draft.arrivalDate, v => set({ arrivalDate: v }), { type: "date" })}
          {f(`How many days (up to ${visit.timing.maxVisitDays})`, "v-days", draft.days, v => set({ days: v.replace(/\D/g, "").slice(0, 3) }))}
          {f("Expected departure time", "v-departure", d.departureTime, v => setD({ departureTime: v }))}
          {f("Visit organiser", "v-organiser", d.organiser, v => setD({ organiser: v }))}
          {f("Host's name", "v-host", d.hostName, v => setD({ hostName: v }))}
          {f("Host's telephone number", "v-host-phone", d.hostPhone, v => setD({ hostPhone: v }))}
          <div className="sm:col-span-2"><Label>Where access is needed</Label>
            <Choice name="v-location" label="Where access is needed" value={d.location ?? ""} disabled={!edit} onChange={v => setD({ location: v })} options={locations.map(l => [l, l])} /></div>
          {f("Purpose of the visit and scope of work", "v-purpose", d.purpose, v => setD({ purpose: v }), { multiline: true, wide: true })}
          <div className="sm:col-span-2 space-y-1">
            <Label>Will the visitor take on a safety critical role, or work on safety critical equipment?</Label>
            <p className="text-xs text-muted-foreground">For example work under electrical safety rules, pressure systems, lifting operations or other systems the site treats as safety critical.</p>
            <Choice name="v-critical" label="Safety critical role or equipment" value={d.safetyCritical ?? ""} disabled={!edit} onChange={v => setD({ safetyCritical: v as "yes" | "no" })} options={[["yes", "Yes"], ["no", "No"]]} />
          </div>
        </div>
      </Section>

      <Section title="3. Emergency contact" description="One contact only. You must have their permission to give their details.">
        {removed ? <p className="text-sm text-muted-foreground">Removed after the visit.</p> : (
          <div className="grid gap-3 sm:grid-cols-2">
            {f("Contact's name", "v-ec-name", p.emergencyName, v => setP({ emergencyName: v }))}
            {f("Contact's telephone number", "v-ec-phone", p.emergencyPhone, v => setP({ emergencyPhone: v }))}
            {f("Relationship to the visitor (optional)", "v-ec-relationship", p.emergencyRelationship, v => setP({ emergencyRelationship: v }))}
            <div className="self-end"><Tick id="v-ec-permission" checked={!!p.emergencyPermission} disabled={!edit} onChange={v => setP({ emergencyPermission: v })}>The contact has agreed to their details being given</Tick></div>
          </div>
        )}
      </Section>

      <Section title="4. Adjustments and access support" description="Give only what is needed to arrange a safe visit. Do not add medical details that are not needed.">
        {removed ? <p className="text-sm text-muted-foreground">Removed after the visit.</p> : (
          <div className="space-y-3">
            <div><Label>Are any reasonable adjustments or access support needed?</Label>
              <Choice name="v-support" label="Adjustments or access support needed" value={p.supportNeeded ?? ""} disabled={!edit} onChange={v => setP({ supportNeeded: v as "yes" | "no" })} options={[["yes", "Yes"], ["no", "No"]]} /></div>
            {p.supportNeeded === "yes" && (
              <>
                <div className="flex flex-wrap gap-x-4 gap-y-1">{SUPPORT_TYPES.map(t => <Tick key={t} id={`v-support-type-${t}`} checked={!!p.supportTypes?.includes(t)} disabled={!edit} onChange={on => setP({ supportTypes: on ? [...(p.supportTypes ?? []), t] : (p.supportTypes ?? []).filter(x => x !== t) })}>{t}</Tick>)}</div>
                {f("What is needed for this visit", "v-support-details", p.supportDetails, v => setP({ supportDetails: v }), { multiline: true })}
              </>
            )}
          </div>
        )}
      </Section>

      <Section title="5. Protective equipment" description="Protective equipment is required in operational areas. Tick only what the site needs to issue.">
        {ppeRows.length === 0 ? <p className="text-sm text-muted-foreground">Nothing asked for.</p> : (
          <div className="space-y-2">{ppeRows.map(item => (
            <div key={item} className="grid items-center gap-2 sm:grid-cols-[1fr_16rem]">
              <Tick id={`v-ppe-${item}`} checked={ppeOf(item).required} disabled={!edit} onChange={v => setPpe(item, { required: v })}>{item}</Tick>
              {ppeOf(item).required && <Input aria-label={`Size or details for ${item}`} placeholder="Size or details" value={ppeOf(item).size} disabled={!edit} onChange={e => setPpe(item, { size: e.target.value })} />}
            </div>
          ))}</div>
        )}
      </Section>

      <Section title="6. Competence checklist" description={needChecklist ? "Answer every line. Say why for any answer of No. Attach the certificates below." : "Only needed when the visit involves safety critical work. Answer the safety critical question in section 2."}>
        {needChecklist && (
          <div className="space-y-5" data-testid="visitor-checklist">
            <div className="grid gap-3 sm:grid-cols-2">{f("Contractor's supervisor", "v-supervisor", c.supervisorName, v => set({ checklist: { ...c, supervisorName: v } }))}</div>
            {visit.wording.checklist.map(section => (
              <div key={section.key}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-medium">{section.title}</h3>
                  {edit && section.naAllowed && <Button size="sm" variant="ghost" data-testid={`button-na-rest-${section.key}`} onClick={() => set({ checklist: { ...c, answers: { ...(c.answers ?? {}), ...Object.fromEntries(section.items.filter(i => !c.answers?.[i.key]?.answer).map(i => [i.key, { ...(c.answers?.[i.key] ?? {}), answer: "na" as const }])) } } })}>Mark the rest not applicable</Button>}
                </div>
                <ul className="divide-y">{section.items.map(item => {
                  const a = c.answers?.[item.key];
                  return (
                    <li key={item.key} className="grid gap-2 py-3 lg:grid-cols-[1fr_16rem_16rem]">
                      <div><div className="text-sm">{item.text}</div>{item.evidence && <div className="text-xs text-muted-foreground">Evidence: {item.evidence}</div>}</div>
                      <Choice name={`check-${item.key}`} label={item.text} value={a?.answer ?? ""} disabled={!edit} onChange={v => setAnswer(item.key, { answer: v as ChecklistAnswer })}
                        options={section.naAllowed ? [["yes", "Yes"], ["no", "No"], ["na", "Not applicable"]] : [["yes", "Yes"], ["no", "No"]]} />
                      <Input aria-label={`Comment: ${item.text}`} placeholder={a?.answer === "no" ? "Say why (needed)" : "Comments"} value={a?.comment ?? ""} disabled={!edit} onChange={e => setAnswer(item.key, { comment: e.target.value })} data-testid={`comment-${item.key}`} />
                    </li>
                  );
                })}</ul>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="7. Certificates" description="Certificates are kept with this form on the visitor's record.">
        <div className="space-y-6">
          <Certificates visit={visit} category="personnel" title="For the person attending" hint="Qualifications, training, competence and any authorisations relevant to the visit." onChanged={changed} />
          <Certificates visit={visit} category="equipment" title="For equipment and tools being brought" hint="Inspection, calibration, hazardous area, pressure and lifting certificates." onChanged={changed} />
        </div>
      </Section>

      <Section title="8. Declarations and sign-off">
        <div className="space-y-3">
          {visit.wording.declarations.map(x => <Tick key={x.key} id={`v-declare-${x.key}`} checked={!!d.declarations?.includes(x.key)} disabled={!edit} onChange={on => setD({ declarations: on ? [...(d.declarations ?? []), x.key] : (d.declarations ?? []).filter(k => k !== x.key) })}>{x.text}</Tick>)}
          <div className="grid gap-3 sm:grid-cols-2">
            {f("Completed by", "v-completed-by", d.completedBy, v => setD({ completedBy: v }))}
            {f("Signature (type your full name)", "v-signature", d.signature, v => setD({ signature: v }))}
          </div>
        </div>
      </Section>

      {edit && (
        <Card><CardContent className="space-y-3 pt-6">
          {missing.length > 0 ? <div className="text-sm" data-testid="text-still-needed"><strong>Still needed before it can be submitted:</strong><ul className="list-disc pl-5">{missing.map(x => <li key={x}>{x}</li>)}</ul></div> : <p className="text-sm" data-testid="text-ready">Everything needed is here.</p>}
          {wouldBeLate && visit.timing.lateRule === "flag" && <div><Label htmlFor="v-late-reason">This form is late. Why?</Label><Input id="v-late-reason" value={lateReason} onChange={e => setLateReason(e.target.value)} data-testid="v-late-reason" /></div>}
          {wouldBeLate && visit.timing.lateRule === "block" && <p className="text-sm text-destructive" data-testid="text-too-late">It is too late to submit a form for this arrival date. Choose a later date, or speak to your host.</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={save.isPending} onClick={() => save.mutate()} data-testid="button-save-visit">Save for later</Button>
            <Button disabled={submit.isPending || missing.length > 0 || (wouldBeLate && (visit.timing.lateRule === "block" || lateReason.trim().length < 5))} onClick={() => submit.mutate()} data-testid="button-submit-visit">{submit.isPending ? "Submitting..." : "Submit to the host"}</Button>
            <Button variant="ghost" className="ml-auto" onClick={() => { if (window.confirm("Cancel this visit?")) act.mutate({ path: "cancel", body: {}, done: "Visit cancelled" }); }} data-testid="button-cancel-visit">Cancel visit</Button>
          </div>
        </CardContent></Card>
      )}

      {isHost && visit.canReview && (
        <Section title="Your decision" description="Accept it, or send it back with what needs correcting. The contractor is told either way.">
          <div className="space-y-3">
            <Textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="A note for the contractor (needed when sending back)" aria-label="Note for the contractor" data-testid="input-review-note" />
            <div className="flex flex-wrap gap-2">
              <Button disabled={act.isPending} onClick={() => act.mutate({ path: "review", body: { decision: "accept", note: note.trim() || undefined }, done: "Accepted" })} data-testid="button-accept-visit">Accept</Button>
              <Button variant="outline" disabled={act.isPending || note.trim().length < 5} onClick={() => act.mutate({ path: "review", body: { decision: "return", note: note.trim() }, done: "Sent back" })} data-testid="button-return-visit">Send back</Button>
            </div>
          </div>
        </Section>
      )}

      {!edit && visit.status !== "cancelled" && (
        <div className="flex flex-wrap gap-2">
          {isHost && (visit.status === "submitted" || visit.status === "accepted") && <Button variant="outline" size="sm" onClick={() => act.mutate({ path: "resend", body: {}, done: "Sent" })} data-testid="button-resend-visit">Email the form again</Button>}
          {isHost && !visit.privateRemovedAt && <Button variant="outline" size="sm" onClick={() => {
            if (visit.keepPrivate) return act.mutate({ path: "hold", body: { hold: false }, done: "Hold released" });
            const reason = window.prompt("Why must the personal details on this form be kept? (for example an incident or a security enquiry)");
            if (reason) act.mutate({ path: "hold", body: { hold: true, reason }, done: "Personal details will be kept" });
          }} data-testid="button-hold-visit">{visit.keepPrivate ? "Release the hold on personal details" : "Keep personal details (hold)"}</Button>}
          <Button variant="ghost" size="sm" onClick={() => { if (window.confirm("Cancel this visit?")) act.mutate({ path: "cancel", body: {}, done: "Visit cancelled" }); }} data-testid="button-cancel-visit">Cancel visit</Button>
        </div>
      )}

      <details className="rounded-md border p-3 text-sm"><summary className="cursor-pointer font-medium">History</summary>
        <ul className="mt-2 space-y-1">{visit.history.map((h, i) => <li key={i}>{new Date(h.at).toLocaleString("en-GB")}: {h.what}{h.note ? ` (${h.note})` : ""}</li>)}</ul>
      </details>
    </div>
  );
}

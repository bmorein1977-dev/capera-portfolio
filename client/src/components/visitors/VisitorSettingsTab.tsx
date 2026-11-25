import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { retentionSentence, type VisitorSettings, type ChecklistSection } from "@shared/visitorForm";
import { problem, refreshContractorData } from "./shared";

type Loaded = VisitorSettings & { defaults: { checklist: ChecklistSection[]; privacyNotice: string; siteNotes: string } };

const asLines = (a: string[]) => a.join("\n");
const fromLines = (s: string) => s.split("\n").map(x => x.trim()).filter(Boolean);
// a checklist line is typed as "requirement | evidence expected"; a line that is unchanged keeps its key, so earlier drafts keep their answers
const sectionText = (s: ChecklistSection) => s.items.map(i => (i.evidence ? `${i.text} | ${i.evidence}` : i.text)).join("\n");
function sectionFrom(s: ChecklistSection, text: string): ChecklistSection {
  const used = new Set<string>();
  const items = fromLines(text).map(line => {
    const [first, ...rest] = line.split("|");
    const t = first.trim(), evidence = rest.join("|").trim();
    const same = s.items.find(i => i.text === t && !used.has(i.key));
    const key = same?.key ?? `${s.key.slice(0, 1)}-${Math.random().toString(36).slice(2, 10)}`;
    used.add(key);
    return { key, text: t, evidence };
  });
  return { ...s, items };
}

export function VisitorSettingsTab() {
  const { toast } = useToast();
  const { data } = useQuery<Loaded>({ queryKey: ["/api/contractor/visitor-settings"] });
  const [f, setF] = useState<null | { emails: string; noticeDays: string; maxVisitDays: string; lateRule: "flag" | "block"; checklistRule: "always" | "safety_critical"; siteName: string; locations: string; ppe: string; siteNotes: string; privacyNotice: string; retention: string; emailAttachments: boolean; sections: string[] }>(null);
  const load = (s: Loaded) => setF({
    emails: asLines(s.submissionEmails), noticeDays: String(s.noticeDays), maxVisitDays: String(s.maxVisitDays), lateRule: s.lateRule, checklistRule: s.checklistRule, siteName: s.siteName,
    locations: asLines(s.accessLocations), ppe: asLines(s.ppeItems), siteNotes: s.siteNotes, privacyNotice: s.privacyNotice, retention: s.privateRetentionDays === null ? "" : String(s.privateRetentionDays),
    emailAttachments: s.emailAttachments, sections: s.checklist.map(sectionText),
  });
  useEffect(() => { if (data && !f) load(data); }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: async () => {
      const s: VisitorSettings = {
        submissionEmails: fromLines(f!.emails.replace(/[,;]/g, "\n")), noticeDays: Number(f!.noticeDays || 0), maxVisitDays: Number(f!.maxVisitDays || 1), lateRule: f!.lateRule, checklistRule: f!.checklistRule,
        siteName: f!.siteName, accessLocations: fromLines(f!.locations), ppeItems: fromLines(f!.ppe), siteNotes: f!.siteNotes, privacyNotice: f!.privacyNotice,
        privateRetentionDays: f!.retention.trim() ? Number(f!.retention) : null, emailAttachments: f!.emailAttachments, checklist: data!.checklist.map((c, i) => sectionFrom(c, f!.sections[i])),
      };
      return (await apiRequest("PUT", "/api/contractor/visitor-settings", s)).json();
    },
    onSuccess: () => { refreshContractorData(); toast({ title: "Visitor form settings saved" }); },
    onError: (e) => toast({ title: "Not saved", description: `${problem(e).message}. Check the email addresses and numbers.`, variant: "destructive" }),
  });

  if (!data || !f) return <p className="py-6 text-center text-sm text-muted-foreground">Loading...</p>;
  const up = (patch: Partial<NonNullable<typeof f>>) => setF({ ...f, ...patch });
  const area = (label: string, id: string, value: string, on: (v: string) => void, rows = 4, hint?: string) => (
    <div><Label htmlFor={id}>{label}</Label><Textarea id={id} rows={rows} value={value} onChange={e => on(e.target.value)} data-testid={id} />{hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}</div>
  );
  const radio = <T extends string>(name: string, value: T, options: Array<[T, string]>, on: (v: T) => void) => (
    <div className="space-y-1">{options.map(([v, text]) => <label key={v} className="flex items-start gap-2 text-sm"><input type="radio" className="mt-1" name={name} checked={value === v} onChange={() => on(v)} data-testid={`${name}-${v}`} /><span>{text}</span></label>)}</div>
  );

  return (
    <div className="space-y-4" data-testid="visitor-settings">
      <Card>
        <CardHeader><CardTitle className="text-base">Where forms go, and when they are due</CardTitle><CardDescription>These apply to every contracting company.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          {area("Email submitted forms to", "vs-emails", f.emails, v => up({ emails: v }), 2, "Up to five addresses, one on each line. Only these addresses receive the form. Email must also be set up on this system.")}
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={f.emailAttachments} onChange={e => up({ emailAttachments: e.target.checked })} data-testid="vs-attachments" /><span>Attach the form and certificates to the email. They hold personal details, so only switch this on for a mailbox that is looked after. Without it the email just says a form is waiting in Capera.</span></label>
          <div className="grid gap-3 sm:grid-cols-3">
            <div><Label htmlFor="vs-notice">Days' notice needed before arrival</Label><Input id="vs-notice" type="number" min={0} max={90} value={f.noticeDays} onChange={e => up({ noticeDays: e.target.value })} data-testid="vs-notice" /></div>
            <div><Label htmlFor="vs-maxdays">Longest visit, in days</Label><Input id="vs-maxdays" type="number" min={1} max={60} value={f.maxVisitDays} onChange={e => up({ maxVisitDays: e.target.value })} data-testid="vs-maxdays" /></div>
            <div><Label htmlFor="vs-retention">Remove personal details after (days)</Label><Input id="vs-retention" type="number" min={1} max={3650} placeholder="Not removed" value={f.retention} onChange={e => up({ retention: e.target.value })} data-testid="vs-retention" /></div>
          </div>
          <p className="text-xs text-muted-foreground">The privacy notice will add: "{retentionSentence(f.retention.trim() ? Number(f.retention) : null)}" Removal runs once a day and cannot be undone.</p>
          <div><Label>If a form is sent with less notice than that</Label>{radio("vs-late", f.lateRule, [["flag", "Accept it, mark it as late and require a reason"], ["block", "Refuse it"]], v => up({ lateRule: v }))}</div>
          <div><Label>When is the competence checklist, with certificates, needed?</Label>{radio("vs-checklist-rule", f.checklistRule, [["always", "For every visitor"], ["safety_critical", "Only when the visit involves safety critical work"]], v => up({ checklistRule: v }))}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">What the form says</CardTitle><CardDescription>The starting wording is general. Check it, especially the privacy notice, with whoever looks after data protection.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div><Label htmlFor="vs-site">Site or company name shown on the form (optional)</Label><Input id="vs-site" value={f.siteName} onChange={e => up({ siteName: e.target.value })} data-testid="vs-site" /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            {area("Places a visitor can ask for access to", "vs-locations", f.locations, v => up({ locations: v }), 5, "One on each line.")}
            {area("Protective equipment the site can issue", "vs-ppe", f.ppe, v => up({ ppe: v }), 5, "One on each line.")}
          </div>
          {area("Site notes", "vs-notes", f.siteNotes, v => up({ siteNotes: v }), 4, "One point on each line: parking, speed limits, how visitors are met.")}
          {area("Privacy notice", "vs-privacy", f.privacyNotice, v => up({ privacyNotice: v }), 8, "One point on each line. Say who is responsible for the information and who to contact.")}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Competence checklist</CardTitle><CardDescription>One requirement on each line, written as: requirement | evidence expected. Forms already submitted keep the wording they were submitted with.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          {data.checklist.map((c, i) => <div key={c.key}>{area(c.title, `vs-check-${c.key}`, f.sections[i], v => up({ sections: f.sections.map((x, j) => (j === i ? v : x)) }), 8)}</div>)}
          <Button variant="outline" size="sm" onClick={() => { if (window.confirm("Put the checklist back to Capera's standard lines? Nothing changes until you save.")) up({ sections: data.defaults.checklist.map(sectionText) }); }} data-testid="vs-reset-checklist">Use the standard checklist</Button>
        </CardContent>
      </Card>

      <div className="flex gap-2"><Button disabled={save.isPending} onClick={() => save.mutate()} data-testid="button-save-visitor-settings">Save settings</Button><Button variant="ghost" onClick={() => load(data)}>Undo changes</Button></div>
    </div>
  );
}

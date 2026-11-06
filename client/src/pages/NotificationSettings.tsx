import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { errorText } from "@/components/performance/shared";
import { AlertTriangle, Bell, CheckCircle2, Clock, Mail, RotateCcw, Send } from "lucide-react";

// Email notifications. Every email Capera sends is listed here, grouped by area. Each can be switched off, sent to more people,
// bundled into a daily or weekly digest, and reworded. The Email log shows every email that was sent, failed, or could not be sent
// because email is not set up, and lets an administrator resend it.

interface Variable { name: string; description: string; example: string }
interface TypeDef {
  key: string; category: string; label: string; description: string; audience: string; variables: Variable[]; subject: string; body: string;
  frequencies: Array<"immediate" | "daily" | "weekly">; reminderDays?: number[]; managerCopy?: boolean;
}
interface Rule {
  typeKey: string; isEnabled: boolean; sendToDefault: boolean; alsoRoles: string[]; alsoUserIds: string[]; includeManager: boolean; frequency: "immediate" | "daily" | "weekly";
  reminderDays: number[] | null; subject: string; body: string; customSubject: boolean; customBody: boolean; customised: boolean;
}
interface RulesResponse {
  rules: Array<{ type: TypeDef; rule: Rule }>; roles: Array<{ value: string; label: string }>;
  email: { configured: boolean; provider: string | null; from: string | null };
  summary: { last30Days: Record<string, number>; queued: number };
}
interface LogRow {
  id: string; typeKey: string | null; label: string | null; recipientEmail: string; recipientName: string | null; subject: string; status: "sent" | "failed" | "skipped" | "pending";
  errorMessage: string | null; sentAt: string | null; createdAt: string; resendOf: string | null;
}
interface LogDetail extends LogRow { body: string }
interface UserLite { id: string; firstName: string | null; lastName: string | null; email: string | null; role: string }

const FREQ_LABEL = { immediate: "Straight away", daily: "A daily digest", weekly: "A weekly digest" } as const;
const ANY = "__any";
const PAGE = 25;
const when = (d: string) => new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const nameOf = (u: UserLite) => [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || u.id;

function StatusBadge({ status }: { status: LogRow["status"] }) {
  if (status === "sent") return <Badge className="gap-1 bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-950 dark:text-green-200"><CheckCircle2 className="h-3.5 w-3.5" />Sent</Badge>;
  if (status === "failed") return <Badge className="gap-1 bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-950 dark:text-red-200"><AlertTriangle className="h-3.5 w-3.5" />Failed</Badge>;
  if (status === "skipped") return <Badge className="gap-1 bg-amber-100 text-amber-900 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-200"><Clock className="h-3.5 w-3.5" />Not sent</Badge>;
  return <Badge variant="secondary">Pending</Badge>;
}

interface FormState {
  isEnabled: boolean; sendToDefault: boolean; includeManager: boolean; alsoRoles: string[]; alsoUserIds: string[]; frequency: Rule["frequency"]; reminderDays: string; subject: string; body: string;
}
const toForm = (r: Rule): FormState => ({ isEnabled: r.isEnabled, sendToDefault: r.sendToDefault, includeManager: r.includeManager, alsoRoles: r.alsoRoles, alsoUserIds: r.alsoUserIds, frequency: r.frequency, reminderDays: (r.reminderDays ?? []).join(", "), subject: r.subject, body: r.body });

export default function NotificationSettings() {
  const { toast } = useToast();
  const onError = (e: any) => toast({ title: "That did not work", description: errorText(e), variant: "destructive" });
  const refresh = () => queryClient.invalidateQueries({ predicate: q => String(q.queryKey[0]).startsWith("/api/notifications") });

  const { data, isLoading } = useQuery<RulesResponse>({ queryKey: ["/api/notifications/rules"] });
  const { data: people = [] } = useQuery<UserLite[]>({ queryKey: ["/api/users"] });
  const categories = Array.from(new Set((data?.rules ?? []).map(r => r.type.category)));

  // ---------------------------------------------------------------- edit dialog
  const [editing, setEditing] = useState<{ type: TypeDef; rule: Rule } | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [personSearch, setPersonSearch] = useState("");
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const lastField = useRef<"subject" | "body">("body");

  const open = (type: TypeDef, rule: Rule) => { setEditing({ type, rule }); setForm(toForm(rule)); setPreview(null); setPersonSearch(""); };
  const close = () => { setEditing(null); setForm(null); setPreview(null); };
  const parseDays = (s: string) => s.split(/[,\s]+/).filter(Boolean).map(Number);

  const payload = (f: FormState, t: TypeDef) => ({
    isEnabled: f.isEnabled, sendToDefault: f.sendToDefault, includeManager: f.includeManager, alsoRoles: f.alsoRoles, alsoUserIds: f.alsoUserIds, frequency: f.frequency,
    ...(t.reminderDays ? { reminderDays: parseDays(f.reminderDays) } : {}),
    subject: f.subject.trim() === t.subject ? "" : f.subject, body: f.body.trim() === t.body.trim() ? "" : f.body, // unchanged wording stays "default"
  });

  const save = useMutation({
    mutationFn: () => apiRequest("PUT", `/api/notifications/rules/${editing!.type.key}`, payload(form!, editing!.type)),
    onSuccess: () => { toast({ title: "Saved" }); close(); refresh(); }, onError,
  });
  const toggle = useMutation({
    mutationFn: (v: { key: string; isEnabled: boolean }) => apiRequest("PUT", `/api/notifications/rules/${v.key}`, { isEnabled: v.isEnabled }),
    onSuccess: refresh, onError,
  });
  const reset = useMutation({
    mutationFn: (key: string) => apiRequest("POST", `/api/notifications/rules/${key}/reset`),
    onSuccess: () => { toast({ title: "Back to the standard settings" }); close(); refresh(); }, onError,
  });
  const showPreview = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/notifications/rules/${editing!.type.key}/preview`, { subject: form!.subject, body: form!.body })).json() as Promise<{ subject: string; html: string; unknownPlaceholders: string[] }>,
    onSuccess: (r) => { if (r.unknownPlaceholders.length) toast({ title: "Check the wording", description: `Not available here: ${r.unknownPlaceholders.map(u => `{{${u}}}`).join(", ")}`, variant: "destructive" }); setPreview(r); }, onError,
  });
  const sendTest = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/notifications/rules/${editing!.type.key}/test`, { subject: form!.subject, body: form!.body })).json() as Promise<{ status: string; to: string; error: string | null }>,
    onSuccess: (r) => { toast({ title: r.status === "sent" ? "Test email sent" : "Test not sent", description: r.status === "sent" ? `Sent to ${r.to}` : r.error ?? "Email is not set up.", variant: r.status === "sent" ? "default" : "destructive" }); refresh(); }, onError,
  });

  const insertPlaceholder = (name: string) => {
    if (!form) return;
    const token = `{{${name}}}`;
    const field = lastField.current;
    const el = field === "subject" ? subjectRef.current : bodyRef.current;
    const cur = field === "subject" ? form.subject : form.body;
    const at = el?.selectionStart ?? cur.length, end = el?.selectionEnd ?? at;
    const next = cur.slice(0, at) + token + cur.slice(end);
    setForm({ ...form, [field]: next });
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(at + token.length, at + token.length); });
  };

  const matches = personSearch.trim().length < 2 ? [] : people.filter(p => nameOf(p).toLowerCase().includes(personSearch.trim().toLowerCase()) && !form?.alsoUserIds.includes(p.id)).slice(0, 6);

  // ------------------------------------------------------------------------------ log
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState(ANY);
  const [statusFilter, setStatusFilter] = useState(ANY);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const [viewing, setViewing] = useState<string | null>(null);
  const [resendTo, setResendTo] = useState("");

  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  if (typeFilter !== ANY) params.set("typeKey", typeFilter);
  if (statusFilter !== ANY) params.set("status", statusFilter);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  params.set("limit", String(PAGE)); params.set("offset", String(page * PAGE));
  const { data: logData, isLoading: logsLoading } = useQuery<{ logs: LogRow[]; total: number }>({ queryKey: [`/api/notifications/logs?${params.toString()}`] });
  const { data: detail } = useQuery<LogDetail>({ queryKey: [`/api/notifications/logs/${viewing}`], enabled: !!viewing });
  const logs = logData?.logs ?? [];
  const total = logData?.total ?? 0;
  const lastPage = Math.max(0, Math.ceil(total / PAGE) - 1);
  const filter = (fn: () => void) => { fn(); setPage(0); };

  const resend = useMutation({
    mutationFn: async (v: { id: string; to?: string }) => (await apiRequest("POST", `/api/notifications/logs/${v.id}/resend`, { to: v.to || undefined })).json() as Promise<{ status: string; to: string; error: string | null }>,
    onSuccess: (r) => { toast({ title: r.status === "sent" ? "Resent" : "Not resent", description: r.status === "sent" ? `Sent again to ${r.to}` : r.error ?? "Email is not set up.", variant: r.status === "sent" ? "default" : "destructive" }); setViewing(null); setResendTo(""); refresh(); }, onError,
  });

  const email = data?.email;
  const s30 = data?.summary.last30Days ?? {};

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><Bell className="h-6 w-6" />Email notifications</h1>
        <p className="mt-1 text-muted-foreground">Every email Capera sends is listed here. Switch each on or off, choose who gets it, how often, and what it says. The Email log records every one and lets you resend it.</p>
      </div>

      {email && (email.configured ? (
        <div className="flex items-start gap-3 rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-200" data-testid="banner-email-ok">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /><div>Email is set up{email.provider ? ` (${email.provider}${email.from ? `, sending from ${email.from}` : ""})` : ""}.</div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200" data-testid="banner-email-missing">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div><strong>Email is not set up on this system.</strong> Emails are recorded in the Email log as "Not sent" so you can see what would have gone out, but nobody receives them. Ask whoever looks after the system to add the email settings. You can resend from the log once it is set up.</div>
        </div>
      ))}

      <Tabs defaultValue="notifications">
        <TabsList>
          <TabsTrigger value="notifications" data-testid="tab-notifications">Notifications</TabsTrigger>
          <TabsTrigger value="log" data-testid="tab-email-log">Email log{s30.failed ? ` (${s30.failed} failed)` : ""}</TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="space-y-6">
          {isLoading && <p className="text-muted-foreground">Loading...</p>}
          {categories.map(cat => (
            <Card key={cat}>
              <CardHeader><CardTitle className="text-base">{cat}</CardTitle></CardHeader>
              <CardContent className="divide-y p-0">
                {data!.rules.filter(r => r.type.category === cat).map(({ type, rule }) => (
                  <div key={type.key} className="flex flex-wrap items-start justify-between gap-3 p-4" data-testid={`row-type-${type.key}`}>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{type.label}</span>
                        {!rule.isEnabled && <Badge variant="secondary" data-testid={`badge-off-${type.key}`}>Off</Badge>}
                        {rule.frequency !== "immediate" && <Badge variant="outline">{FREQ_LABEL[rule.frequency]}</Badge>}
                        {(rule.customSubject || rule.customBody) && <Badge variant="outline">Your wording</Badge>}
                        {(rule.alsoRoles.length > 0 || rule.alsoUserIds.length > 0 || rule.includeManager || !rule.sendToDefault) && <Badge variant="outline">Recipients changed</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">{type.description}</p>
                      <p className="text-xs text-muted-foreground">Goes to: {type.audience}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch checked={rule.isEnabled} onCheckedChange={v => toggle.mutate({ key: type.key, isEnabled: v })} aria-label={`Send ${type.label}`} data-testid={`switch-type-${type.key}`} />
                      <Button variant="outline" size="sm" onClick={() => open(type, rule)} data-testid={`button-edit-${type.key}`}>Edit</Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="log" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {([["sent", "Sent", "text-green-700"], ["failed", "Failed", "text-red-700"], ["skipped", "Not sent", "text-amber-700"]] as const).map(([k, label, tone]) => (
              <Card key={k}><CardContent className="p-4"><div className={`text-2xl font-semibold ${tone}`} data-testid={`count-${k}`}>{s30[k] ?? 0}</div><div className="text-sm text-muted-foreground">{label}, last 30 days</div></CardContent></Card>
            ))}
            <Card><CardContent className="p-4"><div className="text-2xl font-semibold" data-testid="count-queued">{data?.summary.queued ?? 0}</div><div className="text-sm text-muted-foreground">Waiting for a digest</div></CardContent></Card>
          </div>

          <Card>
            <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
              <Input placeholder="Search address or subject" value={q} onChange={e => filter(() => setQ(e.target.value))} data-testid="input-log-search" />
              <Select value={typeFilter} onValueChange={v => filter(() => setTypeFilter(v))}>
                <SelectTrigger data-testid="select-log-type"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value={ANY}>Every email</SelectItem>{(data?.rules ?? []).map(r => <SelectItem key={r.type.key} value={r.type.key}>{r.type.label}</SelectItem>)}<SelectItem value="digest">Digests</SelectItem></SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={v => filter(() => setStatusFilter(v))}>
                <SelectTrigger data-testid="select-log-status"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value={ANY}>Any result</SelectItem><SelectItem value="sent">Sent</SelectItem><SelectItem value="failed">Failed</SelectItem><SelectItem value="skipped">Not sent</SelectItem></SelectContent>
              </Select>
              <Input type="date" value={from} onChange={e => filter(() => setFrom(e.target.value))} aria-label="From" data-testid="input-log-from" />
              <Input type="date" value={to} onChange={e => filter(() => setTo(e.target.value))} aria-label="To" data-testid="input-log-to" />
            </CardContent>
          </Card>

          <Card><CardContent className="p-0">
            {!logsLoading && logs.length === 0 ? <p className="p-8 text-center text-muted-foreground" data-testid="text-no-logs">No emails match.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>When</TableHead><TableHead>To</TableHead><TableHead>Email</TableHead><TableHead>Result</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {logs.map(l => (
                    <TableRow key={l.id} data-testid={`row-log-${l.id}`}>
                      <TableCell className="whitespace-nowrap text-sm">{when(l.createdAt)}</TableCell>
                      <TableCell className="text-sm">{l.recipientName ?? l.recipientEmail}{l.recipientName && <span className="block text-xs text-muted-foreground">{l.recipientEmail}</span>}</TableCell>
                      <TableCell className="text-sm"><span className="font-medium">{l.subject}</span>{l.label && <span className="block text-xs text-muted-foreground">{l.label}{l.resendOf ? " · resent" : ""}</span>}</TableCell>
                      <TableCell><StatusBadge status={l.status} />{l.errorMessage && <span className="block max-w-xs text-xs text-muted-foreground">{l.errorMessage}</span>}</TableCell>
                      <TableCell className="text-right"><div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => { setViewing(l.id); setResendTo(""); }} data-testid={`button-view-${l.id}`}><Mail className="mr-1 h-3.5 w-3.5" />View</Button>
                        <Button variant="outline" size="sm" onClick={() => resend.mutate({ id: l.id })} disabled={resend.isPending} data-testid={`button-resend-${l.id}`}><Send className="mr-1 h-3.5 w-3.5" />Resend</Button>
                      </div></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent></Card>

          {total > PAGE && (
            <div className="flex items-center justify-between">
              <Button variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)} data-testid="button-log-newer">Newer</Button>
              <span className="text-sm text-muted-foreground">Page {page + 1} of {lastPage + 1} ({total} emails)</span>
              <Button variant="outline" disabled={page >= lastPage} onClick={() => setPage(page + 1)} data-testid="button-log-older">Older</Button>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* edit one notification */}
      <Dialog open={!!editing} onOpenChange={o => !o && close()}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto" data-testid="dialog-edit-notification">
          {editing && form && (
            <>
              <DialogHeader><DialogTitle>{editing.type.label}</DialogTitle><DialogDescription>{editing.type.description}</DialogDescription></DialogHeader>
              <div className="space-y-6">
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div><Label htmlFor="enabled">Send this email</Label>{!editing.rule.customised && ["competence_expiring", "competence_expired"].includes(editing.type.key) && <p className="text-xs text-muted-foreground">New automatic reminder: off until you switch it on.</p>}</div>
                  <Switch id="enabled" checked={form.isEnabled} onCheckedChange={v => setForm({ ...form, isEnabled: v })} data-testid="switch-enabled" />
                </div>

                <section className="space-y-3">
                  <h3 className="font-medium">Who gets it</h3>
                  <label className="flex items-start gap-2 text-sm"><Checkbox checked={form.sendToDefault} onCheckedChange={v => setForm({ ...form, sendToDefault: v === true })} data-testid="check-send-default" /><span>The usual recipients: {editing.type.audience}</span></label>
                  {editing.type.managerCopy && <label className="flex items-start gap-2 text-sm"><Checkbox checked={form.includeManager} onCheckedChange={v => setForm({ ...form, includeManager: v === true })} data-testid="check-include-manager" /><span>Also the line manager of the person it is about</span></label>}
                  <div className="space-y-2">
                    <Label className="text-sm">Also send to everyone with these roles</Label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {(data?.roles ?? []).map(r => (
                        <label key={r.value} className="flex items-center gap-2 text-sm"><Checkbox checked={form.alsoRoles.includes(r.value)} onCheckedChange={v => setForm({ ...form, alsoRoles: v === true ? [...form.alsoRoles, r.value] : form.alsoRoles.filter(x => x !== r.value) })} data-testid={`check-role-${r.value}`} />{r.label}</label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="person-search" className="text-sm">Also send to these people</Label>
                    <div className="flex flex-wrap gap-2">
                      {form.alsoUserIds.map(id => { const p = people.find(x => x.id === id); return <Badge key={id} variant="secondary" className="cursor-pointer" onClick={() => setForm({ ...form, alsoUserIds: form.alsoUserIds.filter(x => x !== id) })} data-testid={`chip-person-${id}`}>{p ? nameOf(p) : id} ×</Badge>; })}
                    </div>
                    <Input id="person-search" placeholder="Type a name to add someone" value={personSearch} onChange={e => setPersonSearch(e.target.value)} data-testid="input-person-search" />
                    {matches.length > 0 && <div className="rounded-md border">{matches.map(p => <button key={p.id} type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { setForm({ ...form, alsoUserIds: [...form.alsoUserIds, p.id] }); setPersonSearch(""); }} data-testid={`option-person-${p.id}`}>{nameOf(p)}<span className="ml-2 text-xs text-muted-foreground">{p.email}</span></button>)}</div>}
                  </div>
                </section>

                <section className="space-y-3">
                  <h3 className="font-medium">When it goes</h3>
                  {editing.type.frequencies.length > 1 ? (
                    <Select value={form.frequency} onValueChange={v => setForm({ ...form, frequency: v as FormState["frequency"] })}>
                      <SelectTrigger className="max-w-xs" data-testid="select-frequency"><SelectValue /></SelectTrigger>
                      <SelectContent>{editing.type.frequencies.map(f => <SelectItem key={f} value={f}>{FREQ_LABEL[f]}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : <p className="text-sm text-muted-foreground">{editing.type.reminderDays ? "Checked once a day." : "Always sent straight away."}</p>}
                  {form.frequency !== "immediate" && <p className="text-xs text-muted-foreground">Each person gets one email listing everything waiting for them, instead of one email each time.</p>}
                  {editing.type.reminderDays && (
                    <div className="space-y-1.5"><Label htmlFor="days">Remind this many days before (separate with commas)</Label><Input id="days" className="max-w-xs" value={form.reminderDays} onChange={e => setForm({ ...form, reminderDays: e.target.value })} data-testid="input-reminder-days" /></div>
                  )}
                </section>

                <section className="space-y-3">
                  <div className="flex items-center justify-between"><h3 className="font-medium">What it says</h3>
                    <Button variant="ghost" size="sm" onClick={() => setForm({ ...form, subject: editing.type.subject, body: editing.type.body })} data-testid="button-reset-wording"><RotateCcw className="mr-1 h-3.5 w-3.5" />Use the standard wording</Button></div>
                  <div className="space-y-1.5"><Label htmlFor="subject">Subject</Label><Input id="subject" ref={subjectRef} value={form.subject} onFocus={() => { lastField.current = "subject"; }} onChange={e => setForm({ ...form, subject: e.target.value })} data-testid="input-subject" /></div>
                  <div className="space-y-1.5"><Label htmlFor="body">Message</Label><Textarea id="body" ref={bodyRef} rows={9} value={form.body} onFocus={() => { lastField.current = "body"; }} onChange={e => setForm({ ...form, body: e.target.value })} data-testid="input-body" />
                    <p className="text-xs text-muted-foreground">A blank line starts a new paragraph. Click a placeholder below to put it where your cursor is; it is replaced with the real details when the email goes out.</p></div>
                  <div className="flex flex-wrap gap-2" data-testid="placeholder-list">
                    {[{ name: "recipientName", description: "The name of the person receiving the email", example: "" }, ...editing.type.variables].map(v => (
                      <Button key={v.name} variant="outline" size="sm" className="h-auto py-1 text-xs" title={`${v.description}${v.example ? `, for example: ${v.example}` : ""}`} onClick={() => insertPlaceholder(v.name)} data-testid={`placeholder-${v.name}`}>{`{{${v.name}}}`}</Button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => showPreview.mutate()} disabled={showPreview.isPending} data-testid="button-preview">Preview</Button>
                    <Button variant="outline" onClick={() => sendTest.mutate()} disabled={sendTest.isPending} data-testid="button-send-test"><Send className="mr-1 h-3.5 w-3.5" />Send me a test</Button>
                  </div>
                  {preview && (
                    <div className="space-y-1" data-testid="preview-box"><p className="text-sm"><span className="text-muted-foreground">Subject:</span> <strong>{preview.subject}</strong></p>
                      <iframe title="Preview of the email" sandbox="" srcDoc={preview.html} className="h-72 w-full rounded-md border bg-white" /></div>
                  )}
                </section>
              </div>
              <DialogFooter className="gap-2 sm:justify-between">
                <Button variant="ghost" onClick={() => reset.mutate(editing.type.key)} disabled={reset.isPending || !editing.rule.customised} data-testid="button-reset-all">Reset everything to standard</Button>
                <div className="flex gap-2"><Button variant="outline" onClick={close}>Cancel</Button><Button onClick={() => save.mutate()} disabled={save.isPending} data-testid="button-save-notification">{save.isPending ? "Saving..." : "Save"}</Button></div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* view and resend one email from the log */}
      <Dialog open={!!viewing} onOpenChange={o => { if (!o) { setViewing(null); setResendTo(""); } }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" data-testid="dialog-view-email">
          <DialogHeader><DialogTitle>{detail?.subject ?? "Email"}</DialogTitle><DialogDescription>{detail ? `To ${detail.recipientEmail}, ${when(detail.createdAt)}` : "Loading..."}</DialogDescription></DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="flex items-center gap-2"><StatusBadge status={detail.status} />{detail.errorMessage && <span className="text-sm text-muted-foreground">{detail.errorMessage}</span>}</div>
              <iframe title="The email as it was sent" sandbox="" srcDoc={detail.body} className="h-80 w-full rounded-md border bg-white" data-testid="iframe-email-body" />
              <div className="space-y-1.5"><Label htmlFor="resend-to">Send it again to (leave blank for the same address)</Label><Input id="resend-to" type="email" value={resendTo} onChange={e => setResendTo(e.target.value)} placeholder={detail.recipientEmail} data-testid="input-resend-to" /></div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setViewing(null)}>Close</Button><Button disabled={!detail || resend.isPending} onClick={() => detail && resend.mutate({ id: detail.id, to: resendTo.trim() })} data-testid="button-confirm-resend"><Send className="mr-1 h-3.5 w-3.5" />Resend</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

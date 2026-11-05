import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronRight, Download, ScrollText } from "lucide-react";

// Who changed what, and when. Every change made through the system is recorded automatically, along with sign-ins.
// Where the record could be read before and after, the detail shows each field that changed from what to what.

interface Change { field: string; from?: unknown; to?: unknown }
interface AuditEvent {
  id: string; occurredAt: string; actorId: string | null; actorName: string | null; actorRole: string | null; actingAsName: string | null;
  action: string; entityType: string; entityId: string | null; entityLabel: string | null; summary: string; changes: Change[] | null; method: string; path: string;
}
interface Filters { entityTypes: string[]; actions: string[]; actors: { id: string; name: string }[] }

const PAGE = 50;
const ANY = "__any";
const tidy = (s: string) => s.replace(/-/g, " ");
const show = (v: unknown) => (v === null || v === undefined || v === "" ? "(blank)" : typeof v === "object" ? JSON.stringify(v) : String(v));
const when = (d: string) => new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

function ActionBadge({ action }: { action: string }) {
  const tone = action === "create" ? "bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-950 dark:text-green-200"
    : action === "delete" ? "bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-950 dark:text-red-200"
    : action === "sign-in" ? "bg-slate-100 text-slate-800 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200"
    : "bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-200";
  return <Badge className={tone}>{tidy(action)}</Badge>;
}

export default function AuditLog() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [actorId, setActorId] = useState(ANY);
  const [entityType, setEntityType] = useState(ANY);
  const [action, setAction] = useState(ANY);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (actorId !== ANY) params.set("actorId", actorId);
  if (entityType !== ANY) params.set("entityType", entityType);
  if (action !== ANY) params.set("action", action);
  if (q.trim()) params.set("q", q.trim());
  const filterQuery = params.toString();
  const listUrl = `/api/audit-log?${filterQuery}${filterQuery ? "&" : ""}limit=${PAGE}&offset=${page * PAGE}`;

  const { data: options } = useQuery<Filters>({ queryKey: ["/api/audit-log/filters"] });
  const { data, isLoading } = useQuery<{ events: AuditEvent[]; total: number }>({ queryKey: [listUrl] });
  const events = data?.events ?? [];
  const total = data?.total ?? 0;
  const lastPage = Math.max(0, Math.ceil(total / PAGE) - 1);
  const change = (fn: () => void) => { fn(); setPage(0); };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><ScrollText className="h-6 w-6" />Audit log</h1>
        <p className="mt-1 text-muted-foreground">A record of who changed what, and when, across the whole system, including sign-ins. Entries cannot be edited or removed.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Find changes</CardTitle>
          <CardDescription>Narrow the list by date, person, type of record or what was done.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5"><Label htmlFor="audit-from">From</Label><Input id="audit-from" type="date" value={from} onChange={e => change(() => setFrom(e.target.value))} data-testid="input-audit-from" /></div>
            <div className="space-y-1.5"><Label htmlFor="audit-to">To</Label><Input id="audit-to" type="date" value={to} onChange={e => change(() => setTo(e.target.value))} data-testid="input-audit-to" /></div>
            <div className="space-y-1.5"><Label htmlFor="audit-q">Search</Label><Input id="audit-q" placeholder="A name, a record, a word" value={q} onChange={e => change(() => setQ(e.target.value))} data-testid="input-audit-search" /></div>
            <div className="space-y-1.5"><Label>Done by</Label>
              <Select value={actorId} onValueChange={v => change(() => setActorId(v))}>
                <SelectTrigger data-testid="select-audit-actor"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value={ANY}>Anyone</SelectItem>{options?.actors.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1.5"><Label>Type of record</Label>
              <Select value={entityType} onValueChange={v => change(() => setEntityType(v))}>
                <SelectTrigger data-testid="select-audit-type"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value={ANY}>Everything</SelectItem>{options?.entityTypes.map(t => <SelectItem key={t} value={t}>{tidy(t)}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1.5"><Label>What was done</Label>
              <Select value={action} onValueChange={v => change(() => setAction(v))}>
                <SelectTrigger data-testid="select-audit-action"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value={ANY}>Anything</SelectItem>{options?.actions.map(a => <SelectItem key={a} value={a}>{tidy(a)}</SelectItem>)}</SelectContent>
              </Select></div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground" data-testid="text-audit-total">{isLoading ? "Loading..." : `${total.toLocaleString("en-GB")} ${total === 1 ? "entry" : "entries"}`}</p>
            <Button variant="outline" asChild data-testid="button-audit-export"><a href={`/api/audit-log/export?${filterQuery}`}><Download className="mr-2 h-4 w-4" />Download as CSV</a></Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {!isLoading && events.length === 0 ? (
            <p className="p-8 text-center text-muted-foreground" data-testid="text-audit-empty">Nothing recorded for those filters yet.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead className="w-8" /><TableHead>When</TableHead><TableHead>Done by</TableHead><TableHead>What</TableHead><TableHead>Record</TableHead></TableRow></TableHeader>
              <TableBody>
                {events.map(e => {
                  const expanded = !!open[e.id];
                  const changes = e.changes ?? [];
                  return (
                    <Fragment key={e.id}>
                      <TableRow className={changes.length ? "cursor-pointer" : ""} onClick={() => changes.length && setOpen({ ...open, [e.id]: !expanded })} data-testid={`row-audit-${e.id}`}>
                        <TableCell>{changes.length ? (expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : null}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{when(e.occurredAt)}</TableCell>
                        <TableCell className="text-sm">{e.actorName ?? "Unknown"}{e.actingAsName && <span className="block text-xs text-muted-foreground">acting as {e.actingAsName}</span>}</TableCell>
                        <TableCell className="text-sm"><div className="flex flex-wrap items-center gap-2"><ActionBadge action={e.action} /><span>{tidy(e.entityType)}</span></div></TableCell>
                        <TableCell className="text-sm">{e.entityLabel ?? "—"}{changes.length > 0 && <span className="block text-xs text-muted-foreground">{changes.length} {changes.length === 1 ? "field" : "fields"}</span>}</TableCell>
                      </TableRow>
                      {expanded && (
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                          <TableCell />
                          <TableCell colSpan={4}>
                            <p className="mb-2 text-sm">{e.summary}</p>
                            <ul className="space-y-1 text-sm" data-testid={`list-audit-changes-${e.id}`}>
                              {changes.map(c => (
                                <li key={c.field}><span className="font-medium">{c.field}</span>{": "}
                                  {"from" in c ? <><span className="text-muted-foreground line-through">{show(c.from)}</span>{" → "}<span>{show(c.to)}</span></> : <span>{show(c.to)}</span>}
                                </li>
                              ))}
                            </ul>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {total > PAGE && (
        <div className="flex items-center justify-between">
          <Button variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)} data-testid="button-audit-prev">Newer</Button>
          <span className="text-sm text-muted-foreground">Page {page + 1} of {lastPage + 1}</span>
          <Button variant="outline" disabled={page >= lastPage} onClick={() => setPage(page + 1)} data-testid="button-audit-next">Older</Button>
        </div>
      )}
    </div>
  );
}

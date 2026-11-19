import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Lock, RotateCcw } from "lucide-react";
import { ACTIONS, ACTION_LABEL, type Action, type TrainingArea } from "@shared/trainingPermissions";
import { errorText } from "@/components/performance/shared";

interface Matrix {
  areas: TrainingArea[];
  roles: Array<{ key: string; label: string; locked?: boolean }>;
  defaults: Record<string, string[]>;
  overrides: Record<string, Record<string, boolean>>;
  effective: Record<string, string[]>;
}

const LETTER: Record<Action, string> = { view: "V", create: "C", edit: "E", delete: "D", approve: "A" };

// Who may do what in training, for each type of user. The server, the menu and the router all read this table, so what is ticked here is what
// people can actually do. Super administrators always have everything. Ticks that differ from the usual setting are marked.
export default function TrainingPermissionsAdmin() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<Matrix>({ queryKey: ["/api/training-permissions"] });
  const [role, setRole] = useState("training_administrator");
  const [confirmReset, setConfirmReset] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ predicate: q => ["/api/training-permissions", "/api/auth/user"].includes(String(q.queryKey[0])) });
  const save = useMutation({
    mutationFn: async (change: { role: string; area: string; action: string; allowed: boolean }) => (await apiRequest("PUT", "/api/training-permissions", { changes: [change] })).json(),
    onSuccess: () => { refresh(); toast({ title: "Saved", description: "It takes effect straight away." }); },
    onError: (e: any) => toast({ title: "That did not work", description: errorText(e), variant: "destructive" }),
  });
  const reset = useMutation({
    mutationFn: async (r: string) => (await apiRequest("POST", "/api/training-permissions/reset", { role: r })).json(),
    onSuccess: () => { refresh(); setConfirmReset(false); toast({ title: "Put back to the usual settings" }); },
    onError: (e: any) => toast({ title: "That did not work", description: errorText(e), variant: "destructive" }),
  });

  const selected = data?.roles.find(r => r.key === role);
  const held = useMemo(() => new Set(data?.effective[role] ?? []), [data, role]);
  const defaulted = useMemo(() => new Set(data?.defaults[role] ?? []), [data, role]);
  const changedCount = data ? Object.keys(data.overrides[role] ?? {}).length : 0;
  const groups = useMemo(() => Array.from(new Set((data?.areas ?? []).map(a => a.group))), [data]);

  if (isLoading || !data) return <div className="p-6 text-muted-foreground">Loading...</div>;

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6" data-testid="page-training-permissions">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Training Permissions</h1>
        <p className="text-muted-foreground">Choose what each type of user may do in training. What is ticked here is what people can actually do: the menu, the screens and the server all follow it. Changes take effect straight away and are recorded in the Audit Log.</p>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-lg">Who holds what</CardTitle><CardDescription>V view, C create, E edit, D delete, A approve. Choose a user type to change it.</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Training area</TableHead>
                {data.roles.map(r => (
                  <TableHead key={r.key} className="text-center">
                    <button type="button" onClick={() => setRole(r.key)} aria-pressed={role === r.key} data-testid={`role-${r.key}`}
                      className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${role === r.key ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{r.label}</button>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.areas.map(a => (
                <TableRow key={a.key}>
                  <TableCell className="text-sm font-medium">{a.label}</TableCell>
                  {data.roles.map(r => {
                    const keys = (Object.keys(a.actions) as Action[]).filter(act => data.effective[r.key]?.includes(`${a.key}.${act}`));
                    return <TableCell key={r.key} className="text-center font-mono text-xs tracking-wider" data-testid={`cell-${a.key}-${r.key}`}>{keys.length ? keys.map(k => LETTER[k]).join("") : <span className="text-muted-foreground">-</span>}</TableCell>;
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card data-testid="card-role-editor">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">{selected?.label}</CardTitle>
              <CardDescription>
                {selected?.locked ? "Always has every permission, so nobody can lock themselves out. This cannot be changed."
                  : changedCount ? `${changedCount} setting${changedCount === 1 ? "" : "s"} changed from the usual. Changed settings are marked.` : "Using the usual settings."}
              </CardDescription>
            </div>
            {selected?.locked ? <Badge variant="outline" className="gap-1"><Lock className="h-3 w-3" aria-hidden />Locked</Badge>
              : <Button size="sm" variant="outline" disabled={!changedCount || reset.isPending} onClick={() => setConfirmReset(true)} data-testid="button-reset-role"><RotateCcw className="mr-1.5 h-4 w-4" />Put back to the usual settings</Button>}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {groups.map(g => (
            <div key={g}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{g}</h3>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader><TableRow><TableHead>Area</TableHead>{ACTIONS.map(a => <TableHead key={a} className="w-24 text-center">{ACTION_LABEL[a]}</TableHead>)}</TableRow></TableHeader>
                  <TableBody>
                    {data.areas.filter(a => a.group === g).map(a => (
                      <TableRow key={a.key} data-testid={`row-${a.key}`}>
                        <TableCell><div className="text-sm font-medium">{a.label}</div><div className="text-xs text-muted-foreground">{a.description}</div></TableCell>
                        {ACTIONS.map(act => {
                          const meaning = a.actions[act];
                          if (!meaning) return <TableCell key={act} className="text-center text-muted-foreground">-</TableCell>;
                          const key = `${a.key}.${act}`;
                          const on = held.has(key);
                          const changed = on !== defaulted.has(key);
                          return (
                            <TableCell key={act} className="text-center">
                              <div className="inline-flex items-center gap-1.5" title={meaning}>
                                <Checkbox checked={on} disabled={selected?.locked || save.isPending} aria-label={`${ACTION_LABEL[act]}: ${meaning} (${selected?.label})`}
                                  onCheckedChange={v => save.mutate({ role, area: a.key, action: act, allowed: v === true })} data-testid={`perm-${a.key}-${act}`} />
                                {changed && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" title="Changed from the usual setting" aria-label="Changed from the usual setting" data-testid={`changed-${a.key}-${act}`} />}
                              </div>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Reading the lists that booking and request flows need (courses, sessions, providers, venues) stays open to everyone signed in, so people can book and ask for training.
            A manager can always approve a request from their own direct reports; <b>Approve</b> here is for approving anyone's. A person holds a permission if any of their roles has it.
          </p>
        </CardContent>
      </Card>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Put {selected?.label} back to the usual settings?</AlertDialogTitle><AlertDialogDescription>Every change you have made for this user type is removed, and it goes back to what it could do before. This takes effect straight away.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => reset.mutate(role)} data-testid="button-confirm-reset">Put back</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

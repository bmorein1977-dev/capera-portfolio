import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type Key = { id: string; name: string; prefix: string; scopes: string[]; createdAt: string; expiresAt: string | null; lastUsedAt: string | null; revokedAt: string | null };
const when = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "never");

export default function Integrations() {
  const { toast } = useToast();
  const data = useQuery<{ scopes: Record<string, string>; keys: Key[] }>({ queryKey: ["/api/api-keys"], queryFn: () => api("GET", "/api/api-keys") });
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>([]);
  const [expiresOn, setExpiresOn] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const fail = (e: Error) => toast({ title: "Not done", description: e.message, variant: "destructive" });
  const create = useMutation({
    mutationFn: () => api<{ key: string }>("POST", "/api/api-keys", { name, scopes, ...(expiresOn ? { expiresOn } : {}) }),
    onSuccess: (r) => { setFresh(r.key); setName(""); setScopes([]); setExpiresOn(""); queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] }); }, onError: fail,
  });
  const revoke = useMutation({ mutationFn: (id: string) => api("POST", `/api/api-keys/${id}/revoke`), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] }), onError: fail });

  return (
    <div className="space-y-6 p-4 md:p-6" data-testid="page-integrations">
      <div>
        <h1 className="text-2xl font-bold">Integrations</h1>
        <p className="text-muted-foreground">Keys that let your own systems send people from HR, or read competence and training status into reporting tools such as Power BI.{" "}
          <a className="underline" href="/api/v1/openapi.json" target="_blank" rel="noopener noreferrer">Interface description (OpenAPI)</a></p>
      </div>
      {fresh && (
        <Card className="border-primary" data-testid="card-new-key">
          <CardHeader><CardTitle>Copy the new key now</CardTitle><CardDescription>It is shown only this once. Store it in your system's secret store.</CardDescription></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <code className="break-all rounded-md bg-muted p-2 text-sm" data-testid="text-new-key">{fresh}</code>
            <Button variant="outline" onClick={() => { navigator.clipboard?.writeText(fresh); toast({ title: "Copied" }); }}>Copy</Button>
            <Button variant="ghost" onClick={() => setFresh(null)}>Done</Button>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader><CardTitle>New key</CardTitle><CardDescription>Give each system its own key, with only what it needs. A key lasts a year unless you choose another date (two years at most).</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div><Label htmlFor="key-name">System name</Label><Input id="key-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="HR system" data-testid="input-key-name" /></div>
            <div><Label htmlFor="key-expiry">End date (optional)</Label><Input id="key-expiry" type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} /></div>
          </div>
          {Object.entries(data.data?.scopes ?? {}).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={scopes.includes(k)} onChange={(e) => setScopes((s) => (e.target.checked ? [...s, k] : s.filter((x) => x !== k)))} data-testid={`check-scope-${k}`} /><span className="font-mono text-xs">{k}</span> {label}</label>
          ))}
          <Button onClick={() => create.mutate()} disabled={name.trim().length < 3 || !scopes.length || create.isPending} data-testid="button-create-key">Create key</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Keys</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {data.isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : data.error ? <p className="text-sm text-destructive">{(data.error as Error).message}</p> : !data.data!.keys.length ? <p className="text-sm text-muted-foreground">No keys yet.</p> : data.data!.keys.map((k) => {
            const ended = !!k.revokedAt || (!!k.expiresAt && new Date(k.expiresAt).getTime() <= Date.now());
            return (
              <div key={k.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3" data-testid={`row-key-${k.id}`}>
                <div>
                  <p className="font-medium">{k.name} <span className="font-mono text-xs text-muted-foreground">{k.prefix}...</span></p>
                  <p className="text-xs text-muted-foreground">Created {when(k.createdAt)}. Ends {when(k.expiresAt)}. Last used {when(k.lastUsedAt)}.</p>
                  <div className="mt-1 flex flex-wrap gap-1">{k.scopes.map((s) => <Badge key={s} variant="outline">{s}</Badge>)}{k.revokedAt && <Badge variant="destructive">Revoked</Badge>}</div>
                </div>
                {!ended && <Button size="sm" variant="outline" onClick={() => { if (confirm(`Revoke the key for ${k.name}? The system using it will stop working at once.`)) revoke.mutate(k.id); }}>Revoke</Button>}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

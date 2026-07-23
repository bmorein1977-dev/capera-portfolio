import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, ShieldCheck } from "lucide-react";
import type { TrainingCompletionRecord, Training, User } from "@shared/schema";

const METHOD_LABELS: Record<string, string> = {
  content_completed: "Watched to Completion",
  admin_marked: "Marked by Admin",
  self_reported: "Self-Reported",
};
const METHOD_COLORS: Record<string, string> = {
  content_completed: "text-green-600 dark:text-green-400",
  admin_marked: "text-blue-600 dark:text-blue-400",
  self_reported: "text-muted-foreground",
};

function userLabel(u: User) {
  return `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || u.id;
}

export default function TrainingCompletionsReport() {
  const [trainingId, setTrainingId] = useState("");
  const [userId, setUserId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: trainings = [] } = useQuery<Training[]>({ queryKey: ['/api/trainings'] });
  const { data: users = [] } = useQuery<User[]>({ queryKey: ['/api/users'] });

  const buildQuery = () => {
    const params = new URLSearchParams();
    if (trainingId) params.set('trainingId', trainingId);
    if (userId) params.set('userId', userId);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return params.toString();
  };

  const query = buildQuery();
  const { data: records = [], isLoading } = useQuery<TrainingCompletionRecord[]>({
    queryKey: [`/api/reports/training-completions${query ? `?${query}` : ''}`],
  });

  const handleDownload = () => {
    window.open(`/api/reports/training-completions/export${query ? `?${query}` : ''}`, '_blank');
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-training-completions-report">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Training Completions</h1>
        <p className="text-muted-foreground">
          An auditable record of every training completion - who, what, when, and how it was recorded
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="filter-training">Training</Label>
            <Select value={trainingId || 'all'} onValueChange={v => setTrainingId(v === 'all' ? '' : v)}>
              <SelectTrigger id="filter-training" data-testid="select-filter-training"><SelectValue placeholder="All trainings" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All trainings</SelectItem>
                {trainings.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-user">Person</Label>
            <Select value={userId || 'all'} onValueChange={v => setUserId(v === 'all' ? '' : v)}>
              <SelectTrigger id="filter-user" data-testid="select-filter-user"><SelectValue placeholder="Everyone" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone</SelectItem>
                {users.map(u => <SelectItem key={u.id} value={u.id}>{userLabel(u)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-from">From</Label>
            <Input id="filter-from" type="date" value={from} onChange={e => setFrom(e.target.value)} data-testid="input-filter-from" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-to">To</Label>
            <Input id="filter-to" type="date" value={to} onChange={e => setTo(e.target.value)} data-testid="input-filter-to" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Completion Records
            </CardTitle>
            <CardDescription data-testid="text-record-count">
              {isLoading ? 'Loading...' : `${records.length} record${records.length === 1 ? '' : 's'}`}
            </CardDescription>
          </div>
          <Button onClick={handleDownload} data-testid="button-download-csv">
            <Download className="h-4 w-4 mr-2" />
            Download CSV
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : records.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No completions match these filters</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Person</TableHead>
                  <TableHead>Training</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map(r => (
                  <TableRow key={r.id} data-testid={`row-completion-${r.id}`}>
                    <TableCell className="font-medium">
                      {r.userName}
                      <div className="text-xs text-muted-foreground">{r.userEmail}</div>
                    </TableCell>
                    <TableCell>{r.trainingName}</TableCell>
                    <TableCell>{r.categoryName || '—'}</TableCell>
                    <TableCell><span className={METHOD_COLORS[r.method] || ''}>{METHOD_LABELS[r.method] || r.method}</span></TableCell>
                    <TableCell>{new Date(r.completedAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

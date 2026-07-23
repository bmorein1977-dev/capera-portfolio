import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Pencil, Trash2, Target, Users, ListChecks, ShieldAlert } from "lucide-react";
import type {
  WorkforceInitiative, InitiativeRoleRequirement, SuccessionPlan, SuccessionCandidate,
  JobRole, Location, BusinessUnit, User, RoleTransitionPlan,
} from "@shared/schema";

const RISK_LABELS: Record<string, string> = { low: "Low", medium: "Medium", high: "High" };
const RISK_COLORS: Record<string, string> = {
  low: "text-green-600 dark:text-green-400",
  medium: "text-yellow-600 dark:text-yellow-400",
  high: "text-red-600 dark:text-red-400",
};
const READINESS_LABELS: Record<string, string> = {
  ready_now: "Ready Now",
  ready_1_2_years: "Ready in 1-2 Years",
  ready_3_5_years: "Ready in 3-5 Years",
  developing: "Developing",
};
const STATUS_LABELS: Record<string, string> = { planned: "Planned", active: "Active", complete: "Complete", cancelled: "Cancelled" };

function useEntityCrud<T extends { id: string }>(basePath: string, queryKey: any[]) {
  const { toast } = useToast();
  const { data = [], isLoading } = useQuery<T[]>({ queryKey });

  const saveMutation = useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: any }) => {
      return id
        ? apiRequest('PATCH', `${basePath}/${id}`, data)
        : apiRequest('POST', basePath, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Saved" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to save", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('DELETE', `${basePath}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Deactivated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete", variant: "destructive" });
    },
  });

  return { items: data, isLoading, saveMutation, deleteMutation };
}

function userName(u?: User) {
  if (!u) return null;
  return `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || undefined;
}

function RequirementsPanel({ initiative, jobRoles }: { initiative: WorkforceInitiative; jobRoles: JobRole[] }) {
  const basePath = `/api/swp/initiatives/${initiative.id}/requirements`;
  const queryKey = ['/api/swp/initiatives', initiative.id, 'requirements'];
  const { items, isLoading, deleteMutation } = useEntityCrud<InitiativeRoleRequirement>(basePath, queryKey);
  const { toast } = useToast();

  const addMutation = useMutation({
    mutationFn: async (data: any) => apiRequest('POST', basePath, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Requirement added" });
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const [jobRoleId, setJobRoleId] = useState("");
  const [headcount, setHeadcount] = useState("1");
  const [requiredByDate, setRequiredByDate] = useState("");
  const [notes, setNotes] = useState("");

  const jobRoleName = (id: string) => jobRoles.find(r => r.id === id)?.name || "Unknown role";

  const handleAdd = () => {
    if (!jobRoleId) return;
    addMutation.mutate({
      jobRoleId,
      headcountNeeded: parseInt(headcount, 10) || 1,
      requiredByDate: requiredByDate || null,
      notes: notes || null,
    }, {
      onSuccess: () => { setJobRoleId(""); setHeadcount("1"); setRequiredByDate(""); setNotes(""); },
    });
  };

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="text-center py-4 text-muted-foreground text-sm">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-4 text-muted-foreground text-sm">No role requirements yet</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job Role</TableHead>
              <TableHead>Headcount</TableHead>
              <TableHead>Required By</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(req => (
              <TableRow key={req.id} data-testid={`row-requirement-${req.id}`}>
                <TableCell className="font-medium">{jobRoleName(req.jobRoleId)}</TableCell>
                <TableCell>{req.headcountNeeded}</TableCell>
                <TableCell>{req.requiredByDate ? new Date(req.requiredByDate).toLocaleDateString() : '—'}</TableCell>
                <TableCell className="max-w-xs truncate">{req.notes || '—'}</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => deleteMutation.mutate(req.id)} data-testid={`button-delete-requirement-${req.id}`}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <div className="border rounded-md p-4 space-y-3">
        <div className="text-sm font-medium">Add Role Requirement</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Select value={jobRoleId} onValueChange={setJobRoleId}>
            <SelectTrigger data-testid="select-requirement-job-role"><SelectValue placeholder="Job role" /></SelectTrigger>
            <SelectContent>
              {jobRoles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="number" min={1} value={headcount} onChange={e => setHeadcount(e.target.value)} placeholder="Headcount" data-testid="input-requirement-headcount" />
          <Input type="date" value={requiredByDate} onChange={e => setRequiredByDate(e.target.value)} data-testid="input-requirement-date" />
          <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes" data-testid="input-requirement-notes" />
        </div>
        <Button size="sm" onClick={handleAdd} disabled={!jobRoleId || addMutation.isPending} data-testid="button-add-requirement">
          <Plus className="h-3 w-3 mr-2" />
          Add Requirement
        </Button>
      </div>
    </div>
  );
}

function WorkforceInitiativesTab() {
  const { items, isLoading, saveMutation, deleteMutation } = useEntityCrud<WorkforceInitiative>('/api/swp/initiatives', ['/api/swp/initiatives']);
  const { data: locations = [] } = useQuery<Location[]>({ queryKey: ['/api/org/locations'] });
  const { data: businessUnits = [] } = useQuery<BusinessUnit[]>({ queryKey: ['/api/org/business-units'] });
  const { data: jobRoles = [] } = useQuery<JobRole[]>({ queryKey: ['/api/job-roles'] });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WorkforceInitiative | null>(null);
  const [requirementsFor, setRequirementsFor] = useState<WorkforceInitiative | null>(null);
  const [form, setForm] = useState({ name: '', description: '', locationId: '', businessUnitId: '', targetDate: '', status: 'planned' });

  const openDialog = (initiative?: WorkforceInitiative) => {
    setEditing(initiative || null);
    setForm(initiative ? {
      name: initiative.name,
      description: initiative.description || '',
      locationId: initiative.locationId || '',
      businessUnitId: initiative.businessUnitId || '',
      targetDate: initiative.targetDate ? new Date(initiative.targetDate).toISOString().slice(0, 10) : '',
      status: initiative.status || 'planned',
    } : { name: '', description: '', locationId: '', businessUnitId: '', targetDate: '', status: 'planned' });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    const data = {
      name: form.name,
      description: form.description || null,
      locationId: form.locationId || null,
      businessUnitId: form.businessUnitId || null,
      targetDate: form.targetDate || null,
      status: form.status,
    };
    saveMutation.mutate({ id: editing?.id, data }, { onSuccess: () => setIsDialogOpen(false) });
  };

  const locationName = (id?: string | null) => locations.find(l => l.id === id)?.name || '—';
  const businessUnitName = (id?: string | null) => businessUnits.find(b => b.id === id)?.name || '—';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Workforce Initiatives</CardTitle>
          <CardDescription>Future projects and programs that will need new or vacant headcount filled</CardDescription>
        </div>
        <Button onClick={() => openDialog()} data-testid="button-add-initiative">
          <Plus className="h-4 w-4 mr-2" />
          Add Initiative
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No workforce initiatives yet</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Business Unit</TableHead>
                <TableHead>Target Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(initiative => (
                <TableRow key={initiative.id} data-testid={`row-initiative-${initiative.id}`}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2"><Target className="h-4 w-4 text-muted-foreground" />{initiative.name}</div>
                  </TableCell>
                  <TableCell>{locationName(initiative.locationId)}</TableCell>
                  <TableCell>{businessUnitName(initiative.businessUnitId)}</TableCell>
                  <TableCell>{initiative.targetDate ? new Date(initiative.targetDate).toLocaleDateString() : '—'}</TableCell>
                  <TableCell><Badge variant="outline">{STATUS_LABELS[initiative.status || 'planned']}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setRequirementsFor(initiative)} data-testid={`button-requirements-${initiative.id}`}>
                        <ListChecks className="h-3 w-3 mr-1" /> Requirements
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openDialog(initiative)} data-testid={`button-edit-initiative-${initiative.id}`}><Pencil className="h-3 w-3" /></Button>
                      <Button variant="outline" size="sm" onClick={() => { if (confirm("Deactivate this initiative?")) deleteMutation.mutate(initiative.id); }} data-testid={`button-delete-initiative-${initiative.id}`}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent data-testid="dialog-initiative-form">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Initiative" : "Add Initiative"}</DialogTitle>
            <DialogDescription>A future project or program that will drive new headcount demand</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="initiative-name">Name *</Label>
              <Input id="initiative-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g., New Platform Commissioning" data-testid="input-initiative-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="initiative-description">Description</Label>
              <Textarea id="initiative-description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} data-testid="input-initiative-description" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="initiative-location">Location</Label>
                <Select value={form.locationId || 'none'} onValueChange={v => setForm({ ...form, locationId: v === 'none' ? '' : v })}>
                  <SelectTrigger id="initiative-location" data-testid="select-initiative-location"><SelectValue placeholder="Any" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Any</SelectItem>
                    {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="initiative-bu">Business Unit</Label>
                <Select value={form.businessUnitId || 'none'} onValueChange={v => setForm({ ...form, businessUnitId: v === 'none' ? '' : v })}>
                  <SelectTrigger id="initiative-bu" data-testid="select-initiative-business-unit"><SelectValue placeholder="Any" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Any</SelectItem>
                    {businessUnits.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="initiative-date">Target Date</Label>
                <Input id="initiative-date" type="date" value={form.targetDate} onChange={e => setForm({ ...form, targetDate: e.target.value })} data-testid="input-initiative-date" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="initiative-status">Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger id="initiative-status" data-testid="select-initiative-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saveMutation.isPending} data-testid="button-save-initiative">
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!requirementsFor} onOpenChange={open => !open && setRequirementsFor(null)}>
        <DialogContent className="max-w-3xl" data-testid="dialog-requirements">
          <DialogHeader>
            <DialogTitle>Role Requirements - {requirementsFor?.name}</DialogTitle>
            <DialogDescription>Headcount this initiative needs, by job role</DialogDescription>
          </DialogHeader>
          {requirementsFor && <RequirementsPanel initiative={requirementsFor} jobRoles={jobRoles} />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function CandidateReadiness({ candidateUserId, jobRoleId }: { candidateUserId: string; jobRoleId: string }) {
  const { data: plan, isLoading } = useQuery<RoleTransitionPlan>({
    queryKey: ['/api/users', candidateUserId, 'role-transition', jobRoleId],
    enabled: !!candidateUserId && !!jobRoleId,
  });

  if (isLoading) return <span className="text-xs text-muted-foreground">Loading...</span>;
  if (!plan) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className="text-xs text-muted-foreground" data-testid={`text-candidate-coverage-${candidateUserId}`}>
      {plan.statistics.coveragePercentage}% competency match
    </span>
  );
}

function CandidatesPanel({ plan, users }: { plan: SuccessionPlan; users: User[] }) {
  const basePath = `/api/swp/succession-plans/${plan.id}/candidates`;
  const queryKey = ['/api/swp/succession-plans', plan.id, 'candidates'];
  const { items, isLoading, deleteMutation } = useEntityCrud<SuccessionCandidate>(basePath, queryKey);
  const { toast } = useToast();

  const addMutation = useMutation({
    mutationFn: async (data: any) => apiRequest('POST', basePath, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Candidate added" });
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const [candidateUserId, setCandidateUserId] = useState("");
  const [readiness, setReadiness] = useState("developing");
  const [rank, setRank] = useState("1");
  const [notes, setNotes] = useState("");

  const availableUsers = users.filter(u => u.id !== plan.incumbentUserId && !items.some(i => i.candidateUserId === u.id));

  const handleAdd = () => {
    if (!candidateUserId) return;
    addMutation.mutate({
      candidateUserId,
      readiness,
      rank: parseInt(rank, 10) || 1,
      notes: notes || null,
    }, {
      onSuccess: () => { setCandidateUserId(""); setReadiness("developing"); setRank("1"); setNotes(""); },
    });
  };

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="text-center py-4 text-muted-foreground text-sm">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-4 text-muted-foreground text-sm">No successors nominated yet</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rank</TableHead>
              <TableHead>Candidate</TableHead>
              <TableHead>Readiness</TableHead>
              <TableHead>Competency Match</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...items].sort((a, b) => (a.rank ?? 1) - (b.rank ?? 1)).map(candidate => (
              <TableRow key={candidate.id} data-testid={`row-candidate-${candidate.id}`}>
                <TableCell>{candidate.rank}</TableCell>
                <TableCell className="font-medium">{userName(users.find(u => u.id === candidate.candidateUserId)) || 'Unknown'}</TableCell>
                <TableCell><Badge variant="outline">{READINESS_LABELS[candidate.readiness || 'developing']}</Badge></TableCell>
                <TableCell><CandidateReadiness candidateUserId={candidate.candidateUserId} jobRoleId={plan.jobRoleId} /></TableCell>
                <TableCell className="max-w-xs truncate">{candidate.notes || '—'}</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => deleteMutation.mutate(candidate.id)} data-testid={`button-delete-candidate-${candidate.id}`}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <div className="border rounded-md p-4 space-y-3">
        <div className="text-sm font-medium">Nominate Successor</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Select value={candidateUserId} onValueChange={setCandidateUserId}>
            <SelectTrigger data-testid="select-candidate-user"><SelectValue placeholder="Candidate" /></SelectTrigger>
            <SelectContent>
              {availableUsers.map(u => <SelectItem key={u.id} value={u.id}>{userName(u)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={readiness} onValueChange={setReadiness}>
            <SelectTrigger data-testid="select-candidate-readiness"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(READINESS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="number" min={1} value={rank} onChange={e => setRank(e.target.value)} placeholder="Rank" data-testid="input-candidate-rank" />
          <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes" data-testid="input-candidate-notes" />
        </div>
        <Button size="sm" onClick={handleAdd} disabled={!candidateUserId || addMutation.isPending} data-testid="button-add-candidate">
          <Plus className="h-3 w-3 mr-2" />
          Nominate Successor
        </Button>
      </div>
    </div>
  );
}

function SuccessionPlansTab() {
  const { items, isLoading, saveMutation, deleteMutation } = useEntityCrud<SuccessionPlan>('/api/swp/succession-plans', ['/api/swp/succession-plans']);
  const { data: jobRoles = [] } = useQuery<JobRole[]>({ queryKey: ['/api/job-roles'] });
  const { data: users = [] } = useQuery<User[]>({ queryKey: ['/api/users'] });
  const { toast } = useToast();

  const roleUpdateMutation = useMutation({
    mutationFn: async ({ id, successionCritical }: { id: string; successionCritical: boolean }) =>
      apiRequest('PATCH', `/api/job-roles/${id}`, { successionCritical }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/job-roles'] }),
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SuccessionPlan | null>(null);
  const [candidatesFor, setCandidatesFor] = useState<SuccessionPlan | null>(null);
  const [form, setForm] = useState({ jobRoleId: '', incumbentUserId: '', riskLevel: 'medium', notes: '', markCritical: true });

  const openDialog = (plan?: SuccessionPlan) => {
    setEditing(plan || null);
    const role = plan ? jobRoles.find(r => r.id === plan.jobRoleId) : undefined;
    setForm(plan ? {
      jobRoleId: plan.jobRoleId,
      incumbentUserId: plan.incumbentUserId || '',
      riskLevel: plan.riskLevel || 'medium',
      notes: plan.notes || '',
      markCritical: role?.successionCritical ?? true,
    } : { jobRoleId: '', incumbentUserId: '', riskLevel: 'medium', notes: '', markCritical: true });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.jobRoleId) return;
    const data = {
      jobRoleId: form.jobRoleId,
      incumbentUserId: form.incumbentUserId || null,
      riskLevel: form.riskLevel,
      notes: form.notes || null,
    };
    saveMutation.mutate({ id: editing?.id, data }, {
      onSuccess: () => {
        roleUpdateMutation.mutate({ id: form.jobRoleId, successionCritical: form.markCritical });
        setIsDialogOpen(false);
      },
    });
  };

  const jobRoleName = (id: string) => jobRoles.find(r => r.id === id)?.name || 'Unknown role';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Succession Plans</CardTitle>
          <CardDescription>Track successors for critical roles and how ready each candidate is</CardDescription>
        </div>
        <Button onClick={() => openDialog()} data-testid="button-add-succession-plan">
          <Plus className="h-4 w-4 mr-2" />
          Add Succession Plan
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No succession plans yet</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job Role</TableHead>
                <TableHead>Incumbent</TableHead>
                <TableHead>Risk Level</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(plan => (
                <TableRow key={plan.id} data-testid={`row-succession-plan-${plan.id}`}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-muted-foreground" />{jobRoleName(plan.jobRoleId)}</div>
                  </TableCell>
                  <TableCell>{userName(users.find(u => u.id === plan.incumbentUserId)) || 'Vacant'}</TableCell>
                  <TableCell><span className={RISK_COLORS[plan.riskLevel || 'medium']}>{RISK_LABELS[plan.riskLevel || 'medium']}</span></TableCell>
                  <TableCell className="max-w-xs truncate">{plan.notes || '—'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setCandidatesFor(plan)} data-testid={`button-candidates-${plan.id}`}>
                        <Users className="h-3 w-3 mr-1" /> Successors
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openDialog(plan)} data-testid={`button-edit-succession-plan-${plan.id}`}><Pencil className="h-3 w-3" /></Button>
                      <Button variant="outline" size="sm" onClick={() => { if (confirm("Deactivate this succession plan?")) deleteMutation.mutate(plan.id); }} data-testid={`button-delete-succession-plan-${plan.id}`}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent data-testid="dialog-succession-plan-form">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Succession Plan" : "Add Succession Plan"}</DialogTitle>
            <DialogDescription>One plan per critical role - who holds it today, and the risk of it becoming vacant</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="plan-role">Job Role *</Label>
              <Select value={form.jobRoleId} onValueChange={v => setForm({ ...form, jobRoleId: v })} disabled={!!editing}>
                <SelectTrigger id="plan-role" data-testid="select-plan-job-role"><SelectValue placeholder="Select a role" /></SelectTrigger>
                <SelectContent>
                  {jobRoles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-incumbent">Incumbent</Label>
              <Select value={form.incumbentUserId || 'none'} onValueChange={v => setForm({ ...form, incumbentUserId: v === 'none' ? '' : v })}>
                <SelectTrigger id="plan-incumbent" data-testid="select-plan-incumbent"><SelectValue placeholder="Vacant" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Vacant</SelectItem>
                  {users.map(u => <SelectItem key={u.id} value={u.id}>{userName(u)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-risk">Risk Level</Label>
              <Select value={form.riskLevel} onValueChange={v => setForm({ ...form, riskLevel: v })}>
                <SelectTrigger id="plan-risk" data-testid="select-plan-risk"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(RISK_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-notes">Notes</Label>
              <Textarea id="plan-notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} data-testid="input-plan-notes" />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="plan-critical" checked={form.markCritical} onCheckedChange={checked => setForm({ ...form, markCritical: !!checked })} data-testid="checkbox-plan-critical" />
              <Label htmlFor="plan-critical" className="font-normal">Mark this job role as succession-critical</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saveMutation.isPending} data-testid="button-save-succession-plan">
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!candidatesFor} onOpenChange={open => !open && setCandidatesFor(null)}>
        <DialogContent className="max-w-3xl" data-testid="dialog-candidates">
          <DialogHeader>
            <DialogTitle>Successors - {candidatesFor ? jobRoleName(candidatesFor.jobRoleId) : ''}</DialogTitle>
            <DialogDescription>Nominated successors, ranked, with their live competency match against this role</DialogDescription>
          </DialogHeader>
          {candidatesFor && <CandidatesPanel plan={candidatesFor} users={users} />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function StrategicWorkforcePlanning() {
  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-strategic-workforce-planning">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Strategic Workforce Planning</h1>
        <p className="text-muted-foreground">Plan future headcount demand from upcoming initiatives, and track successors for critical roles</p>
      </div>

      <Tabs defaultValue="initiatives">
        <TabsList>
          <TabsTrigger value="initiatives" data-testid="tab-initiatives">Workforce Initiatives</TabsTrigger>
          <TabsTrigger value="succession" data-testid="tab-succession">Succession Planning</TabsTrigger>
        </TabsList>
        <TabsContent value="initiatives" className="mt-4">
          <WorkforceInitiativesTab />
        </TabsContent>
        <TabsContent value="succession" className="mt-4">
          <SuccessionPlansTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

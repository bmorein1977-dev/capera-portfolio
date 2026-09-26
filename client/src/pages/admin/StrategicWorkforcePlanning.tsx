import { useState, useMemo } from "react";
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
import { UserCombobox } from "@/components/UserCombobox";
import { Plus, Pencil, Trash2, Target, Users, ListChecks, ShieldAlert } from "lucide-react";
import type {
  WorkforceInitiative, InitiativeRoleRequirement, SuccessionPlan, SuccessionCandidate,
  JobRole, Location, BusinessUnit, User, RoleTransitionPlan,
  Skill, UserSkill, JobRoleSkill,
} from "@shared/schema";

const PROFICIENCY_LABELS: Record<string, string> = {
  beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced", expert: "Expert",
};
const SKILL_SOURCE_LABELS: Record<string, string> = {
  self_reported: "Self-Reported", manager_assessed: "Manager-Assessed", verified: "Verified",
};

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

function formatDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d.toLocaleDateString();
}

function EditCandidateDialog({ candidate, onClose, onSave, isSaving }: {
  candidate: SuccessionCandidate;
  onClose: () => void;
  onSave: (data: any) => void;
  isSaving: boolean;
}) {
  const [readiness, setReadiness] = useState(candidate.readiness || "developing");
  const [rank, setRank] = useState(String(candidate.rank ?? 1));
  const [notes, setNotes] = useState(candidate.notes || "");
  const [devPlanDescription, setDevPlanDescription] = useState(candidate.developmentPlanDescription || "");
  const [devPlanDueDate, setDevPlanDueDate] = useState(
    candidate.developmentPlanDueDate ? new Date(candidate.developmentPlanDueDate).toISOString().split('T')[0] : ""
  );

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent data-testid="dialog-edit-candidate">
        <DialogHeader>
          <DialogTitle>Edit Successor</DialogTitle>
          <DialogDescription>
            EI PSM KPI 3.4b counts a successor toward "succession depth" only once they have a time-bound development plan here.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Readiness</Label>
              <Select value={readiness} onValueChange={setReadiness}>
                <SelectTrigger data-testid="select-edit-candidate-readiness"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(READINESS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Rank</Label>
              <Input type="number" min={1} value={rank} onChange={e => setRank(e.target.value)} data-testid="input-edit-candidate-rank" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} data-testid="input-edit-candidate-notes" />
          </div>
          <div className="space-y-2 border-t pt-4">
            <Label>Development Plan</Label>
            <Textarea
              value={devPlanDescription}
              onChange={e => setDevPlanDescription(e.target.value)}
              placeholder="What this successor needs to develop, and how"
              data-testid="input-candidate-dev-plan-description"
            />
          </div>
          <div className="space-y-2">
            <Label>Development Plan Due Date</Label>
            <Input
              type="date"
              value={devPlanDueDate}
              onChange={e => setDevPlanDueDate(e.target.value)}
              data-testid="input-candidate-dev-plan-due-date"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => onSave({
              readiness,
              rank: parseInt(rank, 10) || 1,
              notes: notes || null,
              developmentPlanDescription: devPlanDescription || null,
              developmentPlanDueDate: devPlanDueDate ? new Date(devPlanDueDate).toISOString() : null,
            })}
            disabled={isSaving}
            data-testid="button-save-candidate"
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CandidatesPanel({ plan, users }: { plan: SuccessionPlan; users: User[] }) {
  const basePath = `/api/swp/succession-plans/${plan.id}/candidates`;
  const queryKey = ['/api/swp/succession-plans', plan.id, 'candidates'];
  const { items, isLoading, saveMutation, deleteMutation } = useEntityCrud<SuccessionCandidate>(basePath, queryKey);
  const { toast } = useToast();
  const [editingCandidate, setEditingCandidate] = useState<SuccessionCandidate | null>(null);

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
              <TableHead>Dev Plan Due</TableHead>
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
                <TableCell>
                  {candidate.developmentPlanDueDate ? (
                    <span data-testid={`text-dev-plan-due-${candidate.id}`}>{formatDate(candidate.developmentPlanDueDate)}</span>
                  ) : (
                    <span className="text-muted-foreground text-xs">Not set</span>
                  )}
                </TableCell>
                <TableCell className="max-w-xs truncate">{candidate.notes || '—'}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditingCandidate(candidate)} data-testid={`button-edit-candidate-${candidate.id}`}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => deleteMutation.mutate(candidate.id)} data-testid={`button-delete-candidate-${candidate.id}`}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {editingCandidate && (
        <EditCandidateDialog
          candidate={editingCandidate}
          onClose={() => setEditingCandidate(null)}
          isSaving={saveMutation.isPending}
          onSave={(data) => saveMutation.mutate({ id: editingCandidate.id, data }, { onSuccess: () => setEditingCandidate(null) })}
        />
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

function SkillsCatalogTab() {
  const { items: skillList, isLoading, saveMutation, deleteMutation } = useEntityCrud<Skill>('/api/skills', ['/api/skills']);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Skill | null>(null);
  const [form, setForm] = useState({ name: '', category: '', description: '' });

  const openDialog = (skill?: Skill) => {
    setEditing(skill || null);
    setForm(skill ? { name: skill.name, category: skill.category || '', description: skill.description || '' } : { name: '', category: '', description: '' });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    saveMutation.mutate(
      { id: editing?.id, data: { name: form.name, category: form.category || null, description: form.description || null } },
      { onSuccess: () => setIsDialogOpen(false) }
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Skills Catalog</CardTitle>
          <CardDescription>The master list of skills tracked across the organisation</CardDescription>
        </div>
        <Button onClick={() => openDialog()} data-testid="button-add-skill">
          <Plus className="h-4 w-4 mr-2" />
          Add Skill
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : skillList.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No skills defined yet</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {skillList.map(skill => (
                <TableRow key={skill.id} data-testid={`row-skill-${skill.id}`}>
                  <TableCell className="font-medium">{skill.name}</TableCell>
                  <TableCell>{skill.category ? <Badge variant="outline">{skill.category}</Badge> : '—'}</TableCell>
                  <TableCell className="text-muted-foreground max-w-md truncate">{skill.description || '—'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openDialog(skill)} data-testid={`button-edit-skill-${skill.id}`}><Pencil className="h-3 w-3" /></Button>
                      <Button variant="outline" size="sm" onClick={() => { if (confirm("Deactivate this skill?")) deleteMutation.mutate(skill.id); }} data-testid={`button-delete-skill-${skill.id}`}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent data-testid="dialog-skill-form">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Skill" : "Add Skill"}</DialogTitle>
            <DialogDescription>A named capability people can be assigned, at a proficiency level</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="skill-name">Name *</Label>
              <Input id="skill-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g., Python Programming" data-testid="input-skill-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="skill-category">Category</Label>
              <Input id="skill-category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="e.g., Technical, Business, Leadership, Language" data-testid="input-skill-category" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="skill-description">Description</Label>
              <Textarea id="skill-description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} data-testid="input-skill-description" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!form.name.trim() || saveMutation.isPending} data-testid="button-save-skill">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function UserSkillsTab({ skillList, users }: { skillList: Skill[]; users: User[] }) {
  const { items, isLoading, saveMutation, deleteMutation } = useEntityCrud<UserSkill>('/api/user-skills', ['/api/user-skills']);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<UserSkill | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [skillId, setSkillId] = useState('');
  const [proficiency, setProficiency] = useState('intermediate');
  const [yearsExperience, setYearsExperience] = useState('');
  const [source, setSource] = useState('self_reported');
  const [notes, setNotes] = useState('');

  const userOptions = useMemo(() =>
    [...users].filter(u => !u.isArchived)
      .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))
      .map(u => ({ id: u.id, label: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || 'Unknown' })),
    [users]
  );
  const userName = (id: string) => userOptions.find(u => u.id === id)?.label || 'Unknown';
  const skillName = (id: string) => skillList.find(s => s.id === id)?.name || 'Unknown';

  const openDialog = (row?: UserSkill) => {
    setEditing(row || null);
    if (row) {
      setUserId(row.userId);
      setSkillId(row.skillId);
      setProficiency(row.proficiency || 'intermediate');
      setYearsExperience(row.yearsExperience != null ? row.yearsExperience.toString() : '');
      setSource(row.source || 'self_reported');
      setNotes(row.notes || '');
    } else {
      setUserId(null);
      setSkillId('');
      setProficiency('intermediate');
      setYearsExperience('');
      setSource('self_reported');
      setNotes('');
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!userId || !skillId) return;
    saveMutation.mutate(
      { id: editing?.id, data: { userId, skillId, proficiency, yearsExperience: yearsExperience ? parseInt(yearsExperience, 10) : null, source, notes: notes || null } },
      { onSuccess: () => setIsDialogOpen(false) }
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Skills by Person</CardTitle>
          <CardDescription>Each person's declared or assessed skills and proficiency level</CardDescription>
        </div>
        <Button onClick={() => openDialog()} disabled={skillList.length === 0} data-testid="button-add-user-skill">
          <Plus className="h-4 w-4 mr-2" />
          Assign Skill
        </Button>
      </CardHeader>
      <CardContent>
        {skillList.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">Add a skill to the catalog first</div>
        ) : isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No skills assigned yet</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead>Skill</TableHead>
                <TableHead>Proficiency</TableHead>
                <TableHead>Experience</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(row => (
                <TableRow key={row.id} data-testid={`row-user-skill-${row.id}`}>
                  <TableCell className="font-medium">{userName(row.userId)}</TableCell>
                  <TableCell>{skillName(row.skillId)}</TableCell>
                  <TableCell><Badge variant="outline">{PROFICIENCY_LABELS[row.proficiency || 'intermediate']}</Badge></TableCell>
                  <TableCell>{row.yearsExperience != null ? `${row.yearsExperience} yr${row.yearsExperience === 1 ? '' : 's'}` : '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{SKILL_SOURCE_LABELS[row.source || 'self_reported']}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openDialog(row)} data-testid={`button-edit-user-skill-${row.id}`}><Pencil className="h-3 w-3" /></Button>
                      <Button variant="outline" size="sm" onClick={() => { if (confirm("Remove this skill assignment?")) deleteMutation.mutate(row.id); }} data-testid={`button-delete-user-skill-${row.id}`}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent data-testid="dialog-user-skill-form">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Skill Assignment" : "Assign Skill"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Person *</Label>
              <UserCombobox testId="user-skill-person" options={userOptions} value={userId} onChange={setUserId} placeholder="Search for a person..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-skill-skill">Skill *</Label>
              <Select value={skillId} onValueChange={setSkillId}>
                <SelectTrigger id="user-skill-skill" data-testid="select-user-skill-skill"><SelectValue placeholder="Choose a skill" /></SelectTrigger>
                <SelectContent>{skillList.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="user-skill-proficiency">Proficiency</Label>
                <Select value={proficiency} onValueChange={setProficiency}>
                  <SelectTrigger id="user-skill-proficiency" data-testid="select-user-skill-proficiency"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(PROFICIENCY_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-skill-years">Years Experience</Label>
                <Input id="user-skill-years" type="number" min="0" value={yearsExperience} onChange={e => setYearsExperience(e.target.value)} data-testid="input-user-skill-years" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-skill-source">Source</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger id="user-skill-source" data-testid="select-user-skill-source"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(SKILL_SOURCE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-skill-notes">Notes</Label>
              <Textarea id="user-skill-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} data-testid="input-user-skill-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!userId || !skillId || saveMutation.isPending} data-testid="button-save-user-skill">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function RoleSkillsTab({ skillList, jobRoles }: { skillList: Skill[]; jobRoles: JobRole[] }) {
  const { items, isLoading, saveMutation, deleteMutation } = useEntityCrud<JobRoleSkill>('/api/job-role-skills', ['/api/job-role-skills']);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<JobRoleSkill | null>(null);
  const [jobRoleId, setJobRoleId] = useState('');
  const [skillId, setSkillId] = useState('');
  const [requiredProficiency, setRequiredProficiency] = useState('intermediate');

  const roleName = (id: string) => jobRoles.find(r => r.id === id)?.name || 'Unknown role';
  const skillName = (id: string) => skillList.find(s => s.id === id)?.name || 'Unknown';

  const openDialog = (row?: JobRoleSkill) => {
    setEditing(row || null);
    setJobRoleId(row?.jobRoleId || '');
    setSkillId(row?.skillId || '');
    setRequiredProficiency(row?.requiredProficiency || 'intermediate');
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!jobRoleId || !skillId) return;
    saveMutation.mutate({ id: editing?.id, data: { jobRoleId, skillId, requiredProficiency } }, { onSuccess: () => setIsDialogOpen(false) });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Skills by Role</CardTitle>
          <CardDescription>Which skills each job role is expected to require, for future gap-analysis and staffing matches</CardDescription>
        </div>
        <Button onClick={() => openDialog()} disabled={skillList.length === 0} data-testid="button-add-role-skill">
          <Plus className="h-4 w-4 mr-2" />
          Add Requirement
        </Button>
      </CardHeader>
      <CardContent>
        {skillList.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">Add a skill to the catalog first</div>
        ) : isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No role requirements yet</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job Role</TableHead>
                <TableHead>Skill</TableHead>
                <TableHead>Required Proficiency</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(row => (
                <TableRow key={row.id} data-testid={`row-role-skill-${row.id}`}>
                  <TableCell className="font-medium">{roleName(row.jobRoleId)}</TableCell>
                  <TableCell>{skillName(row.skillId)}</TableCell>
                  <TableCell><Badge variant="outline">{PROFICIENCY_LABELS[row.requiredProficiency || 'intermediate']}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openDialog(row)} data-testid={`button-edit-role-skill-${row.id}`}><Pencil className="h-3 w-3" /></Button>
                      <Button variant="outline" size="sm" onClick={() => { if (confirm("Remove this requirement?")) deleteMutation.mutate(row.id); }} data-testid={`button-delete-role-skill-${row.id}`}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent data-testid="dialog-role-skill-form">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Requirement" : "Add Requirement"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="role-skill-role">Job Role *</Label>
              <Select value={jobRoleId} onValueChange={setJobRoleId}>
                <SelectTrigger id="role-skill-role" data-testid="select-role-skill-role"><SelectValue placeholder="Choose a role" /></SelectTrigger>
                <SelectContent>{jobRoles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-skill-skill">Skill *</Label>
              <Select value={skillId} onValueChange={setSkillId}>
                <SelectTrigger id="role-skill-skill" data-testid="select-role-skill-skill"><SelectValue placeholder="Choose a skill" /></SelectTrigger>
                <SelectContent>{skillList.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-skill-proficiency">Required Proficiency</Label>
              <Select value={requiredProficiency} onValueChange={setRequiredProficiency}>
                <SelectTrigger id="role-skill-proficiency" data-testid="select-role-skill-proficiency"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(PROFICIENCY_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!jobRoleId || !skillId || saveMutation.isPending} data-testid="button-save-role-skill">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function SkillsInventoryTab() {
  const { data: skillList = [] } = useQuery<Skill[]>({ queryKey: ['/api/skills'] });
  const { data: users = [] } = useQuery<User[]>({ queryKey: ['/api/users'] });
  const { data: jobRoles = [] } = useQuery<JobRole[]>({ queryKey: ['/api/job-roles'] });

  return (
    <Tabs defaultValue="catalog">
      <TabsList>
        <TabsTrigger value="catalog" data-testid="tab-skills-catalog">Catalog</TabsTrigger>
        <TabsTrigger value="by-person" data-testid="tab-skills-by-person">By Person</TabsTrigger>
        <TabsTrigger value="by-role" data-testid="tab-skills-by-role">By Role</TabsTrigger>
      </TabsList>
      <TabsContent value="catalog" className="mt-4"><SkillsCatalogTab /></TabsContent>
      <TabsContent value="by-person" className="mt-4"><UserSkillsTab skillList={skillList} users={users} /></TabsContent>
      <TabsContent value="by-role" className="mt-4"><RoleSkillsTab skillList={skillList} jobRoles={jobRoles} /></TabsContent>
    </Tabs>
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
          <TabsTrigger value="skills" data-testid="tab-skills-inventory">Skills Inventory</TabsTrigger>
        </TabsList>
        <TabsContent value="initiatives" className="mt-4">
          <WorkforceInitiativesTab />
        </TabsContent>
        <TabsContent value="succession" className="mt-4">
          <SuccessionPlansTab />
        </TabsContent>
        <TabsContent value="skills" className="mt-4">
          <SkillsInventoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

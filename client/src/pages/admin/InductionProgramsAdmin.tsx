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
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Pencil, Trash2, ListChecks, ClipboardList, UserPlus } from "lucide-react";
import type {
  InductionProgram, InductionTask, OnboardingAssignment, OnboardingChecklist,
  JobFamily, JobRole, Training, User,
} from "@shared/schema";

const CATEGORY_LABELS: Record<string, string> = {
  administrative: "Administrative",
  safety: "Safety",
  training: "Training",
  social: "Social",
  general: "General",
};
const STATUS_LABELS: Record<string, string> = { in_progress: "In Progress", complete: "Complete", overdue: "Overdue", cancelled: "Cancelled" };
const STATUS_COLORS: Record<string, string> = {
  in_progress: "text-yellow-600 dark:text-yellow-400",
  complete: "text-green-600 dark:text-green-400",
  overdue: "text-red-600 dark:text-red-400",
  cancelled: "text-muted-foreground",
};

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

function TasksPanel({ program, trainings }: { program: InductionProgram; trainings: Training[] }) {
  const basePath = `/api/onboarding/programs/${program.id}/tasks`;
  const queryKey = ['/api/onboarding/programs', program.id, 'tasks'];
  const { items, isLoading, saveMutation, deleteMutation } = useEntityCrud<InductionTask>(basePath, queryKey);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<InductionTask | null>(null);
  const [form, setForm] = useState({
    name: '', description: '', category: 'general', order: '0', required: true,
    dueOffsetDays: '', linkedTrainingId: '',
  });

  const openDialog = (task?: InductionTask) => {
    setEditing(task || null);
    setForm(task ? {
      name: task.name,
      description: task.description || '',
      category: task.category || 'general',
      order: String(task.order ?? 0),
      required: task.required ?? true,
      dueOffsetDays: task.dueOffsetDays != null ? String(task.dueOffsetDays) : '',
      linkedTrainingId: task.linkedTrainingId || '',
    } : { name: '', description: '', category: 'general', order: String(items.length), required: true, dueOffsetDays: '', linkedTrainingId: '' });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    const data = {
      name: form.name,
      description: form.description || null,
      category: form.category,
      order: parseInt(form.order, 10) || 0,
      required: form.required,
      dueOffsetDays: form.dueOffsetDays ? parseInt(form.dueOffsetDays, 10) : null,
      linkedTrainingId: form.linkedTrainingId || null,
    };
    saveMutation.mutate({ id: editing?.id, data }, { onSuccess: () => setIsDialogOpen(false) });
  };

  const trainingName = (id?: string | null) => trainings.find(t => t.id === id)?.name;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => openDialog()} data-testid="button-add-task">
          <Plus className="h-3 w-3 mr-2" />
          Add Task
        </Button>
      </div>
      {isLoading ? (
        <div className="text-center py-4 text-muted-foreground text-sm">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-4 text-muted-foreground text-sm">No tasks yet</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Required</TableHead>
              <TableHead>Due (days)</TableHead>
              <TableHead>Linked Training</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(task => (
              <TableRow key={task.id} data-testid={`row-task-${task.id}`}>
                <TableCell>{task.order}</TableCell>
                <TableCell className="font-medium">{task.name}</TableCell>
                <TableCell><Badge variant="outline">{CATEGORY_LABELS[task.category || 'general']}</Badge></TableCell>
                <TableCell>{task.required ? 'Yes' : 'No'}</TableCell>
                <TableCell>{task.dueOffsetDays ?? '—'}</TableCell>
                <TableCell>{trainingName(task.linkedTrainingId) || '—'}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => openDialog(task)} data-testid={`button-edit-task-${task.id}`}><Pencil className="h-3 w-3" /></Button>
                    <Button variant="outline" size="sm" onClick={() => deleteMutation.mutate(task.id)} data-testid={`button-delete-task-${task.id}`}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent data-testid="dialog-task-form">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Task" : "Add Task"}</DialogTitle>
            <DialogDescription>A single step within this induction program</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task-name">Name *</Label>
              <Input id="task-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g., Site Safety Induction" data-testid="input-task-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-description">Description</Label>
              <Textarea id="task-description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} data-testid="input-task-description" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="task-category">Category</Label>
                <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                  <SelectTrigger id="task-category" data-testid="select-task-category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-order">Order</Label>
                <Input id="task-order" type="number" value={form.order} onChange={e => setForm({ ...form, order: e.target.value })} data-testid="input-task-order" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-due">Due (days after start)</Label>
                <Input id="task-due" type="number" min={0} value={form.dueOffsetDays} onChange={e => setForm({ ...form, dueOffsetDays: e.target.value })} data-testid="input-task-due" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-linked-training">Linked Training Course</Label>
              <Select value={form.linkedTrainingId || 'none'} onValueChange={v => setForm({ ...form, linkedTrainingId: v === 'none' ? '' : v })}>
                <SelectTrigger id="task-linked-training" data-testid="select-task-linked-training"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {trainings.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="task-required" checked={form.required} onCheckedChange={checked => setForm({ ...form, required: !!checked })} data-testid="checkbox-task-required" />
              <Label htmlFor="task-required" className="font-normal">Required (counts toward completion percentage)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saveMutation.isPending} data-testid="button-save-task">
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProgramsTab() {
  const { items, isLoading, saveMutation, deleteMutation } = useEntityCrud<InductionProgram>('/api/onboarding/programs', ['/api/onboarding/programs']);
  const { data: jobFamilies = [] } = useQuery<JobFamily[]>({ queryKey: ['/api/org/job-families'] });
  const { data: jobRoles = [] } = useQuery<JobRole[]>({ queryKey: ['/api/job-roles'] });
  const { data: trainings = [] } = useQuery<Training[]>({ queryKey: ['/api/trainings'] });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<InductionProgram | null>(null);
  const [tasksFor, setTasksFor] = useState<InductionProgram | null>(null);
  const [form, setForm] = useState({ name: '', description: '', jobFamilyId: '', jobRoleId: '' });

  const openDialog = (program?: InductionProgram) => {
    setEditing(program || null);
    setForm(program ? {
      name: program.name,
      description: program.description || '',
      jobFamilyId: program.jobFamilyId || '',
      jobRoleId: program.jobRoleId || '',
    } : { name: '', description: '', jobFamilyId: '', jobRoleId: '' });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    const data = {
      name: form.name,
      description: form.description || null,
      jobFamilyId: form.jobFamilyId || null,
      jobRoleId: form.jobRoleId || null,
    };
    saveMutation.mutate({ id: editing?.id, data }, { onSuccess: () => setIsDialogOpen(false) });
  };

  const jobFamilyName = (id?: string | null) => jobFamilies.find(f => f.id === id)?.name || '—';
  const jobRoleName = (id?: string | null) => jobRoles.find(r => r.id === id)?.name || '—';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Induction Programs</CardTitle>
          <CardDescription>Checklist templates for new starters or people moving into a new role</CardDescription>
        </div>
        <Button onClick={() => openDialog()} data-testid="button-add-program">
          <Plus className="h-4 w-4 mr-2" />
          Add Program
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No induction programs yet</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Job Family</TableHead>
                <TableHead>Job Role</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(program => (
                <TableRow key={program.id} data-testid={`row-program-${program.id}`}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-muted-foreground" />{program.name}</div>
                  </TableCell>
                  <TableCell>{jobFamilyName(program.jobFamilyId)}</TableCell>
                  <TableCell>{jobRoleName(program.jobRoleId)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setTasksFor(program)} data-testid={`button-tasks-${program.id}`}>
                        <ListChecks className="h-3 w-3 mr-1" /> Tasks
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openDialog(program)} data-testid={`button-edit-program-${program.id}`}><Pencil className="h-3 w-3" /></Button>
                      <Button variant="outline" size="sm" onClick={() => { if (confirm("Deactivate this program?")) deleteMutation.mutate(program.id); }} data-testid={`button-delete-program-${program.id}`}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent data-testid="dialog-program-form">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Program" : "Add Program"}</DialogTitle>
            <DialogDescription>Optionally scope this program to a job family or a specific job role</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="program-name">Name *</Label>
              <Input id="program-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g., New Starter Induction" data-testid="input-program-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="program-description">Description</Label>
              <Textarea id="program-description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} data-testid="input-program-description" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="program-job-family">Job Family</Label>
                <Select value={form.jobFamilyId || 'none'} onValueChange={v => setForm({ ...form, jobFamilyId: v === 'none' ? '' : v })}>
                  <SelectTrigger id="program-job-family" data-testid="select-program-job-family"><SelectValue placeholder="Any" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Any</SelectItem>
                    {jobFamilies.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="program-job-role">Job Role</Label>
                <Select value={form.jobRoleId || 'none'} onValueChange={v => setForm({ ...form, jobRoleId: v === 'none' ? '' : v })}>
                  <SelectTrigger id="program-job-role" data-testid="select-program-job-role"><SelectValue placeholder="Any" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Any</SelectItem>
                    {jobRoles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saveMutation.isPending} data-testid="button-save-program">
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!tasksFor} onOpenChange={open => !open && setTasksFor(null)}>
        <DialogContent className="max-w-4xl" data-testid="dialog-tasks">
          <DialogHeader>
            <DialogTitle>Tasks - {tasksFor?.name}</DialogTitle>
            <DialogDescription>The steps a person works through for this program, in order</DialogDescription>
          </DialogHeader>
          {tasksFor && <TasksPanel program={tasksFor} trainings={trainings} />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function ChecklistView({ assignment }: { assignment: OnboardingAssignment }) {
  const { data: checklist, isLoading } = useQuery<OnboardingChecklist>({
    queryKey: ['/api/onboarding/assignments', assignment.id, 'checklist'],
  });
  const { toast } = useToast();

  const toggleMutation = useMutation({
    mutationFn: async ({ taskId, complete }: { taskId: string; complete: boolean }) =>
      complete
        ? apiRequest('POST', `/api/onboarding/assignments/${assignment.id}/tasks/${taskId}/complete`, {})
        : apiRequest('DELETE', `/api/onboarding/assignments/${assignment.id}/tasks/${taskId}/complete`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/onboarding/assignments', assignment.id, 'checklist'] });
      queryClient.invalidateQueries({ queryKey: ['/api/onboarding/assignments'] });
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  if (isLoading || !checklist) return <div className="text-center py-4 text-muted-foreground text-sm">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Progress value={checklist.statistics.completionPercentage} className="flex-1" />
        <span className="text-sm text-muted-foreground whitespace-nowrap" data-testid="text-checklist-progress">
          {checklist.statistics.completedTasks} / {checklist.statistics.totalTasks} required tasks
        </span>
      </div>
      <div className="divide-y border rounded-md">
        {checklist.tasks.map(({ task, completion }) => (
          <div key={task.id} className="flex items-center gap-3 px-4 py-3" data-testid={`row-checklist-task-${task.id}`}>
            <Checkbox
              checked={!!completion?.completedAt}
              onCheckedChange={checked => toggleMutation.mutate({ taskId: task.id, complete: !!checked })}
              data-testid={`checkbox-checklist-task-${task.id}`}
            />
            <div className="flex-1 min-w-0">
              <div className="font-medium">{task.name}{!task.required && <span className="text-xs text-muted-foreground ml-2">(optional)</span>}</div>
              {task.description && <div className="text-sm text-muted-foreground">{task.description}</div>}
            </div>
            <Badge variant="outline">{CATEGORY_LABELS[task.category || 'general']}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

function AssignmentsTab() {
  const { items, isLoading, saveMutation, deleteMutation } = useEntityCrud<OnboardingAssignment>('/api/onboarding/assignments', ['/api/onboarding/assignments']);
  const { data: users = [] } = useQuery<User[]>({ queryKey: ['/api/users'] });
  const { data: programs = [] } = useQuery<InductionProgram[]>({ queryKey: ['/api/onboarding/programs'] });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [checklistFor, setChecklistFor] = useState<OnboardingAssignment | null>(null);
  const [form, setForm] = useState({ userId: '', programId: '', startDate: '', targetCompletionDate: '' });

  const openDialog = () => {
    setForm({ userId: '', programId: '', startDate: new Date().toISOString().slice(0, 10), targetCompletionDate: '' });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.userId || !form.programId || !form.startDate) return;
    const data = {
      userId: form.userId,
      programId: form.programId,
      startDate: form.startDate,
      targetCompletionDate: form.targetCompletionDate || null,
    };
    saveMutation.mutate({ data }, { onSuccess: () => setIsDialogOpen(false) });
  };

  const programName = (id: string) => programs.find(p => p.id === id)?.name || 'Unknown program';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Assignments</CardTitle>
          <CardDescription>People currently working through an induction program</CardDescription>
        </div>
        <Button onClick={openDialog} data-testid="button-add-assignment">
          <UserPlus className="h-4 w-4 mr-2" />
          Assign Program
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No assignments yet</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead>Program</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>Target Completion</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(assignment => (
                <TableRow key={assignment.id} data-testid={`row-assignment-${assignment.id}`}>
                  <TableCell className="font-medium">{userName(users.find(u => u.id === assignment.userId)) || 'Unknown'}</TableCell>
                  <TableCell>{programName(assignment.programId)}</TableCell>
                  <TableCell>{new Date(assignment.startDate).toLocaleDateString()}</TableCell>
                  <TableCell>{assignment.targetCompletionDate ? new Date(assignment.targetCompletionDate).toLocaleDateString() : '—'}</TableCell>
                  <TableCell><span className={STATUS_COLORS[assignment.status || 'in_progress']}>{STATUS_LABELS[assignment.status || 'in_progress']}</span></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setChecklistFor(assignment)} data-testid={`button-checklist-${assignment.id}`}>
                        <ListChecks className="h-3 w-3 mr-1" /> Checklist
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => { if (confirm("Cancel this assignment?")) deleteMutation.mutate(assignment.id); }} data-testid={`button-delete-assignment-${assignment.id}`}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent data-testid="dialog-assignment-form">
          <DialogHeader>
            <DialogTitle>Assign Program</DialogTitle>
            <DialogDescription>Start someone on an induction program</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="assignment-user">Person *</Label>
              <Select value={form.userId} onValueChange={v => setForm({ ...form, userId: v })}>
                <SelectTrigger id="assignment-user" data-testid="select-assignment-user"><SelectValue placeholder="Select a person" /></SelectTrigger>
                <SelectContent>
                  {users.map(u => <SelectItem key={u.id} value={u.id}>{userName(u)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assignment-program">Program *</Label>
              <Select value={form.programId} onValueChange={v => setForm({ ...form, programId: v })}>
                <SelectTrigger id="assignment-program" data-testid="select-assignment-program"><SelectValue placeholder="Select a program" /></SelectTrigger>
                <SelectContent>
                  {programs.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="assignment-start">Start Date *</Label>
                <Input id="assignment-start" type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} data-testid="input-assignment-start" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="assignment-target">Target Completion</Label>
                <Input id="assignment-target" type="date" value={form.targetCompletionDate} onChange={e => setForm({ ...form, targetCompletionDate: e.target.value })} data-testid="input-assignment-target" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saveMutation.isPending} data-testid="button-save-assignment">
              {saveMutation.isPending ? "Assigning..." : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!checklistFor} onOpenChange={open => !open && setChecklistFor(null)}>
        <DialogContent className="max-w-2xl" data-testid="dialog-assignment-checklist">
          <DialogHeader>
            <DialogTitle>Checklist - {checklistFor ? userName(users.find(u => u.id === checklistFor.userId)) : ''}</DialogTitle>
            <DialogDescription>{checklistFor ? programName(checklistFor.programId) : ''}</DialogDescription>
          </DialogHeader>
          {checklistFor && <ChecklistView assignment={checklistFor} />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function InductionProgramsAdmin() {
  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-induction-programs-admin">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Onboarding & Induction</h1>
        <p className="text-muted-foreground">Manage induction programs and track new starters working through them</p>
      </div>

      <Tabs defaultValue="programs">
        <TabsList>
          <TabsTrigger value="programs" data-testid="tab-programs">Programs</TabsTrigger>
          <TabsTrigger value="assignments" data-testid="tab-assignments">Assignments</TabsTrigger>
        </TabsList>
        <TabsContent value="programs" className="mt-4">
          <ProgramsTab />
        </TabsContent>
        <TabsContent value="assignments" className="mt-4">
          <AssignmentsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

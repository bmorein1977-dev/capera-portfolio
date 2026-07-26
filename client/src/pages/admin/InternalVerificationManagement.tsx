import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Trash2, UserCheck, Percent, Download } from "lucide-react";
import { format } from "date-fns";
import type { User, VerifierAllocation, SamplingPlan } from "@shared/schema";

function userName(u?: User) {
  return u ? `${u.firstName} ${u.lastName}` : 'Unknown';
}

function useUsersByRole() {
  const { data: users = [], isLoading } = useQuery<User[]>({ queryKey: ['/api/users'] });
  const verifiers = users.filter(u => u.role === 'internal_verifier');
  const assessors = users.filter(u => u.role === 'assessor');
  const userById = new Map(users.map(u => [u.id, u]));
  return { verifiers, assessors, userById, isLoading };
}

function AllocationsTab() {
  const { toast } = useToast();
  const { verifiers, assessors, userById, isLoading: usersLoading } = useUsersByRole();
  const { data: allocations = [], isLoading } = useQuery<VerifierAllocation[]>({ queryKey: ['/api/verifier-allocations'] });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [verifierId, setVerifierId] = useState("");
  const [assessorId, setAssessorId] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => apiRequest('POST', '/api/verifier-allocations', { verifierId, assessorId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/verifier-allocations'] });
      toast({ title: "Allocated" });
      setIsDialogOpen(false);
      setVerifierId("");
      setAssessorId("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to allocate", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('DELETE', `/api/verifier-allocations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/verifier-allocations'] });
      toast({ title: "Allocation removed" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to remove allocation", variant: "destructive" });
    },
  });

  const alreadyAllocated = allocations.some(a => a.verifierId === verifierId && a.assessorId === assessorId);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Verifier - Assessor Allocations</CardTitle>
          <CardDescription>Which assessors each Internal Verifier is responsible for sampling and verifying</CardDescription>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} data-testid="button-add-allocation">
          <Plus className="h-4 w-4 mr-2" />
          Allocate Assessor
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading || usersLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : allocations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <UserCheck className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>No allocations yet</p>
            <p className="text-sm">Internal Verifiers can't see any assessors until you allocate some here.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Internal Verifier</TableHead>
                <TableHead>Assessor</TableHead>
                <TableHead>Allocated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allocations.map(a => (
                <TableRow key={a.id} data-testid={`row-allocation-${a.id}`}>
                  <TableCell className="font-medium">{userName(userById.get(a.verifierId))}</TableCell>
                  <TableCell>{userName(userById.get(a.assessorId))}</TableCell>
                  <TableCell>{a.allocatedDate ? format(new Date(a.allocatedDate), 'PPP') : '—'}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { if (confirm("Remove this allocation? The verifier will no longer see this assessor's assessments.")) deleteMutation.mutate(a.id); }}
                      data-testid={`button-remove-allocation-${a.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent data-testid="dialog-allocation-form">
          <DialogHeader>
            <DialogTitle>Allocate Assessor to Internal Verifier</DialogTitle>
            <DialogDescription>The verifier will be able to see this assessor's assessments and sample/verify them</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Internal Verifier</Label>
              <Select value={verifierId} onValueChange={setVerifierId}>
                <SelectTrigger data-testid="select-verifier"><SelectValue placeholder="Select an internal verifier" /></SelectTrigger>
                <SelectContent>
                  {verifiers.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">No users with the Internal Verifier role yet</div>
                  ) : verifiers.map(v => (
                    <SelectItem key={v.id} value={v.id}>{userName(v)} ({v.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assessor</Label>
              <Select value={assessorId} onValueChange={setAssessorId}>
                <SelectTrigger data-testid="select-assessor"><SelectValue placeholder="Select an assessor" /></SelectTrigger>
                <SelectContent>
                  {assessors.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">No users with the Assessor role yet</div>
                  ) : assessors.map(a => (
                    <SelectItem key={a.id} value={a.id}>{userName(a)} ({a.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {alreadyAllocated && (
              <p className="text-sm text-destructive">This assessor is already allocated to this verifier.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!verifierId || !assessorId || alreadyAllocated || createMutation.isPending}
              data-testid="button-save-allocation"
            >
              Allocate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function SamplingPlansTab() {
  const { toast } = useToast();
  const { verifiers, assessors, userById, isLoading: usersLoading } = useUsersByRole();
  const { data: plans = [], isLoading } = useQuery<SamplingPlan[]>({ queryKey: ['/api/sampling-plans'] });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SamplingPlan | null>(null);
  const [form, setForm] = useState({ verifierId: '', assessorId: '', targetPercentage: '10', periodStartDate: '', periodEndDate: '' });

  const openDialog = (plan?: SamplingPlan) => {
    setEditing(plan || null);
    setForm(plan ? {
      verifierId: plan.verifierId,
      assessorId: plan.assessorId,
      targetPercentage: String(plan.targetPercentage),
      periodStartDate: plan.periodStartDate ? new Date(plan.periodStartDate).toISOString().slice(0, 10) : '',
      periodEndDate: plan.periodEndDate ? new Date(plan.periodEndDate).toISOString().slice(0, 10) : '',
    } : { verifierId: '', assessorId: '', targetPercentage: '10', periodStartDate: '', periodEndDate: '' });
    setIsDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const data = {
        verifierId: form.verifierId,
        assessorId: form.assessorId,
        targetPercentage: parseInt(form.targetPercentage, 10),
        periodStartDate: form.periodStartDate ? new Date(form.periodStartDate) : null,
        periodEndDate: form.periodEndDate ? new Date(form.periodEndDate) : null,
      };
      return editing
        ? apiRequest('PATCH', `/api/sampling-plans/${editing.id}`, data)
        : apiRequest('POST', '/api/sampling-plans', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sampling-plans'] });
      toast({ title: "Saved" });
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to save sampling plan", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('DELETE', `/api/sampling-plans/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sampling-plans'] });
      toast({ title: "Sampling plan removed" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to remove sampling plan", variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Sampling Plans</CardTitle>
          <CardDescription>What percentage of each assessor's assessments an Internal Verifier is expected to sample</CardDescription>
        </div>
        <Button onClick={() => openDialog()} data-testid="button-add-sampling-plan">
          <Plus className="h-4 w-4 mr-2" />
          New Sampling Plan
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading || usersLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : plans.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Percent className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>No sampling plans yet</p>
            <p className="text-sm">Verifiers default to a 10% sampling rate until a plan is set here.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Internal Verifier</TableHead>
                <TableHead>Assessor</TableHead>
                <TableHead>Target Rate</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map(p => (
                <TableRow key={p.id} data-testid={`row-sampling-plan-${p.id}`}>
                  <TableCell className="font-medium">{userName(userById.get(p.verifierId))}</TableCell>
                  <TableCell>{userName(userById.get(p.assessorId))}</TableCell>
                  <TableCell><Badge variant="outline">{p.targetPercentage}%</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.periodStartDate ? format(new Date(p.periodStartDate), 'MMM d, yyyy') : '—'}
                    {' – '}
                    {p.periodEndDate ? format(new Date(p.periodEndDate), 'MMM d, yyyy') : 'ongoing'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openDialog(p)} data-testid={`button-edit-sampling-plan-${p.id}`}>Edit</Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { if (confirm("Remove this sampling plan?")) deleteMutation.mutate(p.id); }}
                        data-testid={`button-remove-sampling-plan-${p.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent data-testid="dialog-sampling-plan-form">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Sampling Plan' : 'New Sampling Plan'}</DialogTitle>
            <DialogDescription>Set the target percentage of assessments this verifier should sample from this assessor</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Internal Verifier</Label>
              <Select value={form.verifierId} onValueChange={(v) => setForm(f => ({ ...f, verifierId: v }))} disabled={!!editing}>
                <SelectTrigger data-testid="select-plan-verifier"><SelectValue placeholder="Select an internal verifier" /></SelectTrigger>
                <SelectContent>
                  {verifiers.map(v => <SelectItem key={v.id} value={v.id}>{userName(v)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assessor</Label>
              <Select value={form.assessorId} onValueChange={(v) => setForm(f => ({ ...f, assessorId: v }))} disabled={!!editing}>
                <SelectTrigger data-testid="select-plan-assessor"><SelectValue placeholder="Select an assessor" /></SelectTrigger>
                <SelectContent>
                  {assessors.map(a => <SelectItem key={a.id} value={a.id}>{userName(a)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Target Sampling Rate (%)</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={form.targetPercentage}
                onChange={(e) => setForm(f => ({ ...f, targetPercentage: e.target.value }))}
                data-testid="input-target-percentage"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Period Start (optional)</Label>
                <Input type="date" value={form.periodStartDate} onChange={(e) => setForm(f => ({ ...f, periodStartDate: e.target.value }))} data-testid="input-period-start" />
              </div>
              <div className="space-y-2">
                <Label>Period End (optional)</Label>
                <Input type="date" value={form.periodEndDate} onChange={(e) => setForm(f => ({ ...f, periodEndDate: e.target.value }))} data-testid="input-period-end" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!form.verifierId || !form.assessorId || !form.targetPercentage || saveMutation.isPending}
              data-testid="button-save-sampling-plan"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function InternalVerificationManagement() {
  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-internal-verification-management">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Internal Verification Management</h1>
          <p className="text-muted-foreground">Allocate assessors to Internal Verifiers and set sampling rates</p>
        </div>
        <Button variant="outline" onClick={() => window.open('/api/verifications/export', '_blank')} data-testid="button-export-all-verifications">
          <Download className="h-4 w-4 mr-2" />
          Export All Verification Activity
        </Button>
      </div>

      <Tabs defaultValue="allocations">
        <TabsList>
          <TabsTrigger value="allocations" data-testid="tab-allocations">Verifier Allocations</TabsTrigger>
          <TabsTrigger value="sampling-plans" data-testid="tab-sampling-plans">Sampling Plans</TabsTrigger>
        </TabsList>
        <TabsContent value="allocations" className="mt-4">
          <AllocationsTab />
        </TabsContent>
        <TabsContent value="sampling-plans" className="mt-4">
          <SamplingPlansTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

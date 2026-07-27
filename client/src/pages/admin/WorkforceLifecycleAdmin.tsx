import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { UserCombobox } from "@/components/UserCombobox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Snowflake, CheckCircle2, Trash2, UserMinus, UserPlus, HeartPulse } from "lucide-react";
import type { Absence, User, JobRole } from "@shared/schema";

const ABSENCE_TYPE_LABELS: Record<string, string> = {
  long_term_sick: "Long-Term Sick",
  holiday: "Holiday",
  other_leave: "Other Leave",
};

// A joiner/leaver stays visible in those lists for this many days either side of their date -
// long enough to be useful without turning into a permanent full history (that's what the User
// Management list itself is for).
const LIFECYCLE_WINDOW_DAYS = 90;

function daysBetween(a: Date, b: Date) {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

export default function WorkforceLifecycleAdmin() {
  const { toast } = useToast();
  const [isRecordDialogOpen, setIsRecordDialogOpen] = useState(false);
  const [returnDialogAbsence, setReturnDialogAbsence] = useState<Absence | null>(null);
  const [returnDate, setReturnDate] = useState('');

  const { data: users = [] } = useQuery<User[]>({ queryKey: ['/api/users'] });
  const { data: jobRoles = [] } = useQuery<JobRole[]>({ queryKey: ['/api/job-roles'] });
  const { data: absences = [] } = useQuery<Absence[]>({ queryKey: ['/api/absences'] });

  const userById = new Map(users.map(u => [u.id, u]));
  const jobRoleNameById = new Map(jobRoles.map(r => [r.id, r.name]));
  const userLabel = (u: User) => `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || 'Unknown';

  const openAbsences = absences.filter(a => !a.actualReturnDate).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  const closedAbsences = absences.filter(a => a.actualReturnDate).sort((a, b) => new Date(b.actualReturnDate!).getTime() - new Date(a.actualReturnDate!).getTime());

  const now = useMemo(() => new Date(), []);
  const leavers = users
    .filter(u => u.isArchived && u.leftAt && Math.abs(daysBetween(now, new Date(u.leftAt))) <= LIFECYCLE_WINDOW_DAYS)
    .sort((a, b) => new Date(b.leftAt!).getTime() - new Date(a.leftAt!).getTime());
  const joiners = users
    .filter(u => !u.isArchived && u.startDate && Math.abs(daysBetween(new Date(u.startDate), now)) <= LIFECYCLE_WINDOW_DAYS)
    .sort((a, b) => new Date(b.startDate!).getTime() - new Date(a.startDate!).getTime());

  const invalidateAbsences = () => queryClient.invalidateQueries({ queryKey: ['/api/absences'] });

  const returnMutation = useMutation({
    mutationFn: async ({ id, actualReturnDate }: { id: string; actualReturnDate: string }) =>
      apiRequest('PATCH', `/api/absences/${id}`, { actualReturnDate }),
    onSuccess: () => {
      invalidateAbsences();
      setReturnDialogAbsence(null);
      toast({ title: 'Marked as returned' });
    },
    onError: (error: any) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('DELETE', `/api/absences/${id}`),
    onSuccess: () => { invalidateAbsences(); toast({ title: 'Removed' }); },
    onError: (error: any) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  return (
    <div className="p-6 space-y-6" data-testid="page-workforce-lifecycle-admin">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HeartPulse className="h-6 w-6" />
            Workforce Lifecycle
          </h1>
          <p className="text-muted-foreground">
            Record absences (long-term sick, holiday, other leave), track leavers and joiners, and freeze compliance tracking for anyone on long-term sick.
          </p>
        </div>
        <Button onClick={() => setIsRecordDialogOpen(true)} data-testid="button-record-absence">
          <Plus className="h-4 w-4 mr-2" />
          Record Absence
        </Button>
      </div>

      <Tabs defaultValue="absences">
        <TabsList>
          <TabsTrigger value="absences" data-testid="tab-absences">Absences</TabsTrigger>
          <TabsTrigger value="leavers" data-testid="tab-leavers">Leavers ({leavers.length})</TabsTrigger>
          <TabsTrigger value="joiners" data-testid="tab-joiners">Joiners ({joiners.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="absences" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Currently Away ({openAbsences.length})</CardTitle>
              <CardDescription>Frozen absences are excluded from overdue/expiring counts on the Executive Dashboard and Element 3 KPI report while open.</CardDescription>
            </CardHeader>
            <CardContent>
              {openAbsences.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4">No one is currently recorded as away.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Person</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>Expected Return</TableHead>
                      <TableHead>Frozen</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {openAbsences.map(a => {
                      const person = userById.get(a.userId);
                      return (
                        <TableRow key={a.id} data-testid={`row-absence-${a.id}`}>
                          <TableCell className="font-medium">{person ? userLabel(person) : 'Unknown'}</TableCell>
                          <TableCell>{ABSENCE_TYPE_LABELS[a.absenceType] || a.absenceType}</TableCell>
                          <TableCell>{format(new Date(a.startDate), 'PP')}</TableCell>
                          <TableCell>{a.expectedReturnDate ? format(new Date(a.expectedReturnDate), 'PP') : '—'}</TableCell>
                          <TableCell>
                            {a.isFrozen && (
                              <Badge variant="outline" className="gap-1 text-blue-600 dark:text-blue-400">
                                <Snowflake className="h-3 w-3" /> Frozen
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => { setReturnDialogAbsence(a); setReturnDate(new Date().toISOString().split('T')[0]); }}
                                data-testid={`button-mark-returned-${a.id}`}
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" /> Mark Returned
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => deleteMutation.mutate(a.id)} data-testid={`button-delete-absence-${a.id}`}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recently Closed</CardTitle>
            </CardHeader>
            <CardContent>
              {closedAbsences.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4">No closed absences yet.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Person</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>Returned</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {closedAbsences.slice(0, 20).map(a => {
                      const person = userById.get(a.userId);
                      return (
                        <TableRow key={a.id} data-testid={`row-closed-absence-${a.id}`}>
                          <TableCell className="font-medium">{person ? userLabel(person) : 'Unknown'}</TableCell>
                          <TableCell>{ABSENCE_TYPE_LABELS[a.absenceType] || a.absenceType}</TableCell>
                          <TableCell>{format(new Date(a.startDate), 'PP')}</TableCell>
                          <TableCell>{format(new Date(a.actualReturnDate!), 'PP')}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" onClick={() => deleteMutation.mutate(a.id)} data-testid={`button-delete-closed-absence-${a.id}`}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leavers">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><UserMinus className="h-4 w-4" /> Leavers, last {LIFECYCLE_WINDOW_DAYS} days</CardTitle>
              <CardDescription>Marked as a leaver via User Management's Archive action - already excluded from active compliance tracking.</CardDescription>
            </CardHeader>
            <CardContent>
              {leavers.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4">No leavers in this window.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Person</TableHead>
                      <TableHead>Job Role</TableHead>
                      <TableHead>Leaving Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leavers.map(u => (
                      <TableRow key={u.id} data-testid={`row-leaver-${u.id}`}>
                        <TableCell className="font-medium">{userLabel(u)}</TableCell>
                        <TableCell>{u.jobRoleId ? (jobRoleNameById.get(u.jobRoleId) || '—') : '—'}</TableCell>
                        <TableCell>{format(new Date(u.leftAt!), 'PP')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="joiners">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><UserPlus className="h-4 w-4" /> Joiners, {LIFECYCLE_WINDOW_DAYS} days either side of today</CardTitle>
              <CardDescription>Start date set on the user's profile in User Management - required training/competencies are already auto-assigned as soon as a job role is set, regardless of start date.</CardDescription>
            </CardHeader>
            <CardContent>
              {joiners.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4">No joiners in this window.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Person</TableHead>
                      <TableHead>Job Role</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {joiners.map(u => {
                      const isUpcoming = new Date(u.startDate!).getTime() > now.getTime();
                      return (
                        <TableRow key={u.id} data-testid={`row-joiner-${u.id}`}>
                          <TableCell className="font-medium">{userLabel(u)}</TableCell>
                          <TableCell>{u.jobRoleId ? (jobRoleNameById.get(u.jobRoleId) || '—') : '—'}</TableCell>
                          <TableCell>{format(new Date(u.startDate!), 'PP')}</TableCell>
                          <TableCell>
                            <Badge variant={isUpcoming ? 'outline' : 'secondary'}>{isUpcoming ? 'Upcoming' : 'Started'}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <RecordAbsenceDialog
        open={isRecordDialogOpen}
        onOpenChange={setIsRecordDialogOpen}
        users={users}
      />

      <Dialog open={!!returnDialogAbsence} onOpenChange={(open) => !open && setReturnDialogAbsence(null)}>
        <DialogContent data-testid="dialog-mark-returned">
          <DialogHeader>
            <DialogTitle>Mark as Returned</DialogTitle>
            <DialogDescription>
              {returnDialogAbsence && userById.get(returnDialogAbsence.userId) ? userLabel(userById.get(returnDialogAbsence.userId)!) : ''} will show as active again and their compliance tracking un-freezes immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="return-date">Return Date</Label>
            <Input id="return-date" type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} data-testid="input-return-date" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnDialogAbsence(null)}>Cancel</Button>
            <Button
              onClick={() => returnDialogAbsence && returnMutation.mutate({ id: returnDialogAbsence.id, actualReturnDate: returnDate })}
              disabled={!returnDate || returnMutation.isPending}
              data-testid="button-confirm-mark-returned"
            >
              Confirm Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RecordAbsenceDialog({ open, onOpenChange, users }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: User[];
}) {
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [absenceType, setAbsenceType] = useState('long_term_sick');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [isFrozen, setIsFrozen] = useState(true);
  const [notes, setNotes] = useState('');

  const userOptions = useMemo(() => {
    return [...users]
      .filter(u => !u.isArchived)
      .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))
      .map(u => ({ id: u.id, label: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || 'Unknown' }));
  }, [users]);

  const reset = () => {
    setUserId(null);
    setAbsenceType('long_term_sick');
    setStartDate(new Date().toISOString().split('T')[0]);
    setExpectedReturnDate('');
    setIsFrozen(true);
    setNotes('');
  };

  const createMutation = useMutation({
    mutationFn: async () => apiRequest('POST', '/api/absences', {
      userId,
      absenceType,
      startDate,
      expectedReturnDate: expectedReturnDate || null,
      isFrozen,
      notes: notes || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/absences'] });
      onOpenChange(false);
      reset();
      toast({ title: 'Absence Recorded' });
    },
    onError: (error: any) => toast({ title: 'Error', description: error.message || 'Failed to record absence', variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent data-testid="dialog-record-absence">
        <DialogHeader>
          <DialogTitle>Record Absence</DialogTitle>
          <DialogDescription>Long-term sick freezes their overdue/expiring counts by default - toggle it off if this absence shouldn't affect compliance reporting.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Person *</Label>
            <UserCombobox testId="record-absence-person" options={userOptions} value={userId} onChange={setUserId} placeholder="Search for a person..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="absence-type">Type</Label>
            <Select
              value={absenceType}
              onValueChange={(v) => { setAbsenceType(v); setIsFrozen(v === 'long_term_sick'); }}
            >
              <SelectTrigger id="absence-type" data-testid="select-absence-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ABSENCE_TYPE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="absence-start">Start Date *</Label>
              <Input id="absence-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} data-testid="input-absence-start-date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="absence-expected-return">Expected Return</Label>
              <Input id="absence-expected-return" type="date" value={expectedReturnDate} onChange={(e) => setExpectedReturnDate(e.target.value)} data-testid="input-absence-expected-return" />
            </div>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={isFrozen} onCheckedChange={(v) => setIsFrozen(!!v)} data-testid="checkbox-freeze-compliance" />
            <span>
              Freeze compliance tracking
              <span className="block text-xs text-muted-foreground">While checked, this person is excluded from overdue/expiring counts on the Executive Dashboard and Element 3 KPI report.</span>
            </span>
          </label>
          <div className="space-y-2">
            <Label htmlFor="absence-notes">Notes</Label>
            <Textarea id="absence-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} data-testid="input-absence-notes" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => createMutation.mutate()} disabled={!userId || !startDate || createMutation.isPending} data-testid="button-save-absence">
            Record Absence
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Pencil, Trash2, Shield, Briefcase, BookOpen } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { TrainingPolicyMatrix, ExternalTrainingCourse } from "@shared/schema";

const policyFormSchema = z.object({
  jobRoleId: z.string().min(1, "Job role is required"),
  courseId: z.string().min(1, "Course is required"),
  policyStatus: z.string().min(1, "Policy status is required"),
  requiresApproval: z.boolean().default(false),
  costCap: z.string().optional(),
  notes: z.string().optional(),
});

type PolicyFormData = z.infer<typeof policyFormSchema>;

type PolicyWithDetails = TrainingPolicyMatrix & {
  jobRoleName?: string;
  courseName?: string;
};

type JobRole = {
  id: string;
  name: string;
};

export default function TrainingPolicyMatrixAdmin() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<TrainingPolicyMatrix | null>(null);
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const form = useForm<PolicyFormData>({
    resolver: zodResolver(policyFormSchema),
    defaultValues: {
      jobRoleId: "",
      courseId: "",
      policyStatus: "OPTIONAL",
      requiresApproval: false,
      costCap: "",
      notes: "",
    },
  });

  // Fetch policies
  const { data: policies = [], isLoading } = useQuery<PolicyWithDetails[]>({
    queryKey: ['/api/training/policy-matrix'],
  });

  // Fetch job roles
  const { data: jobRoles = [] } = useQuery<JobRole[]>({
    queryKey: ['/api/job-roles'],
  });

  // Fetch courses
  const { data: courses = [] } = useQuery<ExternalTrainingCourse[]>({
    queryKey: ['/api/training/courses'],
  });

  // Create/Update policy mutation
  const savePolicyMutation = useMutation({
    mutationFn: async (data: PolicyFormData) => {
      if (editingPolicy) {
        return apiRequest('PUT', `/api/training/policy-matrix/${editingPolicy.id}`, data);
      } else {
        return apiRequest('POST', '/api/training/policy-matrix', data);
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: editingPolicy ? "Policy updated successfully" : "Policy created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/training/policy-matrix'] });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save policy",
        variant: "destructive",
      });
    },
  });

  // Delete policy mutation
  const deletePolicyMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/training/policy-matrix/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Policy deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/training/policy-matrix'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete policy",
        variant: "destructive",
      });
    },
  });

  const handleOpenDialog = (policy?: TrainingPolicyMatrix) => {
    if (policy) {
      setEditingPolicy(policy);
      form.reset({
        jobRoleId: policy.jobRoleId,
        courseId: policy.courseId,
        policyStatus: policy.policyStatus,
        requiresApproval: policy.requiresApproval || false,
        costCap: policy.costCap || "",
        notes: policy.notes || "",
      });
    } else {
      setEditingPolicy(null);
      form.reset({
        jobRoleId: "",
        courseId: "",
        policyStatus: "OPTIONAL",
        requiresApproval: false,
        costCap: "",
        notes: "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingPolicy(null);
    form.reset();
  };

  const handleSubmit = (data: PolicyFormData) => {
    savePolicyMutation.mutate(data);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this training policy?")) {
      deletePolicyMutation.mutate(id);
    }
  };

  const filteredPolicies = policies.filter(p => {
    if (filterRole !== "all" && p.jobRoleId !== filterRole) return false;
    if (filterStatus !== "all" && p.policyStatus !== filterStatus) return false;
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'MANDATORY':
        return 'destructive';
      case 'OPTIONAL':
        return 'default';
      case 'NA':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getJobRoleName = (roleId: string) => {
    const role = jobRoles.find(r => r.id === roleId);
    return role?.name || "Unknown Role";
  };

  const getCourseName = (courseId: string) => {
    const course = courses.find(c => c.id === courseId);
    return course?.title || "Unknown Course";
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-training-policy-matrix-admin">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Training Policy Matrix</h1>
          <p className="text-muted-foreground">Link training courses to job roles and define compliance policies</p>
        </div>
        <Button onClick={() => handleOpenDialog()} data-testid="button-add-policy">
          <Plus className="h-4 w-4 mr-2" />
          Add Policy
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-[250px]" data-testid="select-filter-role">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Job Roles</SelectItem>
            {jobRoles.map(role => (
              <SelectItem key={role.id} value={role.id}>
                {role.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]" data-testid="select-filter-status">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="MANDATORY">Mandatory</SelectItem>
            <SelectItem value="OPTIONAL">Optional</SelectItem>
            <SelectItem value="NA">Not Applicable</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Policies Table */}
      <Card>
        <CardHeader>
          <CardTitle>Training Policies</CardTitle>
          <CardDescription>{filteredPolicies.length} polic{filteredPolicies.length === 1 ? 'y' : 'ies'} found</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading policies...</div>
          ) : filteredPolicies.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No policies found. Create policies to link training requirements to job roles.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job Role</TableHead>
                    <TableHead>Training Course</TableHead>
                    <TableHead>Policy Status</TableHead>
                    <TableHead>Approval Required</TableHead>
                    <TableHead>Cost Cap</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPolicies.map((policy) => (
                    <TableRow key={policy.id} data-testid={`row-policy-${policy.id}`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4 text-muted-foreground" />
                          {getJobRoleName(policy.jobRoleId)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-muted-foreground" />
                          {getCourseName(policy.courseId)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(policy.policyStatus)}>
                          {policy.policyStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {policy.requiresApproval ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Shield className="h-3 w-3 text-amber-600" />
                            <span>Yes</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">No</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{policy.costCap || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                        {policy.notes || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenDialog(policy)}
                            data-testid={`button-edit-policy-${policy.id}`}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(policy.id)}
                            data-testid={`button-delete-policy-${policy.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-policy-form">
          <DialogHeader>
            <DialogTitle>{editingPolicy ? "Edit Training Policy" : "Add New Training Policy"}</DialogTitle>
            <DialogDescription>
              {editingPolicy ? "Update training policy requirements" : "Define training requirements for a job role"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="jobRoleId">Job Role *</Label>
                <Controller
                  name="jobRoleId"
                  control={form.control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger data-testid="select-job-role">
                        <SelectValue placeholder="Select job role" />
                      </SelectTrigger>
                      <SelectContent>
                        {jobRoles.map(role => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {form.formState.errors.jobRoleId && (
                  <p className="text-sm text-destructive">{form.formState.errors.jobRoleId.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="courseId">Training Course *</Label>
                <Controller
                  name="courseId"
                  control={form.control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger data-testid="select-course">
                        <SelectValue placeholder="Select course" />
                      </SelectTrigger>
                      <SelectContent>
                        {courses.map(course => (
                          <SelectItem key={course.id} value={course.id}>
                            {course.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {form.formState.errors.courseId && (
                  <p className="text-sm text-destructive">{form.formState.errors.courseId.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="policyStatus">Policy Status *</Label>
                <Controller
                  name="policyStatus"
                  control={form.control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger data-testid="select-policy-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MANDATORY">Mandatory</SelectItem>
                        <SelectItem value="OPTIONAL">Optional</SelectItem>
                        <SelectItem value="NA">Not Applicable</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {form.formState.errors.policyStatus && (
                  <p className="text-sm text-destructive">{form.formState.errors.policyStatus.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="costCap">Cost Cap (optional)</Label>
                <Input
                  id="costCap"
                  {...form.register("costCap")}
                  placeholder="e.g., £1000"
                  data-testid="input-cost-cap"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Controller
                name="requiresApproval"
                control={form.control}
                render={({ field }) => (
                  <Checkbox
                    id="requiresApproval"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    data-testid="checkbox-requires-approval"
                  />
                )}
              />
              <Label htmlFor="requiresApproval" className="cursor-pointer">
                Requires manager approval before booking
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                {...form.register("notes")}
                placeholder="Additional policy notes or requirements..."
                rows={3}
                data-testid="input-notes"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog} data-testid="button-cancel">
                Cancel
              </Button>
              <Button type="submit" disabled={savePolicyMutation.isPending} data-testid="button-save-policy">
                {savePolicyMutation.isPending ? "Saving..." : editingPolicy ? "Update Policy" : "Add Policy"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

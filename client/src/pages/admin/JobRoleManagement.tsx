import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import AssessmentTwoColumn from "@/components/AssessmentTwoColumn";
import { ManageTrainingsDialog } from "@/components/ManageTrainingsDialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Briefcase,
  Plus,
  Edit,
  Trash2,
  Search,
  Settings2,
  Target,
  CheckCircle2,
  Circle,
  Eye,
  GraduationCap,
  Copy,
} from "lucide-react";
import type {
  JobRole,
  CompetencyElement,
  CompetencyCategory,
  RoleElement,
  CompetencyLevel,
  RoleElementLevel,
  Training,
  TrainingCategory,
  RoleTraining,
} from "@shared/schema";

const TRAINING_REQUIREMENT_LABELS: Record<string, string> = {
  M: "Mandatory",
  R: "Role Specific",
  D: "Discretionary",
};

const jobRoleFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().min(1, "Code is required"),
  description: z.string().optional(),
  department: z.string().optional(),
  location: z.string().optional(),
  businessUnit: z.string().optional(),
  level: z.string().optional(),
});

type JobRoleFormData = z.infer<typeof jobRoleFormSchema>;

interface RoleMatrixData {
  role: JobRole;
  elements: Array<{
    id: string; // role-element ID needed for deletion
    elementId: string;
    elementName: string;
    categoryId?: string;
    categoryName?: string;
    required: boolean;
    requirementLevel: string | null;
    activityType: string | null;
    validityYears: number | null;
    safetyCritical: boolean | null;
  }>;
}

export default function JobRoleManagement() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<JobRole | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isManageElementsOpen, setIsManageElementsOpen] = useState(false);
  const [isManageTrainingsOpen, setIsManageTrainingsOpen] = useState(false);
  const [viewingElementId, setViewingElementId] = useState<string | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<JobRole | null>(null);
  const [duplicatingRole, setDuplicatingRole] = useState<JobRole | null>(null);
  const [duplicateName, setDuplicateName] = useState("");
  const [duplicateCode, setDuplicateCode] = useState("");

  const { data: jobRoles, isLoading: loadingRoles } = useQuery<JobRole[]>({
    queryKey: ['/api/job-roles'],
  });

  const { data: categories } = useQuery<CompetencyCategory[]>({
    queryKey: ['/api/competency-categories'],
  });

  const { data: allElements } = useQuery<CompetencyElement[]>({
    queryKey: ['/api/competency-elements'],
  });

  const { data: roleMatrix, isLoading: loadingMatrix } = useQuery<RoleMatrixData>({
    queryKey: ['/api/job-roles', selectedRole?.id, 'matrix'],
    queryFn: async () => {
      if (!selectedRole) return { role: selectedRole!, elements: [] };
      const response = await fetch(`/api/job-roles/${selectedRole.id}/matrix`);
      if (!response.ok) throw new Error('Failed to fetch role matrix');
      return response.json();
    },
    enabled: !!selectedRole,
  });

  const { data: trainingCategories } = useQuery<TrainingCategory[]>({
    queryKey: ['/api/training-categories'],
  });

  const { data: roleTrainings, isLoading: loadingRoleTrainings } = useQuery<Array<RoleTraining & { training: Training }>>({
    queryKey: ['/api/role-trainings', { roleId: selectedRole?.id }],
    enabled: !!selectedRole,
  });

  const createForm = useForm<JobRoleFormData>({
    resolver: zodResolver(jobRoleFormSchema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
      department: "",
      location: "",
      businessUnit: "",
      level: "",
    },
  });

  const editForm = useForm<JobRoleFormData>({
    resolver: zodResolver(jobRoleFormSchema),
  });

  const createMutation = useMutation({
    mutationFn: async (data: JobRoleFormData) => {
      const response = await apiRequest('POST', '/api/job-roles', data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/job-roles'] });
      toast({
        title: "Job Role Created",
        description: "The job role has been created successfully.",
      });
      setIsCreateDialogOpen(false);
      createForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create job role",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: JobRoleFormData) => {
      if (!selectedRole) throw new Error("No role selected");
      const response = await apiRequest('PATCH', `/api/job-roles/${selectedRole.id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/job-roles'] });
      toast({
        title: "Job Role Updated",
        description: "The job role has been updated successfully.",
      });
      setIsEditDialogOpen(false);
      setSelectedRole(null);
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update job role",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/job-roles/${id}`);
      if (!response.ok) throw new Error('Failed to delete job role');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/job-roles'] });
      toast({
        title: "Job Role Deleted",
        description: "The job role has been deleted successfully.",
      });
      setIsDeleteDialogOpen(false);
      setRoleToDelete(null);
      if (selectedRole?.id === roleToDelete?.id) {
        setSelectedRole(null);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Deletion Failed",
        description: error.message || "Failed to delete job role",
        variant: "destructive",
      });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async () => {
      if (!duplicatingRole) return;
      const response = await apiRequest('POST', `/api/job-roles/${duplicatingRole.id}/duplicate`, {
        name: duplicateName,
        code: duplicateCode,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to duplicate job role');
      }
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/job-roles'] });
      toast({
        title: "Job Role Duplicated",
        description: `"${result.role.name}" created with ${result.elementsCopied} element(s) and ${result.trainingsCopied} training(s) copied.`,
      });
      setDuplicatingRole(null);
      setDuplicateName("");
      setDuplicateCode("");
    },
    onError: (error: any) => {
      toast({
        title: "Duplication Failed",
        description: error.message || "Failed to duplicate job role",
        variant: "destructive",
      });
    },
  });

  const handleCreateSubmit = (data: JobRoleFormData) => {
    createMutation.mutate(data);
  };

  const handleEditSubmit = (data: JobRoleFormData) => {
    updateMutation.mutate(data);
  };

  const handleEdit = (role: JobRole) => {
    setSelectedRole(role);
    editForm.reset({
      name: role.name,
      code: role.code,
      description: role.description || "",
      department: role.department || "",
      location: role.location || "",
      businessUnit: role.businessUnit || "",
      level: role.level || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (role: JobRole) => {
    setRoleToDelete(role);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (roleToDelete) {
      deleteMutation.mutate(roleToDelete.id);
    }
  };

  const filteredRoles = jobRoles?.filter(role =>
    role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    role.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    role.department?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedElements = roleMatrix?.elements.reduce((acc, element) => {
    const categoryName = element.categoryName || 'Competence Elements';
    if (!acc[categoryName]) {
      acc[categoryName] = [];
    }
    acc[categoryName].push(element);
    return acc;
  }, {} as Record<string, typeof roleMatrix.elements>);

  const trainingCategoryById = new Map((trainingCategories || []).map(c => [c.id, c]));

  const groupedTrainings = roleTrainings?.reduce((acc, rt) => {
    const categoryName = trainingCategoryById.get(rt.training.categoryId)?.name || 'Training Courses';
    if (!acc[categoryName]) {
      acc[categoryName] = [];
    }
    acc[categoryName].push(rt);
    return acc;
  }, {} as Record<string, typeof roleTrainings>);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Job Role Management</h1>
          <p className="text-muted-foreground">
            Create job roles and assign competence elements
          </p>
        </div>
        <Button
          onClick={() => setIsCreateDialogOpen(true)}
          data-testid="button-create-role"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Job Role
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Job Roles Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Job Roles
            </CardTitle>
            <CardDescription>
              {filteredRoles?.length || 0} role(s) available
            </CardDescription>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, code, or department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-roles"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loadingRoles ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading job roles...
              </div>
            ) : filteredRoles && filteredRoles.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRoles.map((role) => (
                    <TableRow
                      key={role.id}
                      className={selectedRole?.id === role.id ? "bg-muted" : ""}
                      data-testid={`row-role-${role.id}`}
                    >
                      <TableCell>
                        <button
                          onClick={() => setSelectedRole(role)}
                          className="text-left hover:underline font-medium"
                          data-testid={`button-select-role-${role.id}`}
                        >
                          {role.name}
                        </button>
                        {role.department && (
                          <div className="text-xs text-muted-foreground">
                            {role.department}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{role.code}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(role)}
                            data-testid={`button-edit-role-${role.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setDuplicatingRole(role);
                              setDuplicateName(`${role.name} (Copy)`);
                              setDuplicateCode(`${role.code}-COPY`);
                            }}
                            data-testid={`button-duplicate-role-${role.id}`}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(role)}
                            data-testid={`button-delete-role-${role.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No job roles found. Create one to get started.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column - Role Details & Matrix */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Role Details
              </span>
              {selectedRole && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsManageElementsOpen(true)}
                    data-testid="button-manage-elements"
                  >
                    <Settings2 className="mr-2 h-4 w-4" />
                    Manage Elements
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsManageTrainingsOpen(true)}
                    data-testid="button-manage-trainings"
                  >
                    <GraduationCap className="mr-2 h-4 w-4" />
                    Manage Trainings
                  </Button>
                </div>
              )}
            </CardTitle>
            <CardDescription>
              {selectedRole ? "View and manage assigned competence elements" : "Select a role to view details"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedRole ? (
              <div className="space-y-6">
                {/* Role Information */}
                <div className="grid grid-cols-2 gap-4 pb-4 border-b">
                  <div>
                    <div className="text-sm text-muted-foreground">Role Name</div>
                    <div className="font-medium">{selectedRole.name}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Code</div>
                    <div className="font-medium">{selectedRole.code}</div>
                  </div>
                  {selectedRole.department && (
                    <div>
                      <div className="text-sm text-muted-foreground">Department</div>
                      <div className="font-medium">{selectedRole.department}</div>
                    </div>
                  )}
                  {selectedRole.location && (
                    <div>
                      <div className="text-sm text-muted-foreground">Location</div>
                      <div className="font-medium">{selectedRole.location}</div>
                    </div>
                  )}
                  {selectedRole.businessUnit && (
                    <div>
                      <div className="text-sm text-muted-foreground">Business Unit</div>
                      <div className="font-medium">{selectedRole.businessUnit}</div>
                    </div>
                  )}
                  {selectedRole.level && (
                    <div>
                      <div className="text-sm text-muted-foreground">Level</div>
                      <div className="font-medium">{selectedRole.level}</div>
                    </div>
                  )}
                  {selectedRole.description && (
                    <div className="col-span-2">
                      <div className="text-sm text-muted-foreground">Description</div>
                      <div className="font-medium">{selectedRole.description}</div>
                    </div>
                  )}
                </div>

                {/* Assigned Elements Matrix */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">
                    Assigned Elements ({roleMatrix?.elements.length || 0})
                  </h3>
                  {loadingMatrix ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Loading elements...
                    </div>
                  ) : roleMatrix && roleMatrix.elements.length > 0 ? (
                    <Accordion type="multiple" className="w-full">
                      {Object.entries(groupedElements || {}).map(([categoryName, elements]) => (
                        <AccordionItem key={categoryName} value={categoryName}>
                          <AccordionTrigger>
                            {categoryName}
                            <Badge variant="secondary" className="ml-2">
                              {elements.length}
                            </Badge>
                          </AccordionTrigger>
                          <AccordionContent>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Element</TableHead>
                                  <TableHead className="text-right">Required</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {elements.map((element) => (
                                  <TableRow
                                    key={element.elementId}
                                    className="cursor-pointer hover-elevate"
                                    onClick={() => setViewingElementId(element.elementId)}
                                    data-testid={`row-element-${element.elementId}`}
                                  >
                                    <TableCell>{element.elementName}</TableCell>
                                    <TableCell className="text-right">
                                      {element.required ? (
                                        <Badge variant="default">
                                          <CheckCircle2 className="h-3 w-3 mr-1" />
                                          Required
                                        </Badge>
                                      ) : (
                                        <Badge variant="secondary">
                                          <Circle className="h-3 w-3 mr-1" />
                                          Optional
                                        </Badge>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground border rounded-md">
                      No elements assigned to this role yet.
                      <br />
                      Click "Manage Elements" to add some.
                    </div>
                  )}
                </div>

                {/* Assigned Trainings Matrix */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">
                    Assigned Trainings ({roleTrainings?.length || 0})
                  </h3>
                  {loadingRoleTrainings ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Loading trainings...
                    </div>
                  ) : roleTrainings && roleTrainings.length > 0 ? (
                    <Accordion type="multiple" className="w-full">
                      {Object.entries(groupedTrainings || {}).map(([categoryName, trainingsInCategory]) => (
                        <AccordionItem key={categoryName} value={categoryName}>
                          <AccordionTrigger>
                            {categoryName}
                            <Badge variant="secondary" className="ml-2">
                              {trainingsInCategory.length}
                            </Badge>
                          </AccordionTrigger>
                          <AccordionContent>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Training</TableHead>
                                  <TableHead className="text-right">Requirement</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {trainingsInCategory.map((rt) => (
                                  <TableRow
                                    key={rt.id}
                                    data-testid={`row-role-training-${rt.trainingId}`}
                                  >
                                    <TableCell>{rt.training.name}</TableCell>
                                    <TableCell className="text-right">
                                      <Badge variant={rt.requirementLevel === 'D' ? 'secondary' : 'default'}>
                                        {TRAINING_REQUIREMENT_LABELS[rt.requirementLevel || 'M'] || rt.requirementLevel}
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground border rounded-md">
                      No trainings assigned to this role yet.
                      <br />
                      Click "Manage Trainings" to add some.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Briefcase className="mx-auto h-12 w-12 mb-4 opacity-20" />
                Select a job role from the table to view its details and assigned competence elements.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Job Role Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent data-testid="dialog-create-role">
          <DialogHeader>
            <DialogTitle>Create Job Role</DialogTitle>
            <DialogDescription>
              Add a new job role to the system. Required fields are marked with *.
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4">
              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Senior Electrical Engineer" {...field} data-testid="input-role-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., SEE01" {...field} data-testid="input-role-code" />
                    </FormControl>
                    <FormDescription>
                      A unique identifier for this role
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input placeholder="Brief description of the role" {...field} data-testid="input-role-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Engineering" {...field} data-testid="input-role-department" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Offshore" {...field} data-testid="input-role-location" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="businessUnit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Unit</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Operations" {...field} data-testid="input-role-business-unit" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="level"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Level</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Senior" {...field} data-testid="input-role-level" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)} data-testid="button-cancel-create">
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-create">
                  {createMutation.isPending ? "Creating..." : "Create Role"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Job Role Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent data-testid="dialog-edit-role">
          <DialogHeader>
            <DialogTitle>Edit Job Role</DialogTitle>
            <DialogDescription>
              Update the job role information.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Senior Electrical Engineer" {...field} data-testid="input-edit-role-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., SEE01" {...field} data-testid="input-edit-role-code" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input placeholder="Brief description of the role" {...field} data-testid="input-edit-role-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Engineering" {...field} data-testid="input-edit-role-department" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Offshore" {...field} data-testid="input-edit-role-location" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="businessUnit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Unit</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Operations" {...field} data-testid="input-edit-role-business-unit" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="level"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Level</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Senior" {...field} data-testid="input-edit-role-level" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} data-testid="button-cancel-edit">
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending} data-testid="button-submit-edit">
                  {updateMutation.isPending ? "Updating..." : "Update Role"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-role">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Job Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{roleToDelete?.name}"? This action cannot be undone.
              Users assigned to this role will lose their role assignment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Duplicate Job Role Dialog */}
      <Dialog open={!!duplicatingRole} onOpenChange={(open) => !open && setDuplicatingRole(null)}>
        <DialogContent data-testid="dialog-duplicate-role">
          <DialogHeader>
            <DialogTitle>Duplicate Job Role</DialogTitle>
            <DialogDescription>
              Creates a new job role with all of "{duplicatingRole?.name}"'s assigned competence
              elements and trainings copied across. Edit the new role afterward to make it its own.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">New Role Name</label>
              <Input
                value={duplicateName}
                onChange={(e) => setDuplicateName(e.target.value)}
                data-testid="input-duplicate-role-name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">New Role Code</label>
              <Input
                value={duplicateCode}
                onChange={(e) => setDuplicateCode(e.target.value)}
                data-testid="input-duplicate-role-code"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDuplicatingRole(null)}>Cancel</Button>
            <Button
              onClick={() => duplicateMutation.mutate()}
              disabled={duplicateMutation.isPending || !duplicateName.trim() || !duplicateCode.trim()}
              data-testid="button-confirm-duplicate"
            >
              {duplicateMutation.isPending ? "Duplicating…" : "Duplicate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Elements Dialog - To be implemented in next task */}
      {selectedRole && (
        <ManageElementsDialog
          role={selectedRole}
          isOpen={isManageElementsOpen}
          onClose={() => setIsManageElementsOpen(false)}
          categories={categories || []}
          allElements={allElements || []}
          assignedElements={roleMatrix?.elements || []}
          onViewCriteria={setViewingElementId}
        />
      )}

      {/* Manage Trainings Dialog */}
      {selectedRole && (
        <ManageTrainingsDialog
          role={selectedRole}
          isOpen={isManageTrainingsOpen}
          onClose={() => setIsManageTrainingsOpen(false)}
        />
      )}

      {/* Element Criteria Detail Dialog */}
      <Dialog open={!!viewingElementId} onOpenChange={(open) => !open && setViewingElementId(null)}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          {viewingElementId && <AssessmentTwoColumn elementId={viewingElementId} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Manage Elements Dialog Component
interface ManageElementsDialogProps {
  role: JobRole;
  isOpen: boolean;
  onClose: () => void;
  categories: CompetencyCategory[];
  allElements: CompetencyElement[];
  assignedElements: Array<{
    id: string; // role-element ID
    elementId: string;
    elementName: string;
    required: boolean;
    requirementLevel: string | null;
    activityType: string | null;
    validityYears: number | null;
    safetyCritical: boolean | null;
  }>;
  onViewCriteria: (elementId: string) => void;
}

const REQUIREMENT_LEVEL_LABELS: Record<string, string> = {
  M: "Mandatory",
  R: "Role Specific",
  D: "Discretionary",
};

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  knowledge: "Knowledge Assessment",
  performance: "Performance Assessment",
  both: "Performance & Knowledge Assessment",
};

interface ElementWithLevels extends CompetencyElement {
  levels?: CompetencyLevel[];
}

function ManageElementsDialog({
  role,
  isOpen,
  onClose,
  categories,
  allElements,
  assignedElements,
  onViewCriteria,
}: ManageElementsDialogProps) {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedLevels, setSelectedLevels] = useState<Map<string, string[]>>(new Map());
  const [showOnlyWithLevels, setShowOnlyWithLevels] = useState(false);

  // Create a map of element ID to role-element for quick lookup
  const assignedMap = new Map(assignedElements.map(el => [el.elementId, el]));

  // Fetch all competency levels
  const { data: allLevels = [] } = useQuery<CompetencyLevel[]>({
    queryKey: ['/api/competency-levels'],
  });

  // Fetch assigned role-element-levels for this role
  const { data: assignedRoleLevels = [] } = useQuery<RoleElementLevel[]>({
    queryKey: ['/api/role-element-levels', role.id],
    queryFn: async () => {
      const response = await fetch(`/api/role-element-levels?roleId=${role.id}`);
      if (!response.ok) return [];
      return response.json();
    },
  });

  // Group levels by element ID
  const levelsByElement = allLevels.reduce((acc, level) => {
    if (!acc[level.elementId]) acc[level.elementId] = [];
    acc[level.elementId].push(level);
    return acc;
  }, {} as Record<string, CompetencyLevel[]>);

  const assignMutation = useMutation({
    mutationFn: async ({ elementId, required, levelIds }: { elementId: string; required: boolean; levelIds?: string[] }) => {
      // First create the role-element assignment
      const response = await apiRequest('POST', '/api/role-elements', {
        roleId: role.id,
        elementId,
        required,
      });
      const roleElement = await response.json();

      // If element has levels and specific levels selected, create role-element-level assignments
      if (levelIds && levelIds.length > 0) {
        const levelAssignments = levelIds.map(levelId => ({
          roleId: role.id,
          elementId,
          levelId,
        }));
        
        await apiRequest('POST', '/api/role-element-levels/bulk', {
          assignments: levelAssignments,
        });
      }
      
      return roleElement;
    },
    onSuccess: (roleElement: { sync?: { usersSynced: number; assessmentsCreated: number; trainingsEnrolled: number } }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/job-roles', role.id, 'matrix'] });
      queryClient.invalidateQueries({ queryKey: ['/api/job-roles'] });
      queryClient.invalidateQueries({ queryKey: ['/api/role-element-levels', role.id] });
      const sync = roleElement.sync;
      toast({
        title: "Element Assigned",
        description: sync
          ? `Assigned to this role. Synced to ${sync.usersSynced} existing candidate${sync.usersSynced === 1 ? '' : 's'} in this role (${sync.assessmentsCreated} new assessment${sync.assessmentsCreated === 1 ? '' : 's'} created).`
          : "The element has been assigned to this role.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Assignment Failed",
        description: error.message || "Failed to assign element",
        variant: "destructive",
      });
    },
  });

  const unassignMutation = useMutation({
    mutationFn: async (roleElementId: string) => {
      const response = await apiRequest('DELETE', `/api/role-elements/${roleElementId}`);
      if (!response.ok) throw new Error('Failed to unassign element');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/job-roles', role.id, 'matrix'] });
      queryClient.invalidateQueries({ queryKey: ['/api/job-roles'] });
      toast({
        title: "Element Unassigned",
        description: "The element has been removed from this role.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Unassignment Failed",
        description: error.message || "Failed to unassign element",
        variant: "destructive",
      });
    },
  });

  const updateRoleElementMutation = useMutation({
    mutationFn: async ({ roleElementId, patch }: { roleElementId: string; patch: Record<string, unknown> }) => {
      const response = await apiRequest('PATCH', `/api/role-elements/${roleElementId}`, patch);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/job-roles', role.id, 'matrix'] });
      toast({
        title: "Updated",
        description: "Element assignment updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update assignment",
        variant: "destructive",
      });
    },
  });

  const assignLevelMutation = useMutation({
    mutationFn: async ({ elementId, levelId }: { elementId: string; levelId: string }) => {
      const response = await apiRequest('POST', '/api/role-element-levels', {
        roleId: role.id,
        elementId,
        levelId,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/role-element-levels', role.id] });
      toast({
        title: "Level Assigned",
        description: "The competency level has been assigned to this role.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Assignment Failed",
        description: error.message || "Failed to assign level",
        variant: "destructive",
      });
    },
  });

  const unassignLevelMutation = useMutation({
    mutationFn: async (roleLevelId: string) => {
      const response = await apiRequest('DELETE', `/api/role-element-levels/${roleLevelId}`);
      if (!response.ok) throw new Error('Failed to unassign level');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/role-element-levels', role.id] });
      toast({
        title: "Level Unassigned",
        description: "The competency level has been removed from this role.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Unassignment Failed",
        description: error.message || "Failed to unassign level",
        variant: "destructive",
      });
    },
  });

  const handleToggleElement = async (elementId: string) => {
    const assignedElement = assignedMap.get(elementId);
    
    if (assignedElement) {
      // Unassign the element (and all its levels)
      const levelsForElement = assignedRoleLevels.filter(rl => {
        const level = allLevels.find(l => l.id === rl.levelId);
        return level?.elementId === elementId;
      });
      
      // Delete all level assignments for this element
      for (const roleLevel of levelsForElement) {
        await unassignLevelMutation.mutateAsync(roleLevel.id);
      }
      
      await unassignMutation.mutateAsync(assignedElement.id);
    } else {
      // Assign the element with default required=true
      await assignMutation.mutateAsync({ elementId, required: true });
    }
  };

  const handleToggleLevel = async (elementId: string, levelId: string) => {
    const existingAssignment = assignedRoleLevels.find(rl => rl.levelId === levelId);
    
    if (existingAssignment) {
      await unassignLevelMutation.mutateAsync(existingAssignment.id);
    } else {
      // Make sure element is assigned first
      const assignedElement = assignedMap.get(elementId);
      if (!assignedElement) {
        // Assign element first
        await assignMutation.mutateAsync({ elementId, required: true });
      }
      await assignLevelMutation.mutateAsync({ elementId, levelId });
    }
  };

  const handleUpdateRoleElementField = async (elementId: string, patch: Record<string, unknown>) => {
    const assignedElement = assignedMap.get(elementId);
    if (!assignedElement) return;

    await updateRoleElementMutation.mutateAsync({
      roleElementId: assignedElement.id,
      patch,
    });
  };

  const filteredElements = allElements.filter(el => {
    // Category filter
    if (selectedCategory && el.categoryId !== selectedCategory) return false;
    
    // Level filter - show only elements with proficiency levels
    if (showOnlyWithLevels) {
      const hasLevels = levelsByElement[el.id] && levelsByElement[el.id].length > 0;
      return hasLevels;
    }
    
    return true;
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]" data-testid="dialog-manage-elements">
        <DialogHeader>
          <DialogTitle>Manage Elements for {role.name}</DialogTitle>
          <DialogDescription>
            Select competence elements to assign to this job role and mark them as required or optional.
            For elements with proficiency levels, hover over level badges to see descriptions. Edit level descriptions in Competency Levels Management.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-2 gap-4">
            {/* Category Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Filter by Category</label>
              <Select value={selectedCategory || "__all__"} onValueChange={(val) => setSelectedCategory(val === "__all__" ? "" : val)}>
                <SelectTrigger data-testid="select-category-filter">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Categories</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Level Filter */}
            <div className="flex items-end">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="filter-levels"
                  checked={showOnlyWithLevels}
                  onCheckedChange={(checked) => setShowOnlyWithLevels(checked as boolean)}
                  data-testid="checkbox-filter-levels"
                />
                <label htmlFor="filter-levels" className="text-sm font-medium cursor-pointer">
                  Show only multi-level elements
                </label>
              </div>
            </div>
          </div>

          {/* Dual-Column Picklist */}
          <div className="grid grid-cols-2 gap-4">
            {/* Available Elements Column */}
            <div className="border rounded-md">
              <div className="bg-muted px-4 py-2 font-semibold border-b">
                Available Elements ({filteredElements.filter(el => !assignedMap.has(el.id)).length})
              </div>
              <div className="p-2 max-h-96 overflow-y-auto">
                {filteredElements.filter(el => !assignedMap.has(el.id)).length > 0 ? (
                  <div className="space-y-1">
                    {filteredElements.filter(el => !assignedMap.has(el.id)).map(element => {
                      const category = categories.find(c => c.id === element.categoryId);
                      const elementLevels = levelsByElement[element.id] || [];
                      const hasLevels = elementLevels.length > 0;
                      
                      return (
                        <div
                          key={element.id}
                          className="flex items-start gap-2 p-2 border rounded hover-elevate group"
                          data-testid={`available-element-${element.id}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="font-medium break-words">{element.name}</div>
                              {hasLevels && (
                                <Badge variant="secondary" className="text-xs shrink-0" data-testid={`badge-multi-level-${element.id}`}>
                                  {elementLevels.length} Levels
                                </Badge>
                              )}
                            </div>
                            {category && (
                              <div className="text-xs text-muted-foreground">{category.name}</div>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleToggleElement(element.id)}
                            disabled={assignMutation.isPending}
                            className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            data-testid={`button-assign-${element.id}`}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    All elements assigned
                  </div>
                )}
              </div>
            </div>

            {/* Assigned Elements Column */}
            <div className="border rounded-md">
              <div className="bg-muted px-4 py-2 font-semibold border-b">
                Assigned Elements ({assignedElements.length})
              </div>
              <div className="p-2 max-h-96 overflow-y-auto">
                {assignedElements.length > 0 ? (
                  <div className="space-y-1">
                    {assignedElements.map(assignedEl => {
                      const element = allElements.find(el => el.id === assignedEl.elementId);
                      if (!element) return null;
                      const category = categories.find(c => c.id === element.categoryId);
                      
                      // Get levels for this element if any
                      const elementLevels = levelsByElement[element.id] || [];
                      const assignedLevelsForElement = assignedRoleLevels
                        .filter(rl => {
                          const level = allLevels.find(l => l.id === rl.levelId);
                          return level?.elementId === element.id;
                        })
                        .map(rl => rl.levelId);
                      
                      return (
                        <div
                          key={assignedEl.id}
                          className="border rounded p-2 hover-elevate group"
                          data-testid={`assigned-element-${assignedEl.elementId}`}
                        >
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="font-medium break-words">{element.name}</div>
                                {elementLevels.length > 0 && (
                                  <Badge variant="secondary" className="text-xs shrink-0">
                                    {elementLevels.length} Levels
                                  </Badge>
                                )}
                              </div>
                              {category && (
                                <div className="text-xs text-muted-foreground">{category.name}</div>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onViewCriteria(element.id)}
                              className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              data-testid={`button-view-criteria-${element.id}`}
                              title="View Safety / Knowledge / Performance criteria"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleToggleElement(element.id)}
                              disabled={unassignMutation.isPending}
                              className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              data-testid={`button-unassign-${element.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-xs text-muted-foreground">Requirement</label>
                              <Select
                                value={assignedEl.requirementLevel ?? "M"}
                                onValueChange={(value) => handleUpdateRoleElementField(element.id, { requirementLevel: value })}
                                disabled={updateRoleElementMutation.isPending}
                              >
                                <SelectTrigger className="h-8 text-xs" data-testid={`select-requirement-level-${element.id}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(REQUIREMENT_LEVEL_LABELS).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>{label} ({value})</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1">
                              <label className="text-xs text-muted-foreground">Activity Type</label>
                              <Select
                                value={assignedEl.activityType ?? "both"}
                                onValueChange={(value) => handleUpdateRoleElementField(element.id, { activityType: value })}
                                disabled={updateRoleElementMutation.isPending}
                              >
                                <SelectTrigger className="h-8 text-xs" data-testid={`select-activity-type-${element.id}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(ACTIVITY_TYPE_LABELS).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>{label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1">
                              <label className="text-xs text-muted-foreground">Validity (years)</label>
                              <Input
                                type="number"
                                min={0}
                                className="h-8 text-xs"
                                placeholder="Inherit from element"
                                defaultValue={assignedEl.validityYears ?? ""}
                                onBlur={(e) => {
                                  const raw = e.target.value.trim();
                                  handleUpdateRoleElementField(element.id, { validityYears: raw ? parseInt(raw, 10) : null });
                                }}
                                data-testid={`input-validity-years-${element.id}`}
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-xs text-muted-foreground">Safety Critical</label>
                              <Select
                                value={assignedEl.safetyCritical === null ? "inherit" : assignedEl.safetyCritical ? "yes" : "no"}
                                onValueChange={(value) => handleUpdateRoleElementField(element.id, {
                                  safetyCritical: value === "inherit" ? null : value === "yes",
                                })}
                                disabled={updateRoleElementMutation.isPending}
                              >
                                <SelectTrigger className="h-8 text-xs" data-testid={`select-safety-critical-${element.id}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="inherit">Inherit from element</SelectItem>
                                  <SelectItem value="yes">Yes</SelectItem>
                                  <SelectItem value="no">No</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* Level Selection - Only show if element has levels */}
                          {elementLevels.length > 0 && (
                            <div className="mt-3 pt-3 border-t space-y-2">
                              <div className="text-xs font-medium text-muted-foreground">Proficiency Levels:</div>
                              <div className="flex flex-wrap gap-2">
                                {elementLevels
                                  .sort((a, b) => a.order - b.order)
                                  .map(level => {
                                    const isAssigned = assignedLevelsForElement.includes(level.id);
                                    const isPending = assignLevelMutation.isPending || unassignLevelMutation.isPending;
                                    return (
                                      <Tooltip key={level.id}>
                                        <TooltipTrigger asChild>
                                          <Badge
                                            variant={isAssigned ? "default" : "outline"}
                                            className={`cursor-pointer hover-elevate ${isPending ? 'opacity-50 pointer-events-none' : ''}`}
                                            onClick={() => !isPending && handleToggleLevel(element.id, level.id)}
                                            data-testid={`badge-level-${level.id}`}
                                          >
                                            {level.name}
                                            {isAssigned && <CheckCircle2 className="ml-1 h-3 w-3" />}
                                          </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="max-w-sm">
                                          <div className="space-y-1">
                                            <div className="font-semibold">{level.name}</div>
                                            {level.description && (
                                              <div className="text-xs text-muted-foreground">{level.description}</div>
                                            )}
                                            <div className="text-xs text-muted-foreground">Code: {level.code}</div>
                                          </div>
                                        </TooltipContent>
                                      </Tooltip>
                                    );
                                  })}
                              </div>
                              {assignedLevelsForElement.length > 0 && (
                                <div className="text-xs text-muted-foreground">
                                  {assignedLevelsForElement.length} level(s) assigned
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    No elements assigned yet
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="flex items-center justify-between text-sm text-muted-foreground border-t pt-4">
            <span>{assignedElements.length} elements assigned</span>
            <span>{assignedElements.filter(el => el.required).length} required</span>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose} data-testid="button-close-manage-elements">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

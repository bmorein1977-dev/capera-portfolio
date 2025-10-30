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
import { useToast } from "@/hooks/use-toast";
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
} from "lucide-react";
import type {
  JobRole,
  CompetencyElement,
  CompetencyCategory,
  RoleElement,
} from "@shared/schema";

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
  const [roleToDelete, setRoleToDelete] = useState<JobRole | null>(null);

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
    const categoryName = element.categoryName || 'Uncategorized';
    if (!acc[categoryName]) {
      acc[categoryName] = [];
    }
    acc[categoryName].push(element);
    return acc;
  }, {} as Record<string, typeof roleMatrix.elements>);

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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsManageElementsOpen(true)}
                  data-testid="button-manage-elements"
                >
                  <Settings2 className="mr-2 h-4 w-4" />
                  Manage Elements
                </Button>
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
                                  <TableRow key={element.elementId}>
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

      {/* Manage Elements Dialog - To be implemented in next task */}
      {selectedRole && (
        <ManageElementsDialog
          role={selectedRole}
          isOpen={isManageElementsOpen}
          onClose={() => setIsManageElementsOpen(false)}
          categories={categories || []}
          allElements={allElements || []}
          assignedElements={roleMatrix?.elements || []}
        />
      )}
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
  }>;
}

function ManageElementsDialog({
  role,
  isOpen,
  onClose,
  categories,
  allElements,
  assignedElements,
}: ManageElementsDialogProps) {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  // Create a map of element ID to role-element for quick lookup
  const assignedMap = new Map(assignedElements.map(el => [el.elementId, el]));

  const assignMutation = useMutation({
    mutationFn: async ({ elementId, required }: { elementId: string; required: boolean }) => {
      const response = await apiRequest('POST', '/api/role-elements', {
        roleId: role.id,
        elementId,
        required,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/job-roles', role.id, 'matrix'] });
      queryClient.invalidateQueries({ queryKey: ['/api/job-roles'] });
      toast({
        title: "Element Assigned",
        description: "The element has been assigned to this role.",
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

  const updateRequiredMutation = useMutation({
    mutationFn: async ({ roleElementId, required }: { roleElementId: string; required: boolean }) => {
      const response = await apiRequest('PATCH', `/api/role-elements/${roleElementId}`, { required });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/job-roles', role.id, 'matrix'] });
      toast({
        title: "Updated",
        description: "Element requirement updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update requirement",
        variant: "destructive",
      });
    },
  });

  const handleToggleElement = async (elementId: string) => {
    const assignedElement = assignedMap.get(elementId);
    
    if (assignedElement) {
      // Unassign the element
      await unassignMutation.mutateAsync(assignedElement.id);
    } else {
      // Assign the element with default required=true
      await assignMutation.mutateAsync({ elementId, required: true });
    }
  };

  const handleToggleRequired = async (elementId: string) => {
    const assignedElement = assignedMap.get(elementId);
    if (!assignedElement) return;
    
    const newRequired = !assignedElement.required;
    await updateRequiredMutation.mutateAsync({
      roleElementId: assignedElement.id,
      required: newRequired,
    });
  };

  const filteredElements = allElements.filter(el => 
    !selectedCategory || el.categoryId === selectedCategory
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]" data-testid="dialog-manage-elements">
        <DialogHeader>
          <DialogTitle>Manage Elements for {role.name}</DialogTitle>
          <DialogDescription>
            Select competence elements to assign to this job role and mark them as required or optional.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Category Filter */}
          <div>
            <label className="text-sm font-medium mb-2 block">Filter by Category</label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger data-testid="select-category-filter">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                      return (
                        <div
                          key={element.id}
                          className="flex items-center justify-between p-2 border rounded hover-elevate group"
                          data-testid={`available-element-${element.id}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{element.name}</div>
                            {category && (
                              <div className="text-xs text-muted-foreground truncate">{category.name}</div>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleToggleElement(element.id)}
                            disabled={assignMutation.isPending}
                            className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
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
                      
                      return (
                        <div
                          key={assignedEl.id}
                          className="border rounded p-2 hover-elevate group"
                          data-testid={`assigned-element-${assignedEl.elementId}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{element.name}</div>
                              {category && (
                                <div className="text-xs text-muted-foreground truncate">{category.name}</div>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleToggleElement(element.id)}
                              disabled={unassignMutation.isPending}
                              className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                              data-testid={`button-unassign-${element.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <Checkbox
                              checked={assignedEl.required}
                              onCheckedChange={() => handleToggleRequired(element.id)}
                              disabled={updateRequiredMutation.isPending}
                              data-testid={`checkbox-required-${element.id}`}
                              id={`required-${element.id}`}
                            />
                            <label
                              htmlFor={`required-${element.id}`}
                              className="text-sm cursor-pointer select-none"
                            >
                              Required
                            </label>
                          </div>
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

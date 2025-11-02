import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Users, Briefcase, Award, CheckCircle2, XCircle, Loader2, GraduationCap } from "lucide-react";
import type { User, JobRole, CompetencyElement, CompetencyCategory, Training, TrainingCategory, CompetencyLevel } from "@shared/schema";

export default function BulkAssignment() {
  const { toast } = useToast();
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedJobRole, setSelectedJobRole] = useState<string>("");
  const [selectedElement, setSelectedElement] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedLevel, setSelectedLevel] = useState<string>("");
  const [selectedTraining, setSelectedTraining] = useState<string>("");
  const [selectedTrainingCategory, setSelectedTrainingCategory] = useState<string>("");

  const { data: users, isLoading: loadingUsers } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  const { data: jobRoles, isLoading: loadingJobRoles } = useQuery<JobRole[]>({
    queryKey: ['/api/job-roles'],
  });

  const { data: categories, isLoading: loadingCategories } = useQuery<CompetencyCategory[]>({
    queryKey: ['/api/competency-categories'],
  });

  const { data: allElements, isLoading: loadingElements } = useQuery<CompetencyElement[]>({
    queryKey: ['/api/competency-elements'],
  });

  const { data: allLevels } = useQuery<CompetencyLevel[]>({
    queryKey: ['/api/competency-levels'],
  });

  const { data: trainingCategories, isLoading: loadingTrainingCategories } = useQuery<TrainingCategory[]>({
    queryKey: ['/api/training-categories'],
  });

  const { data: trainings, isLoading: loadingTrainings } = useQuery<Training[]>({
    queryKey: ['/api/trainings'],
    enabled: !!selectedTrainingCategory,
  });

  const filteredElements = selectedCategory 
    ? allElements?.filter(el => el.categoryId === selectedCategory) 
    : [];
  const filteredTrainings = selectedTrainingCategory
    ? trainings?.filter(t => t.categoryId === selectedTrainingCategory)
    : [];
  const elementLevels = selectedElement
    ? allLevels?.filter(l => l.elementId === selectedElement).sort((a, b) => a.order - b.order) || []
    : [];

  const bulkAssignJobRoleMutation = useMutation({
    mutationFn: async (data: { userIds: string[]; jobRoleId: string }) => {
      const response = await apiRequest('POST', '/api/admin/bulk-assign-job-role', data);
      return await response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/assessments'] });
      toast({
        title: "Bulk Assignment Complete",
        description: `Successfully assigned job role to ${data.successful ?? 0} user(s). ${data.totalAssessmentsCreated ?? 0} assessment(s) created. ${data.failed?.length ?? 0} failed.`,
      });
      setSelectedUsers([]);
      setSelectedJobRole("");
    },
    onError: () => {
      toast({
        title: "Assignment Failed",
        description: "Failed to perform bulk job role assignment",
        variant: "destructive",
      });
    },
  });

  const bulkAssignElementMutation = useMutation({
    mutationFn: async (data: { userIds: string[]; elementId: string; levelId?: string }) => {
      const response = await apiRequest('POST', '/api/admin/bulk-assign-element', data);
      return await response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/assessments'] });
      toast({
        title: "Bulk Assignment Complete",
        description: `Successfully assigned element to ${data.successful ?? 0} user(s). ${data.totalAssessmentsCreated ?? 0} assessment(s) created. ${data.failed?.length ?? 0} failed.`,
      });
      setSelectedUsers([]);
      setSelectedElement("");
      setSelectedCategory("");
      setSelectedLevel("");
    },
    onError: () => {
      toast({
        title: "Assignment Failed",
        description: "Failed to perform bulk element assignment",
        variant: "destructive",
      });
    },
  });

  const bulkAssignTrainingMutation = useMutation({
    mutationFn: async (data: { userIds: string[]; trainingId: string }) => {
      const response = await apiRequest('POST', '/api/admin/bulk-assign-training', data);
      return await response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/training-enrollments'] });
      const parts = [];
      if (data.successful > 0) parts.push(`${data.successful} newly enrolled`);
      if (data.skipped > 0) parts.push(`${data.skipped} already enrolled`);
      if (data.failed?.length > 0) parts.push(`${data.failed.length} failed`);
      
      toast({
        title: "Bulk Training Assignment Complete",
        description: parts.join(', '),
      });
      setSelectedUsers([]);
      setSelectedTraining("");
      setSelectedTrainingCategory("");
    },
    onError: () => {
      toast({
        title: "Assignment Failed",
        description: "Failed to perform bulk training assignment",
        variant: "destructive",
      });
    },
  });

  const handleToggleUser = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === users?.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(users?.map(u => u.id) || []);
    }
  };

  const handleAssignJobRole = () => {
    if (selectedUsers.length === 0 || !selectedJobRole) {
      toast({
        title: "Invalid Selection",
        description: "Please select users and a job role",
        variant: "destructive",
      });
      return;
    }
    bulkAssignJobRoleMutation.mutate({
      userIds: selectedUsers,
      jobRoleId: selectedJobRole,
    });
  };

  const handleAssignElement = () => {
    if (selectedUsers.length === 0 || !selectedElement) {
      toast({
        title: "Invalid Selection",
        description: "Please select users and a competence element",
        variant: "destructive",
      });
      return;
    }
    bulkAssignElementMutation.mutate({
      userIds: selectedUsers,
      elementId: selectedElement,
      levelId: selectedLevel || undefined,
    });
  };

  const handleAssignTraining = () => {
    if (selectedUsers.length === 0 || !selectedTraining) {
      toast({
        title: "Invalid Selection",
        description: "Please select users and a training course",
        variant: "destructive",
      });
      return;
    }
    bulkAssignTrainingMutation.mutate({
      userIds: selectedUsers,
      trainingId: selectedTraining,
    });
  };

  const isLoading = loadingUsers || loadingJobRoles || loadingCategories || loadingTrainingCategories;

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6 pb-8">
        <div className="flex items-center gap-3">
          <Users className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Bulk Assignment</h1>
            <p className="text-muted-foreground">Assign job roles or competence elements to multiple users at once</p>
          </div>
        </div>

        <Card>
          <CardHeader className="gap-1">
            <CardTitle>Select Users</CardTitle>
            <CardDescription>Choose users to assign job roles or competence elements</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedUsers.length === (users?.length ?? 0) && (users?.length ?? 0) > 0}
                    onCheckedChange={handleSelectAll}
                    data-testid="checkbox-select-all"
                  />
                  <span className="text-sm font-medium">Select All ({selectedUsers.length} selected)</span>
                </div>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="border rounded-md divide-y max-h-96 overflow-y-auto">
                  {users?.map(user => (
                    <div
                      key={user.id}
                      className="flex items-center gap-3 p-3 hover-elevate"
                      data-testid={`user-row-${user.id}`}
                    >
                      <Checkbox
                        checked={selectedUsers.includes(user.id)}
                        onCheckedChange={() => handleToggleUser(user.id)}
                        data-testid={`checkbox-user-${user.id}`}
                      />
                      <div className="flex-1">
                        <p className="font-medium">{user.firstName} {user.lastName}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                      <div className="text-sm text-muted-foreground capitalize">{user.role.replace('_', ' ')}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="job-role" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="job-role" data-testid="tab-job-role">
              <Briefcase className="w-4 h-4 mr-2" />
              Assign Job Role
            </TabsTrigger>
            <TabsTrigger value="element" data-testid="tab-element">
              <Award className="w-4 h-4 mr-2" />
              Assign Element
            </TabsTrigger>
            <TabsTrigger value="training" data-testid="tab-training">
              <GraduationCap className="w-4 h-4 mr-2" />
              Assign Training
            </TabsTrigger>
          </TabsList>

          <TabsContent value="job-role" className="space-y-4">
            <Card>
              <CardHeader className="gap-1">
                <CardTitle>Assign Job Role</CardTitle>
                <CardDescription>
                  Select a job role to assign to {selectedUsers.length} user(s). This will automatically assign all competence elements linked to the job role.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pb-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Job Role</label>
                  <Select value={selectedJobRole} onValueChange={setSelectedJobRole}>
                    <SelectTrigger data-testid="select-job-role">
                      <SelectValue placeholder="Select a job role" />
                    </SelectTrigger>
                    <SelectContent>
                      {jobRoles?.map(role => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name} ({role.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="pt-2">
                  <Button
                    onClick={handleAssignJobRole}
                    disabled={selectedUsers.length === 0 || !selectedJobRole || bulkAssignJobRoleMutation.isPending}
                    className="w-full"
                    data-testid="button-assign-job-role"
                    size="lg"
                  >
                    {bulkAssignJobRoleMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Assigning...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Assign Job Role to {selectedUsers.length} User(s)
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="element" className="space-y-4">
            <Card>
              <CardHeader className="gap-1">
                <CardTitle>Assign Competence Element</CardTitle>
                <CardDescription>
                  Select a competence element to assign to {selectedUsers.length} user(s). This will create an assessment record for each user.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pb-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Competence Category</label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger data-testid="select-category">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories?.map(category => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Competence Element</label>
                  <Select
                    value={selectedElement}
                    onValueChange={(val) => {
                      setSelectedElement(val);
                      setSelectedLevel(""); // Reset level when element changes
                    }}
                    disabled={!selectedCategory}
                  >
                    <SelectTrigger data-testid="select-element">
                      <SelectValue placeholder={selectedCategory ? "Select an element" : "Select a category first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredElements?.map(element => (
                        <SelectItem key={element.id} value={element.id}>
                          {element.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {elementLevels.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Proficiency Level (Optional)</label>
                    <Select
                      value={selectedLevel}
                      onValueChange={setSelectedLevel}
                      disabled={!selectedElement}
                    >
                      <SelectTrigger data-testid="select-level">
                        <SelectValue placeholder="No specific level (default)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No specific level (default)</SelectItem>
                        {elementLevels.map(level => (
                          <SelectItem key={level.id} value={level.id}>
                            {level.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      If no level is selected, a general assessment without a specific proficiency level will be created.
                    </p>
                  </div>
                )}

                <Button
                  onClick={handleAssignElement}
                  disabled={selectedUsers.length === 0 || !selectedElement || bulkAssignElementMutation.isPending}
                  className="w-full"
                  data-testid="button-assign-element"
                >
                  {bulkAssignElementMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Assigning...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Assign Element to {selectedUsers.length} User(s)
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="training" className="space-y-4">
            <Card>
              <CardHeader className="gap-1">
                <CardTitle>Assign Training</CardTitle>
                <CardDescription>
                  Select a training course to assign to {selectedUsers.length} user(s). This will create a training enrollment for each user.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pb-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Training Category</label>
                  <Select value={selectedTrainingCategory} onValueChange={setSelectedTrainingCategory}>
                    <SelectTrigger data-testid="select-training-category">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {trainingCategories?.map(category => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Training Course</label>
                  <Select
                    value={selectedTraining}
                    onValueChange={setSelectedTraining}
                    disabled={!selectedTrainingCategory}
                  >
                    <SelectTrigger data-testid="select-training">
                      <SelectValue placeholder={selectedTrainingCategory ? "Select a training" : "Select a category first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredTrainings?.map(training => (
                        <SelectItem key={training.id} value={training.id}>
                          {training.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleAssignTraining}
                  disabled={selectedUsers.length === 0 || !selectedTraining || bulkAssignTrainingMutation.isPending}
                  className="w-full"
                  data-testid="button-assign-training"
                >
                  {bulkAssignTrainingMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Assigning...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Assign Training to {selectedUsers.length} User(s)
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {(bulkAssignJobRoleMutation.data || bulkAssignElementMutation.data || bulkAssignTrainingMutation.data) && (
          <Card>
            <CardHeader className="gap-1">
              <CardTitle>Last Operation Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-3 p-3 border rounded-md">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-sm text-muted-foreground">Successful</p>
                      <p className="text-2xl font-bold">
                        {bulkAssignJobRoleMutation.data?.successful ?? bulkAssignElementMutation.data?.successful ?? bulkAssignTrainingMutation.data?.successful ?? 0}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 border rounded-md">
                    <XCircle className="w-5 h-5 text-red-600" />
                    <div>
                      <p className="text-sm text-muted-foreground">Failed</p>
                      <p className="text-2xl font-bold">
                        {bulkAssignJobRoleMutation.data?.failed?.length ?? bulkAssignElementMutation.data?.failed?.length ?? bulkAssignTrainingMutation.data?.failed?.length ?? 0}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 border rounded-md">
                    <Award className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {bulkAssignTrainingMutation.data ? "Enrollments Created" : "Assessments Created"}
                      </p>
                      <p className="text-2xl font-bold">
                        {bulkAssignJobRoleMutation.data?.totalAssessmentsCreated ?? bulkAssignElementMutation.data?.totalAssessmentsCreated ?? bulkAssignTrainingMutation.data?.totalEnrollmentsCreated ?? 0}
                      </p>
                    </div>
                  </div>
                </div>
                
                {bulkAssignTrainingMutation.data?.skipped > 0 && (
                  <div className="flex items-center gap-3 p-3 border rounded-md bg-muted/50">
                    <GraduationCap className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Already Enrolled (Skipped)</p>
                      <p className="text-2xl font-bold">{bulkAssignTrainingMutation.data.skipped}</p>
                    </div>
                  </div>
                )}

                {((bulkAssignJobRoleMutation.data?.failed?.length ?? 0) > 0 || (bulkAssignElementMutation.data?.failed?.length ?? 0) > 0 || (bulkAssignTrainingMutation.data?.failed?.length ?? 0) > 0) && (
                  <div className="border rounded-md p-4 bg-destructive/5">
                    <h3 className="font-medium text-sm mb-2">Failed Users:</h3>
                    <div className="space-y-1">
                      {(bulkAssignJobRoleMutation.data?.failed ?? bulkAssignElementMutation.data?.failed ?? bulkAssignTrainingMutation.data?.failed ?? []).map((failure: any) => (
                        <div key={failure.userId} className="text-sm text-muted-foreground">
                          {failure.userId}: {failure.error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

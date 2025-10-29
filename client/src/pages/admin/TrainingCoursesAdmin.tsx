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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Pencil, Trash2, BookOpen, DollarSign, Clock } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { ExternalTrainingCourse, TrainingProvider } from "@shared/schema";

const courseFormSchema = z.object({
  title: z.string().min(1, "Course title is required"),
  description: z.string().optional(),
  modality: z.string().min(1, "Modality is required"),
  durationHours: z.coerce.number().int().min(1).optional(),
  cost: z.string().optional(),
  providerId: z.string().min(1, "Provider is required"),
  language: z.string().default("en"),
  tags: z.string().optional(), // Comma-separated
  prerequisites: z.string().optional(), // Comma-separated
  targetAudience: z.string().optional(),
  learningOutcomes: z.string().optional(), // Comma-separated
  certificationProvided: z.boolean().default(false),
});

type CourseFormData = z.infer<typeof courseFormSchema>;

export default function TrainingCoursesAdmin() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<ExternalTrainingCourse | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const form = useForm<CourseFormData>({
    resolver: zodResolver(courseFormSchema),
    defaultValues: {
      title: "",
      description: "",
      modality: "",
      durationHours: undefined,
      cost: "",
      providerId: "",
      language: "en",
      tags: "",
      prerequisites: "",
      targetAudience: "",
      learningOutcomes: "",
      certificationProvided: false,
    },
  });

  // Fetch courses
  const { data: courses = [], isLoading } = useQuery<ExternalTrainingCourse[]>({
    queryKey: ['/api/training/courses'],
  });

  // Fetch providers for dropdown
  const { data: providers = [] } = useQuery<TrainingProvider[]>({
    queryKey: ['/api/training/providers'],
  });

  // Create/Update course mutation
  const saveCourseMutation = useMutation({
    mutationFn: async (data: CourseFormData) => {
      const payload = {
        ...data,
        tags: data.tags ? data.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        prerequisites: data.prerequisites ? data.prerequisites.split(',').map(p => p.trim()).filter(Boolean) : [],
        learningOutcomes: data.learningOutcomes ? data.learningOutcomes.split(',').map(l => l.trim()).filter(Boolean) : [],
      };
      if (editingCourse) {
        return apiRequest('PUT', `/api/training/courses/${editingCourse.id}`, payload);
      } else {
        return apiRequest('POST', '/api/training/courses', payload);
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: editingCourse ? "Course updated successfully" : "Course created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/training/courses'] });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save course",
        variant: "destructive",
      });
    },
  });

  // Delete course mutation
  const deleteCourseMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/training/courses/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Course deactivated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/training/courses'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete course",
        variant: "destructive",
      });
    },
  });

  const handleOpenDialog = (course?: ExternalTrainingCourse) => {
    if (course) {
      setEditingCourse(course);
      form.reset({
        title: course.title,
        description: course.description || "",
        modality: course.modality || "",
        durationHours: course.durationHours || undefined,
        cost: course.cost || "",
        providerId: course.providerId || "",
        language: course.language || "en",
        tags: course.tags?.join(', ') || "",
        prerequisites: course.prerequisites?.join(', ') || "",
        targetAudience: course.targetAudience || "",
        learningOutcomes: course.learningOutcomes?.join(', ') || "",
        certificationProvided: course.certificationProvided || false,
      });
    } else {
      setEditingCourse(null);
      form.reset({
        title: "",
        description: "",
        modality: "",
        durationHours: undefined,
        cost: "",
        providerId: "",
        language: "en",
        tags: "",
        prerequisites: "",
        targetAudience: "",
        learningOutcomes: "",
        certificationProvided: false,
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingCourse(null);
    form.reset();
  };

  const handleSubmit = (data: CourseFormData) => {
    saveCourseMutation.mutate(data);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to deactivate this course?")) {
      deleteCourseMutation.mutate(id);
    }
  };

  const filteredCourses = courses.filter(c =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getProviderName = (providerId: string | null) => {
    if (!providerId) return "—";
    const provider = providers.find(p => p.id === providerId);
    return provider?.name || "Unknown";
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-training-courses-admin">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Training Courses</h1>
          <p className="text-muted-foreground">Manage external training course catalog</p>
        </div>
        <Button onClick={() => handleOpenDialog()} data-testid="button-add-course">
          <Plus className="h-4 w-4 mr-2" />
          Add Course
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <Input
          placeholder="Search courses..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
          data-testid="input-search-courses"
        />
      </div>

      {/* Courses Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Training Courses</CardTitle>
          <CardDescription>{filteredCourses.length} course(s) found</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading courses...</div>
          ) : filteredCourses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? "No courses match your search" : "No courses added yet"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Modality</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCourses.map((course) => (
                    <TableRow key={course.id} data-testid={`row-course-${course.id}`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div>{course.title}</div>
                            {course.certificationProvided && (
                              <Badge variant="secondary" className="text-xs mt-1">Certification</Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{getProviderName(course.providerId)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{course.modality?.replace('_', ' ')}</Badge>
                      </TableCell>
                      <TableCell>
                        {course.durationHours && (
                          <div className="flex items-center gap-1 text-sm">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            {course.durationHours}h
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {course.cost && (
                          <div className="flex items-center gap-1 text-sm">
                            <DollarSign className="h-3 w-3 text-muted-foreground" />
                            {course.cost}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {course.tags?.slice(0, 2).map(tag => (
                            <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                          ))}
                          {course.tags && course.tags.length > 2 && (
                            <Badge variant="secondary" className="text-xs">+{course.tags.length - 2}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={course.isActive ? "default" : "secondary"}>
                          {course.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenDialog(course)}
                            data-testid={`button-edit-course-${course.id}`}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(course.id)}
                            data-testid={`button-delete-course-${course.id}`}
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-course-form">
          <DialogHeader>
            <DialogTitle>{editingCourse ? "Edit Course" : "Add New Course"}</DialogTitle>
            <DialogDescription>
              {editingCourse ? "Update course information" : "Add a new training course to the catalog"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="title">Course Title *</Label>
                <Input
                  id="title"
                  {...form.register("title")}
                  placeholder="e.g., Advanced Safety Management"
                  data-testid="input-course-title"
                />
                {form.formState.errors.title && (
                  <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  {...form.register("description")}
                  placeholder="Course overview and objectives..."
                  rows={3}
                  data-testid="input-course-description"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="providerId">Provider *</Label>
                <Controller
                  name="providerId"
                  control={form.control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger data-testid="select-provider">
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {providers.map(provider => (
                          <SelectItem key={provider.id} value={provider.id}>
                            {provider.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {form.formState.errors.providerId && (
                  <p className="text-sm text-destructive">{form.formState.errors.providerId.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="modality">Modality *</Label>
                <Controller
                  name="modality"
                  control={form.control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger data-testid="select-modality">
                        <SelectValue placeholder="Select modality" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="in_person">In Person</SelectItem>
                        <SelectItem value="online">Online</SelectItem>
                        <SelectItem value="hybrid">Hybrid</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {form.formState.errors.modality && (
                  <p className="text-sm text-destructive">{form.formState.errors.modality.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="durationHours">Duration (hours)</Label>
                <Input
                  id="durationHours"
                  type="number"
                  {...form.register("durationHours")}
                  placeholder="e.g., 16"
                  data-testid="input-course-duration"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cost">Cost</Label>
                <Input
                  id="cost"
                  {...form.register("cost")}
                  placeholder="e.g., £500 or Free"
                  data-testid="input-course-cost"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="language">Language</Label>
                <Input
                  id="language"
                  {...form.register("language")}
                  placeholder="e.g., en"
                  data-testid="input-course-language"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input
                  id="tags"
                  {...form.register("tags")}
                  placeholder="e.g., Safety, Leadership, Compliance"
                  data-testid="input-course-tags"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="prerequisites">Prerequisites (comma-separated)</Label>
                <Input
                  id="prerequisites"
                  {...form.register("prerequisites")}
                  placeholder="e.g., Basic safety training, 2 years experience"
                  data-testid="input-course-prerequisites"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="targetAudience">Target Audience</Label>
                <Input
                  id="targetAudience"
                  {...form.register("targetAudience")}
                  placeholder="e.g., Safety managers, supervisors"
                  data-testid="input-course-audience"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="learningOutcomes">Learning Outcomes (comma-separated)</Label>
                <Textarea
                  id="learningOutcomes"
                  {...form.register("learningOutcomes")}
                  placeholder="e.g., Risk assessment, Incident investigation, Compliance management"
                  rows={2}
                  data-testid="input-course-outcomes"
                />
              </div>

              <div className="flex items-center space-x-2 md:col-span-2">
                <Controller
                  name="certificationProvided"
                  control={form.control}
                  render={({ field }) => (
                    <Checkbox
                      id="certificationProvided"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="checkbox-certification"
                    />
                  )}
                />
                <Label htmlFor="certificationProvided" className="cursor-pointer">
                  Certification provided upon completion
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog} data-testid="button-cancel">
                Cancel
              </Button>
              <Button type="submit" disabled={saveCourseMutation.isPending} data-testid="button-save-course">
                {saveCourseMutation.isPending ? "Saving..." : editingCourse ? "Update Course" : "Add Course"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

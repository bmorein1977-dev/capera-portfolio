import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Search, AlertTriangle, Pencil } from "lucide-react";
import type { Training, TrainingCategory } from "@shared/schema";

function formatValidity(months: number | null): string {
  if (months === null) return "Never expires";
  if (months % 12 === 0) return `${months / 12} year${months === 12 ? "" : "s"}`;
  return `${months} months`;
}

function monthsToYearsInput(months: number | null): string {
  if (months === null) return "";
  return months % 12 === 0 ? String(months / 12) : String(Math.round((months / 12) * 100) / 100);
}

function yearsInputToMonths(years: string): number | null {
  const trimmed = years.trim();
  if (!trimmed) return null;
  const parsed = parseFloat(trimmed);
  if (isNaN(parsed)) return null;
  return Math.round(parsed * 12);
}

const trainingFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  categoryId: z.string().min(1, "Category is required"),
  deliveryMethod: z.string().optional(),
  trainingSource: z.string().optional(),
  estimatedHours: z.string().optional(),
  validityYears: z.string().optional(),
  isSafetyCritical: z.boolean(),
});

type TrainingFormData = z.infer<typeof trainingFormSchema>;

interface EditTrainingDialogProps {
  training: Training | null;
  categories: TrainingCategory[];
  onClose: () => void;
}

function EditTrainingDialog({ training, categories, onClose }: EditTrainingDialogProps) {
  const { toast } = useToast();

  const form = useForm<TrainingFormData>({
    resolver: zodResolver(trainingFormSchema),
    values: training ? {
      name: training.name,
      categoryId: training.categoryId,
      deliveryMethod: training.deliveryMethod ?? "",
      trainingSource: training.trainingSource ?? "",
      estimatedHours: training.estimatedHours ?? "",
      validityYears: monthsToYearsInput(training.validityPeriod),
      isSafetyCritical: training.isSafetyCritical ?? false,
    } : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: TrainingFormData) => {
      if (!training) return;
      const response = await apiRequest("PUT", `/api/trainings/${training.id}`, {
        name: data.name,
        categoryId: data.categoryId,
        deliveryMethod: data.deliveryMethod || null,
        trainingSource: data.trainingSource || null,
        estimatedHours: data.estimatedHours || null,
        validityPeriod: yearsInputToMonths(data.validityYears ?? ""),
        isSafetyCritical: data.isSafetyCritical,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trainings"] });
      toast({ title: "Course Updated", description: "The training course has been updated." });
      onClose();
    },
    onError: (error: any) => {
      toast({ title: "Update Failed", description: error.message || "Failed to update course", variant: "destructive" });
    },
  });

  return (
    <Dialog open={!!training} onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="dialog-edit-training">
        <DialogHeader>
          <DialogTitle>Edit Training Course</DialogTitle>
          <DialogDescription>Update this course's details.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => updateMutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Course Title</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-edit-training-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <FormControl>
                    <select
                      {...field}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                      data-testid="select-edit-training-category"
                    >
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="estimatedHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estimated Hours</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. 1.5 or TBC" data-testid="input-edit-training-hours" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="validityYears"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Validity (years)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Blank = never expires" data-testid="input-edit-training-validity" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="deliveryMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delivery Method</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. Training Course" data-testid="input-edit-training-method" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="trainingSource"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source / Provider</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. Internal / T - (HOTA)" data-testid="input-edit-training-source" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="isSafetyCritical"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="checkbox-edit-training-safety-critical"
                    />
                  </FormControl>
                  <FormLabel className="!mt-0">Safety Critical</FormLabel>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-training">
                {updateMutation.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

interface EditCategoryDialogProps {
  category: TrainingCategory | null;
  onClose: () => void;
}

function EditCategoryDialog({ category, onClose }: EditCategoryDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState(category?.name ?? "");

  useEffect(() => {
    if (category) setName(category.name);
  }, [category]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!category) return;
      const response = await apiRequest("PUT", `/api/training-categories/${category.id}`, { name });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-categories"] });
      toast({ title: "Category Updated", description: "The category has been renamed." });
      onClose();
    },
    onError: (error: any) => {
      toast({ title: "Update Failed", description: error.message || "Failed to update category", variant: "destructive" });
    },
  });

  return (
    <Dialog open={!!category} onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="dialog-edit-category">
        <DialogHeader>
          <DialogTitle>Rename Category</DialogTitle>
        </DialogHeader>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          data-testid="input-edit-category-name"
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending || !name.trim()}
            data-testid="button-save-category"
          >
            {updateMutation.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function TrainingCourseLibrary() {
  const [searchTerm, setSearchTerm] = useState("");
  const [editingTraining, setEditingTraining] = useState<Training | null>(null);
  const [editingCategory, setEditingCategory] = useState<TrainingCategory | null>(null);

  const { data: categories = [], isLoading: loadingCategories } = useQuery<TrainingCategory[]>({
    queryKey: ["/api/training-categories"],
  });

  const { data: trainings = [], isLoading: loadingTrainings } = useQuery<Training[]>({
    queryKey: ["/api/trainings"],
  });

  const filteredTrainings = trainings.filter(t =>
    !searchTerm || t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const trainingsByCategory = new Map<string, Training[]>();
  for (const training of filteredTrainings) {
    const list = trainingsByCategory.get(training.categoryId) || [];
    list.push(training);
    trainingsByCategory.set(training.categoryId, list);
  }

  const isLoading = loadingCategories || loadingTrainings;

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">Training Course Library</h1>
        <p className="text-muted-foreground">
          All training categories and courses imported from the training matrix. To assign a
          course to a job role, use Manage Trainings on Job Role Management.
        </p>
      </div>

      <div className="flex items-center gap-2 mb-6">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search courses..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          data-testid="input-search-courses"
          className="max-w-sm"
        />
        <span className="text-sm text-muted-foreground ml-auto">
          {trainings.length} course(s) in {categories.length} categor{categories.length === 1 ? "y" : "ies"}
        </span>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : categories.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">
            No training categories or courses found. Import a training matrix via Training Matrix
            Import to populate this list.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {categories
            .filter(cat => (trainingsByCategory.get(cat.id) || []).length > 0)
            .map(category => {
              const categoryTrainings = trainingsByCategory.get(category.id) || [];
              return (
                <Card key={category.id} data-testid={`card-category-${category.id}`}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {category.name}
                      <Badge variant="secondary">{categoryTrainings.length}</Badge>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 ml-auto"
                        onClick={() => setEditingCategory(category)}
                        data-testid={`button-edit-category-${category.id}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {categoryTrainings.map(training => (
                        <div
                          key={training.id}
                          className="flex flex-wrap items-center justify-between gap-2 p-3 border rounded-md hover-elevate group"
                          data-testid={`row-training-${training.id}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{training.name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {[training.deliveryMethod, training.trainingSource].filter(Boolean).join(" · ")}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {training.isSafetyCritical && (
                              <Badge variant="outline" className="text-red-600 dark:text-red-400 gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Safety Critical
                              </Badge>
                            )}
                            <Badge variant="secondary" data-testid={`badge-validity-${training.id}`}>
                              {formatValidity(training.validityPeriod)}
                            </Badge>
                            {training.estimatedHours && (
                              <Badge variant="outline">{training.estimatedHours}h</Badge>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => setEditingTraining(training)}
                              data-testid={`button-edit-training-${training.id}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
        </div>
      )}

      <EditTrainingDialog
        training={editingTraining}
        categories={categories}
        onClose={() => setEditingTraining(null)}
      />
      <EditCategoryDialog
        category={editingCategory}
        onClose={() => setEditingCategory(null)}
      />
    </div>
  );
}

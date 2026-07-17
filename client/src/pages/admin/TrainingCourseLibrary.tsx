import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, AlertTriangle } from "lucide-react";
import type { Training, TrainingCategory } from "@shared/schema";

function formatValidity(months: number | null): string {
  if (months === null) return "Never expires";
  if (months % 12 === 0) return `${months / 12} year${months === 12 ? "" : "s"}`;
  return `${months} months`;
}

export default function TrainingCourseLibrary() {
  const [searchTerm, setSearchTerm] = useState("");

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
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {categoryTrainings.map(training => (
                        <div
                          key={training.id}
                          className="flex flex-wrap items-center justify-between gap-2 p-3 border rounded-md"
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
    </div>
  );
}

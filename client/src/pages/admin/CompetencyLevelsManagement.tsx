import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Plus, Edit, Trash2, Layers, RefreshCw } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface CompetencyCategory {
  id: string;
  name: string;
}

interface CompetencyElement {
  id: string;
  name: string;
  code: string;
  categoryId: string;
}

interface CompetencyLevel {
  id: string;
  elementId: string;
  name: string;
  code: string;
  description: string | null;
  order: number;
}

export default function CompetencyLevelsManagement() {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedElement, setSelectedElement] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState<CompetencyLevel | null>(null);
  
  const [newLevel, setNewLevel] = useState({
    name: '',
    code: '',
    description: '',
    order: 0,
  });

  const { data: categories } = useQuery<CompetencyCategory[]>({
    queryKey: ['/api/competency-categories'],
  });

  const { data: allElements } = useQuery<CompetencyElement[]>({
    queryKey: ['/api/competency-elements'],
  });

  const { data: levels, isLoading: levelsLoading } = useQuery<CompetencyLevel[]>({
    queryKey: ['/api/competency-levels', { elementId: selectedElement }],
    queryFn: async () => {
      const response = await fetch(`/api/competency-levels?elementId=${selectedElement}`);
      if (!response.ok) throw new Error('Failed to fetch levels');
      return response.json();
    },
    enabled: !!selectedElement,
  });

  const filteredElements = selectedCategory
    ? allElements?.filter(el => el.categoryId === selectedCategory)
    : [];

  const createLevelMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/competency-levels', data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/competency-levels'] });
      toast({
        title: "Level Created",
        description: "Competency level has been created successfully.",
      });
      setIsAddDialogOpen(false);
      resetNewLevel();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create competency level.",
        variant: "destructive",
      });
    },
  });

  const updateLevelMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest('PATCH', `/api/competency-levels/${id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/competency-levels'] });
      toast({
        title: "Level Updated",
        description: "Competency level has been updated successfully.",
      });
      setIsEditDialogOpen(false);
      setEditingLevel(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update competency level.",
        variant: "destructive",
      });
    },
  });

  const deleteLevelMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/competency-levels/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/competency-levels'] });
      toast({
        title: "Level Deleted",
        description: "Competency level has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete competency level.",
        variant: "destructive",
      });
    },
  });

  const resetNewLevel = () => {
    setNewLevel({
      name: '',
      code: '',
      description: '',
      order: levels?.length || 0,
    });
  };

  const handleCreateLevel = () => {
    if (!selectedElement) return;
    
    createLevelMutation.mutate({
      elementId: selectedElement,
      name: newLevel.name,
      code: newLevel.code,
      description: newLevel.description || null,
      order: newLevel.order,
    });
  };

  const handleUpdateLevel = () => {
    if (!editingLevel) return;
    
    updateLevelMutation.mutate({
      id: editingLevel.id,
      data: {
        name: editingLevel.name,
        code: editingLevel.code,
        description: editingLevel.description || null,
        order: editingLevel.order,
      },
    });
  };

  const selectedElementData = allElements?.find(el => el.id === selectedElement);
  const sortedLevels = levels?.sort((a, b) => a.order - b.order) || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Layers className="h-8 w-8" />
            Competency Levels Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Define proficiency levels (Basic, Intermediate, Advanced) for competency elements
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="gap-1">
          <CardTitle>Select Competency Element</CardTitle>
          <CardDescription>
            Choose a competency element to view and manage its proficiency levels
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Competence Category</Label>
              <Select value={selectedCategory} onValueChange={(val) => {
                setSelectedCategory(val);
                setSelectedElement('');
              }}>
                <SelectTrigger data-testid="select-category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories?.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Competence Element</Label>
              <Select
                value={selectedElement}
                onValueChange={setSelectedElement}
                disabled={!selectedCategory}
              >
                <SelectTrigger data-testid="select-element">
                  <SelectValue placeholder={selectedCategory ? "Select an element" : "Select a category first"} />
                </SelectTrigger>
                <SelectContent>
                  {filteredElements?.map((element) => (
                    <SelectItem key={element.id} value={element.id}>
                      {element.code} - {element.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedElement && (
        <Card>
          <CardHeader className="gap-1">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>
                  Proficiency Levels for "{selectedElementData?.code} - {selectedElementData?.name}"
                </CardTitle>
                <CardDescription>
                  Add, edit, or remove proficiency levels for this competency element
                </CardDescription>
              </div>
              <Button
                onClick={() => {
                  resetNewLevel();
                  setIsAddDialogOpen(true);
                }}
                data-testid="button-add-level"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Level
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {levelsLoading ? (
              <div className="flex items-center justify-center p-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : sortedLevels.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground">
                <Layers className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No proficiency levels defined for this element yet.</p>
                <p className="text-sm mt-2">Click "Add Level" to create the first level.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedLevels.map((level) => (
                  <div
                    key={level.id}
                    className="flex items-center justify-between p-4 border rounded-md hover-elevate"
                    data-testid={`level-row-${level.id}`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl font-bold text-muted-foreground w-8 text-center">
                          {level.order + 1}
                        </div>
                        <div>
                          <div className="font-semibold text-lg">
                            {level.name} <span className="text-muted-foreground text-sm">({level.code})</span>
                          </div>
                          {level.description && (
                            <div className="text-sm text-muted-foreground mt-1">
                              {level.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingLevel(level);
                          setIsEditDialogOpen(true);
                        }}
                        data-testid={`button-edit-level-${level.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete the "${level.name}" level?`)) {
                            deleteLevelMutation.mutate(level.id);
                          }
                        }}
                        data-testid={`button-delete-level-${level.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add Level Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent data-testid="dialog-add-level">
          <DialogHeader>
            <DialogTitle>Add Proficiency Level</DialogTitle>
            <DialogDescription>
              Create a new proficiency level for this competency element
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Level Name *</Label>
              <Input
                placeholder="e.g., Basic, Intermediate, Advanced"
                value={newLevel.name}
                onChange={(e) => setNewLevel({ ...newLevel, name: e.target.value })}
                data-testid="input-level-name"
              />
            </div>

            <div className="space-y-2">
              <Label>Level Code *</Label>
              <Input
                placeholder="e.g., B, I, A"
                value={newLevel.code}
                onChange={(e) => setNewLevel({ ...newLevel, code: e.target.value })}
                data-testid="input-level-code"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Describe what this proficiency level means..."
                value={newLevel.description}
                onChange={(e) => setNewLevel({ ...newLevel, description: e.target.value })}
                data-testid="input-level-description"
              />
            </div>

            <div className="space-y-2">
              <Label>Display Order</Label>
              <Input
                type="number"
                min="0"
                value={newLevel.order}
                onChange={(e) => setNewLevel({ ...newLevel, order: parseInt(e.target.value) || 0 })}
                data-testid="input-level-order"
              />
              <p className="text-xs text-muted-foreground">
                Lower numbers appear first (0 = first, 1 = second, etc.)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddDialogOpen(false);
                resetNewLevel();
              }}
              data-testid="button-cancel-add-level"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateLevel}
              disabled={!newLevel.name || !newLevel.code || createLevelMutation.isPending}
              data-testid="button-confirm-add-level"
            >
              {createLevelMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Level
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Level Dialog */}
      {editingLevel && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent data-testid="dialog-edit-level">
            <DialogHeader>
              <DialogTitle>Edit Proficiency Level</DialogTitle>
              <DialogDescription>
                Update the details of this proficiency level
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Level Name *</Label>
                <Input
                  value={editingLevel.name}
                  onChange={(e) => setEditingLevel({ ...editingLevel, name: e.target.value })}
                  data-testid="input-edit-level-name"
                />
              </div>

              <div className="space-y-2">
                <Label>Level Code *</Label>
                <Input
                  value={editingLevel.code}
                  onChange={(e) => setEditingLevel({ ...editingLevel, code: e.target.value })}
                  data-testid="input-edit-level-code"
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={editingLevel.description || ''}
                  onChange={(e) => setEditingLevel({ ...editingLevel, description: e.target.value })}
                  data-testid="input-edit-level-description"
                />
              </div>

              <div className="space-y-2">
                <Label>Display Order</Label>
                <Input
                  type="number"
                  min="0"
                  value={editingLevel.order}
                  onChange={(e) => setEditingLevel({ ...editingLevel, order: parseInt(e.target.value) || 0 })}
                  data-testid="input-edit-level-order"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setEditingLevel(null);
                }}
                data-testid="button-cancel-edit-level"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateLevel}
                disabled={!editingLevel.name || !editingLevel.code || updateLevelMutation.isPending}
                data-testid="button-confirm-edit-level"
              >
                {updateLevelMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Edit className="h-4 w-4 mr-2" />
                    Update Level
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

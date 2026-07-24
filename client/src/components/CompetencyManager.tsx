import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Plus, 
  Edit, 
  Pencil,
  Trash2, 
  Save,
  FolderOpen,
  Folder,
  Target,
  BookOpen,
  Brain,
  Users,
  ChevronRight,
  ChevronDown,
  Upload,
  Shield,
  Sparkles,
  Loader2
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { 
  CompetencyCategory, 
  CompetencyElement, 
  CompetenceSubcategory,
  CompetenceCriteria,
  InsertCompetencyCategory,
  InsertCompetencyElement,
  InsertCompetenceSubcategory,
  InsertCompetenceCriteria,
  CompetencyTreeNode
} from '@shared/schema';
import { ExcelImportDialog } from '@/components/ExcelImportDialog';

interface CompetencyFilters {
  categoryId?: string;
  elementId?: string;
  searchQuery?: string;
}

export default function CompetencyManager() {
  // Competency management state
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [filters, setFilters] = useState<CompetencyFilters>({});
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  
  // Dialog states
  const [showAddCategoryDialog, setShowAddCategoryDialog] = useState(false);
  const [showAddElementDialog, setShowAddElementDialog] = useState(false);
  const [showAiStandardsReviewDialog, setShowAiStandardsReviewDialog] = useState(false);
  const [aiStandardsReview, setAiStandardsReview] = useState<{
    summary: string;
    disclaimer: string;
    suggestions: { title: string; rationale: string; suggestedChange: string }[];
  } | null>(null);
  const [showAddSubcategoryDialog, setShowAddSubcategoryDialog] = useState(false);
  const [showAddCriteriaDialog, setShowAddCriteriaDialog] = useState(false);
  const [showExcelImportDialog, setShowExcelImportDialog] = useState(false);

  // Editing states
  const [editingCategory, setEditingCategory] = useState<CompetencyCategory | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [editingElement, setEditingElement] = useState<CompetencyElement | null>(null);
  const [elementToDelete, setElementToDelete] = useState<string | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<CompetenceSubcategory | null>(null);
  const [editingCriteria, setEditingCriteria] = useState<CompetenceCriteria | null>(null);
  const [criteriaType, setCriteriaType] = useState<'knowledge' | 'performance' | 'safety'>('knowledge');

  const { toast } = useToast();

  // Fetch data queries
  const { data: competencyTree = [], isLoading: treeLoading } = useQuery<CompetencyTreeNode[]>({
    queryKey: ['/api/competency-tree'],
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<CompetencyCategory[]>({
    queryKey: ['/api/competency-categories'],
  });

  const { data: elements = [], isLoading: elementsLoading } = useQuery<CompetencyElement[]>({
    queryKey: ['/api/competency-elements'],
  });

  // Competence subcategories for selected element
  const { data: safetySubcategories = [] } = useQuery<CompetenceSubcategory[]>({
    queryKey: ['/api/competence-subcategories', { elementId: selectedElementId, type: 'safety' }],
    enabled: !!selectedElementId,
  });

  const { data: knowledgeSubcategories = [] } = useQuery<CompetenceSubcategory[]>({
    queryKey: ['/api/competence-subcategories', { elementId: selectedElementId, type: 'knowledge' }],
    enabled: !!selectedElementId,
  });

  const { data: performanceSubcategories = [] } = useQuery<CompetenceSubcategory[]>({
    queryKey: ['/api/competence-subcategories', { elementId: selectedElementId, type: 'performance' }],
    enabled: !!selectedElementId,
  });

  // All subcategories for the element
  const { data: allSubcategories = [] } = useQuery<CompetenceSubcategory[]>({
    queryKey: ['/api/competence-subcategories', { elementId: selectedElementId }],
    enabled: !!selectedElementId,
  });

  // Competence criteria for selected element by type
  const { data: safetyCriteria = [] } = useQuery<CompetenceCriteria[]>({
    queryKey: ['/api/competence-criteria', { elementId: selectedElementId, type: 'safety' }],
    enabled: !!selectedElementId,
  });

  const { data: knowledgeCriteria = [] } = useQuery<CompetenceCriteria[]>({
    queryKey: ['/api/competence-criteria', { elementId: selectedElementId, type: 'knowledge' }],
    enabled: !!selectedElementId,
  });

  const { data: performanceCriteria = [] } = useQuery<CompetenceCriteria[]>({
    queryKey: ['/api/competence-criteria', { elementId: selectedElementId, type: 'performance' }],
    enabled: !!selectedElementId,
  });

  // All criteria for backward compatibility
  const allCriteria = useMemo(() => [...safetyCriteria, ...knowledgeCriteria, ...performanceCriteria], [safetyCriteria, knowledgeCriteria, performanceCriteria]);

  // Computed data for element-level criteria (no subcategory)
  const elementLevelSafetyCriteria = useMemo(() =>
    safetyCriteria.filter(c => !c.subcategoryId),
    [safetyCriteria]
  );

  const elementLevelKnowledgeCriteria = useMemo(() =>
    knowledgeCriteria.filter(c => !c.subcategoryId),
    [knowledgeCriteria]
  );
  
  const elementLevelPerformanceCriteria = useMemo(() => 
    performanceCriteria.filter(c => !c.subcategoryId), 
    [performanceCriteria]
  );

  // Mutations for categories
  const createCategoryMutation = useMutation({
    mutationFn: (data: InsertCompetencyCategory) => apiRequest('POST', '/api/competency-categories', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/competency-categories'] });
      queryClient.invalidateQueries({ queryKey: ['/api/competency-tree'] });
      setShowAddCategoryDialog(false);
      setEditingCategory(null);
      toast({ title: 'Success', description: 'Category created successfully' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create category', variant: 'destructive' });
    }
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertCompetencyCategory> }) => 
      apiRequest('PATCH', `/api/competency-categories/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/competency-categories'] });
      queryClient.invalidateQueries({ queryKey: ['/api/competency-tree'] });
      setShowAddCategoryDialog(false);
      setEditingCategory(null);
      toast({ title: 'Success', description: 'Category updated successfully' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update category', variant: 'destructive' });
    }
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/competency-categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/competency-categories'] });
      queryClient.invalidateQueries({ queryKey: ['/api/competency-tree'] });
      queryClient.invalidateQueries({ queryKey: ['/api/competency-elements'] });
      queryClient.invalidateQueries({ queryKey: ['/api/competence-subcategories'] });
      queryClient.invalidateQueries({ queryKey: ['/api/competence-criteria'] });
      setSelectedCategoryId(null);
      setSelectedElementId(null);
      toast({ title: 'Success', description: 'Category deleted successfully' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete category', variant: 'destructive' });
    }
  });

  // Mutations for elements
  const createElementMutation = useMutation({
    mutationFn: (data: InsertCompetencyElement) => apiRequest('POST', '/api/competency-elements', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/competency-elements'] });
      queryClient.invalidateQueries({ queryKey: ['/api/competency-tree'] });
      setShowAddElementDialog(false);
      setEditingElement(null);
      toast({ title: 'Success', description: 'Element created successfully' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create element', variant: 'destructive' });
    }
  });

  const aiStandardsReviewMutation = useMutation({
    mutationFn: async (elementId: string) => {
      const res = await apiRequest('POST', `/api/competency-elements/${elementId}/ai-review-standard`);
      return res.json();
    },
    onSuccess: (data) => {
      setAiStandardsReview(data);
      setShowAiStandardsReviewDialog(true);
    },
    onError: (error: any) => {
      toast({ title: 'AI Review Failed', description: error.message || 'Failed to run AI standards review', variant: 'destructive' });
    }
  });

  const updateElementMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertCompetencyElement> }) =>
      apiRequest('PATCH', `/api/competency-elements/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/competency-elements'] });
      queryClient.invalidateQueries({ queryKey: ['/api/competency-tree'] });
      setShowAddElementDialog(false);
      setEditingElement(null);
      toast({ title: 'Success', description: 'Element updated successfully' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update element', variant: 'destructive' });
    }
  });

  const deleteElementMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/competency-elements/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/competency-elements'] });
      queryClient.invalidateQueries({ queryKey: ['/api/competency-tree'] });
      queryClient.invalidateQueries({ queryKey: ['/api/competence-subcategories'] });
      queryClient.invalidateQueries({ queryKey: ['/api/competence-criteria'] });
      setSelectedElementId(null);
      toast({ title: 'Success', description: 'Element deleted successfully' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete element', variant: 'destructive' });
    }
  });

  // Mutations for subcategories
  const createSubcategoryMutation = useMutation({
    mutationFn: (data: InsertCompetenceSubcategory) => apiRequest('POST', '/api/competence-subcategories', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/competence-subcategories'] });
      setShowAddSubcategoryDialog(false);
      setEditingSubcategory(null);
      toast({ title: 'Success', description: 'Subcategory created successfully' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create subcategory', variant: 'destructive' });
    }
  });

  // Mutations for criteria
  const createCriteriaMutation = useMutation({
    mutationFn: (data: InsertCompetenceCriteria) => apiRequest('POST', '/api/competence-criteria', data),
    onSuccess: (_, variables) => {
      // Invalidate specific type-based queries for better cache precision
      queryClient.invalidateQueries({ queryKey: ['/api/competence-criteria', { elementId: selectedElementId, type: variables.type }] });
      queryClient.invalidateQueries({ queryKey: ['/api/competence-criteria', { elementId: selectedElementId }] });
      setShowAddCriteriaDialog(false);
      setEditingCriteria(null);
      toast({ title: 'Success', description: 'Criteria created successfully' });
    },
    onError: (error: any) => {
      console.error('Criteria creation error:', error);
      let errorMessage = 'Failed to create criteria';
      if (error?.response?.data?.details) {
        errorMessage = error.response.data.details.map((err: any) => err.message).join(', ');
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      toast({ title: 'Validation Error', description: errorMessage, variant: 'destructive' });
    }
  });

  // Bulk criteria creation mutation
  const createBulkCriteriaMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/competence-criteria/bulk', data),
    onSuccess: (_, variables) => {
      // Invalidate queries for the specific element and type
      queryClient.invalidateQueries({ queryKey: ['/api/competence-criteria', { elementId: selectedElementId, type: variables.type }] });
      queryClient.invalidateQueries({ queryKey: ['/api/competence-criteria', { elementId: selectedElementId }] });
      setShowAddCriteriaDialog(false);
      toast({ title: 'Success', description: `${variables.criteria.length} criteria created successfully` });
    },
    onError: (error: any) => {
      console.error('Bulk criteria creation error:', error);
      let errorMessage = 'Failed to create criteria';
      if (error?.response?.data?.details) {
        errorMessage = error.response.data.details.map((err: any) => err.message).join(', ');
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      toast({ title: 'Bulk Creation Error', description: errorMessage, variant: 'destructive' });
    }
  });

  // Tree navigation handlers
  const toggleExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const selectCategory = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setSelectedElementId(null);
    setFilters(prev => ({ ...prev, categoryId, elementId: undefined }));
  };

  const selectElement = (elementId: string, categoryId: string) => {
    setSelectedElementId(elementId);
    setSelectedCategoryId(categoryId);
    setFilters(prev => ({ ...prev, elementId, categoryId }));
  };

  // Helper functions
  const renderTreeItem = (item: CompetencyTreeNode, level: number = 0) => {
    const isExpanded = expandedItems.has(item.id);
    const hasChildren = item.children && item.children.length > 0;
    const isSelected = item.type === 'category' 
      ? selectedCategoryId === item.id
      : selectedElementId === item.id;

    return (
      <div key={item.id} className="select-none">
        <div 
          className={`group flex items-center gap-2 p-2 cursor-pointer hover-elevate rounded-md ${
            isSelected ? 'bg-accent text-accent-foreground' : ''
          }`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => {
            if (item.type === 'category') {
              selectCategory(item.id);
              if (hasChildren) toggleExpanded(item.id);
            } else {
              const categoryId = item.categoryId || '';
              selectElement(item.id, categoryId);
            }
          }}
          data-testid={`tree-${item.type}-${item.id}`}
        >
          {hasChildren && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(item.id);
              }}
              aria-label={isExpanded ? `Collapse ${item.name}` : `Expand ${item.name}`}
              data-testid={`button-expand-${item.id}`}
            >
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </Button>
          )}
          {!hasChildren && <div className="w-4" />}
          
          {item.type === 'category' ? (
            <Folder className="h-4 w-4 text-primary" />
          ) : (
            <Target className="h-4 w-4 text-muted-foreground" />
          )}
          
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium break-words">{item.name}</div>
            {item.type === 'category' && item.elementCount !== undefined && (
              <div className="text-xs text-muted-foreground">
                {item.elementCount} elements
              </div>
            )}
          </div>

          {item.type === 'category' && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  const category = competencyTree.find(c => c.id === item.id);
                  if (category) {
                    setEditingCategory({
                      id: category.id,
                      name: category.name,
                      code: category.code || '',
                      description: category.description || '',
                      order: category.order || 0
                    });
                    setShowAddCategoryDialog(true);
                  }
                }}
                data-testid={`button-edit-category-${item.id}`}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  setCategoryToDelete(item.id);
                }}
                data-testid={`button-delete-category-${item.id}`}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}

          {item.type === 'element' && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  // Find element in all categories
                  const findElement = (nodes: CompetencyTreeNode[]): CompetencyTreeNode | null => {
                    for (const node of nodes) {
                      if (node.type === 'element' && node.id === item.id) {
                        return node;
                      }
                      if (node.children) {
                        const found = findElement(node.children);
                        if (found) return found;
                      }
                    }
                    return null;
                  };
                  const element = findElement(competencyTree);
                  if (element) {
                    setEditingElement({
                      id: element.id,
                      categoryId: element.categoryId || '',
                      name: element.name,
                      code: element.code || '',
                      description: element.description || '',
                      order: element.order || 0,
                      reassessmentYears: (element as any).reassessmentYears || null
                    });
                    setShowAddElementDialog(true);
                  }
                }}
                data-testid={`button-edit-element-${item.id}`}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  setElementToDelete(item.id);
                }}
                data-testid={`button-delete-element-${item.id}`}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
        
        {hasChildren && isExpanded && item.children && (
          <div>
            {item.children.map(child => renderTreeItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  // Render element-level criteria (K1, P1 without subcategory)
  const renderElementLevelCriteria = (criteria: CompetenceCriteria[]) => {
    if (criteria.length === 0) return null;
    
    return (
      <Card className="mb-4 border-2 border-dashed border-primary/20" data-testid="card-element-level-criteria">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Element-Level Criteria
            <Badge variant="outline" className="text-xs">
              Direct {criteria[0]?.type === 'knowledge' ? 'K' : 'P'} criteria
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2">
            {criteria
              .sort((a, b) => a.criteriaNumber - b.criteriaNumber)
              .map((criterion) => (
              <div key={criterion.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                <div className="flex flex-col gap-1 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs font-mono">
                      {criterion.code}
                    </Badge>
                    <span className="text-sm">{criterion.description}</span>
                  </div>
                  {criterion.assessorGuidance && (
                    <div className="text-xs text-muted-foreground pl-2" data-testid={`text-assessor-guidance-${criterion.id}`}>
                      Assessor guidance: {criterion.assessorGuidance}
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => {
                      setEditingCriteria(criterion);
                      setCriteriaType(criterion.type as 'knowledge' | 'performance' | 'safety');
                      setShowAddCriteriaDialog(true);
                    }}
                    aria-label={`Edit ${criterion.code}`}
                    data-testid={`button-edit-criteria-${criterion.id}`}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  // Render subcategory card with criteria
  const renderSubcategoryCard = (subcategory: CompetenceSubcategory) => {
    const criteriaForSubcategory = allCriteria.filter(c => 
      c.subcategoryId === subcategory.id && c.type === subcategory.type
    );
    
    return (
      <Card key={subcategory.id} className="mb-4" data-testid={`card-subcategory-${subcategory.id}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              {subcategory.type === 'knowledge' ? (
                <Brain className="h-4 w-4 text-blue-500" />
              ) : (
                <Users className="h-4 w-4 text-green-500" />
              )}
              {subcategory.name}
              <Badge variant="outline" className="text-xs">
                {subcategory.type === 'knowledge' ? 'K' : 'P'}{subcategory.order}
              </Badge>
            </CardTitle>
            <div className="flex gap-1">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => {
                  setEditingSubcategory(subcategory);
                  setShowAddSubcategoryDialog(true);
                }}
                aria-label={`Edit subcategory ${subcategory.name}`}
                data-testid={`button-edit-subcategory-${subcategory.id}`}
              >
                <Edit className="h-3 w-3" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => {
                  setCriteriaType(subcategory.type as 'knowledge' | 'performance' | 'safety');
                  setEditingCriteria(null);
                  setShowAddCriteriaDialog(true);
                }}
                aria-label={`Add criteria to ${subcategory.name}`}
                data-testid={`button-add-criteria-${subcategory.id}`}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <CardDescription className="text-sm">
            {subcategory.type === 'knowledge' ? 'Knowledge criteria' : 'Performance criteria'}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="pt-0">
          {criteriaForSubcategory.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-4">
              No criteria defined. Add your first criteria to get started.
            </div>
          ) : (
            <div className="space-y-2">
              {criteriaForSubcategory
                .sort((a, b) => (a.criteriaNumber || 0) - (b.criteriaNumber || 0))
                .map((criteria) => (
                <div 
                  key={criteria.id} 
                  className="flex items-center justify-between p-2 bg-muted/50 rounded-md hover-elevate"
                  data-testid={`criteria-${criteria.id}`}
                >
                  <div className="flex flex-col gap-1 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs font-mono">
                        {criteria.code}
                      </Badge>
                      <span className="text-sm">{criteria.criteriaText || criteria.description}</span>
                      <Badge variant={criteria.required !== false ? "default" : "outline"} className="text-xs">
                        {criteria.required !== false ? 'M' : 'O'}
                      </Badge>
                    </div>
                    {criteria.assessorGuidance && (
                      <div className="text-xs text-muted-foreground pl-2" data-testid={`text-assessor-guidance-${criteria.id}`}>
                        <Badge variant="secondary" className="text-xs font-mono mr-1">
                          {criteria.guidanceNumber || `${criteria.type === 'knowledge' ? 'KG' : 'PG'}`}
                        </Badge>
                        Assessor guidance: {criteria.assessorGuidance}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => {
                        setEditingCriteria(criteria);
                        setCriteriaType(criteria.type as 'knowledge' | 'performance' | 'safety');
                        setShowAddCriteriaDialog(true);
                      }}
                      aria-label={`Edit ${criteria.code}`}
                      data-testid={`button-edit-criteria-${criteria.id}`}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="h-full p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-competency-manager">
            Competency Management
          </h1>
          <p className="text-muted-foreground">
            Manage competence criteria with Knowledge (K1.1) and Performance (P1.1) structure
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowExcelImportDialog(true)}
            data-testid="button-excel-import"
          >
            <Upload className="h-4 w-4 mr-2" />
            Excel Import
          </Button>
          <Button onClick={() => setShowAddCategoryDialog(true)} data-testid="button-add-category">
            <Plus className="h-4 w-4 mr-2" />
            Add Category
          </Button>
          <Button
            onClick={() => setShowAddElementDialog(true)}
            disabled={!selectedCategoryId}
            data-testid="button-add-element"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Element
          </Button>
          <Button
            onClick={() => setShowAddSubcategoryDialog(true)}
            disabled={!selectedElementId}
            data-testid="button-add-subcategory"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Subcategory
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="h-[calc(100vh-12rem)]">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
            {/* Left Panel - Tree Navigation */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FolderOpen className="h-5 w-5" />
                  Competency Structure
                </CardTitle>
                <CardDescription>
                  Navigate categories and elements
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-20rem)]">
                  <div className="p-4 space-y-1">
                    {treeLoading ? (
                      <div className="text-center text-muted-foreground py-8">
                        Loading structure...
                      </div>
                    ) : competencyTree.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8">
                        No categories found. Create your first category to get started.
                      </div>
                    ) : (
                      competencyTree.map((item: CompetencyTreeNode) => renderTreeItem(item))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Right Panel - Competence Criteria */}
            <Card className="lg:col-span-3">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Competence Criteria
                      {selectedCategoryId && (
                        <Badge variant="outline">
                          {categories.find(c => c.id === selectedCategoryId)?.name}
                        </Badge>
                      )}
                      {selectedElementId && (
                        <Badge variant="outline">
                          {elements.find(e => e.id === selectedElementId)?.name}
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {selectedElementId
                        ? 'Knowledge and Performance criteria for assessment template'
                        : selectedCategoryId
                        ? 'Select an element to view competence criteria'
                        : 'Select a category or element to view competence criteria'
                      }
                    </CardDescription>
                  </div>
                  {selectedElementId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => aiStandardsReviewMutation.mutate(selectedElementId)}
                      disabled={aiStandardsReviewMutation.isPending}
                      data-testid="button-ai-review-standard"
                    >
                      {aiStandardsReviewMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      AI Review Standard
                    </Button>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-20rem)]">
                  {!selectedElementId ? (
                    <div className="text-center text-muted-foreground py-8">
                      Select an element from the tree to view competence criteria
                    </div>
                  ) : (
                    <div className="p-6">
                      {/* Inline Proficiency Levels Panel */}
                      {selectedElementId && <InlineLevelManagementPanel elementId={selectedElementId} />}
                      
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Safety Column */}
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <Shield className="h-5 w-5 text-red-500" />
                              <h3 className="text-lg font-semibold">Safety Criteria</h3>
                              <Badge variant="secondary">S1, S2, S3...</Badge>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => {
                                setCriteriaType('safety');
                                setShowAddCriteriaDialog(true);
                              }}
                              data-testid="button-add-safety-criteria"
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add S
                            </Button>
                          </div>

                          {/* Display element-level safety criteria */}
                          {renderElementLevelCriteria(elementLevelSafetyCriteria)}

                          {safetySubcategories.length === 0 ? (
                            <Card className="border-dashed">
                              <CardContent className="flex flex-col items-center justify-center py-8">
                                <Shield className="h-8 w-8 text-muted-foreground mb-2" />
                                <p className="text-sm text-muted-foreground text-center">
                                  No safety subcategories yet.
                                  <br />
                                  Add your first safety subcategory to get started.
                                </p>
                              </CardContent>
                            </Card>
                          ) : (
                            safetySubcategories
                              .sort((a, b) => (a.order || 0) - (b.order || 0))
                              .map(renderSubcategoryCard)
                          )}
                        </div>

                        {/* Knowledge Column */}
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <Brain className="h-5 w-5 text-blue-500" />
                              <h3 className="text-lg font-semibold">Knowledge Criteria</h3>
                              <Badge variant="secondary">K1, K2, K3...</Badge>
                            </div>
                            <Button 
                              size="sm"
                              onClick={() => {
                                setCriteriaType('knowledge');
                                setShowAddCriteriaDialog(true);
                              }}
                              data-testid="button-add-knowledge-criteria"
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add K
                            </Button>
                          </div>
                          
                          {/* Display element-level knowledge criteria */}
                          {renderElementLevelCriteria(elementLevelKnowledgeCriteria)}
                          
                          {knowledgeSubcategories.length === 0 ? (
                            <Card className="border-dashed">
                              <CardContent className="flex flex-col items-center justify-center py-8">
                                <BookOpen className="h-8 w-8 text-muted-foreground mb-2" />
                                <p className="text-sm text-muted-foreground text-center">
                                  No knowledge subcategories yet.
                                  <br />
                                  Add your first knowledge subcategory to get started.
                                </p>
                              </CardContent>
                            </Card>
                          ) : (
                            knowledgeSubcategories
                              .sort((a, b) => (a.order || 0) - (b.order || 0))
                              .map(renderSubcategoryCard)
                          )}
                        </div>

                        {/* Performance Column */}
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <Users className="h-5 w-5 text-green-500" />
                              <h3 className="text-lg font-semibold">Performance Criteria</h3>
                              <Badge variant="secondary">P1, P2, P3...</Badge>
                            </div>
                            <Button 
                              size="sm"
                              onClick={() => {
                                setCriteriaType('performance');
                                setShowAddCriteriaDialog(true);
                              }}
                              data-testid="button-add-performance-criteria"
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add P
                            </Button>
                          </div>
                          
                          {/* Display element-level performance criteria */}
                          {renderElementLevelCriteria(elementLevelPerformanceCriteria)}
                          
                          {performanceSubcategories.length === 0 ? (
                            <Card className="border-dashed">
                              <CardContent className="flex flex-col items-center justify-center py-8">
                                <Users className="h-8 w-8 text-muted-foreground mb-2" />
                                <p className="text-sm text-muted-foreground text-center">
                                  No performance subcategories yet.
                                  <br />
                                  Add your first performance subcategory to get started.
                                </p>
                              </CardContent>
                            </Card>
                          ) : (
                            performanceSubcategories
                              .sort((a, b) => (a.order || 0) - (b.order || 0))
                              .map(renderSubcategoryCard)
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
      </div>

      {/* Add Category Dialog */}
      <Dialog open={showAddCategoryDialog} onOpenChange={setShowAddCategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Edit Category' : 'Add Category'}
            </DialogTitle>
            <DialogDescription>
              Create a new competency category to organize elements and criteria.
            </DialogDescription>
          </DialogHeader>
          <CategoryForm
            onSubmit={(data) => {
              if (editingCategory) {
                updateCategoryMutation.mutate({ id: editingCategory.id, data });
              } else {
                createCategoryMutation.mutate(data);
              }
            }}
            onCancel={() => {
              setShowAddCategoryDialog(false);
              setEditingCategory(null);
            }}
            isLoading={createCategoryMutation.isPending || updateCategoryMutation.isPending}
            initialData={editingCategory || undefined}
          />
        </DialogContent>
      </Dialog>

      {/* Add Element Dialog */}
      <Dialog open={showAddElementDialog} onOpenChange={setShowAddElementDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingElement ? 'Edit Element' : 'Add Element'}
            </DialogTitle>
            <DialogDescription>
              Create a new competency element within the selected category.
            </DialogDescription>
          </DialogHeader>
          {(selectedCategoryId || editingElement) && (
            <ElementForm
              categoryId={editingElement?.categoryId || selectedCategoryId || ''}
              onSubmit={(data) => {
                if (editingElement) {
                  updateElementMutation.mutate({ id: editingElement.id, data });
                } else {
                  createElementMutation.mutate(data);
                }
              }}
              onCancel={() => {
                setShowAddElementDialog(false);
                setEditingElement(null);
              }}
              isLoading={createElementMutation.isPending || updateElementMutation.isPending}
              initialData={editingElement || undefined}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Add Subcategory Dialog */}
      <Dialog open={showAddSubcategoryDialog} onOpenChange={setShowAddSubcategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSubcategory ? 'Edit Subcategory' : 'Add Subcategory'}
            </DialogTitle>
            <DialogDescription>
              Create a new knowledge or performance subcategory for organizing criteria.
            </DialogDescription>
          </DialogHeader>
          {selectedElementId && (
            <SubcategoryForm
              elementId={selectedElementId}
              onSubmit={(data) => createSubcategoryMutation.mutate(data)}
              onCancel={() => {
                setShowAddSubcategoryDialog(false);
                setEditingSubcategory(null);
              }}
              isLoading={createSubcategoryMutation.isPending}
              initialData={editingSubcategory || undefined}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Add Criteria Dialog */}
      <Dialog open={showAddCriteriaDialog} onOpenChange={setShowAddCriteriaDialog}>
        <DialogContent className={editingCriteria ? '' : 'max-w-3xl max-h-[90vh] overflow-y-auto'}>
          <DialogHeader>
            <DialogTitle>
              {editingCriteria ? 'Edit Criteria' : 'Add Criteria (Bulk)'}
            </DialogTitle>
            <DialogDescription>
              {editingCriteria 
                ? `Update the ${criteriaType} criteria with automatic numbering.`
                : `Create multiple ${criteriaType} criteria at once with shared settings.`
              }
            </DialogDescription>
          </DialogHeader>
          {selectedElementId && (
            editingCriteria ? (
              <CriteriaForm
                elementId={selectedElementId}
                type={criteriaType}
                subcategories={allSubcategories.filter(s => s.type === criteriaType)}
                onSubmit={(data) => createCriteriaMutation.mutate(data)}
                onCancel={() => {
                  setShowAddCriteriaDialog(false);
                  setEditingCriteria(null);
                }}
                isLoading={createCriteriaMutation.isPending}
                initialData={editingCriteria}
              />
            ) : (
              <BulkCriteriaForm
                elementId={selectedElementId}
                type={criteriaType}
                subcategories={allSubcategories.filter(s => s.type === criteriaType)}
                onSubmit={(data) => createBulkCriteriaMutation.mutate(data)}
                onCancel={() => {
                  setShowAddCriteriaDialog(false);
                }}
                isLoading={createBulkCriteriaMutation.isPending}
              />
            )
          )}
        </DialogContent>
      </Dialog>

      {/* Excel Import Dialog */}
      <ExcelImportDialog 
        isOpen={showExcelImportDialog} 
        onClose={() => setShowExcelImportDialog(false)}
        onSuccess={() => {
          // Refresh all data after successful import
          queryClient.invalidateQueries({ queryKey: ['/api/competency-tree'] });
          queryClient.invalidateQueries({ queryKey: ['/api/competency-categories'] });
          queryClient.invalidateQueries({ queryKey: ['/api/competency-elements'] });
          queryClient.invalidateQueries({ queryKey: ['/api/competence-subcategories'] });
          queryClient.invalidateQueries({ queryKey: ['/api/competence-criteria'] });
        }}
      />

      {/* AI Standards Review Dialog */}
      <Dialog open={showAiStandardsReviewDialog} onOpenChange={setShowAiStandardsReviewDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-ai-standards-review">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              AI Standards Review
            </DialogTitle>
            <DialogDescription>
              {aiStandardsReview?.summary}
            </DialogDescription>
          </DialogHeader>
          {aiStandardsReview && (
            <div className="space-y-4">
              <div className="text-xs text-muted-foreground bg-muted/50 rounded p-3 border">
                {aiStandardsReview.disclaimer}
              </div>
              {aiStandardsReview.suggestions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No suggested updates - this standard looks current based on the AI's general knowledge.</p>
              ) : (
                <div className="space-y-3">
                  {aiStandardsReview.suggestions.map((suggestion, index) => (
                    <div key={index} className="border rounded p-3 space-y-1" data-testid={`suggestion-${index}`}>
                      <div className="font-medium text-sm">{suggestion.title}</div>
                      <div className="text-sm text-muted-foreground">{suggestion.rationale}</div>
                      <div className="text-sm bg-muted/50 rounded p-2 mt-1"><span className="font-medium">Suggested change: </span>{suggestion.suggestedChange}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Category Confirmation */}
      <AlertDialog open={!!categoryToDelete} onOpenChange={(open) => !open && setCategoryToDelete(null)}>
        <AlertDialogContent data-testid="dialog-delete-category-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this category? This action cannot be undone and will remove all associated elements, subcategories, and criteria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-category">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (categoryToDelete) {
                  deleteCategoryMutation.mutate(categoryToDelete);
                  setCategoryToDelete(null);
                }
              }}
              data-testid="button-confirm-delete-category"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Element Confirmation */}
      <AlertDialog open={!!elementToDelete} onOpenChange={(open) => !open && setElementToDelete(null)}>
        <AlertDialogContent data-testid="dialog-delete-element-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Element</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this element? This action cannot be undone and will remove all associated subcategories and criteria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-element">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (elementToDelete) {
                  deleteElementMutation.mutate(elementToDelete);
                  setElementToDelete(null);
                }
              }}
              data-testid="button-confirm-delete-element"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Inline Level Management Panel Component
function InlineLevelManagementPanel({ elementId }: { elementId: string }) {
  const [showAddLevelDialog, setShowAddLevelDialog] = useState(false);
  const [editingLevel, setEditingLevel] = useState<any | null>(null);
  const [deletingLevelId, setDeletingLevelId] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch competency levels for this element
  const { data: competencyLevels = [] } = useQuery<any[]>({
    queryKey: ['/api/competency-levels', elementId],
    queryFn: async () => {
      const response = await fetch(`/api/competency-levels?elementId=${elementId}`);
      if (!response.ok) throw new Error('Failed to fetch competency levels');
      return response.json();
    },
    enabled: !!elementId,
  });

  // Create level mutation
  const createLevelMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/competency-levels', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/competency-levels', elementId] });
      toast({ title: 'Proficiency level created successfully' });
      setShowAddLevelDialog(false);
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Failed to create proficiency level', 
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Update level mutation
  const updateLevelMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest(`/api/competency-levels/${id}`, 'PATCH', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/competency-levels', elementId] });
      toast({ title: 'Proficiency level updated successfully' });
      setShowAddLevelDialog(false);
      setEditingLevel(null);
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Failed to update proficiency level', 
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Delete level mutation
  const deleteLevelMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/competency-levels/${id}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/competency-levels', elementId] });
      toast({ title: 'Proficiency level deleted successfully' });
      setDeletingLevelId(null);
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Failed to delete proficiency level', 
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const handleAddLevel = () => {
    setEditingLevel(null);
    setShowAddLevelDialog(true);
  };

  const handleEditLevel = (level: any) => {
    setEditingLevel(level);
    setShowAddLevelDialog(true);
  };

  return (
    <>
      <Card className="mb-6 bg-muted/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4" />
                Proficiency Levels
              </CardTitle>
              <CardDescription className="text-xs">
                Define proficiency levels for this element (Basic, Intermediate, Advanced, etc.)
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleAddLevel}
              data-testid="button-add-proficiency-level"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Level
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {competencyLevels.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              No proficiency levels defined. Add levels to enable level-specific criteria assignment.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {competencyLevels
                .sort((a, b) => (a.order || 0) - (b.order || 0))
                .map((level) => (
                  <Badge 
                    key={level.id} 
                    variant="secondary" 
                    className="px-3 py-1 flex items-center gap-2"
                    data-testid={`badge-level-${level.code}`}
                  >
                    <span className="font-mono text-xs">{level.code}</span>
                    <span className="text-xs">{level.name}</span>
                    <div className="flex items-center gap-1 ml-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-4 w-4 hover-elevate"
                        onClick={() => handleEditLevel(level)}
                        data-testid={`button-edit-level-${level.code}`}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-4 w-4 hover-elevate"
                        onClick={() => setDeletingLevelId(level.id)}
                        data-testid={`button-delete-level-${level.code}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </Badge>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Level Dialog */}
      <Dialog open={showAddLevelDialog} onOpenChange={setShowAddLevelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingLevel ? 'Edit Proficiency Level' : 'Add Proficiency Level'}
            </DialogTitle>
            <DialogDescription>
              Define a proficiency level for this competency element.
            </DialogDescription>
          </DialogHeader>
          <LevelForm
            elementId={elementId}
            onSubmit={(data) => {
              if (editingLevel) {
                updateLevelMutation.mutate({ id: editingLevel.id, data });
              } else {
                createLevelMutation.mutate(data);
              }
            }}
            onCancel={() => {
              setShowAddLevelDialog(false);
              setEditingLevel(null);
            }}
            isLoading={createLevelMutation.isPending || updateLevelMutation.isPending}
            initialData={editingLevel}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingLevelId} onOpenChange={() => setDeletingLevelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Proficiency Level</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this proficiency level? This action cannot be undone.
              Criteria linked to this level will become unlinked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-level">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingLevelId && deleteLevelMutation.mutate(deletingLevelId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-level"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Level Form Component  
function LevelForm({
  elementId,
  onSubmit,
  onCancel,
  isLoading,
  initialData
}: {
  elementId: string;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isLoading: boolean;
  initialData?: any;
}) {
  const [formData, setFormData] = useState({
    elementId: elementId,
    name: initialData?.name || '',
    code: initialData?.code || '',
    description: initialData?.description || '',
    order: initialData?.order || 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="level-name">Level Name *</Label>
        <Input
          id="level-name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="e.g., Basic, Intermediate, Advanced"
          required
          data-testid="input-level-name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="level-code">Level Code *</Label>
        <Input
          id="level-code"
          value={formData.code}
          onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
          placeholder="e.g., L1, L2, L3"
          required
          data-testid="input-level-code"
        />
        <p className="text-xs text-muted-foreground">
          Short code to identify this level (e.g., L1 for Level 1, BAS for Basic)
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="level-description">Description</Label>
        <Textarea
          id="level-description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Describe what this proficiency level represents"
          data-testid="textarea-level-description"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="level-order">Display Order *</Label>
        <Input
          id="level-order"
          type="number"
          value={formData.order}
          onChange={(e) => setFormData(prev => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
          required
          data-testid="input-level-order"
        />
        <p className="text-xs text-muted-foreground">
          Controls the order levels appear (lower numbers first)
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel-level">
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading} data-testid="button-save-level">
          {isLoading ? 'Saving...' : 'Save Level'}
        </Button>
      </div>
    </form>
  );
}

// Bulk Criteria Form Component
function BulkCriteriaForm({
  elementId,
  type,
  subcategories,
  onSubmit,
  onCancel,
  isLoading
}: {
  elementId: string;
  type: 'knowledge' | 'performance' | 'safety';
  subcategories: CompetenceSubcategory[];
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  // Fetch element details to check if assessor guidance is required
  const { data: element } = useQuery<CompetencyElement>({
    queryKey: ['/api/competency-elements', elementId],
    queryFn: async () => {
      const response = await fetch(`/api/competency-elements/${elementId}`);
      if (!response.ok) throw new Error('Failed to fetch element');
      return response.json();
    },
    enabled: !!elementId,
  });

  // Fetch competency levels for this element
  const { data: competencyLevels = [] } = useQuery<any[]>({
    queryKey: ['/api/competency-levels', elementId],
    queryFn: async () => {
      const response = await fetch(`/api/competency-levels?elementId=${elementId}`);
      if (!response.ok) throw new Error('Failed to fetch competency levels');
      return response.json();
    },
    enabled: !!elementId,
  });

  // Shared fields for all criteria
  const [sharedFields, setSharedFields] = useState({
    subcategoryId: null as string | null,
    levelId: null as string | null,
    required: true,
    assessmentMethods: [] as string[],
  });

  // Individual criteria rows
  const [criteriaRows, setCriteriaRows] = useState([
    { criteriaText: '', assessorGuidance: '' }
  ]);

  const assessmentMethodOptions = [
    'Practical Assessment',
    'Written Examination',
    'Workplace Observation',
    'Portfolio Review',
    'Simulation Exercise',
    'Peer Assessment',
    'Self Assessment',
    'Professional Discussion'
  ];

  const handleAssessmentMethodChange = (method: string, checked: boolean) => {
    if (checked) {
      setSharedFields(prev => ({ 
        ...prev, 
        assessmentMethods: [...prev.assessmentMethods, method] 
      }));
    } else {
      setSharedFields(prev => ({ 
        ...prev, 
        assessmentMethods: prev.assessmentMethods.filter(m => m !== method) 
      }));
    }
  };

  const addCriteriaRow = () => {
    setCriteriaRows(prev => [...prev, { criteriaText: '', assessorGuidance: '' }]);
  };

  const removeCriteriaRow = (index: number) => {
    if (criteriaRows.length > 1) {
      setCriteriaRows(prev => prev.filter((_, i) => i !== index));
    }
  };

  const updateCriteriaRow = (index: number, field: 'criteriaText' | 'assessorGuidance', value: string) => {
    setCriteriaRows(prev => prev.map((row, i) => 
      i === index ? { ...row, [field]: value } : row
    ));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Build the bulk request payload
    const bulkData = {
      elementId,
      type,
      subcategoryId: sharedFields.subcategoryId,
      levelId: sharedFields.levelId,
      required: sharedFields.required,
      assessmentMethods: sharedFields.assessmentMethods,
      criteria: criteriaRows
        .filter(row => row.criteriaText.trim() !== '') // Only include non-empty criteria
        .map(row => ({
          criteriaText: row.criteriaText,
          assessorGuidance: element?.requiresAssessorGuidance ? row.assessorGuidance : ''
        }))
    };

    if (bulkData.criteria.length === 0) {
      return; // Don't submit if no criteria
    }

    onSubmit(bulkData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Shared Fields Section */}
      <div className="space-y-4 p-4 bg-muted/30 rounded-md">
        <h4 className="font-medium text-sm">Common Settings (applies to all criteria)</h4>

        <div className="space-y-2">
          <Label htmlFor="bulk-subcategory">Subcategory (Optional)</Label>
          <Select
            value={sharedFields.subcategoryId || 'none'}
            onValueChange={(value) => setSharedFields(prev => ({ ...prev, subcategoryId: value === 'none' ? null : value }))}
          >
            <SelectTrigger data-testid="select-bulk-subcategory">
              <SelectValue placeholder="Select subcategory or create element-level criteria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                No subcategory (Element-level: {type === 'knowledge' ? 'K1, K2...' : 'P1, P2...'})
              </SelectItem>
              {subcategories.map((subcategory) => (
                <SelectItem key={subcategory.id} value={subcategory.id}>
                  {subcategory.name} ({type === 'knowledge' ? 'K' : 'P'}{subcategory.order})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {competencyLevels.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="bulk-level">Proficiency Level (Optional)</Label>
            <Select
              value={sharedFields.levelId || 'none'}
              onValueChange={(value) => setSharedFields(prev => ({ ...prev, levelId: value === 'none' ? null : value }))}
            >
              <SelectTrigger data-testid="select-bulk-level">
                <SelectValue placeholder="Select proficiency level if applicable" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  No level (Applies to all levels)
                </SelectItem>
                {competencyLevels.map((level: any) => (
                  <SelectItem key={level.id} value={level.id}>
                    {level.name} ({level.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="bulk-required"
              checked={sharedFields.required}
              onCheckedChange={(checked) => setSharedFields(prev => ({ ...prev, required: checked as boolean }))}
              data-testid="checkbox-bulk-required"
            />
            <Label htmlFor="bulk-required" className="text-sm">
              Required (M) / Optional (O)
            </Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Checked = Mandatory (M), Unchecked = Optional (O)
          </p>
        </div>

        <div className="space-y-2">
          <Label>Assessment Methods</Label>
          <div className="grid grid-cols-2 gap-2">
            {assessmentMethodOptions.map(method => (
              <div key={method} className="flex items-center space-x-2">
                <Checkbox
                  id={`bulk-method-${method}`}
                  checked={sharedFields.assessmentMethods.includes(method)}
                  onCheckedChange={(checked) => handleAssessmentMethodChange(method, checked as boolean)}
                  data-testid={`checkbox-bulk-method-${method.toLowerCase().replace(/\s+/g, '-')}`}
                />
                <Label htmlFor={`bulk-method-${method}`} className="text-sm">{method}</Label>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Individual Criteria Rows */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-sm">Criteria (add multiple at once)</h4>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addCriteriaRow}
            data-testid="button-add-criteria-row"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Another
          </Button>
        </div>

        {criteriaRows.map((row, index) => (
          <div key={index} className="space-y-3 p-4 border rounded-md relative">
            {criteriaRows.length > 1 && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="absolute top-2 right-2 h-6 w-6"
                onClick={() => removeCriteriaRow(index)}
                data-testid={`button-remove-criteria-row-${index}`}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}

            <div className="space-y-2">
              <Label htmlFor={`criteria-text-${index}`}>
                Assessment Criteria {index + 1} *
              </Label>
              <Textarea
                id={`criteria-text-${index}`}
                value={row.criteriaText}
                onChange={(e) => updateCriteriaRow(index, 'criteriaText', e.target.value)}
                placeholder="Enter criteria text"
                required
                data-testid={`textarea-criteria-text-${index}`}
              />
            </div>

            {element?.requiresAssessorGuidance && (
              <div className="space-y-2">
                <Label htmlFor={`assessor-guidance-${index}`}>
                  Assessor Guidance (Optional)
                </Label>
                <Textarea
                  id={`assessor-guidance-${index}`}
                  value={row.assessorGuidance}
                  onChange={(e) => updateCriteriaRow(index, 'assessorGuidance', e.target.value)}
                  placeholder="Additional guidance for assessors"
                  data-testid={`textarea-assessor-guidance-${index}`}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel-bulk-criteria">
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={isLoading || criteriaRows.every(row => row.criteriaText.trim() === '')}
          data-testid="button-save-bulk-criteria"
        >
          {isLoading ? 'Creating...' : `Create ${criteriaRows.filter(r => r.criteriaText.trim()).length} Criteria`}
        </Button>
      </div>
    </form>
  );
}

// Category Form Component
function CategoryForm({ 
  onSubmit, 
  onCancel, 
  isLoading,
  initialData 
}: {
  onSubmit: (data: InsertCompetencyCategory) => void;
  onCancel: () => void;
  isLoading: boolean;
  initialData?: CompetencyCategory;
}) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    code: initialData?.code || '',
    description: initialData?.description || '',
    order: initialData?.order || 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="category-name">Name *</Label>
          <Input
            id="category-name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Category name"
            required
            data-testid="input-category-name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category-code">Code</Label>
          <Input
            id="category-code"
            value={formData.code}
            onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
            placeholder="Category code"
            data-testid="input-category-code"
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="category-description">Description</Label>
        <Textarea
          id="category-description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Category description"
          data-testid="textarea-category-description"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="category-order">Display Order</Label>
        <Input
          id="category-order"
          type="number"
          value={formData.order}
          onChange={(e) => setFormData(prev => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
          data-testid="input-category-order"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel-category">
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading} data-testid="button-save-category">
          {isLoading ? 'Saving...' : 'Save Category'}
        </Button>
      </div>
    </form>
  );
}

// Element Form Component
function ElementForm({ 
  categoryId,
  onSubmit, 
  onCancel, 
  isLoading,
  initialData 
}: {
  categoryId: string;
  onSubmit: (data: InsertCompetencyElement) => void;
  onCancel: () => void;
  isLoading: boolean;
  initialData?: CompetencyElement;
}) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    code: initialData?.code || '',
    description: initialData?.description || '',
    categoryId: categoryId,
    proficiencyScale: initialData?.proficiencyScale || 'one-point',
    safetyCriticality: initialData?.safetyCriticality || 'low',
    validityPeriod: initialData?.validityPeriod || null,
    reassessmentYears: initialData?.reassessmentYears || null, // Column J: Reassessment Validity (years)
    requiresAssessorGuidance: initialData?.requiresAssessorGuidance || false,
    assessorGuidance: initialData?.assessorGuidance || '',
    order: initialData?.order || 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      validityPeriod: formData.validityPeriod || null,
      reassessmentYears: formData.reassessmentYears || null,
      assessorGuidance: formData.assessorGuidance || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="element-name">Name *</Label>
          <Input
            id="element-name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Element name"
            required
            data-testid="input-element-name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="element-code">Code</Label>
          <Input
            id="element-code"
            value={formData.code}
            onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
            placeholder="Element code"
            data-testid="input-element-code"
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="element-description">Description</Label>
        <Textarea
          id="element-description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Element description"
          data-testid="textarea-element-description"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="proficiency-scale">Proficiency Scale</Label>
          <Select
            value={formData.proficiencyScale}
            onValueChange={(value) => setFormData(prev => ({ ...prev, proficiencyScale: value }))}
          >
            <SelectTrigger data-testid="select-proficiency-scale">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="one-point">One Point</SelectItem>
              <SelectItem value="three-point">Three Point (Basic/Intermediate/Advanced)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="safety-criticality">Safety Criticality</Label>
          <Select
            value={formData.safetyCriticality}
            onValueChange={(value) => setFormData(prev => ({ ...prev, safetyCriticality: value }))}
          >
            <SelectTrigger data-testid="select-safety-criticality">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reassessment-years">Reassessment Validity (Years)</Label>
        <Input
          id="reassessment-years"
          type="number"
          min="1"
          value={formData.reassessmentYears || ''}
          onChange={(e) => setFormData(prev => ({ ...prev, reassessmentYears: e.target.value ? parseInt(e.target.value) : null }))}
          placeholder="Number of years until reassessment required (e.g., 3)"
          data-testid="input-reassessment-years"
        />
        <p className="text-xs text-muted-foreground">
          Optional: Specify how many years before competence needs reassessment
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="requires-assessor-guidance-element"
            checked={formData.requiresAssessorGuidance}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, requiresAssessorGuidance: checked === true }))}
            data-testid="checkbox-requires-assessor-guidance-element"
          />
          <Label htmlFor="requires-assessor-guidance-element" className="text-sm font-medium">
            Requires Assessor Guidance
          </Label>
        </div>
        <p className="text-xs text-muted-foreground">
          When enabled, assessor guidance fields will appear when adding criteria to this element
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel-element">
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading} data-testid="button-save-element">
          {isLoading ? 'Saving...' : 'Save Element'}
        </Button>
      </div>
    </form>
  );
}

// Subcategory Form Component
function SubcategoryForm({ 
  elementId,
  onSubmit, 
  onCancel, 
  isLoading,
  initialData 
}: {
  elementId: string;
  onSubmit: (data: InsertCompetenceSubcategory) => void;
  onCancel: () => void;
  isLoading: boolean;
  initialData?: CompetenceSubcategory;
}) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    elementId: elementId,
    type: initialData?.type || 'knowledge' as 'knowledge' | 'performance' | 'safety',
    order: initialData?.order || 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="subcategory-name">Name *</Label>
          <Input
            id="subcategory-name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Subcategory name"
            required
            data-testid="input-subcategory-name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="subcategory-type">Type</Label>
          <Select
            value={formData.type}
            onValueChange={(value: 'knowledge' | 'performance' | 'safety') => setFormData(prev => ({ ...prev, type: value }))}
          >
            <SelectTrigger data-testid="select-subcategory-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="safety">Safety</SelectItem>
              <SelectItem value="knowledge">Knowledge</SelectItem>
              <SelectItem value="performance">Performance</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="subcategory-order">Display Order</Label>
        <Input
          id="subcategory-order"
          type="number"
          value={formData.order}
          onChange={(e) => setFormData(prev => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
          data-testid="input-subcategory-order"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel-subcategory">
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading} data-testid="button-save-subcategory">
          {isLoading ? 'Saving...' : 'Save Subcategory'}
        </Button>
      </div>
    </form>
  );
}

// Criteria Form Component
function CriteriaForm({ 
  elementId,
  type,
  subcategories,
  onSubmit, 
  onCancel, 
  isLoading,
  initialData 
}: {
  elementId: string;
  type: 'knowledge' | 'performance' | 'safety';
  subcategories: CompetenceSubcategory[];
  onSubmit: (data: InsertCompetenceCriteria) => void;
  onCancel: () => void;
  isLoading: boolean;
  initialData?: CompetenceCriteria;
}) {
  // Fetch element details to check if assessor guidance is required
  const { data: element } = useQuery<CompetencyElement>({
    queryKey: ['/api/competency-elements', elementId],
    queryFn: async () => {
      const response = await fetch(`/api/competency-elements/${elementId}`);
      if (!response.ok) throw new Error('Failed to fetch element');
      return response.json();
    },
    enabled: !!elementId,
  });
  
  // Fetch competency levels for this element
  const { data: competencyLevels = [] } = useQuery<any[]>({
    queryKey: ['/api/competency-levels', elementId],
    queryFn: async () => {
      const response = await fetch(`/api/competency-levels?elementId=${elementId}`);
      if (!response.ok) throw new Error('Failed to fetch competency levels');
      return response.json();
    },
    enabled: !!elementId,
  });

  const [formData, setFormData] = useState({
    criteriaText: initialData?.criteriaText || '', // V2: Use criteriaText instead of description
    elementId: elementId,
    subcategoryId: initialData?.subcategoryId || null,
    levelId: initialData?.levelId || null,
    type: type,
    assessmentMethods: initialData?.assessmentMethods || [],
    assessorGuidance: initialData?.assessorGuidance || '',
    required: initialData?.required ?? true, // V2: Add required field (M/O)
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const assessmentMethodOptions = [
    'Practical Assessment',
    'Written Examination',
    'Workplace Observation',
    'Portfolio Review',
    'Simulation Exercise',
    'Peer Assessment',
    'Self Assessment',
    'Professional Discussion'
  ];

  const handleAssessmentMethodChange = (method: string, checked: boolean) => {
    if (checked) {
      setFormData(prev => ({ 
        ...prev, 
        assessmentMethods: [...prev.assessmentMethods, method] 
      }));
    } else {
      setFormData(prev => ({ 
        ...prev, 
        assessmentMethods: prev.assessmentMethods.filter(m => m !== method) 
      }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="criteria-subcategory">Subcategory (Optional)</Label>
        <Select
          value={formData.subcategoryId || 'none'}
          onValueChange={(value) => setFormData(prev => ({ ...prev, subcategoryId: value === 'none' ? null : value }))}
        >
          <SelectTrigger data-testid="select-criteria-subcategory">
            <SelectValue placeholder="Select subcategory or create element-level criteria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">
              No subcategory (Element-level: {type === 'knowledge' ? 'K1, K2...' : 'P1, P2...'})
            </SelectItem>
            {subcategories.map((subcategory) => (
              <SelectItem key={subcategory.id} value={subcategory.id}>
                {subcategory.name} ({type === 'knowledge' ? 'K' : 'P'}{subcategory.order})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {competencyLevels.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="criteria-level">Proficiency Level (Optional)</Label>
          <Select
            value={formData.levelId || 'none'}
            onValueChange={(value) => setFormData(prev => ({ ...prev, levelId: value === 'none' ? null : value }))}
          >
            <SelectTrigger data-testid="select-criteria-level">
              <SelectValue placeholder="Select proficiency level if applicable" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                No level (Applies to all levels)
              </SelectItem>
              {competencyLevels.map((level: any) => (
                <SelectItem key={level.id} value={level.id}>
                  {level.name} ({level.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            This element has multiple proficiency levels. Select which level this criterion applies to, or leave as "No level" if it applies to all levels.
          </p>
        </div>
      )}
      
      <div className="space-y-2">
        <Label htmlFor="criteria-text">Assessment Criteria *</Label>
        <Textarea
          id="criteria-text"
          value={formData.criteriaText}
          onChange={(e) => setFormData(prev => ({ ...prev, criteriaText: e.target.value }))}
          placeholder="Assessment criteria text"
          required
          data-testid="textarea-criteria-text"
        />
      </div>

      {element?.requiresAssessorGuidance && (
        <div className="space-y-2">
          <Label htmlFor="criteria-assessor-guidance">Assessor Guidance</Label>
          <Textarea
            id="criteria-assessor-guidance"
            value={formData.assessorGuidance}
            onChange={(e) => setFormData(prev => ({ ...prev, assessorGuidance: e.target.value }))}
            placeholder="Additional guidance for assessors (optional, generates KG/PG code if provided)"
            data-testid="textarea-criteria-assessor-guidance"
          />
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="criteria-required"
            checked={formData.required}
            onChange={(e) => setFormData(prev => ({ ...prev, required: e.target.checked }))}
            data-testid="checkbox-criteria-required"
          />
          <Label htmlFor="criteria-required" className="text-sm">
            Required (M) / Optional (O) - Column J
          </Label>
        </div>
        <p className="text-xs text-muted-foreground">
          Checked = Mandatory (M), Unchecked = Optional (O)
        </p>
      </div>

      <div className="space-y-2">
        <Label>Assessment Methods</Label>
        <div className="grid grid-cols-2 gap-2" data-testid="assessment-methods-grid">
          {assessmentMethodOptions.map(method => (
            <div key={method} className="flex items-center space-x-2">
              <input
                type="checkbox"
                id={`method-${method}`}
                checked={formData.assessmentMethods.includes(method)}
                onChange={(e) => handleAssessmentMethodChange(method, e.target.checked)}
                data-testid={`checkbox-method-${method.toLowerCase().replace(/\s+/g, '-')}`}
              />
              <Label htmlFor={`method-${method}`} className="text-sm">{method}</Label>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel-criteria">
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading} data-testid="button-save-criteria">
          {isLoading ? 'Saving...' : 'Save Criteria'}
        </Button>
      </div>
    </form>
  );
}


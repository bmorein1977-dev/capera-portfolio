import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  Edit, 
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
  Building2,
  Grid3X3
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
  JobRole,
  CompetencyMatrix,
  InsertCompetencyCategory,
  InsertCompetencyElement,
  InsertCompetenceSubcategory,
  InsertCompetenceCriteria,
  InsertJobRole,
  InsertCompetencyMatrix,
  CompetencyTreeNode
} from '@shared/schema';

interface CompetencyFilters {
  categoryId?: string;
  elementId?: string;
  searchQuery?: string;
}

export default function CompetencyManager() {
  // Tab management
  const [activeTab, setActiveTab] = useState('competencies');
  
  // Competency management state
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [filters, setFilters] = useState<CompetencyFilters>({});
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  
  // Dialog states
  const [showAddCategoryDialog, setShowAddCategoryDialog] = useState(false);
  const [showAddElementDialog, setShowAddElementDialog] = useState(false);
  const [showAddSubcategoryDialog, setShowAddSubcategoryDialog] = useState(false);
  const [showAddCriteriaDialog, setShowAddCriteriaDialog] = useState(false);
  const [showAddJobRoleDialog, setShowAddJobRoleDialog] = useState(false);
  
  // Editing states
  const [editingCategory, setEditingCategory] = useState<CompetencyCategory | null>(null);
  const [editingElement, setEditingElement] = useState<CompetencyElement | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<CompetenceSubcategory | null>(null);
  const [editingCriteria, setEditingCriteria] = useState<CompetenceCriteria | null>(null);
  const [editingJobRole, setEditingJobRole] = useState<JobRole | null>(null);
  
  // Job role management state
  const [selectedJobRoleId, setSelectedJobRoleId] = useState<string | null>(null);
  const [selectedCriteriaForMatrix, setSelectedCriteriaForMatrix] = useState<string | null>(null);
  const [criteriaType, setCriteriaType] = useState<'knowledge' | 'performance'>('knowledge');

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

  // Competence criteria for selected element
  const { data: allCriteria = [] } = useQuery<CompetenceCriteria[]>({
    queryKey: ['/api/competence-criteria', { elementId: selectedElementId }],
    enabled: !!selectedElementId,
  });

  const { data: jobRoles = [] } = useQuery<JobRole[]>({
    queryKey: ['/api/job-roles'],
  });

  const { data: competencyMatrix = [] } = useQuery<CompetencyMatrix[]>({
    queryKey: ['/api/competency-matrix'],
  });

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/competence-criteria'] });
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

  // Mutations for job roles
  const createJobRoleMutation = useMutation({
    mutationFn: (data: InsertJobRole) => apiRequest('POST', '/api/job-roles', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/job-roles'] });
      setShowAddJobRoleDialog(false);
      setEditingJobRole(null);
      toast({ title: 'Success', description: 'Job role created successfully' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create job role', variant: 'destructive' });
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
          className={`flex items-center gap-2 p-2 cursor-pointer hover-elevate rounded-md ${
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
              className="h-4 w-4 p-0"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(item.id);
              }}
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
            <div className="text-sm font-medium truncate">{item.name}</div>
            {item.type === 'category' && item.elementCount !== undefined && (
              <div className="text-xs text-muted-foreground">
                {item.elementCount} elements
              </div>
            )}
          </div>

          {item.type === 'element' && (
            <div className="flex items-center gap-1">
              <Target className="h-3 w-3 text-blue-500" />
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

  // Render subcategory card with criteria
  const renderSubcategoryCard = (subcategory: CompetenceSubcategory) => {
    const criteriaForSubcategory = allCriteria.filter(c => c.subcategoryId === subcategory.id);
    
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
                className="h-6 w-6"
                onClick={() => {
                  setEditingSubcategory(subcategory);
                  setShowAddSubcategoryDialog(true);
                }}
                data-testid={`button-edit-subcategory-${subcategory.id}`}
              >
                <Edit className="h-3 w-3" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6"
                onClick={() => {
                  setCriteriaType(subcategory.type as 'knowledge' | 'performance');
                  setEditingCriteria(null);
                  setShowAddCriteriaDialog(true);
                }}
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
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs font-mono">
                      {criteria.code}
                    </Badge>
                    <span className="text-sm">{criteria.description}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6"
                      onClick={() => {
                        setEditingCriteria(criteria);
                        setCriteriaType(criteria.type as 'knowledge' | 'performance');
                        setShowAddCriteriaDialog(true);
                      }}
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
            {activeTab === 'competencies' && 'Manage competence criteria with Knowledge (K1.1) and Performance (P1.1) structure'}
            {activeTab === 'matrix' && 'Assign competence criteria to job roles with required proficiency levels'}
            {activeTab === 'roles' && 'Manage job roles and their organizational details'}
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'competencies' && (
            <>
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
            </>
          )}
          {activeTab === 'roles' && (
            <Button onClick={() => setShowAddJobRoleDialog(true)} data-testid="button-add-job-role">
              <Plus className="h-4 w-4 mr-2" />
              Add Job Role
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-[calc(100vh-12rem)]">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="competencies" data-testid="tab-competencies">
            <Target className="h-4 w-4 mr-2" />
            Competencies
          </TabsTrigger>
          <TabsTrigger value="matrix" data-testid="tab-matrix">
            <Grid3X3 className="h-4 w-4 mr-2" />
            Job Matrix
          </TabsTrigger>
          <TabsTrigger value="roles" data-testid="tab-roles">
            <Building2 className="h-4 w-4 mr-2" />
            Job Roles
          </TabsTrigger>
        </TabsList>

        <TabsContent value="competencies" className="h-full">
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
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Knowledge Column */}
                        <div>
                          <div className="flex items-center gap-2 mb-4">
                            <Brain className="h-5 w-5 text-blue-500" />
                            <h3 className="text-lg font-semibold">Knowledge Criteria</h3>
                            <Badge variant="secondary">K1, K2, K3...</Badge>
                          </div>
                          
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
                          <div className="flex items-center gap-2 mb-4">
                            <Users className="h-5 w-5 text-green-500" />
                            <h3 className="text-lg font-semibold">Performance Criteria</h3>
                            <Badge variant="secondary">P1, P2, P3...</Badge>
                          </div>
                          
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
        </TabsContent>

        <TabsContent value="matrix" className="h-full">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Job Matrix</CardTitle>
              <CardDescription>
                Assign competence criteria to job roles with required proficiency levels
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center text-muted-foreground py-8">
                Job matrix functionality will be implemented next
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="h-full">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Job Roles</CardTitle>
              <CardDescription>
                Manage job roles and their organizational details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center text-muted-foreground py-8">
                Job roles functionality will be implemented next
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
            onSubmit={(data) => createCategoryMutation.mutate(data)}
            onCancel={() => {
              setShowAddCategoryDialog(false);
              setEditingCategory(null);
            }}
            isLoading={createCategoryMutation.isPending}
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
          {selectedCategoryId && (
            <ElementForm
              categoryId={selectedCategoryId}
              onSubmit={(data) => createElementMutation.mutate(data)}
              onCancel={() => {
                setShowAddElementDialog(false);
                setEditingElement(null);
              }}
              isLoading={createElementMutation.isPending}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCriteria ? 'Edit Criteria' : 'Add Criteria'}
            </DialogTitle>
            <DialogDescription>
              Create a new {criteriaType} criteria with automatic K1.1 or P1.1 numbering.
            </DialogDescription>
          </DialogHeader>
          {selectedElementId && (
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
              initialData={editingCriteria || undefined}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Add Job Role Dialog */}
      <Dialog open={showAddJobRoleDialog} onOpenChange={setShowAddJobRoleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingJobRole ? 'Edit Job Role' : 'Add Job Role'}
            </DialogTitle>
            <DialogDescription>
              Create a new job role for competency assignment.
            </DialogDescription>
          </DialogHeader>
          <JobRoleForm
            onSubmit={(data) => createJobRoleMutation.mutate(data)}
            onCancel={() => {
              setShowAddJobRoleDialog(false);
              setEditingJobRole(null);
            }}
            isLoading={createJobRoleMutation.isPending}
            initialData={editingJobRole || undefined}
          />
        </DialogContent>
      </Dialog>
    </div>
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
    requiresAssessorGuidance: initialData?.requiresAssessorGuidance || false,
    assessorGuidance: initialData?.assessorGuidance || '',
    order: initialData?.order || 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      validityPeriod: formData.validityPeriod || null,
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
    description: initialData?.description || '',
    elementId: elementId,
    type: initialData?.type || 'knowledge' as 'knowledge' | 'performance',
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
            onValueChange={(value: 'knowledge' | 'performance') => setFormData(prev => ({ ...prev, type: value }))}
          >
            <SelectTrigger data-testid="select-subcategory-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="knowledge">Knowledge</SelectItem>
              <SelectItem value="performance">Performance</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="subcategory-description">Description</Label>
        <Textarea
          id="subcategory-description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Subcategory description"
          data-testid="textarea-subcategory-description"
        />
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
  type: 'knowledge' | 'performance';
  subcategories: CompetenceSubcategory[];
  onSubmit: (data: InsertCompetenceCriteria) => void;
  onCancel: () => void;
  isLoading: boolean;
  initialData?: CompetenceCriteria;
}) {
  const [formData, setFormData] = useState({
    description: initialData?.description || '',
    elementId: elementId,
    subcategoryId: initialData?.subcategoryId || '',
    type: type,
    assessmentMethods: initialData?.assessmentMethods || [],
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
        <Label htmlFor="criteria-subcategory">Subcategory *</Label>
        <Select
          value={formData.subcategoryId}
          onValueChange={(value) => setFormData(prev => ({ ...prev, subcategoryId: value }))}
        >
          <SelectTrigger data-testid="select-criteria-subcategory">
            <SelectValue placeholder="Select subcategory" />
          </SelectTrigger>
          <SelectContent>
            {subcategories.map((subcategory) => (
              <SelectItem key={subcategory.id} value={subcategory.id}>
                {subcategory.name} ({type === 'knowledge' ? 'K' : 'P'}{subcategory.order})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="criteria-description">Description *</Label>
        <Textarea
          id="criteria-description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Criteria description"
          required
          data-testid="textarea-criteria-description"
        />
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
        <Button type="submit" disabled={isLoading || !formData.subcategoryId} data-testid="button-save-criteria">
          {isLoading ? 'Saving...' : 'Save Criteria'}
        </Button>
      </div>
    </form>
  );
}

// Job Role Form Component
function JobRoleForm({ 
  onSubmit, 
  onCancel, 
  isLoading,
  initialData 
}: {
  onSubmit: (data: InsertJobRole) => void;
  onCancel: () => void;
  isLoading: boolean;
  initialData?: JobRole;
}) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    code: initialData?.code || '',
    description: initialData?.description || '',
    department: initialData?.department || '',
    level: initialData?.level || '',
    isActive: initialData?.isActive ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="job-role-name">Name *</Label>
          <Input
            id="job-role-name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Job role name"
            required
            data-testid="input-job-role-name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="job-role-code">Code *</Label>
          <Input
            id="job-role-code"
            value={formData.code}
            onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
            placeholder="Job role code"
            required
            data-testid="input-job-role-code"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="job-role-description">Description</Label>
        <Textarea
          id="job-role-description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Job role description"
          data-testid="textarea-job-role-description"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel-job-role">
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading} data-testid="button-save-job-role">
          {isLoading ? 'Saving...' : 'Save Job Role'}
        </Button>
      </div>
    </form>
  );
}
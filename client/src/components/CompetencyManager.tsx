import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Users,
  BookOpen,
  Search,
  Filter,
  ChevronRight,
  ChevronDown,
  Building2,
  Grid3X3
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { 
  CompetencyCategory, 
  CompetencyElement, 
  Competency, 
  JobRole,
  CompetencyMatrix,
  InsertCompetencyCategory,
  InsertCompetencyElement,
  InsertCompetency,
  InsertJobRole,
  InsertCompetencyMatrix,
  CompetencyTreeNode
} from '@shared/schema';

interface CompetencyFilters {
  categoryId?: string;
  elementId?: string;
  type?: string;
  critical?: boolean;
  safetyCritical?: boolean;
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
  const [showAddCategoryDialog, setShowAddCategoryDialog] = useState(false);
  const [showAddElementDialog, setShowAddElementDialog] = useState(false);
  const [showAddCompetencyDialog, setShowAddCompetencyDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CompetencyCategory | null>(null);
  const [editingElement, setEditingElement] = useState<CompetencyElement | null>(null);
  const [editingCompetency, setEditingCompetency] = useState<Competency | null>(null);
  
  // Job role management state
  const [showAddJobRoleDialog, setShowAddJobRoleDialog] = useState(false);
  const [editingJobRole, setEditingJobRole] = useState<JobRole | null>(null);
  const [selectedJobRoleId, setSelectedJobRoleId] = useState<string | null>(null);
  const [selectedCompetencyForMatrix, setSelectedCompetencyForMatrix] = useState<string | null>(null);

  const { toast } = useToast();

  // Fetch data
  const { data: competencyTree = [], isLoading: treeLoading } = useQuery<CompetencyTreeNode[]>({
    queryKey: ['/api/competency-tree'],
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<CompetencyCategory[]>({
    queryKey: ['/api/competency-categories'],
  });

  const { data: elements = [], isLoading: elementsLoading } = useQuery<CompetencyElement[]>({
    queryKey: ['/api/competency-elements'],
  });

  // Create stable query key for competencies
  const competenciesQueryKey = [
    '/api/competencies-with-details',
    {
      elementId: selectedElementId || null,
      categoryId: selectedCategoryId || null,
      type: filters.type || null,
      critical: filters.critical || null,
      safetyCritical: filters.safetyCritical || null,
      searchQuery: filters.searchQuery || null
    }
  ];

  const { data: competencies = [], isLoading: competenciesLoading } = useQuery<any[]>({
    queryKey: competenciesQueryKey,
    enabled: !!(selectedCategoryId || selectedElementId),
  });

  const { data: jobRoles = [] } = useQuery<JobRole[]>({
    queryKey: ['/api/job-roles'],
  });

  const { data: competencyMatrix = [] } = useQuery<CompetencyMatrix[]>({
    queryKey: ['/api/competency-matrix'],
  });

  // Mutations
  const createCategoryMutation = useMutation({
    mutationFn: (data: InsertCompetencyCategory) => apiRequest('POST', '/api/competency-categories', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/competency-categories'] });
      queryClient.invalidateQueries({ queryKey: ['/api/competency-tree'] });
      setShowAddCategoryDialog(false);
      toast({ title: 'Success', description: 'Category created successfully' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create category', variant: 'destructive' });
    }
  });

  const createElementMutation = useMutation({
    mutationFn: (data: InsertCompetencyElement) => apiRequest('POST', '/api/competency-elements', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/competency-elements'] });
      queryClient.invalidateQueries({ queryKey: ['/api/competency-tree'] });
      setShowAddElementDialog(false);
      toast({ title: 'Success', description: 'Element created successfully' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create element', variant: 'destructive' });
    }
  });

  const createCompetencyMutation = useMutation({
    mutationFn: (data: InsertCompetency) => apiRequest('POST', '/api/competencies', data),
    onSuccess: () => {
      // Use partial-key invalidation for React Query v5 to ensure UI updates
      queryClient.invalidateQueries({ 
        queryKey: ['/api/competencies-with-details'],
        refetchType: 'active'
      });
      queryClient.invalidateQueries({ 
        queryKey: ['/api/competency-tree'],
        refetchType: 'active'
      });
      queryClient.invalidateQueries({ 
        queryKey: ['/api/competencies']
      });
      setShowAddCompetencyDialog(false);
      toast({ title: 'Success', description: 'Competency created successfully' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create competency', variant: 'destructive' });
    }
  });

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

  const updateJobRoleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertJobRole> }) => 
      apiRequest('PATCH', `/api/job-roles/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/job-roles'] });
      setEditingJobRole(null);
      toast({ title: 'Success', description: 'Job role updated successfully' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update job role', variant: 'destructive' });
    }
  });

  const deleteJobRoleMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/job-roles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/job-roles'] });
      queryClient.invalidateQueries({ queryKey: ['/api/competency-matrix'] });
      toast({ title: 'Success', description: 'Job role deleted successfully' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete job role', variant: 'destructive' });
    }
  });

  const createMatrixEntryMutation = useMutation({
    mutationFn: (data: InsertCompetencyMatrix) => apiRequest('POST', '/api/competency-matrix', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/competency-matrix'] });
      toast({ title: 'Success', description: 'Competency assigned to job role successfully' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to assign competency', variant: 'destructive' });
    }
  });

  const deleteMatrixEntryMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/competency-matrix/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/competency-matrix'] });
      toast({ title: 'Success', description: 'Competency unassigned from job role successfully' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to unassign competency', variant: 'destructive' });
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
  const getSafetyCriticalityBadge = (level: string) => {
    const colors = {
      low: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      high: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    };
    return (
      <Badge className={colors[level as keyof typeof colors]}>
        {level.charAt(0).toUpperCase() + level.slice(1)}
      </Badge>
    );
  };

  const getTypeBadge = (type: string) => {
    const colors = {
      technical: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      safety: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
      behavioral: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      quality: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    };
    return (
      <Badge className={colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </Badge>
    );
  };

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

  return (
    <div className="h-full p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-competency-manager">
            Competency Management
          </h1>
          <p className="text-muted-foreground">
            {activeTab === 'competencies' && 'Manage hierarchical competency structure with categories, elements, and individual competencies'}
            {activeTab === 'matrix' && 'Assign competencies to job roles with required proficiency levels'}
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
                onClick={() => setShowAddCompetencyDialog(true)} 
                disabled={!selectedElementId}
                data-testid="button-add-competency"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Competency
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

        {/* Right Panel - Competencies Table */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Competencies
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
                    ? 'Competencies in selected element'
                    : selectedCategoryId 
                    ? 'Select an element to view competencies'
                    : 'Select a category or element to view competencies'
                  }
                </CardDescription>
              </div>
              
              {/* Filters */}
              <div className="flex items-center gap-2">
                <div className="flex items-center space-x-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search competencies..."
                    className="w-64"
                    value={filters.searchQuery || ''}
                    onChange={(e) => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
                    data-testid="input-search-competencies"
                  />
                </div>
                <Select
                  value={filters.type || 'all'}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, type: value === 'all' ? undefined : value }))}
                >
                  <SelectTrigger className="w-32" data-testid="select-type-filter">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="technical">Technical</SelectItem>
                    <SelectItem value="safety">Safety</SelectItem>
                    <SelectItem value="behavioral">Behavioral</SelectItem>
                    <SelectItem value="quality">Quality</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-20rem)]">
              {competenciesLoading ? (
                <div className="text-center text-muted-foreground py-8">
                  Loading competencies...
                </div>
              ) : !selectedElementId && !selectedCategoryId ? (
                <div className="text-center text-muted-foreground py-8">
                  Select a category or element from the tree to view competencies
                </div>
              ) : competencies.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No competencies found. Add your first competency to get started.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Safety</TableHead>
                      <TableHead>Critical</TableHead>
                      <TableHead>Threshold</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {competencies.map((competency: CompetencyWithDetails) => (
                      <TableRow key={competency.id} data-testid={`row-competency-${competency.id}`}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{competency.name}</div>
                            {competency.externalId && (
                              <div className="text-xs text-muted-foreground">
                                ID: {competency.externalId}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getTypeBadge(competency.type)}</TableCell>
                        <TableCell>
                          {competency.level && (
                            <Badge variant="outline">{competency.level}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {competency.safetyCritical && (
                            <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                              <Shield className="h-3 w-3 mr-1" />
                              Safety Critical
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {competency.critical && (
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                          )}
                        </TableCell>
                        <TableCell>{competency.passingThreshold}%</TableCell>
                        <TableCell>
                          {competency.isActive ? (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingCompetency(competency)}
                              data-testid={`button-edit-competency-${competency.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              data-testid={`button-delete-competency-${competency.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
          </div>
        </TabsContent>

        <TabsContent value="matrix" className="h-full">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Grid3X3 className="h-5 w-5" />
                  Job Role Competency Matrix
                </CardTitle>
                <CardDescription>
                  Assign competencies to job roles with required proficiency levels
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Matrix Filters */}
                  <div className="flex gap-4 items-center">
                    <div className="flex-1">
                      <Label htmlFor="matrix-job-role">Filter by Job Role</Label>
                      <Select 
                        value={selectedJobRoleId || "all"} 
                        onValueChange={(value) => setSelectedJobRoleId(value === "all" ? null : value)}
                      >
                        <SelectTrigger data-testid="select-matrix-job-role">
                          <SelectValue placeholder="All job roles" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Job Roles</SelectItem>
                          {jobRoles.map(role => (
                            <SelectItem key={role.id} value={role.id}>
                              {role.name} ({role.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1">
                      <Label htmlFor="matrix-competency">Filter by Competency</Label>
                      <Select 
                        value={selectedCompetencyForMatrix || "all"} 
                        onValueChange={(value) => setSelectedCompetencyForMatrix(value === "all" ? null : value)}
                      >
                        <SelectTrigger data-testid="select-matrix-competency">
                          <SelectValue placeholder="All competencies" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Competencies</SelectItem>
                          {competencies.map(competency => (
                            <SelectItem key={competency.id} value={competency.id}>
                              {competency.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Matrix Table */}
                  <ScrollArea className="h-[calc(100vh-22rem)]">
                    {competencyMatrix.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8">
                        No competency assignments found. Start by assigning competencies to job roles.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Job Role</TableHead>
                            <TableHead>Competency</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Element</TableHead>
                            <TableHead>Proficiency Level</TableHead>
                            <TableHead>Mandatory</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {competencyMatrix
                            .filter(entry => 
                              (!selectedJobRoleId || entry.jobRoleId === selectedJobRoleId) &&
                              (!selectedCompetencyForMatrix || entry.competencyId === selectedCompetencyForMatrix)
                            )
                            .map((entry) => {
                              const jobRole = jobRoles.find(r => r.id === entry.jobRoleId);
                              const competency = competencies.find(c => c.id === entry.competencyId);
                              return (
                                <TableRow key={entry.id}>
                                  <TableCell className="font-medium">
                                    {jobRole ? (
                                      <div>
                                        <div>{jobRole.name}</div>
                                        <Badge variant="outline" className="text-xs">{jobRole.code}</Badge>
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground">Unknown Role</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {competency ? (
                                      <div>
                                        <div className="font-medium">{competency.name}</div>
                                        <div className="text-xs text-muted-foreground">{competency.code}</div>
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground">Unknown Competency</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-muted-foreground text-sm">
                                      {competency?.categoryName || '-'}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-muted-foreground text-sm">
                                      {competency?.elementName || '-'}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    <Badge 
                                      className={
                                        entry.proficiencyLevel === 'A' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' :
                                        entry.proficiencyLevel === 'I' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' :
                                        entry.proficiencyLevel === 'B' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' :
                                        'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                                      }
                                    >
                                      {entry.proficiencyLevel === 'S' && 'Standard'}
                                      {entry.proficiencyLevel === 'B' && 'Basic'}
                                      {entry.proficiencyLevel === 'I' && 'Intermediate'}
                                      {entry.proficiencyLevel === 'A' && 'Advanced'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    {entry.isMandatory ? (
                                      <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300">
                                        <Shield className="h-3 w-3 mr-1" />
                                        Mandatory
                                      </Badge>
                                    ) : (
                                      <Badge variant="secondary">Optional</Badge>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {entry.isActive ? (
                                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                        Active
                                      </Badge>
                                    ) : (
                                      <Badge variant="secondary">Inactive</Badge>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-destructive hover:text-destructive"
                                        onClick={() => deleteMatrixEntryMutation.mutate(entry.id)}
                                        data-testid={`button-unassign-${entry.id}`}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                        </TableBody>
                      </Table>
                    )}
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="roles" className="h-full">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Job Role Management
                </CardTitle>
                <CardDescription>
                  Manage job roles and their organizational details
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[calc(100vh-16rem)]">
                  {jobRoles.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      No job roles found. Create your first job role to get started.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Code</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Level</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {jobRoles.map((role) => (
                          <TableRow key={role.id}>
                            <TableCell className="font-medium">{role.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{role.code}</Badge>
                            </TableCell>
                            <TableCell>{role.department || '-'}</TableCell>
                            <TableCell>
                              {role.level && (
                                <Badge variant="secondary">
                                  {role.level.charAt(0).toUpperCase() + role.level.slice(1)}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {role.isActive ? (
                                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Active
                                </Badge>
                              ) : (
                                <Badge variant="secondary">Inactive</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setEditingJobRole(role)}
                                  data-testid={`button-edit-job-role-${role.id}`}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => deleteJobRoleMutation.mutate(role.id)}
                                  data-testid={`button-delete-job-role-${role.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Category Dialog */}
      <Dialog open={showAddCategoryDialog} onOpenChange={setShowAddCategoryDialog}>
        <DialogContent data-testid="dialog-add-category">
          <DialogHeader>
            <DialogTitle>Add New Category</DialogTitle>
            <DialogDescription>
              Create a new competency category to organize elements
            </DialogDescription>
          </DialogHeader>
          <CategoryForm 
            onSubmit={(data) => createCategoryMutation.mutate(data)}
            onCancel={() => setShowAddCategoryDialog(false)}
            isLoading={createCategoryMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Add Element Dialog */}
      <Dialog open={showAddElementDialog} onOpenChange={setShowAddElementDialog}>
        <DialogContent data-testid="dialog-add-element">
          <DialogHeader>
            <DialogTitle>Add New Element</DialogTitle>
            <DialogDescription>
              Create a new competency element within the selected category
            </DialogDescription>
          </DialogHeader>
          <ElementForm 
            categoryId={selectedCategoryId || ''}
            onSubmit={(data) => createElementMutation.mutate(data)}
            onCancel={() => setShowAddElementDialog(false)}
            isLoading={createElementMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Add Competency Dialog */}
      <Dialog open={showAddCompetencyDialog} onOpenChange={setShowAddCompetencyDialog}>
        <DialogContent className="max-w-2xl" data-testid="dialog-add-competency">
          <DialogHeader>
            <DialogTitle>Add New Competency</DialogTitle>
            <DialogDescription>
              Create a new competency within the selected element
            </DialogDescription>
          </DialogHeader>
          <CompetencyForm 
            elementId={selectedElementId || ''}
            onSubmit={(data) => createCompetencyMutation.mutate(data)}
            onCancel={() => setShowAddCompetencyDialog(false)}
            isLoading={createCompetencyMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Add/Edit Job Role Dialog */}
      <Dialog 
        open={showAddJobRoleDialog || !!editingJobRole} 
        onOpenChange={(open) => {
          if (!open) {
            setShowAddJobRoleDialog(false);
            setEditingJobRole(null);
          }
        }}
      >
        <DialogContent data-testid="dialog-job-role">
          <DialogHeader>
            <DialogTitle>
              {editingJobRole ? 'Edit Job Role' : 'Add New Job Role'}
            </DialogTitle>
            <DialogDescription>
              {editingJobRole ? 'Update job role details' : 'Create a new job role'}
            </DialogDescription>
          </DialogHeader>
          <JobRoleForm 
            onSubmit={(data) => {
              if (editingJobRole) {
                updateJobRoleMutation.mutate({ id: editingJobRole.id, data });
              } else {
                createJobRoleMutation.mutate(data);
              }
            }}
            onCancel={() => {
              setShowAddJobRoleDialog(false);
              setEditingJobRole(null);
            }}
            isLoading={createJobRoleMutation.isPending || updateJobRoleMutation.isPending}
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

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="validity-period">Validity Period (Years)</Label>
          <Input
            id="validity-period"
            type="number"
            min="1"
            max="6"
            value={formData.validityPeriod || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, validityPeriod: parseInt(e.target.value) || null }))}
            placeholder="1-6 years"
            data-testid="input-validity-period"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="element-order">Display Order</Label>
          <Input
            id="element-order"
            type="number"
            value={formData.order}
            onChange={(e) => setFormData(prev => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
            data-testid="input-element-order"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="requires-assessor-guidance"
            checked={formData.requiresAssessorGuidance}
            onChange={(e) => setFormData(prev => ({ ...prev, requiresAssessorGuidance: e.target.checked }))}
            data-testid="checkbox-requires-assessor-guidance"
          />
          <Label htmlFor="requires-assessor-guidance">Requires Assessor Guidance</Label>
        </div>
      </div>

      {formData.requiresAssessorGuidance && (
        <div className="space-y-2">
          <Label htmlFor="assessor-guidance">Assessor Guidance</Label>
          <Textarea
            id="assessor-guidance"
            value={formData.assessorGuidance}
            onChange={(e) => setFormData(prev => ({ ...prev, assessorGuidance: e.target.value }))}
            placeholder="Guidelines for assessors"
            data-testid="textarea-assessor-guidance"
          />
        </div>
      )}

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

// Competency Form Component
function CompetencyForm({ 
  elementId,
  onSubmit, 
  onCancel, 
  isLoading,
  initialData 
}: {
  elementId: string;
  onSubmit: (data: InsertCompetency) => void;
  onCancel: () => void;
  isLoading: boolean;
  initialData?: Competency;
}) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    elementId: elementId,
    type: initialData?.type || 'technical',
    level: initialData?.level || 'none',
    externalId: initialData?.externalId || '',
    group: initialData?.group || '',
    critical: initialData?.critical || false,
    safetyCritical: initialData?.safetyCritical || false,
    passingThreshold: initialData?.passingThreshold || 80,
    assessmentMethods: initialData?.assessmentMethods || [],
    evidenceRequirements: initialData?.evidenceRequirements || [],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      level: formData.level === 'none' ? null : formData.level,
      externalId: formData.externalId || null,
      group: formData.group || null,
    });
  };

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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="competency-name">Name *</Label>
          <Input
            id="competency-name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Competency name"
            required
            data-testid="input-competency-name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="external-id">External ID</Label>
          <Input
            id="external-id"
            value={formData.externalId}
            onChange={(e) => setFormData(prev => ({ ...prev, externalId: e.target.value }))}
            placeholder="External identifier"
            data-testid="input-external-id"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="competency-type">Type</Label>
          <Select
            value={formData.type}
            onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
          >
            <SelectTrigger data-testid="select-competency-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="technical">Technical</SelectItem>
              <SelectItem value="safety">Safety</SelectItem>
              <SelectItem value="behavioral">Behavioral</SelectItem>
              <SelectItem value="quality">Quality</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="competency-level">Level</Label>
          <Input
            id="competency-level"
            value={formData.level}
            onChange={(e) => setFormData(prev => ({ ...prev, level: e.target.value }))}
            placeholder="e.g. Basic, Intermediate"
            data-testid="input-competency-level"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="passing-threshold">Passing Threshold (%)</Label>
          <Input
            id="passing-threshold"
            type="number"
            min="0"
            max="100"
            value={formData.passingThreshold}
            onChange={(e) => setFormData(prev => ({ ...prev, passingThreshold: parseInt(e.target.value) || 80 }))}
            data-testid="input-passing-threshold"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="competency-group">Group</Label>
        <Input
          id="competency-group"
          value={formData.group}
          onChange={(e) => setFormData(prev => ({ ...prev, group: e.target.value }))}
          placeholder="Competency group"
          data-testid="input-competency-group"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="competency-type">Type</Label>
          <Select 
            value={formData.type} 
            onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
          >
            <SelectTrigger data-testid="select-competency-type">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="knowledge">Knowledge</SelectItem>
              <SelectItem value="skill">Skill</SelectItem>
              <SelectItem value="technical">Technical</SelectItem>
              <SelectItem value="behavior">Behavior</SelectItem>
              <SelectItem value="safety">Safety</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="competency-level">Level</Label>
          <Select 
            value={formData.level || ""} 
            onValueChange={(value) => setFormData(prev => ({ ...prev, level: value }))}
          >
            <SelectTrigger data-testid="select-competency-level">
              <SelectValue placeholder="Select level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None (one-point scale)</SelectItem>
              <SelectItem value="basic">Basic</SelectItem>
              <SelectItem value="intermediate">Intermediate</SelectItem>
              <SelectItem value="advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="critical"
            checked={formData.critical}
            onChange={(e) => setFormData(prev => ({ ...prev, critical: e.target.checked }))}
            data-testid="checkbox-critical"
          />
          <Label htmlFor="critical">Critical Competency</Label>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="safety-critical"
            checked={formData.safetyCritical}
            onChange={(e) => setFormData(prev => ({ ...prev, safetyCritical: e.target.checked }))}
            data-testid="checkbox-safety-critical"
          />
          <Label htmlFor="safety-critical">Safety Critical</Label>
        </div>
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
        <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel-competency">
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading} data-testid="button-save-competency">
          {isLoading ? 'Saving...' : 'Save Competency'}
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

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="job-role-department">Department</Label>
          <Input
            id="job-role-department"
            value={formData.department}
            onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
            placeholder="Department"
            data-testid="input-job-role-department"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="job-role-level">Level</Label>
          <Select 
            value={formData.level} 
            onValueChange={(value) => setFormData(prev => ({ ...prev, level: value }))}
          >
            <SelectTrigger data-testid="select-job-role-level">
              <SelectValue placeholder="Select level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="trainee">Trainee</SelectItem>
              <SelectItem value="technician">Technician</SelectItem>
              <SelectItem value="senior">Senior</SelectItem>
              <SelectItem value="supervisor">Supervisor</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="director">Director</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="job-role-description">Description</Label>
        <Textarea
          id="job-role-description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Job role description"
          rows={3}
          data-testid="textarea-job-role-description"
        />
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="job-role-active"
          checked={formData.isActive}
          onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
          data-testid="checkbox-job-role-active"
        />
        <Label htmlFor="job-role-active">Active Job Role</Label>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel-job-role">
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading} data-testid="button-save-job-role">
          {isLoading ? 'Saving...' : (initialData ? 'Update Job Role' : 'Save Job Role')}
        </Button>
      </div>
    </form>
  );
}
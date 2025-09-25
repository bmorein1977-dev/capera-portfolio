import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { TrainingCategory, Training, TrainingLevel, InsertTrainingCategory } from '@shared/schema';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  TreePine,
  Plus,
  Save,
  Edit2,
  Trash2,
  Download,
  Upload,
  AlertTriangle,
  Clock,
  Award,
  Target,
  BookOpen,
  FileText,
  Users,
  CheckCircle2,
} from 'lucide-react';

interface TrainingCategoryWithTrainings extends TrainingCategory {
  trainings: Training[];
}

interface TrainingWithLevels extends Training {
  levels: TrainingLevel[];
}

const mockTrainingCategories: TrainingCategory[] = [
  {
    id: '1',
    name: 'Technical Training',
    description: 'Core technical training competencies',
    color: '#3b82f6',
    trainings: [
      {
        id: '1',
        name: 'Equipment Operation',
        description: 'Ability to safely operate manufacturing equipment',
        isSafetyCritical: true,
        validityPeriod: 12,
        prerequisites: ['Basic Safety Training'],
        assessmentMethods: ['Practical Assessment', 'Written Test'],
        levels: [
          {
            level: 1,
            name: 'Beginner',
            description: 'Basic operation under supervision',
            criteria: ['Can start/stop equipment safely', 'Follows basic procedures'],
          },
          {
            level: 2,
            name: 'Intermediate',
            description: 'Independent operation with guidance',
            criteria: ['Operates independently', 'Performs routine maintenance'],
          },
          {
            level: 3,
            name: 'Advanced',
            description: 'Expert operation and troubleshooting',
            criteria: ['Diagnoses problems', 'Trains others', 'Optimizes performance'],
          },
        ],
      },
    ],
  },
  {
    id: '2',
    name: 'Safety Training',
    description: 'Safety training procedures and compliance requirements',
    color: '#ef4444',
    trainings: [
      {
        id: '2',
        name: 'Hazard Identification',
        description: 'Ability to identify and assess workplace hazards',
        isSafetyCritical: true,
        validityPeriod: 24,
        prerequisites: [],
        assessmentMethods: ['Workplace Observation', 'Case Studies'],
        levels: [
          {
            level: 1,
            name: 'Basic',
            description: 'Recognizes common hazards',
            criteria: ['Identifies obvious hazards', 'Knows reporting procedures'],
          },
          {
            level: 2,
            name: 'Advanced',
            description: 'Comprehensive hazard assessment',
            criteria: ['Conducts risk assessments', 'Develops mitigation plans'],
          },
        ],
      },
    ],
  },
];

export default function TrainingFrameworkBuilder() {
  const [categories, setCategories] = useState<TrainingCategory[]>(mockTrainingCategories);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedTraining, setSelectedTraining] = useState<string>('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  const handleAddCategory = () => {
    if (newCategoryName.trim()) {
      const newCategory: TrainingCategory = {
        id: Date.now().toString(),
        name: newCategoryName,
        description: newCategoryDescription,
        color: '#6b7280',
        trainings: [],
      };
      setCategories([...categories, newCategory]);
      setNewCategoryName('');
      setNewCategoryDescription('');
      setIsAddingCategory(false);
      console.log('Added new category:', newCategory);
    }
  };

  const handleDeleteCategory = (categoryId: string) => {
    setCategories(categories.filter(c => c.id !== categoryId));
    console.log('Deleted category:', categoryId);
  };

  const handleAddTraining = (categoryId: string) => {
    console.log('Adding training to category:', categoryId);
  };

  const handleEditTraining = (trainingId: string) => {
    console.log('Editing training:', trainingId);
  };

  const handleExportFramework = () => {
    console.log('Exporting training framework');
  };

  const handleImportFramework = () => {
    console.log('Importing training framework');
  };

  const selectedCategoryData = categories.find(c => c.id === selectedCategory);
  const selectedTrainingData = selectedCategoryData?.trainings.find(t => t.id === selectedTraining);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <TreePine className="h-8 w-8" />
            Training Framework Builder
          </h2>
          <p className="text-muted-foreground">
            Configure your organization's training standards and assessment frameworks
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleImportFramework} data-testid="button-import-framework">
            <Upload className="h-4 w-4 mr-2" />
            Import Training Matrix
          </Button>
          <Button variant="outline" onClick={handleExportFramework} data-testid="button-export-framework">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => setIsAddingCategory(true)} data-testid="button-add-category">
            <Plus className="h-4 w-4 mr-2" />
            Add Category
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Categories List */}
        <Card>
          <CardHeader>
            <CardTitle>Training Categories</CardTitle>
            <CardDescription>Organize trainings into logical categories</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isAddingCategory && (
              <div className="p-4 border rounded-lg space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="categoryName">Category Name</Label>
                  <Input
                    id="categoryName"
                    placeholder="Enter category name"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    data-testid="input-category-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="categoryDescription">Description</Label>
                  <Textarea
                    id="categoryDescription"
                    placeholder="Enter category description"
                    value={newCategoryDescription}
                    onChange={(e) => setNewCategoryDescription(e.target.value)}
                    rows={2}
                    data-testid="textarea-category-description"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleAddCategory} data-testid="button-save-category">
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                  <Button variant="outline" onClick={() => setIsAddingCategory(false)} data-testid="button-cancel-category">
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            <ScrollArea className="h-80">
              <div className="space-y-2">
                {categories.map((category) => (
                  <div
                    key={category.id}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedCategory === category.id
                        ? 'bg-primary/10 border border-primary'
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => setSelectedCategory(category.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                        <div>
                          <h4 className="font-medium">{category.name}</h4>
                          <p className="text-sm text-muted-foreground">{category.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant="secondary" className="text-xs">
                          {category.trainings.length}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCategory(category.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {selectedCategory === category.id && (
                      <div className="mt-3 space-y-2">
                        <Separator />
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Trainings</span>
                          <Button variant="ghost" size="sm" onClick={() => handleAddTraining(category.id)}>
                            <Plus className="h-3 w-3 mr-1" />
                            Add Training
                          </Button>
                        </div>
                        {category.trainings.map((training) => (
                          <div
                            key={training.id}
                            className={`p-2 cursor-pointer rounded transition-colors ${
                              selectedTraining === training.id
                                ? 'bg-primary/10 border-primary'
                                : 'hover:bg-muted'
                            }`}
                            onClick={() => setSelectedTraining(training.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium">{training.name}</p>
                                <div className="flex items-center gap-1 mt-1">
                                  {training.isSafetyCritical && (
                                    <Badge variant="destructive" className="text-xs">
                                      <AlertTriangle className="h-2 w-2 mr-1" />
                                      Safety Critical
                                    </Badge>
                                  )}
                                  {training.validityPeriod && (
                                    <Badge variant="outline" className="text-xs">
                                      <Clock className="h-2 w-2 mr-1" />
                                      {training.validityPeriod}mo
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditTraining(training.id);
                                }}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Training Details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Training Details</CardTitle>
            <CardDescription>
              {selectedTrainingData ? `Configure ${selectedTrainingData.name}` : 'Select a training to view details'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedTrainingData ? (
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="levels">Levels</TabsTrigger>
                  <TabsTrigger value="certificates">Certificates</TabsTrigger>
                  <TabsTrigger value="assessment">Assessment</TabsTrigger>
                </TabsList>
                
                <TabsContent value="overview" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Training Name</Label>
                      <Input value={selectedTrainingData.name} readOnly />
                    </div>
                    <div>
                      <Label>Safety Critical</Label>
                      <Badge variant={selectedTrainingData.isSafetyCritical ? 'destructive' : 'secondary'}>
                        {selectedTrainingData.isSafetyCritical ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                  </div>
                  
                  <div>
                    <Label>Description</Label>
                    <Textarea value={selectedTrainingData.description} readOnly rows={3} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Achievement Date</Label>
                      <Input type="date" placeholder="Select achievement date" />
                    </div>
                    <div>
                      <Label>Expiry Date</Label>
                      <Input type="date" placeholder="Select expiry date" />
                    </div>
                  </div>

                  <div>
                    <Label>Prerequisites</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedTrainingData.prerequisites.map((prereq, index) => (
                        <Badge key={index} variant="outline">
                          {prereq}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="certificates" className="space-y-4 mt-4">
                  <div>
                    <Label>Training Certificate</Label>
                    <div className="mt-2 p-4 border-2 border-dashed rounded-lg">
                      <div className="text-center">
                        <FileText className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">
                          Upload training certificate (PDF, JPG, PNG)
                        </p>
                        <Button variant="outline" className="mt-2">
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Certificate
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                        AI Certificate Reading (Coming Soon)
                      </span>
                    </div>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                      Automatically extract achievement and expiry dates from uploaded certificates
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="levels" className="space-y-4 mt-4">
                  <div className="space-y-3">
                    {selectedTrainingData.levels.map((level) => (
                      <Card key={level.level}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">
                              Level {level.level}: {level.name}
                            </CardTitle>
                            <Badge variant="outline">
                              {level.criteria.length} criteria
                            </Badge>
                          </div>
                          <CardDescription>{level.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div>
                            <Label>Knowledge & Performance Criteria</Label>
                            <div className="mt-2 space-y-1">
                              {level.criteria.map((criterion, index) => (
                                <div key={index} className="flex items-center gap-2 text-sm">
                                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                                  {criterion}
                                </div>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  
                  <Button variant="outline" className="w-full">
                    <Upload className="h-4 w-4 mr-2" />
                    Import Knowledge & Performance Elements (Word/Excel)
                  </Button>
                </TabsContent>

                <TabsContent value="assessment" className="space-y-4 mt-4">
                  <div>
                    <Label>Assessment Methods</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedTrainingData.assessmentMethods.map((method, index) => (
                        <Badge key={index} variant="secondary">
                          <Target className="h-3 w-3 mr-1" />
                          {method}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {selectedTrainingData.validityPeriod && (
                    <div>
                      <Label>Validity Period</Label>
                      <div className="flex items-center gap-2 mt-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedTrainingData.validityPeriod} months</span>
                        <Badge variant="outline" className="ml-2">
                          90-day expiry warnings
                        </Badge>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            ) : (
              <div className="text-center py-8">
                <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Training Selected</h3>
                <p className="text-muted-foreground">
                  Select a training from the categories to view and configure its details
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
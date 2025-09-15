import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Target, 
  Settings, 
  Copy, 
  Save,
  Download,
  Upload,
  TreePine
} from 'lucide-react';
import { useState } from 'react';

interface SkillCategory {
  id: string;
  name: string;
  description: string;
  color: string;
  skills: Skill[];
}

interface Skill {
  id: string;
  name: string;
  description: string;
  levels: SkillLevel[];
  assessmentMethods: string[];
  isSafetyCritical: boolean;
  validityPeriod?: number; // in months
  prerequisites: string[];
}

interface SkillLevel {
  level: number;
  name: string;
  description: string;
  criteria: string[];
}

const mockSkillCategories: SkillCategory[] = [
  {
    id: '1',
    name: 'Technical Skills',
    description: 'Core technical competencies for equipment operation and maintenance',
    color: '#3b82f6',
    skills: [
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
    name: 'Safety Skills',
    description: 'Safety procedures and compliance requirements',
    color: '#ef4444',
    skills: [
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

export default function SkillsFrameworkBuilder() {
  const [categories, setCategories] = useState<SkillCategory[]>(mockSkillCategories);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSkill, setSelectedSkill] = useState<string>('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  const handleAddCategory = () => {
    if (newCategoryName.trim()) {
      const newCategory: SkillCategory = {
        id: Date.now().toString(),
        name: newCategoryName,
        description: newCategoryDescription,
        color: '#6b7280',
        skills: [],
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

  const handleAddSkill = (categoryId: string) => {
    console.log('Adding skill to category:', categoryId);
  };

  const handleEditSkill = (skillId: string) => {
    console.log('Editing skill:', skillId);
  };

  const handleExportFramework = () => {
    console.log('Exporting skills framework');
  };

  const handleImportFramework = () => {
    console.log('Importing skills framework');
  };

  const selectedCategoryData = categories.find(c => c.id === selectedCategory);
  const selectedSkillData = selectedCategoryData?.skills.find(s => s.id === selectedSkill);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <TreePine className="h-8 w-8" />
            Skills Framework Builder
          </h2>
          <p className="text-muted-foreground">
            Configure your organization's competency standards and assessment frameworks
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleImportFramework} data-testid="button-import-framework">
            <Upload className="h-4 w-4 mr-2" />
            Import
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
            <CardTitle>Skill Categories</CardTitle>
            <CardDescription>Organize skills into logical categories</CardDescription>
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

            <div className="space-y-2">
              {categories.map(category => (
                <div 
                  key={category.id}
                  className={`p-3 border rounded-lg cursor-pointer hover-elevate transition-colors ${
                    selectedCategory === category.id ? 'border-primary bg-primary/5' : ''
                  }`}
                  onClick={() => setSelectedCategory(category.id)}
                  data-testid={`category-${category.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="font-medium">{category.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary" className="text-xs">
                        {category.skills.length} skills
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCategory(category.id);
                        }}
                        data-testid={`button-delete-category-${category.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{category.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Skills List */}
        <Card>
          <CardHeader>
            <CardTitle>Skills</CardTitle>
            <CardDescription>
              {selectedCategoryData 
                ? `Skills in ${selectedCategoryData.name}`
                : 'Select a category to view skills'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedCategoryData ? (
              <div className="space-y-4">
                <Button 
                  onClick={() => handleAddSkill(selectedCategory)} 
                  className="w-full" 
                  data-testid="button-add-skill"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Skill
                </Button>
                
                <div className="space-y-2">
                  {selectedCategoryData.skills.map(skill => (
                    <div 
                      key={skill.id}
                      className={`p-3 border rounded-lg cursor-pointer hover-elevate transition-colors ${
                        selectedSkill === skill.id ? 'border-primary bg-primary/5' : ''
                      }`}
                      onClick={() => setSelectedSkill(skill.id)}
                      data-testid={`skill-${skill.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{skill.name}</span>
                            {skill.isSafetyCritical && (
                              <Badge variant="destructive" className="text-xs">
                                Safety Critical
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{skill.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              {skill.levels.length} levels
                            </Badge>
                            {skill.validityPeriod && (
                              <Badge variant="outline" className="text-xs">
                                {skill.validityPeriod} months validity
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditSkill(skill.id);
                          }}
                          data-testid={`button-edit-skill-${skill.id}`}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a category to view and manage skills</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Skill Details */}
        <Card>
          <CardHeader>
            <CardTitle>Skill Details</CardTitle>
            <CardDescription>
              {selectedSkillData 
                ? `Configure ${selectedSkillData.name}`
                : 'Select a skill to view details'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedSkillData ? (
              <Tabs defaultValue="levels" className="space-y-4">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="levels" data-testid="tab-skill-levels">Levels</TabsTrigger>
                  <TabsTrigger value="assessment" data-testid="tab-skill-assessment">Assessment</TabsTrigger>
                  <TabsTrigger value="settings" data-testid="tab-skill-settings">Settings</TabsTrigger>
                </TabsList>

                <TabsContent value="levels" className="space-y-4">
                  <div className="space-y-3">
                    {selectedSkillData.levels.map(level => (
                      <div key={level.level} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">Level {level.level}: {level.name}</h4>
                          <Button variant="ghost" size="sm" data-testid={`button-edit-level-${level.level}`}>
                            <Edit className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{level.description}</p>
                        <div className="space-y-1">
                          {level.criteria.map((criterion, index) => (
                            <div key={index} className="text-xs flex items-center gap-2">
                              <div className="w-1 h-1 bg-primary rounded-full" />
                              {criterion}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    <Button variant="outline" className="w-full" data-testid="button-add-level">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Level
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="assessment" className="space-y-4">
                  <div className="space-y-4">
                    <div>
                      <Label>Assessment Methods</Label>
                      <div className="space-y-2 mt-2">
                        {['Practical Assessment', 'Written Test', 'Workplace Observation', 'Simulation', 'Portfolio Review'].map(method => (
                          <div key={method} className="flex items-center space-x-2">
                            <Checkbox 
                              id={method}
                              checked={selectedSkillData.assessmentMethods.includes(method)}
                              data-testid={`checkbox-method-${method.toLowerCase().replace(/\s+/g, '-')}`}
                            />
                            <label htmlFor={method} className="text-sm">{method}</label>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="validityPeriod">Validity Period (months)</Label>
                      <Input
                        id="validityPeriod"
                        type="number"
                        value={selectedSkillData.validityPeriod || ''}
                        placeholder="No expiry"
                        data-testid="input-validity-period"
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="settings" className="space-y-4">
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="safetyCritical"
                        checked={selectedSkillData.isSafetyCritical}
                        data-testid="checkbox-safety-critical"
                      />
                      <label htmlFor="safetyCritical" className="text-sm font-medium">
                        Safety Critical Skill
                      </label>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Prerequisites</Label>
                      <div className="space-y-2">
                        {selectedSkillData.prerequisites.map((prereq, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <Input value={prereq} readOnly className="flex-1" />
                            <Button variant="ghost" size="sm" data-testid={`button-remove-prereq-${index}`}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                        <Button variant="outline" size="sm" data-testid="button-add-prerequisite">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Prerequisite
                        </Button>
                      </div>
                    </div>

                    <div className="pt-4 border-t">
                      <div className="flex gap-2">
                        <Button data-testid="button-save-skill">
                          <Save className="h-4 w-4 mr-2" />
                          Save Changes
                        </Button>
                        <Button variant="outline" data-testid="button-duplicate-skill">
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </Button>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a skill to configure details</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
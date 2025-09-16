import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Save,
  Download,
  Upload,
  Code,
  Settings,
  BookOpen,
  Shield,
  Award,
  Target
} from 'lucide-react';
import { useState } from 'react';

interface Standard {
  id: string;
  name: string;
  description: string;
  type: 'competency' | 'safety' | 'quality' | 'technical' | 'behavioral';
  framework: string;
  version: string;
  status: 'draft' | 'active' | 'archived';
  validityPeriod?: number;
  isMandatory: boolean;
  createdDate: string;
  lastModified: string;
  criteria: StandardCriteria[];
  assessmentMethods: string[];
  prerequisites: string[];
  tags: string[];
}

interface StandardCriteria {
  id: string;
  level: number;
  title: string;
  description: string;
  evidenceRequirements: string[];
  passingThreshold: number;
}

const standardTypes = [
  { value: 'competency', label: 'Competency Standard', icon: Target },
  { value: 'safety', label: 'Safety Standard', icon: Shield },
  { value: 'quality', label: 'Quality Standard', icon: Award },
  { value: 'technical', label: 'Technical Standard', icon: Code },
  { value: 'behavioral', label: 'Behavioral Standard', icon: BookOpen },
];

const frameworks = [
  { value: 'internal', label: 'Internal Framework' },
  { value: 'iso9001', label: 'ISO 9001' },
  { value: 'iso45001', label: 'ISO 45001' },
  { value: 'nqa', label: 'National Qualification Authority' },
  { value: 'custom', label: 'Custom Framework' },
];

const assessmentMethods = [
  'Practical Assessment',
  'Written Examination',
  'Workplace Observation',
  'Portfolio Review',
  'Simulation Exercise',
  'Peer Assessment',
  'Self Assessment',
  'Professional Discussion',
  'Case Study Analysis',
  'Project-Based Assessment',
];

const mockStandards: Standard[] = [
  {
    id: '1',
    name: 'Equipment Operation Safety',
    description: 'Comprehensive safety standards for equipment operation in manufacturing environments',
    type: 'safety',
    framework: 'iso45001',
    version: '2.1',
    status: 'active',
    validityPeriod: 12,
    isMandatory: true,
    createdDate: '2024-01-15',
    lastModified: '2024-02-10',
    criteria: [
      {
        id: '1',
        level: 1,
        title: 'Basic Safety Awareness',
        description: 'Understands fundamental safety procedures',
        evidenceRequirements: ['Safety manual acknowledgment', 'Basic safety test'],
        passingThreshold: 80,
      },
      {
        id: '2',
        level: 2,
        title: 'Equipment Safety Protocols',
        description: 'Demonstrates safe equipment operation procedures',
        evidenceRequirements: ['Practical demonstration', 'Risk assessment completion'],
        passingThreshold: 85,
      },
    ],
    assessmentMethods: ['Practical Assessment', 'Written Examination', 'Workplace Observation'],
    prerequisites: [],
    tags: ['safety', 'equipment', 'mandatory'],
  },
  {
    id: '2',
    name: 'Quality Control Procedures',
    description: 'Standards for quality control and assurance processes',
    type: 'quality',
    framework: 'iso9001',
    version: '1.3',
    status: 'active',
    validityPeriod: 24,
    isMandatory: false,
    createdDate: '2024-02-01',
    lastModified: '2024-02-15',
    criteria: [
      {
        id: '1',
        level: 1,
        title: 'Quality Fundamentals',
        description: 'Understanding of quality principles and procedures',
        evidenceRequirements: ['Quality manual review', 'Process documentation'],
        passingThreshold: 75,
      },
    ],
    assessmentMethods: ['Portfolio Review', 'Workplace Observation', 'Professional Discussion'],
    prerequisites: ['Basic Training'],
    tags: ['quality', 'iso9001'],
  },
];

export default function DeveloperStandards() {
  const [standards, setStandards] = useState<Standard[]>(mockStandards);
  const [selectedStandard, setSelectedStandard] = useState<string>('');
  const [isCreatingStandard, setIsCreatingStandard] = useState(false);
  const [newStandard, setNewStandard] = useState<Partial<Standard>>({
    name: '',
    description: '',
    type: 'competency',
    framework: 'internal',
    version: '1.0',
    status: 'draft',
    isMandatory: false,
    assessmentMethods: [],
    prerequisites: [],
    tags: [],
    criteria: [],
  });

  const handleCreateStandard = () => {
    if (newStandard.name && newStandard.description) {
      const standard: Standard = {
        id: Date.now().toString(),
        name: newStandard.name,
        description: newStandard.description,
        type: newStandard.type || 'competency',
        framework: newStandard.framework || 'internal',
        version: newStandard.version || '1.0',
        status: 'draft',
        isMandatory: newStandard.isMandatory || false,
        createdDate: new Date().toISOString().split('T')[0],
        lastModified: new Date().toISOString().split('T')[0],
        criteria: [],
        assessmentMethods: newStandard.assessmentMethods || [],
        prerequisites: newStandard.prerequisites || [],
        tags: newStandard.tags || [],
        validityPeriod: newStandard.validityPeriod,
      };
      
      setStandards([...standards, standard]);
      setNewStandard({
        name: '',
        description: '',
        type: 'competency',
        framework: 'internal',
        version: '1.0',
        status: 'draft',
        isMandatory: false,
        assessmentMethods: [],
        prerequisites: [],
        tags: [],
        criteria: [],
      });
      setIsCreatingStandard(false);
      console.log('Created new standard:', standard);
    }
  };

  const handleDeleteStandard = (standardId: string) => {
    setStandards(standards.filter(s => s.id !== standardId));
    console.log('Deleted standard:', standardId);
  };

  const handleExportStandards = () => {
    console.log('Exporting standards');
  };

  const handleImportStandards = () => {
    console.log('Importing standards');
  };

  const selectedStandardData = standards.find(s => s.id === selectedStandard);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'draft': return 'secondary';
      case 'archived': return 'outline';
      default: return 'outline';
    }
  };

  const getTypeIcon = (type: string) => {
    const typeConfig = standardTypes.find(t => t.value === type);
    return typeConfig ? typeConfig.icon : Target;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Code className="h-8 w-8" />
            Developer Standards Management
          </h2>
          <p className="text-muted-foreground">
            Configure and manage standards frameworks for assessments and competencies
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleImportStandards} data-testid="button-import-standards">
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button variant="outline" onClick={handleExportStandards} data-testid="button-export-standards">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => setIsCreatingStandard(true)} data-testid="button-create-standard">
            <Plus className="h-4 w-4 mr-2" />
            Create Standard
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Standards List */}
        <Card>
          <CardHeader>
            <CardTitle>Standards Library</CardTitle>
            <CardDescription>Manage your organization's standards</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isCreatingStandard && (
              <div className="p-4 border rounded-lg space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="standardName">Standard Name</Label>
                  <Input
                    id="standardName"
                    placeholder="Enter standard name"
                    value={newStandard.name || ''}
                    onChange={(e) => setNewStandard({...newStandard, name: e.target.value})}
                    data-testid="input-standard-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="standardType">Type</Label>
                  <Select value={newStandard.type} onValueChange={(value) => setNewStandard({...newStandard, type: value as any})}>
                    <SelectTrigger data-testid="select-standard-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {standardTypes.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="standardDescription">Description</Label>
                  <Textarea
                    id="standardDescription"
                    placeholder="Enter standard description"
                    value={newStandard.description || ''}
                    onChange={(e) => setNewStandard({...newStandard, description: e.target.value})}
                    rows={3}
                    data-testid="textarea-standard-description"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreateStandard} data-testid="button-save-standard">
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                  <Button variant="outline" onClick={() => setIsCreatingStandard(false)} data-testid="button-cancel-standard">
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {standards.map(standard => {
                const IconComponent = getTypeIcon(standard.type);
                return (
                  <div 
                    key={standard.id}
                    className={`p-3 border rounded-lg cursor-pointer hover-elevate transition-colors ${
                      selectedStandard === standard.id ? 'border-primary bg-primary/5' : ''
                    }`}
                    onClick={() => setSelectedStandard(standard.id)}
                    data-testid={`standard-${standard.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <IconComponent className="h-4 w-4" />
                        <span className="font-medium">{standard.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant={getStatusColor(standard.status)} className="text-xs">
                          {standard.status}
                        </Badge>
                        {standard.isMandatory && (
                          <Badge variant="destructive" className="text-xs">
                            Mandatory
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteStandard(standard.id);
                          }}
                          data-testid={`button-delete-standard-${standard.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{standard.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        v{standard.version}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {standard.framework}
                      </Badge>
                      {standard.validityPeriod && (
                        <Badge variant="outline" className="text-xs">
                          {standard.validityPeriod}mo
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Standard Details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Standard Configuration</CardTitle>
            <CardDescription>
              {selectedStandardData 
                ? `Configure ${selectedStandardData.name}`
                : 'Select a standard to view and edit details'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedStandardData ? (
              <Tabs defaultValue="details" className="space-y-4">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="details" data-testid="tab-standard-details">Details</TabsTrigger>
                  <TabsTrigger value="criteria" data-testid="tab-standard-criteria">Criteria</TabsTrigger>
                  <TabsTrigger value="assessment" data-testid="tab-standard-assessment">Assessment</TabsTrigger>
                  <TabsTrigger value="settings" data-testid="tab-standard-settings">Settings</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="detailsName">Name</Label>
                      <Input
                        id="detailsName"
                        value={selectedStandardData.name}
                        data-testid="input-details-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="detailsVersion">Version</Label>
                      <Input
                        id="detailsVersion"
                        value={selectedStandardData.version}
                        data-testid="input-details-version"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="detailsFramework">Framework</Label>
                      <Select value={selectedStandardData.framework}>
                        <SelectTrigger data-testid="select-details-framework">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {frameworks.map(framework => (
                            <SelectItem key={framework.value} value={framework.value}>
                              {framework.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="detailsStatus">Status</Label>
                      <Select value={selectedStandardData.status}>
                        <SelectTrigger data-testid="select-details-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="detailsDescription">Description</Label>
                    <Textarea
                      id="detailsDescription"
                      value={selectedStandardData.description}
                      rows={4}
                      data-testid="textarea-details-description"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="criteria" className="space-y-4">
                  <div className="space-y-3">
                    {selectedStandardData.criteria.map(criterion => (
                      <div key={criterion.id} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">Level {criterion.level}: {criterion.title}</h4>
                          <Button variant="ghost" size="sm" data-testid={`button-edit-criterion-${criterion.id}`}>
                            <Edit className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{criterion.description}</p>
                        <div className="text-xs text-muted-foreground">
                          <div>Passing threshold: {criterion.passingThreshold}%</div>
                          <div>Evidence required: {criterion.evidenceRequirements.join(', ')}</div>
                        </div>
                      </div>
                    ))}
                    <Button variant="outline" className="w-full" data-testid="button-add-criterion">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Criterion
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="assessment" className="space-y-4">
                  <div className="space-y-4">
                    <div>
                      <Label>Assessment Methods</Label>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {assessmentMethods.map(method => (
                          <div key={method} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={method}
                              checked={selectedStandardData.assessmentMethods.includes(method)}
                              className="rounded"
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
                        value={selectedStandardData.validityPeriod || ''}
                        placeholder="No expiry"
                        data-testid="input-validity-period"
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="settings" className="space-y-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="mandatory">Mandatory Standard</Label>
                        <p className="text-sm text-muted-foreground">
                          All users must complete this standard
                        </p>
                      </div>
                      <Switch 
                        id="mandatory"
                        checked={selectedStandardData.isMandatory}
                        data-testid="switch-mandatory"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Prerequisites</Label>
                      <div className="space-y-2">
                        {selectedStandardData.prerequisites.map((prereq, index) => (
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
                        <Button data-testid="button-save-standard-changes">
                          <Save className="h-4 w-4 mr-2" />
                          Save Changes
                        </Button>
                        <Button variant="outline" data-testid="button-duplicate-standard">
                          <Settings className="h-4 w-4 mr-2" />
                          Duplicate
                        </Button>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Code className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a standard to configure details</p>
                <p className="text-sm">Create and manage standards for your organization</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
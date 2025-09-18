import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
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
  Target,
  Languages,
  Copy,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Filter,
  Search
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
  category?: 'safety' | 'knowledge' | 'skills' | 'competency';
  assessmentMethods: AssessmentMethod[];
  translations?: Record<string, {
    title: string;
    description: string;
    evidenceRequirements: string[];
  }>;
  assessorGuidance?: string;
}

interface AssessmentMethod {
  id: string;
  name: string;
  code: number;
  selected: boolean;
}

interface AssessmentTemplate {
  id: string;
  name: string;
  description: string;
  type: 'equipment' | 'task' | 'process';
  documentReferences: DocumentReference[];
  criteria: StandardCriteria[];
  assessmentPlan: string;
  evidenceRequirements: string[];
  hasAssessorGuidance: boolean;
}

interface DocumentReference {
  number: string;
  title: string;
}

interface Language {
  code: string;
  name: string;
  flag: string;
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
        category: 'safety',
        assessmentMethods: [
          { id: '1', name: 'Observed', code: 1, selected: true },
          { id: '3', name: 'Questioned', code: 3, selected: true },
        ],
      },
      {
        id: '2',
        level: 2,
        title: 'Equipment Safety Protocols',
        description: 'Demonstrates safe equipment operation procedures',
        evidenceRequirements: ['Practical demonstration', 'Risk assessment completion'],
        passingThreshold: 85,
        category: 'safety',
        assessmentMethods: [
          { id: '1', name: 'Observed', code: 1, selected: true },
          { id: '2', name: 'Simulated/Demonstrated', code: 2, selected: true },
        ],
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
        category: 'knowledge',
        assessmentMethods: [
          { id: '4', name: 'Professional Discussion', code: 4, selected: true },
          { id: '1', name: 'Observed', code: 1, selected: false },
        ],
      },
    ],
    assessmentMethods: ['Portfolio Review', 'Workplace Observation', 'Professional Discussion'],
    prerequisites: ['Basic Training'],
    tags: ['quality', 'iso9001'],
  },
];

const availableLanguages: Language[] = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺' },
  { code: 'it', name: 'Italian', flag: '🇮🇹' },
  { code: 'nl', name: 'Dutch', flag: '🇳🇱' },
  { code: 'no', name: 'Norwegian', flag: '🇳🇴' },
];

const defaultAssessmentMethods: AssessmentMethod[] = [
  { id: '1', name: 'Observed', code: 1, selected: false },
  { id: '2', name: 'Simulated/Demonstrated', code: 2, selected: false },
  { id: '3', name: 'Questioned', code: 3, selected: false },
  { id: '4', name: 'Professional Discussion', code: 4, selected: false },
  { id: '5', name: 'Witness Testimony', code: 5, selected: false },
  { id: '6', name: 'Other (Please specify)', code: 6, selected: false },
];

// Assessment Templates based on provided examples
const assessmentTemplates: AssessmentTemplate[] = [
  {
    id: 'oil-gas-samplers',
    name: 'Oil & Gas Samplers and Analyzers',
    description: 'Equipment-based assessment for oil and gas sampling and analytical systems aboard FPSO',
    type: 'equipment',
    documentReferences: [
      { number: '1200-MOG60-OPPS-0010-001', title: 'Permit To Work Management' },
      { number: '1200-MOG60-OPPS-0005-001', title: 'Maintenance Execution' },
      { number: '4103-50-6700-G05-0001-001', title: 'Installation, Operation & Maintenance Manual (IOM)' },
      { number: 'API MPMS Chapter 4, 5, 8 & 10', title: 'American Petroleum Institute Manual of Petroleum Measurement Standards' },
      { number: 'ISO 3171', title: 'Petroleum liquids — Automatic pipeline sampling' },
      { number: 'IEC 61508/61511', title: 'IEC Safety Integrity Levels (SIL)' },
    ],
    hasAssessorGuidance: true,
    assessmentPlan: 'Records of outputs/actions arising from observation (primary method), Written or verbal responses to questions, Evidence of prior work, procedural development, Records of outputs/actions arising from demonstrations and/or simulations.',
    evidenceRequirements: [
      'Direct observation of task performance',
      'Verbal/written questioning',
      'Professional discussion',
      'Evidence of prior work or procedural development',
      'Simulation or demonstration records'
    ],
    criteria: [
      {
        id: 'k1.0',
        level: 1,
        title: 'Oil and Gas Metering Principles',
        description: 'Explain the principles of oil and gas metering, including fiscal measurement and accuracy standards.',
        category: 'knowledge',
        evidenceRequirements: ['Verbal explanation', 'Written response', 'Professional discussion'],
        passingThreshold: 80,
        assessmentMethods: [...defaultAssessmentMethods],
        assessorGuidance: 'Verify understanding of custody transfer and its reliance on accurate measurement. Confirm knowledge of industry standards such as API MPMS Chapters 4, 5, and 8. Assess understanding of measurement components: flow, mass, density, water cut, and viscosity. Ensure awareness of accuracy requirements (±0.1% flow, ±0.01% proving repeatability).'
      },
      {
        id: 'k1.1',
        level: 1,
        title: 'Prover Loop Operation',
        description: 'Describe the purpose and operation of a prover loop in metering calibration.',
        category: 'knowledge',
        evidenceRequirements: ['Practical demonstration', 'Technical explanation'],
        passingThreshold: 80,
        assessmentMethods: [...defaultAssessmentMethods],
        assessorGuidance: 'Verify understanding of bi-directional sphere provers for validating flowmeter accuracy. Confirm knowledge of calibrated volume repeatability (±0.01% mean volume). Assess awareness of flowrate limits and maximum sphere velocity (1.6 m/s). Ensure understanding of pressure drop management during proving (<2.2 bar).'
      }
    ]
  },
  {
    id: 'emergency-shutdown',
    name: 'Emergency Shutdown Systems',
    description: 'Equipment-based assessment for ESD system operation and maintenance',
    type: 'equipment',
    documentReferences: [
      { number: 'DOC-CSL-OPS-SSW-001', title: 'Permit to work Procedure' },
      { number: 'CSL-OPS-SSW-018', title: 'Isolation of plant and equipment' },
      { number: 'DOC-CSL-OPS-SSW-003', title: 'Risk Assessment' },
      { number: 'STP-SCI-037-14', title: 'Standard Technical Procedure – 3B Level 5 & 6 ESD Function Test' },
      { number: 'PS 03', title: 'Performance Standard' },
      { number: 'STP-I-050a', title: 'ESD Functional Testing 8A - Levels 4, 5 & 6 (non-pressurised)' },
    ],
    hasAssessorGuidance: false,
    assessmentPlan: 'Records of outputs/actions arising from observation (primary method), Written or verbal responses to questions, Evidence of prior work, procedural development, Records of outputs/actions arising from demonstrations and/or simulations.',
    evidenceRequirements: [
      'Direct observation of task performance',
      'Risk assessment completion',
      'Safety procedure compliance',
      'Equipment inspection and testing'
    ],
    criteria: [
      {
        id: 's1.0',
        level: 1,
        title: 'ESD System Hazard Identification',
        description: 'Demonstrate the ability to identify potential hazards associated with ESD Systems, including electrical risks, pressure hazards, and exposure to hazardous substances.',
        category: 'safety',
        evidenceRequirements: ['Hazard identification exercise', 'Safety documentation'],
        passingThreshold: 100,
        assessmentMethods: [...defaultAssessmentMethods]
      },
      {
        id: 's1.1',
        level: 1,
        title: 'ESD Shutdown Actions',
        description: 'Understand the various shutdown actions associated with the various ESD Systems at the facility, ensuring rapid and safe response to critical situations.',
        category: 'safety',
        evidenceRequirements: ['Emergency response demonstration', 'Procedure walkthrough'],
        passingThreshold: 100,
        assessmentMethods: [...defaultAssessmentMethods]
      },
      {
        id: 'k1.0',
        level: 1,
        title: 'ESD System Purpose',
        description: 'What is the primary purpose of an Emergency Shutdown (ESD) system?',
        category: 'knowledge',
        evidenceRequirements: ['Verbal explanation', 'Written response'],
        passingThreshold: 80,
        assessmentMethods: [...defaultAssessmentMethods]
      },
      {
        id: 'k1.1',
        level: 1,
        title: 'ESD Levels and Initiation',
        description: 'Using the Cause & Effect diagrams, explain the different levels of ESD and how to initiate them?',
        category: 'knowledge',
        evidenceRequirements: ['Diagram interpretation', 'Technical explanation'],
        passingThreshold: 80,
        assessmentMethods: [...defaultAssessmentMethods]
      }
    ]
  }
];

export default function DeveloperStandards() {
  const [standards, setStandards] = useState<Standard[]>(mockStandards);
  const [selectedStandard, setSelectedStandard] = useState<string>('');
  const [isCreatingStandard, setIsCreatingStandard] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  const [isTranslating, setIsTranslating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [isAddingCriterion, setIsAddingCriterion] = useState(false);
  const [newCriterion, setNewCriterion] = useState<Partial<StandardCriteria>>({
    title: '',
    description: '',
    level: 1,
    category: 'knowledge',
    evidenceRequirements: [],
    passingThreshold: 80,
    assessmentMethods: [...defaultAssessmentMethods],
  });
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

  // Translation functionality
  const handleTranslateCriteria = async (criteria: StandardCriteria, targetLanguage: string) => {
    setIsTranslating(true);
    try {
      // Simulated translation service - in real implementation, this would call an API
      const translatedText = await simulateTranslation(criteria.title, targetLanguage);
      const translatedDescription = await simulateTranslation(criteria.description, targetLanguage);
      const translatedEvidence = await Promise.all(
        criteria.evidenceRequirements.map(req => simulateTranslation(req, targetLanguage))
      );

      const updatedStandards = standards.map(standard => 
        standard.id === selectedStandard ? {
          ...standard,
          criteria: standard.criteria.map(c => 
            c.id === criteria.id ? {
              ...c,
              translations: {
                ...c.translations,
                [targetLanguage]: {
                  title: translatedText,
                  description: translatedDescription,
                  evidenceRequirements: translatedEvidence
                }
              }
            } : c
          )
        } : standard
      );
      setStandards(updatedStandards);
    } catch (error) {
      console.error('Translation failed:', error);
    } finally {
      setIsTranslating(false);
    }
  };

  // Simulated translation service
  const simulateTranslation = (text: string, targetLanguage: string): Promise<string> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simple simulation - in reality this would use a translation API
        const translations: Record<string, Record<string, string>> = {
          es: {
            'Oil and Gas Metering Principles': 'Principios de Medición de Petróleo y Gas',
            'Explain the principles of oil and gas metering': 'Explicar los principios de medición de petróleo y gas',
            'ESD System Hazard Identification': 'Identificación de Peligros del Sistema ESD',
            'Safety': 'Seguridad',
            'Knowledge': 'Conocimiento',
          },
          fr: {
            'Oil and Gas Metering Principles': 'Principes de Mesure du Pétrole et du Gaz',
            'Explain the principles of oil and gas metering': 'Expliquer les principes de mesure du pétrole et du gaz',
            'ESD System Hazard Identification': 'Identification des Dangers du Système ESD',
            'Safety': 'Sécurité',
            'Knowledge': 'Connaissance',
          }
        };
        
        const translated = translations[targetLanguage]?.[text] || `[${targetLanguage.toUpperCase()}] ${text}`;
        resolve(translated);
      }, 1000);
    });
  };

  // Template functionality
  const handleApplyTemplate = (templateId: string) => {
    const template = assessmentTemplates.find(t => t.id === templateId);
    if (template && selectedStandard) {
      const updatedStandards = standards.map(standard => 
        standard.id === selectedStandard ? {
          ...standard,
          criteria: [...standard.criteria, ...template.criteria.map(c => ({
            ...c,
            id: `${c.id}_${Date.now()}` // Ensure unique IDs
          }))]
        } : standard
      );
      setStandards(updatedStandards);
      setSelectedTemplate('');
    }
  };

  const handleAddCriterion = () => {
    if (newCriterion.title && newCriterion.description && selectedStandard) {
      const criterion: StandardCriteria = {
        id: Date.now().toString(),
        title: newCriterion.title,
        description: newCriterion.description,
        level: newCriterion.level || 1,
        category: newCriterion.category || 'knowledge',
        evidenceRequirements: newCriterion.evidenceRequirements || [],
        passingThreshold: newCriterion.passingThreshold || 80,
        assessmentMethods: newCriterion.assessmentMethods || [...defaultAssessmentMethods],
        assessorGuidance: newCriterion.assessorGuidance,
      };

      const updatedStandards = standards.map(standard => 
        standard.id === selectedStandard ? {
          ...standard,
          criteria: [...standard.criteria, criterion]
        } : standard
      );
      setStandards(updatedStandards);
      setNewCriterion({
        title: '',
        description: '',
        level: 1,
        category: 'knowledge',
        evidenceRequirements: [],
        passingThreshold: 80,
        assessmentMethods: [...defaultAssessmentMethods],
      });
      setIsAddingCriterion(false);
    }
  };

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
                  {/* Language Translation & Template Controls */}
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Languages className="h-4 w-4" />
                        <Label>Translation Language:</Label>
                        <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                          <SelectTrigger className="w-48" data-testid="select-translation-language">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {availableLanguages.map(lang => (
                              <SelectItem key={lang.code} value={lang.code}>
                                <span className="flex items-center gap-2">
                                  <span>{lang.flag}</span>
                                  <span>{lang.name}</span>
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <Label>Apply Template:</Label>
                        <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                          <SelectTrigger className="w-64" data-testid="select-assessment-template">
                            <SelectValue placeholder="Choose template..." />
                          </SelectTrigger>
                          <SelectContent>
                            {assessmentTemplates.map(template => (
                              <SelectItem key={template.id} value={template.id}>
                                <div className="flex flex-col">
                                  <span>{template.name}</span>
                                  <span className="text-xs text-muted-foreground">{template.description}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedTemplate && (
                          <Button onClick={() => handleApplyTemplate(selectedTemplate)} data-testid="button-apply-template">
                            Apply Template
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {selectedStandardData.criteria.map(criterion => {
                      const currentTranslation = selectedLanguage !== 'en' && criterion.translations?.[selectedLanguage];
                      const displayTitle = currentTranslation?.title || criterion.title;
                      const displayDescription = currentTranslation?.description || criterion.description;
                      const displayEvidence = currentTranslation?.evidenceRequirements || criterion.evidenceRequirements;
                      
                      return (
                        <div key={criterion.id} className="p-4 border rounded-lg space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline" className="text-xs">
                                  Level {criterion.level}
                                </Badge>
                                {criterion.category && (
                                  <Badge variant={criterion.category === 'safety' ? 'destructive' : 'secondary'} className="text-xs">
                                    {criterion.category}
                                  </Badge>
                                )}
                                {selectedLanguage !== 'en' && currentTranslation && (
                                  <Badge variant="default" className="text-xs">
                                    {availableLanguages.find(l => l.code === selectedLanguage)?.flag} Translated
                                  </Badge>
                                )}
                              </div>
                              <h4 className="font-medium mb-2">{displayTitle}</h4>
                              <p className="text-sm text-muted-foreground mb-3">{displayDescription}</p>
                              
                              {criterion.assessorGuidance && (
                                <div className="p-2 bg-blue-50 border-l-2 border-blue-200 rounded text-xs text-blue-800 mb-2">
                                  <strong>Assessor Guidance:</strong> {criterion.assessorGuidance}
                                </div>
                              )}
                              
                              <div className="space-y-2">
                                <div className="text-xs">
                                  <span className="font-medium">Passing Threshold:</span> {criterion.passingThreshold}%
                                </div>
                                <div className="text-xs">
                                  <span className="font-medium">Evidence Required:</span>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {displayEvidence.map((req, index) => (
                                      <Badge key={index} variant="outline" className="text-xs">
                                        {req}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                                <div className="text-xs">
                                  <span className="font-medium">Assessment Methods:</span>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {criterion.assessmentMethods?.filter(m => m.selected).map((method) => (
                                      <Badge key={method.id} variant="secondary" className="text-xs">
                                        {method.code}. {method.name}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-1 ml-4">
                              {selectedLanguage !== 'en' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleTranslateCriteria(criterion, selectedLanguage)}
                                  disabled={isTranslating}
                                  data-testid={`button-translate-criterion-${criterion.id}`}
                                >
                                  {isTranslating ? (
                                    <div className="flex items-center gap-1">
                                      <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                      <span>Translating...</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1">
                                      <Languages className="h-3 w-3" />
                                      <span>Translate</span>
                                    </div>
                                  )}
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" data-testid={`button-edit-criterion-${criterion.id}`}>
                                <Edit className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* Add New Criterion */}
                    <div className="space-y-3">
                      {isAddingCriterion ? (
                        <div className="p-4 border border-dashed rounded-lg space-y-4">
                          <h4 className="font-medium">Add New Criterion</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Title</Label>
                              <Input
                                value={newCriterion.title || ''}
                                onChange={(e) => setNewCriterion({...newCriterion, title: e.target.value})}
                                placeholder="Enter criterion title"
                                data-testid="input-new-criterion-title"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Level</Label>
                              <Input
                                type="number"
                                value={newCriterion.level || 1}
                                onChange={(e) => setNewCriterion({...newCriterion, level: parseInt(e.target.value)})}
                                min="1"
                                max="5"
                                data-testid="input-new-criterion-level"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Category</Label>
                              <Select value={newCriterion.category} onValueChange={(value: any) => setNewCriterion({...newCriterion, category: value})}>
                                <SelectTrigger data-testid="select-new-criterion-category">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="safety">Safety</SelectItem>
                                  <SelectItem value="knowledge">Knowledge</SelectItem>
                                  <SelectItem value="skills">Skills</SelectItem>
                                  <SelectItem value="competency">Competency</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Passing Threshold (%)</Label>
                              <Input
                                type="number"
                                value={newCriterion.passingThreshold || 80}
                                onChange={(e) => setNewCriterion({...newCriterion, passingThreshold: parseInt(e.target.value)})}
                                min="0"
                                max="100"
                                data-testid="input-new-criterion-threshold"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea
                              value={newCriterion.description || ''}
                              onChange={(e) => setNewCriterion({...newCriterion, description: e.target.value})}
                              placeholder="Enter detailed description of the criterion"
                              rows={3}
                              data-testid="textarea-new-criterion-description"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Assessor Guidance (Optional)</Label>
                            <Textarea
                              value={newCriterion.assessorGuidance || ''}
                              onChange={(e) => setNewCriterion({...newCriterion, assessorGuidance: e.target.value})}
                              placeholder="Provide guidance for assessors on how to evaluate this criterion"
                              rows={2}
                              data-testid="textarea-new-criterion-guidance"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Assessment Methods</Label>
                            <div className="grid grid-cols-2 gap-2">
                              {newCriterion.assessmentMethods?.map(method => (
                                <div key={method.id} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`method-${method.id}`}
                                    checked={method.selected}
                                    onCheckedChange={(checked) => {
                                      setNewCriterion({
                                        ...newCriterion,
                                        assessmentMethods: newCriterion.assessmentMethods?.map(m =>
                                          m.id === method.id ? {...m, selected: !!checked} : m
                                        )
                                      });
                                    }}
                                  />
                                  <label htmlFor={`method-${method.id}`} className="text-sm">
                                    {method.code}. {method.name}
                                  </label>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button onClick={handleAddCriterion} data-testid="button-save-criterion">
                              <Save className="h-4 w-4 mr-2" />
                              Save Criterion
                            </Button>
                            <Button variant="outline" onClick={() => setIsAddingCriterion(false)} data-testid="button-cancel-criterion">
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button 
                          variant="outline" 
                          className="w-full" 
                          onClick={() => setIsAddingCriterion(true)}
                          data-testid="button-add-criterion"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Criterion
                        </Button>
                      )}
                    </div>
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
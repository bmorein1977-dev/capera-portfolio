import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BookOpen, 
  FileText, 
  Video, 
  Image, 
  Download, 
  Upload,
  Search,
  Filter,
  Star,
  Clock,
  Eye,
  Plus,
  Edit,
  Trash2,
  ExternalLink,
  Play
} from 'lucide-react';
import { useState } from 'react';

interface Resource {
  id: string;
  title: string;
  description: string;
  type: 'document' | 'video' | 'interactive' | 'link' | 'image' | 'audio';
  category: string;
  skillAreas: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: number; // minutes
  format: string;
  fileSize?: string;
  url: string;
  thumbnailUrl?: string;
  isFeatured: boolean;
  isRequired: boolean;
  rating: number;
  views: number;
  lastUpdated: string;
  author: string;
  tags: string[];
  prerequisites?: string[];
}

interface ResourceCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  resourceCount: number;
}

interface LearningPath {
  id: string;
  title: string;
  description: string;
  resources: string[]; // resource IDs
  estimatedDuration: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  skillAreas: string[];
}

const mockResourceCategories: ResourceCategory[] = [
  {
    id: '1',
    name: 'Safety Procedures',
    description: 'Safety protocols, procedures, and compliance materials',
    icon: '🛡️',
    resourceCount: 15,
  },
  {
    id: '2',
    name: 'Equipment Operation',
    description: 'Equipment manuals, operation guides, and troubleshooting',
    icon: '⚙️',
    resourceCount: 23,
  },
  {
    id: '3',
    name: 'Quality Control',
    description: 'Quality standards, inspection procedures, and best practices',
    icon: '✅',
    resourceCount: 12,
  },
  {
    id: '4',
    name: 'Professional Development',
    description: 'Leadership, communication, and career development resources',
    icon: '📈',
    resourceCount: 8,
  },
];

const mockResources: Resource[] = [
  {
    id: '1',
    title: 'Equipment Safety Manual v2.1',
    description: 'Comprehensive safety manual covering all equipment operation procedures, emergency protocols, and safety requirements.',
    type: 'document',
    category: 'Safety Procedures',
    skillAreas: ['Equipment Operation', 'Safety Procedures'],
    difficulty: 'beginner',
    estimatedTime: 45,
    format: 'PDF',
    fileSize: '2.3 MB',
    url: '/resources/safety-manual-v2.1.pdf',
    isFeatured: true,
    isRequired: true,
    rating: 4.8,
    views: 1247,
    lastUpdated: '2024-02-01',
    author: 'Safety Department',
    tags: ['safety', 'manual', 'required', 'equipment'],
    prerequisites: [],
  },
  {
    id: '2',
    title: 'Lockout/Tagout Procedures Video Series',
    description: 'Step-by-step video training series demonstrating proper lockout/tagout procedures for various equipment types.',
    type: 'video',
    category: 'Safety Procedures',
    skillAreas: ['Safety Procedures', 'Equipment Operation'],
    difficulty: 'intermediate',
    estimatedTime: 25,
    format: 'MP4',
    fileSize: '156 MB',
    url: '/resources/lockout-tagout-series.mp4',
    thumbnailUrl: '/resources/thumbnails/lockout-video.jpg',
    isFeatured: true,
    isRequired: false,
    rating: 4.9,
    views: 892,
    lastUpdated: '2024-01-15',
    author: 'Training Team',
    tags: ['safety', 'video', 'lockout', 'tagout'],
    prerequisites: ['Basic Safety Training'],
  },
  {
    id: '3',
    title: 'Quality Inspection Checklist',
    description: 'Interactive checklist tool for conducting quality inspections with automated scoring and reporting.',
    type: 'interactive',
    category: 'Quality Control',
    skillAreas: ['Quality Control'],
    difficulty: 'intermediate',
    estimatedTime: 15,
    format: 'Web App',
    url: '/resources/quality-checklist',
    isFeatured: false,
    isRequired: false,
    rating: 4.6,
    views: 543,
    lastUpdated: '2024-02-10',
    author: 'Quality Team',
    tags: ['quality', 'checklist', 'interactive'],
  },
  {
    id: '4',
    title: 'Leadership Development Pathway',
    description: 'External course on developing leadership skills in manufacturing environments.',
    type: 'link',
    category: 'Professional Development',
    skillAreas: ['Leadership', 'Communication'],
    difficulty: 'advanced',
    estimatedTime: 180,
    format: 'External Course',
    url: 'https://example.com/leadership-course',
    isFeatured: false,
    isRequired: false,
    rating: 4.4,
    views: 234,
    lastUpdated: '2024-01-20',
    author: 'HR Department',
    tags: ['leadership', 'development', 'external'],
    prerequisites: ['Basic Management Training'],
  },
];

const mockLearningPaths: LearningPath[] = [
  {
    id: '1',
    title: 'New Employee Safety Orientation',
    description: 'Complete safety training path for new manufacturing employees',
    resources: ['1', '2'],
    estimatedDuration: 120,
    difficulty: 'beginner',
    skillAreas: ['Safety Procedures', 'Equipment Operation'],
  },
  {
    id: '2',
    title: 'Quality Excellence Program',
    description: 'Advanced quality control and continuous improvement training',
    resources: ['3'],
    estimatedDuration: 90,
    difficulty: 'intermediate',
    skillAreas: ['Quality Control'],
  },
];

export default function ResourcesManagement() {
  const [resources, setResources] = useState<Resource[]>(mockResources);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedResource, setSelectedResource] = useState<string>('');
  const [isAddingResource, setIsAddingResource] = useState(false);

  const filteredResources = resources.filter(resource => {
    const matchesSearch = resource.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         resource.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         resource.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || resource.category === selectedCategory;
    const matchesDifficulty = selectedDifficulty === 'all' || resource.difficulty === selectedDifficulty;
    
    return matchesSearch && matchesCategory && matchesDifficulty;
  });

  const featuredResources = resources.filter(r => r.isFeatured);
  const selectedResourceData = resources.find(r => r.id === selectedResource);

  const handleResourceClick = (resourceId: string) => {
    // Track view
    setResources(prev => prev.map(r => 
      r.id === resourceId ? { ...r, views: r.views + 1 } : r
    ));
    setSelectedResource(resourceId);
    console.log('Viewing resource:', resourceId);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'document': return <FileText className="h-5 w-5" />;
      case 'video': return <Video className="h-5 w-5" />;
      case 'image': return <Image className="h-5 w-5" />;
      case 'interactive': return <Play className="h-5 w-5" />;
      case 'link': return <ExternalLink className="h-5 w-5" />;
      default: return <FileText className="h-5 w-5" />;
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'default';
      case 'intermediate': return 'secondary';
      case 'advanced': return 'destructive';
      default: return 'outline';
    }
  };

  if (selectedResourceData) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => setSelectedResource('')} data-testid="button-back-to-resources">
            Back to Resources
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" data-testid="button-bookmark-resource">
              <Star className="h-4 w-4 mr-2" />
              Bookmark
            </Button>
            <Button data-testid="button-download-resource">
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start gap-4">
              {selectedResourceData.thumbnailUrl && (
                <img 
                  src={selectedResourceData.thumbnailUrl} 
                  alt={selectedResourceData.title}
                  className="w-32 h-24 object-cover rounded-lg"
                />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {getTypeIcon(selectedResourceData.type)}
                  <CardTitle>{selectedResourceData.title}</CardTitle>
                </div>
                <CardDescription>{selectedResourceData.description}</CardDescription>
                <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{selectedResourceData.estimatedTime} min</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    <span>{selectedResourceData.views} views</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3" />
                    <span>{selectedResourceData.rating}/5</span>
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Badge variant="outline">{selectedResourceData.category}</Badge>
              </div>
              <div className="space-y-2">
                <Label>Difficulty</Label>
                <Badge variant={getDifficultyColor(selectedResourceData.difficulty)}>
                  {selectedResourceData.difficulty}
                </Badge>
              </div>
              <div className="space-y-2">
                <Label>Format</Label>
                <Badge variant="outline">{selectedResourceData.format}</Badge>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Skill Areas</Label>
              <div className="flex flex-wrap gap-2">
                {selectedResourceData.skillAreas.map(skill => (
                  <Badge key={skill} variant="secondary" className="text-xs">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>

            {selectedResourceData.prerequisites && selectedResourceData.prerequisites.length > 0 && (
              <div className="space-y-2">
                <Label>Prerequisites</Label>
                <div className="flex flex-wrap gap-2">
                  {selectedResourceData.prerequisites.map(prereq => (
                    <Badge key={prereq} variant="outline" className="text-xs">
                      {prereq}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4 border-t">
              <div className="flex gap-2">
                <Button className="flex-1" data-testid="button-open-resource">
                  <Play className="h-4 w-4 mr-2" />
                  Open Resource
                </Button>
                {selectedResourceData.type === 'document' && (
                  <Button variant="outline" data-testid="button-download-pdf">
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-8 w-8" />
            Learning Resources
          </h2>
          <p className="text-muted-foreground">
            Access study materials, training content, and preparation resources
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" data-testid="button-upload-resource">
            <Upload className="h-4 w-4 mr-2" />
            Upload Resource
          </Button>
          <Button onClick={() => setIsAddingResource(true)} data-testid="button-add-resource">
            <Plus className="h-4 w-4 mr-2" />
            Add Resource
          </Button>
        </div>
      </div>

      <Tabs defaultValue="browse" className="space-y-4">
        <TabsList>
          <TabsTrigger value="browse" data-testid="tab-browse-resources">Browse Resources</TabsTrigger>
          <TabsTrigger value="categories" data-testid="tab-resource-categories">Categories</TabsTrigger>
          <TabsTrigger value="paths" data-testid="tab-learning-paths">Learning Paths</TabsTrigger>
          <TabsTrigger value="featured" data-testid="tab-featured-resources">Featured</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-4">
          <div className="flex gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search resources..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
                data-testid="input-search-resources"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48" data-testid="select-category-filter">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {mockResourceCategories.map(category => (
                  <SelectItem key={category.id} value={category.name}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
              <SelectTrigger className="w-40" data-testid="select-difficulty-filter">
                <SelectValue placeholder="All Levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredResources.map(resource => (
              <Card 
                key={resource.id} 
                className="hover-elevate cursor-pointer"
                onClick={() => handleResourceClick(resource.id)}
                data-testid={`resource-card-${resource.id}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    {getTypeIcon(resource.type)}
                    <div className="flex-1">
                      <CardTitle className="text-base">{resource.title}</CardTitle>
                      <CardDescription className="text-sm line-clamp-2">
                        {resource.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant={getDifficultyColor(resource.difficulty)} className="text-xs">
                        {resource.difficulty}
                      </Badge>
                      {resource.isRequired && (
                        <Badge variant="destructive" className="text-xs">
                          Required
                        </Badge>
                      )}
                      {resource.isFeatured && (
                        <Badge variant="default" className="text-xs">
                          Featured
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{resource.estimatedTime} min</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        <span>{resource.views}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3" />
                        <span>{resource.rating}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {resource.skillAreas.slice(0, 2).map(skill => (
                        <Badge key={skill} variant="outline" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                      {resource.skillAreas.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{resource.skillAreas.length - 2}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {mockResourceCategories.map(category => (
              <Card key={category.id} className="hover-elevate cursor-pointer" data-testid={`category-${category.id}`}>
                <CardHeader className="text-center">
                  <div className="text-4xl mb-2">{category.icon}</div>
                  <CardTitle className="text-lg">{category.name}</CardTitle>
                  <CardDescription>{category.description}</CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                  <Badge variant="secondary">{category.resourceCount} resources</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="paths" className="space-y-4">
          <div className="grid gap-4">
            {mockLearningPaths.map(path => (
              <Card key={path.id} className="hover-elevate" data-testid={`learning-path-${path.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{path.title}</CardTitle>
                      <CardDescription>{path.description}</CardDescription>
                    </div>
                    <Badge variant={getDifficultyColor(path.difficulty)}>
                      {path.difficulty}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Duration</Label>
                      <div className="flex items-center gap-1 text-sm">
                        <Clock className="h-3 w-3" />
                        <span>{path.estimatedDuration} minutes</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Resources</Label>
                      <Badge variant="outline">{path.resources.length} items</Badge>
                    </div>
                    <div className="space-y-2">
                      <Label>Skill Areas</Label>
                      <div className="flex flex-wrap gap-1">
                        {path.skillAreas.map(skill => (
                          <Badge key={skill} variant="secondary" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="pt-4">
                    <Button data-testid={`button-start-path-${path.id}`}>
                      Start Learning Path
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="featured" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {featuredResources.map(resource => (
              <Card 
                key={resource.id} 
                className="hover-elevate cursor-pointer"
                onClick={() => handleResourceClick(resource.id)}
                data-testid={`featured-resource-${resource.id}`}
              >
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <Star className="h-5 w-5 text-yellow-500" />
                    <Badge variant="default">Featured</Badge>
                  </div>
                  <CardTitle>{resource.title}</CardTitle>
                  <CardDescription>{resource.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{resource.estimatedTime} min</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3" />
                        <span>{resource.rating}/5</span>
                      </div>
                    </div>
                    <Button size="sm">
                      View Resource
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
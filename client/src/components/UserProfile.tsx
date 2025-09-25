import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  User, 
  MapPin, 
  Briefcase, 
  Calendar, 
  Mail, 
  Phone, 
  Edit, 
  Star,
  Target,
  Award,
  BookOpen,
  Clock,
  Settings,
  Sparkles
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import SectorSelector from './SectorSelector';
import { businessSectors, SectorTheme, SectorSkills } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';

interface Skill {
  id: string;
  name: string;
  category: string;
  level: number;
  maxLevel: number;
  verified: boolean;
  lastAssessed: string;
  expiryDate?: string;
}

interface Certification {
  id: string;
  name: string;
  issuer: string;
  issuedDate: string;
  expiryDate?: string;
  status: 'active' | 'expired' | 'expiring_soon';
  certificateUrl?: string;
}

interface LearningPath {
  id: string;
  title: string;
  description: string;
  progress: number;
  estimatedHours: number;
  completedHours: number;
  skills: string[];
}


const getDefaultSkillsForSector = (industry: string): Skill[] => {
  const skillMappings: Record<string, Skill[]> = {
    energy_renewables: [
      { id: '1', name: 'Wind Turbine Operation', category: 'Technical', level: 4, maxLevel: 4, verified: true, lastAssessed: '2024-01-15', expiryDate: '2025-01-15' },
      { id: '2', name: 'Renewable Energy Safety', category: 'Safety', level: 4, maxLevel: 4, verified: true, lastAssessed: '2023-12-10', expiryDate: '2024-12-10' },
      { id: '3', name: 'Grid Integration', category: 'Technical', level: 3, maxLevel: 4, verified: true, lastAssessed: '2024-01-20' },
      { id: '4', name: 'Environmental Compliance', category: 'Compliance', level: 3, maxLevel: 4, verified: false, lastAssessed: '2023-11-05' },
    ],
    oil_gas: [
      { id: '1', name: 'Drilling Operations', category: 'Technical', level: 4, maxLevel: 4, verified: true, lastAssessed: '2024-01-15', expiryDate: '2025-01-15' },
      { id: '2', name: 'H2S Safety Protocols', category: 'Safety', level: 4, maxLevel: 4, verified: true, lastAssessed: '2023-12-10', expiryDate: '2024-12-10' },
      { id: '3', name: 'Well Control', category: 'Technical', level: 3, maxLevel: 4, verified: true, lastAssessed: '2024-01-20' },
      { id: '4', name: 'Offshore Operations', category: 'Specialized', level: 2, maxLevel: 4, verified: false, lastAssessed: '2023-11-05' },
    ],
    manufacturing: [
      { id: '1', name: 'Production Line Control', category: 'Technical', level: 4, maxLevel: 4, verified: true, lastAssessed: '2024-01-15', expiryDate: '2025-01-15' },
      { id: '2', name: 'Machine Safety Standards', category: 'Safety', level: 4, maxLevel: 4, verified: true, lastAssessed: '2023-12-10', expiryDate: '2024-12-10' },
      { id: '3', name: 'Quality Assurance', category: 'Quality', level: 3, maxLevel: 4, verified: true, lastAssessed: '2024-01-20' },
      { id: '4', name: 'Lean Manufacturing', category: 'Process', level: 2, maxLevel: 4, verified: false, lastAssessed: '2023-11-05' },
    ],
    healthcare: [
      { id: '1', name: 'Patient Care Protocols', category: 'Clinical', level: 4, maxLevel: 4, verified: true, lastAssessed: '2024-01-15', expiryDate: '2025-01-15' },
      { id: '2', name: 'Infection Control', category: 'Safety', level: 4, maxLevel: 4, verified: true, lastAssessed: '2023-12-10', expiryDate: '2024-12-10' },
      { id: '3', name: 'Medical Equipment Operation', category: 'Technical', level: 3, maxLevel: 4, verified: true, lastAssessed: '2024-01-20' },
      { id: '4', name: 'Healthcare Compliance', category: 'Regulatory', level: 2, maxLevel: 4, verified: false, lastAssessed: '2023-11-05' },
    ],
  };

  return skillMappings[industry] || [
    { id: '1', name: 'Equipment Operation', category: 'Technical', level: 4, maxLevel: 4, verified: true, lastAssessed: '2024-01-15', expiryDate: '2025-01-15' },
    { id: '2', name: 'Safety Procedures', category: 'Safety', level: 4, maxLevel: 4, verified: true, lastAssessed: '2023-12-10', expiryDate: '2024-12-10' },
    { id: '3', name: 'Quality Control', category: 'Quality', level: 3, maxLevel: 4, verified: true, lastAssessed: '2024-01-20' },
    { id: '4', name: 'Team Leadership', category: 'Leadership', level: 2, maxLevel: 4, verified: false, lastAssessed: '2023-11-05' },
  ];
};

const mockCertifications: Certification[] = [
  {
    id: '1',
    name: 'Equipment Safety Certification Level 3',
    issuer: 'Safety Institute',
    issuedDate: '2023-01-15',
    expiryDate: '2025-01-15',
    status: 'active',
  },
  {
    id: '2',
    name: 'Advanced Machine Operation',
    issuer: 'Technical Training Center',
    issuedDate: '2023-06-20',
    expiryDate: '2024-06-20',
    status: 'expiring_soon',
  },
  {
    id: '3',
    name: 'Quality Management Systems',
    issuer: 'Quality Council',
    issuedDate: '2022-03-10',
    expiryDate: '2024-03-10',
    status: 'expired',
  },
];

const mockLearningPaths: LearningPath[] = [
  {
    id: '1',
    title: 'Advanced Equipment Mastery',
    description: 'Complete training for expert-level equipment operation',
    progress: 75,
    estimatedHours: 40,
    completedHours: 30,
    skills: ['Equipment Operation', 'Maintenance', 'Troubleshooting'],
  },
  {
    id: '2',
    title: 'Leadership Development',
    description: 'Develop team leadership and management skills',
    progress: 25,
    estimatedHours: 60,
    completedHours: 15,
    skills: ['Team Leadership', 'Communication', 'Conflict Resolution'],
  },
];

export default function UserProfile() {
  const { user, isLoading } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedEmail, setEditedEmail] = useState('');
  const [currentSector, setCurrentSector] = useState<string>('general');
  const [sectorTheme, setSectorTheme] = useState<SectorTheme | null>(null);
  const [showSectorSelector, setShowSectorSelector] = useState(false);
  const [sectorSkills, setSectorSkills] = useState<Skill[]>([]);
  const [isLoadingSkills, setIsLoadingSkills] = useState(false);
  const { toast } = useToast();

  // Initialize form values when user data is loaded
  if (user && editedName === '' && editedEmail === '') {
    setEditedName(`${user.firstName} ${user.lastName}`);
    setEditedEmail(user.email || '');
  }

  // Initialize sector-specific skills
  useEffect(() => {
    const loadSectorSkills = async () => {
      if (currentSector === 'general') {
        setSectorSkills(getDefaultSkillsForSector(currentSector));
        return;
      }

      setIsLoadingSkills(true);
      try {
        // Try to fetch AI-generated skills for the sector
        const response = await fetch('/api/ai-theme/generate-skills', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ 
            industry: currentSector,
            companyName: sectorTheme?.companyName || 'Company'
          }),
        });

        if (response.ok) {
          const skillsData = await response.json();
          
          // Handle both direct skills array and wrapped response
          const skillsArray = skillsData.skills || skillsData;
          
          // Convert AI skills to our Skill interface format
          const convertedSkills: Skill[] = skillsArray.map((skill: any, index: number) => ({
            id: (index + 1).toString(),
            name: skill.name,
            category: skill.category || 'Technical',
            level: skill.level || 3,
            maxLevel: 4,
            verified: skill.verified || false,
            lastAssessed: skill.lastAssessed || '2024-01-01',
            expiryDate: skill.expiryDate,
          }));
          
          setSectorSkills(convertedSkills);
          
          toast({
            title: "Skills Updated",
            description: `Loaded ${convertedSkills.length} sector-specific skills.`,
          });
        } else {
          // Fallback to default skills if AI fails
          setSectorSkills(getDefaultSkillsForSector(currentSector));
          console.warn('Failed to fetch AI skills, using defaults');
        }
      } catch (error) {
        console.error('Error fetching sector skills:', error);
        setSectorSkills(getDefaultSkillsForSector(currentSector));
        toast({
          title: "Skills Loading Error",
          description: "Using default skills for this sector.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingSkills(false);
      }
    };

    loadSectorSkills();
  }, [currentSector, sectorTheme?.companyName, toast]);

  const handleThemeGenerated = async (theme: SectorTheme) => {
    setSectorTheme(theme);
    if (theme.industry) {
      setCurrentSector(theme.industry);
    }

    // Apply theme colors to CSS variables
    if (theme.primaryColors && theme.primaryColors.length > 0) {
      const root = document.documentElement;
      root.style.setProperty('--primary-hue', theme.primaryColors[0]);
      if (theme.primaryColors[1]) {
        root.style.setProperty('--primary-accent', theme.primaryColors[1]);
      }
    }
  };

  const getSectorSpecificTitle = (sector: string): string => {
    const titleMappings: Record<string, string> = {
      energy_renewables: 'Renewable Energy Specialist',
      oil_gas: 'Petroleum Operations Engineer',
      manufacturing: 'Production Supervisor',
      healthcare: 'Healthcare Professional',
      construction: 'Construction Manager',
      aviation: 'Aviation Technician',
      maritime: 'Maritime Officer',
      finance: 'Financial Analyst',
      technology: 'Technology Specialist',
      general: 'Senior Technician'
    };
    return titleMappings[sector] || 'Senior Technician';
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Loading profile...</div>;
  }

  if (!user) {
    return <div className="flex items-center justify-center p-8">User not found</div>;
  }

  const handleSaveProfile = () => {
    console.log('Saving profile:', { name: editedName, email: editedEmail });
    setIsEditing(false);
  };

  const getSkillLevelColor = (level: number, maxLevel: number) => {
    const percentage = (level / maxLevel) * 100;
    if (percentage >= 75) return 'bg-green-500';
    if (percentage >= 50) return 'bg-blue-500';
    if (percentage >= 25) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getCertificationStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'expiring_soon': return 'secondary';
      case 'expired': return 'destructive';
      default: return 'outline';
    }
  };

  const skillsByCategory = sectorSkills.reduce((acc, skill) => {
    if (!acc[skill.category]) acc[skill.category] = [];
    acc[skill.category].push(skill);
    return acc;
  }, {} as Record<string, Skill[]>);

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={user.profileImageUrl || undefined} />
              <AvatarFallback className="text-2xl">
                {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1">
              {isEditing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        data-testid="input-edit-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={editedEmail}
                        onChange={(e) => setEditedEmail(e.target.value)}
                        data-testid="input-edit-email"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSaveProfile} data-testid="button-save-profile">
                      Save Changes
                    </Button>
                    <Button variant="outline" onClick={() => setIsEditing(false)} data-testid="button-cancel-edit">
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-2xl font-bold">{user.firstName} {user.lastName}</h2>
                      <p className="text-muted-foreground">
                        {sectorTheme?.companyName ? `${getSectorSpecificTitle(currentSector)} at ${sectorTheme.companyName}` : getSectorSpecificTitle(currentSector)}
                      </p>
                      {currentSector !== 'general' && (
                        <Badge variant="secondary" className="mt-1">
                          {businessSectors.find(s => s.value === currentSector)?.label || 'Custom Sector'}
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setShowSectorSelector(true)} data-testid="button-customize-sector">
                        <Sparkles className="h-4 w-4 mr-2" />
                        Customize Sector
                      </Button>
                      <Button variant="outline" onClick={() => setIsEditing(true)} data-testid="button-edit-profile">
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Profile
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{user.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      <span>{user.department}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{user.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>Member since 2022</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Tabs */}
      <Tabs defaultValue="skills" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="skills" data-testid="tab-skills">Skills</TabsTrigger>
          <TabsTrigger value="certifications" data-testid="tab-certifications">Certifications</TabsTrigger>
          <TabsTrigger value="learning" data-testid="tab-learning">Learning Path</TabsTrigger>
          <TabsTrigger value="assessments" data-testid="tab-assessments">Assessments</TabsTrigger>
        </TabsList>

        <TabsContent value="skills" className="space-y-4">
          {Object.entries(skillsByCategory).map(([category, skills]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  {category} Skills
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {skills.map(skill => (
                    <div key={skill.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium">{skill.name}</h4>
                          {skill.verified && (
                            <Badge variant="default" className="text-xs">
                              Verified
                            </Badge>
                          )}
                          {skill.expiryDate && new Date(skill.expiryDate) < new Date() && (
                            <Badge variant="destructive" className="text-xs">
                              Expired
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Level {skill.level}/{skill.maxLevel}</span>
                          <span>Last assessed: {skill.lastAssessed}</span>
                          {skill.expiryDate && (
                            <span>Expires: {skill.expiryDate}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-32">
                          <Progress 
                            value={(skill.level / skill.maxLevel) * 100} 
                            className="h-2"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" data-testid={`button-view-skill-${skill.id}`}>
                            View Details
                          </Button>
                          {skill.level < skill.maxLevel && (
                            <Button size="sm" data-testid={`button-improve-skill-${skill.id}`}>
                              Improve
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="certifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Professional Certifications
              </CardTitle>
              <CardDescription>Your earned certifications and their status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {mockCertifications.map(cert => (
                  <div key={cert.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium">{cert.name}</h4>
                        <Badge variant={getCertificationStatusColor(cert.status)}>
                          {cert.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <div>Issued by {cert.issuer} on {cert.issuedDate}</div>
                        {cert.expiryDate && (
                          <div>Expires: {cert.expiryDate}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" data-testid={`button-view-cert-${cert.id}`}>
                        View Certificate
                      </Button>
                      {cert.status === 'expired' && (
                        <Button size="sm" data-testid={`button-renew-cert-${cert.id}`}>
                          Renew
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="learning" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Learning Paths
              </CardTitle>
              <CardDescription>Your current learning journey and progress</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {mockLearningPaths.map(path => (
                  <div key={path.id} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium">{path.title}</h4>
                        <p className="text-sm text-muted-foreground">{path.description}</p>
                      </div>
                      <Badge variant="secondary">{path.progress}% Complete</Badge>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Progress</span>
                        <span>{path.completedHours} / {path.estimatedHours} hours</span>
                      </div>
                      <Progress value={path.progress} className="h-2" />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {path.skills.map(skill => (
                        <Badge key={skill} variant="outline" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button size="sm" data-testid={`button-continue-path-${path.id}`}>
                        Continue Learning
                      </Button>
                      <Button variant="outline" size="sm" data-testid={`button-view-path-${path.id}`}>
                        View Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assessments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Assessment History
              </CardTitle>
              <CardDescription>Your completed and upcoming assessments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Assessment history will be displayed here</p>
                <p className="text-sm">Complete assessments to see your progress</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Sector Selector Modal */}
      <SectorSelector
        isVisible={showSectorSelector}
        onClose={() => setShowSectorSelector(false)}
        onThemeGenerated={handleThemeGenerated}
      />
    </div>
  );
}
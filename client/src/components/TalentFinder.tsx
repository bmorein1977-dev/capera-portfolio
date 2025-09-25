import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Filter, MapPin, Briefcase, Star, Mail, Phone } from 'lucide-react';
import { useState } from 'react';

interface TalentProfile {
  id: string;
  name: string;
  role: string;
  department: string;
  location: string;
  email: string;
  phone?: string;
  avatar?: string;
  training: Array<{
    name: string;
    level: number;
    verified: boolean;
  }>;
  availability: 'available' | 'partial' | 'unavailable';
  certifications: string[];
  experience: number; // years
  rating: number; // 1-5
}

const mockTalentProfiles: TalentProfile[] = [
  {
    id: '1',
    name: 'Emma Wilson',
    role: 'Senior Production Operator',
    department: 'Manufacturing',
    location: 'Site A',
    email: 'emma.wilson@company.com',
    phone: '+1 234-567-8901',
    training: [
      { name: 'Equipment Operation', level: 4, verified: true },
      { name: 'Safety Procedures', level: 4, verified: true },
      { name: 'Quality Control', level: 3, verified: true },
      { name: 'Team Leadership', level: 3, verified: false },
    ],
    availability: 'available',
    certifications: ['Safety Level 3', 'Equipment Certification A'],
    experience: 8,
    rating: 4.8,
  },
  {
    id: '2',
    name: 'Alex Thompson',
    role: 'Maintenance Specialist',
    department: 'Maintenance',
    location: 'Site B',
    email: 'alex.thompson@company.com',
    training: [
      { name: 'Mechanical Repair', level: 4, verified: true },
      { name: 'Electrical Systems', level: 3, verified: true },
      { name: 'Preventive Maintenance', level: 4, verified: true },
      { name: 'Troubleshooting', level: 4, verified: true },
    ],
    availability: 'partial',
    certifications: ['Electrical Safety', 'Mechanical Systems'],
    experience: 12,
    rating: 4.9,
  },
  {
    id: '3',
    name: 'Sarah Johnson',
    role: 'Quality Supervisor',
    department: 'Quality',
    location: 'Site A',
    email: 'sarah.johnson@company.com',
    training: [
      { name: 'Quality Control', level: 4, verified: true },
      { name: 'Statistical Analysis', level: 3, verified: true },
      { name: 'Process Improvement', level: 4, verified: true },
      { name: 'Team Management', level: 4, verified: true },
    ],
    availability: 'available',
    certifications: ['Six Sigma Black Belt', 'Quality Management'],
    experience: 10,
    rating: 4.7,
  },
];

const skillLevels = [
  { value: '1', label: 'Beginner (1)' },
  { value: '2', label: 'Intermediate (2)' },
  { value: '3', label: 'Advanced (3)' },
  { value: '4', label: 'Expert (4)' },
];

export default function TalentFinder() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [minSkillLevel, setMinSkillLevel] = useState('1');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [availabilityFilter, setAvailabilityFilter] = useState('all');
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const allTraining = Array.from(new Set(
    mockTalentProfiles.flatMap(profile => profile.training.map(training => training.name))
  ));

  const departments = Array.from(new Set(mockTalentProfiles.map(p => p.department)));
  const locations = Array.from(new Set(mockTalentProfiles.map(p => p.location)));

  const filteredProfiles = mockTalentProfiles.filter(profile => {
    const matchesSearch = profile.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         profile.role.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDepartment = departmentFilter === 'all' || profile.department === departmentFilter;
    const matchesLocation = locationFilter === 'all' || profile.location === locationFilter;
    const matchesAvailability = availabilityFilter === 'all' || profile.availability === availabilityFilter;
    
    const matchesSkills = selectedSkills.length === 0 || selectedSkills.every(skillName => {
      const training = profile.training.find(t => t.name === skillName);
      if (!training) return false;
      if (verifiedOnly && !training.verified) return false;
      return training.level >= parseInt(minSkillLevel);
    });

    return matchesSearch && matchesDepartment && matchesLocation && 
           matchesAvailability && matchesSkills;
  });

  const handleSkillToggle = (skillName: string) => {
    setSelectedSkills(prev => 
      prev.includes(skillName) 
        ? prev.filter(s => s !== skillName)
        : [...prev, skillName]
    );
  };

  const handleContactTalent = (profile: TalentProfile) => {
    console.log('Contacting talent:', profile.name);
  };

  const handleViewProfile = (profile: TalentProfile) => {
    console.log('Viewing profile:', profile.name);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-6 w-6" />
            Talent Finder
          </CardTitle>
          <CardDescription>
            Find the right person for the right job at the right time
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search and Filters */}
          <div className="space-y-4 mb-6">
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search by name or role..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  data-testid="input-search-talent"
                />
              </div>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-department">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="w-[150px]" data-testid="select-location">
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locations.map(location => (
                    <SelectItem key={location} value={location}>{location}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={availabilityFilter} onValueChange={setAvailabilityFilter}>
                <SelectTrigger className="w-[150px]" data-testid="select-availability">
                  <SelectValue placeholder="Availability" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="partial">Partially Available</SelectItem>
                  <SelectItem value="unavailable">Unavailable</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Skills Filter */}
            <div className="space-y-2">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">Required Training:</span>
                <Select value={minSkillLevel} onValueChange={setMinSkillLevel}>
                  <SelectTrigger className="w-[180px]" data-testid="select-training-level">
                    <SelectValue placeholder="Minimum Level" />
                  </SelectTrigger>
                  <SelectContent>
                    {skillLevels.map(level => (
                      <SelectItem key={level.value} value={level.value}>{level.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="verified-only" 
                    checked={verifiedOnly}
                    onCheckedChange={(checked) => setVerifiedOnly(checked as boolean)}
                    data-testid="checkbox-verified-only"
                  />
                  <label htmlFor="verified-only" className="text-sm">Verified training only</label>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {allTraining.map(training => (
                  <Badge
                    key={training}
                    variant={selectedSkills.includes(training) ? 'default' : 'outline'}
                    className="cursor-pointer hover-elevate"
                    onClick={() => handleSkillToggle(training)}
                    data-testid={`training-filter-${training.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {training}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {filteredProfiles.length} talent profiles found
              </span>
            </div>

            <div className="grid gap-4">
              {filteredProfiles.map(profile => (
                <Card key={profile.id} className="hover-elevate" data-testid={`talent-card-${profile.id}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        <Avatar className="h-16 w-16">
                          <AvatarImage src={profile.avatar} />
                          <AvatarFallback className="text-lg">
                            {profile.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 space-y-3">
                          <div>
                            <h3 className="text-lg font-semibold">{profile.name}</h3>
                            <p className="text-muted-foreground">{profile.role}</p>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                              <span className="flex items-center gap-1">
                                <Briefcase className="h-3 w-3" />
                                {profile.department}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {profile.location}
                              </span>
                              <span className="flex items-center gap-1">
                                <Star className="h-3 w-3" />
                                {profile.rating}/5
                              </span>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="text-sm font-medium">Training:</div>
                            <div className="flex flex-wrap gap-2">
                              {profile.training.map(training => (
                                <Badge 
                                  key={training.name}
                                  variant={training.verified ? 'default' : 'secondary'}
                                  className="text-xs"
                                >
                                  {training.name} (Level {training.level})
                                  {training.verified && ' ✓'}
                                </Badge>
                              ))}
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-sm">
                            <span>Experience: {profile.experience} years</span>
                            <Badge 
                              variant={
                                profile.availability === 'available' ? 'default' :
                                profile.availability === 'partial' ? 'secondary' : 'outline'
                              }
                            >
                              {profile.availability === 'available' ? 'Available' :
                               profile.availability === 'partial' ? 'Partial' : 'Unavailable'}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <Button 
                          size="sm"
                          onClick={() => handleViewProfile(profile)}
                          data-testid={`button-view-profile-${profile.id}`}
                        >
                          View Profile
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleContactTalent(profile)}
                          data-testid={`button-contact-${profile.id}`}
                        >
                          <Mail className="h-3 w-3 mr-1" />
                          Contact
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
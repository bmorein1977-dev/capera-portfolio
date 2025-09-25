import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, Users, Download } from 'lucide-react';
import { useState } from 'react';

type TrainingLevel = 0 | 1 | 2 | 3 | 4; // 0 = Not assessed, 1 = Beginner, 2 = Intermediate, 3 = Advanced, 4 = Expert

interface TeamMember {
  id: string;
  name: string;
  role: string;
  department: string;
  location: string;
  avatar?: string;
  training: Record<string, TrainingLevel>;
}

interface TeamMatrixProps {
  teamMembers?: TeamMember[];
  trainingCategories?: string[];
}

const mockTrainingCategories = [
  'Safety Procedures', 
  'Equipment Operation', 
  'Quality Control', 
  'Maintenance',
  'Documentation',
  'Leadership',
  'Communication',
  'Problem Solving'
];

const mockTeamMembers: TeamMember[] = [
  {
    id: '1',
    name: 'Emma Wilson',
    role: 'Production Operator',
    department: 'Manufacturing',
    location: 'Site A',
    training: {
      'Safety Procedures': 4,
      'Equipment Operation': 3,
      'Quality Control': 3,
      'Maintenance': 2,
      'Documentation': 3,
      'Leadership': 1,
      'Communication': 3,
      'Problem Solving': 2,
    },
  },
  {
    id: '2',
    name: 'Alex Thompson',
    role: 'Maintenance Technician',
    department: 'Maintenance',
    location: 'Site A',
    training: {
      'Safety Procedures': 3,
      'Equipment Operation': 4,
      'Quality Control': 2,
      'Maintenance': 4,
      'Documentation': 2,
      'Leadership': 2,
      'Communication': 3,
      'Problem Solving': 4,
    },
  },
  {
    id: '3',
    name: 'Sarah Johnson',
    role: 'Team Lead',
    department: 'Manufacturing',
    location: 'Site A',
    training: {
      'Safety Procedures': 4,
      'Equipment Operation': 3,
      'Quality Control': 4,
      'Maintenance': 2,
      'Documentation': 4,
      'Leadership': 4,
      'Communication': 4,
      'Problem Solving': 3,
    },
  },
  {
    id: '4',
    name: 'Mike Chen',
    role: 'Quality Inspector',
    department: 'Quality',
    location: 'Site B',
    training: {
      'Safety Procedures': 3,
      'Equipment Operation': 2,
      'Quality Control': 4,
      'Maintenance': 1,
      'Documentation': 4,
      'Leadership': 2,
      'Communication': 3,
      'Problem Solving': 3,
    },
  },
];

const getSkillLevelColor = (level: TrainingLevel): string => {
  switch (level) {
    case 0: return 'bg-gray-200 dark:bg-gray-700';
    case 1: return 'bg-red-200 dark:bg-red-900';
    case 2: return 'bg-yellow-200 dark:bg-yellow-900';
    case 3: return 'bg-blue-200 dark:bg-blue-900';
    case 4: return 'bg-green-200 dark:bg-green-900';
    default: return 'bg-gray-200 dark:bg-gray-700';
  }
};

const getSkillLevelText = (level: TrainingLevel): string => {
  switch (level) {
    case 0: return 'Not Assessed';
    case 1: return 'Beginner';
    case 2: return 'Intermediate';
    case 3: return 'Advanced';
    case 4: return 'Expert';
    default: return 'Not Assessed';
  }
};

export default function TeamMatrix({ 
  teamMembers = mockTeamMembers,
  trainingCategories = mockTrainingCategories 
}: TeamMatrixProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');

  const filteredMembers = teamMembers.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.role.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartment = departmentFilter === 'all' || member.department === departmentFilter;
    const matchesLocation = locationFilter === 'all' || member.location === locationFilter;
    
    return matchesSearch && matchesDepartment && matchesLocation;
  });

  const departments = Array.from(new Set(teamMembers.map(m => m.department)));
  const locations = Array.from(new Set(teamMembers.map(m => m.location)));

  const handleExport = () => {
    console.log('Exporting team matrix data');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-6 w-6" />
                Team Training Matrix
              </CardTitle>
              <CardDescription>
                Visual overview of team training and skill levels
              </CardDescription>
            </div>
            <Button variant="outline" onClick={handleExport} data-testid="button-export-matrix">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search team members..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search-members"
              />
            </div>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-department-filter">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map(dept => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-[150px]" data-testid="select-location-filter">
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations.map(location => (
                  <SelectItem key={location} value={location}>{location}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Matrix Table */}
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Header */}
              <div className="grid grid-cols-[300px_repeat(8,120px)] gap-2 mb-4">
                <div className="font-semibold text-sm p-2">Team Member</div>
                {skillCategories.map(skill => (
                  <div key={skill} className="font-semibold text-xs p-2 text-center">
                    {skill}
                  </div>
                ))}
              </div>

              {/* Matrix Rows */}
              <div className="space-y-2">
                {filteredMembers.map(member => (
                  <div 
                    key={member.id} 
                    className="grid grid-cols-[300px_repeat(8,120px)] gap-2 items-center p-2 rounded-lg border hover-elevate"
                    data-testid={`matrix-row-${member.id}`}
                  >
                    {/* Member Info */}
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={member.avatar} />
                        <AvatarFallback>
                          {member.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-sm">{member.name}</div>
                        <div className="text-xs text-muted-foreground">{member.role}</div>
                        <div className="text-xs text-muted-foreground">
                          {member.department} • {member.location}
                        </div>
                      </div>
                    </div>

                    {/* Skill Levels */}
                    {skillCategories.map(skill => {
                      const level = (member.training[skill] || 0) as TrainingLevel;
                      return (
                        <div key={skill} className="flex justify-center">
                          <div
                            className={`w-8 h-8 rounded flex items-center justify-center text-xs font-medium cursor-pointer ${getSkillLevelColor(level)}`}
                            title={`${skill}: ${getSkillLevelText(level)}`}
                            data-testid={`skill-${member.id}-${skill.replace(/\s+/g, '-').toLowerCase()}`}
                          >
                            {level > 0 ? level : '-'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-6 mt-6 p-4 bg-muted/50 rounded-lg">
            <span className="text-sm font-medium">Training Levels:</span>
            {[0, 1, 2, 3, 4].map(level => (
              <div key={level} className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded ${getSkillLevelColor(level)}`} />
                <span className="text-xs">{getSkillLevelText(level)}</span>
              </div>
            ))}
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold">{filteredMembers.length}</div>
              <div className="text-sm text-muted-foreground">Team Members</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold">
                {Math.round(
                  filteredMembers.reduce((acc, member) => {
                    const trainingValues = Object.values(member.training);
                    const avgTraining = trainingValues.reduce((sum, training) => sum + training, 0) / trainingValues.length;
                    return acc + avgSkill;
                  }, 0) / filteredMembers.length * 25
                )}%
              </div>
              <div className="text-sm text-muted-foreground">Average Competency</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold">
                {skillCategories.filter(skill => {
                  const avgLevel = filteredMembers.reduce((acc, member) => 
                    acc + ((member.training[skill] || 0) as number), 0
                  ) / filteredMembers.length;
                  return avgLevel < 2;
                }).length}
              </div>
              <div className="text-sm text-muted-foreground">Training Gaps</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
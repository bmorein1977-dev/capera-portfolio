import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
// import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';
import { 
  FileBarChart, 
  Download, 
  Filter, 
  Search,
  Users,
  Building2,
  User,
  Calendar,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Target,
  Eye,
  Settings
} from 'lucide-react';
import { useState } from 'react';

interface ReportFilter {
  level: 'individual' | 'team' | 'department' | 'company';
  category: 'training' | 'competence' | 'safety' | 'all';
  timeRange: 'week' | 'month' | 'quarter' | 'year' | 'custom';
  startDate?: Date;
  endDate?: Date;
  departments: string[];
  teams: string[];
  individuals: string[];
  skillAreas: string[];
  statusFilter: 'all' | 'compliant' | 'non_compliant' | 'in_progress' | 'overdue';
}

interface ReportData {
  individual?: IndividualReport[];
  team?: TeamReport[];
  department?: DepartmentReport[];
  company?: CompanyReport;
}

interface IndividualReport {
  id: string;
  name: string;
  role: string;
  department: string;
  team: string;
  trainingCompliance: number;
  competenceLevel: number;
  safetyCompliance: number;
  totalAssessments: number;
  completedAssessments: number;
  overdueDays: number;
  lastActivity: string;
  riskLevel: 'low' | 'medium' | 'high';
}

interface TeamReport {
  id: string;
  name: string;
  department: string;
  teamLead: string;
  memberCount: number;
  avgTrainingCompliance: number;
  avgCompetenceLevel: number;
  avgSafetyCompliance: number;
  totalRiskExposure: number;
  criticalGaps: string[];
}

interface DepartmentReport {
  id: string;
  name: string;
  manager: string;
  employeeCount: number;
  teamCount: number;
  trainingCompliance: number;
  competenceLevel: number;
  safetyCompliance: number;
  budgetUtilization: number;
  keyMetrics: {
    onTimeCompletion: number;
    qualityScore: number;
    incidentRate: number;
  };
}

interface CompanyReport {
  totalEmployees: number;
  totalDepartments: number;
  overallCompliance: number;
  trainingInvestment: number;
  competencyGrowth: number;
  safetyIncidents: number;
  topPerformingDepartments: string[];
  areasForImprovement: string[];
}

const mockIndividualReports: IndividualReport[] = [
  {
    id: '1',
    name: 'Emma Wilson',
    role: 'Senior Production Operator',
    department: 'Manufacturing',
    team: 'Production Line A',
    trainingCompliance: 95,
    competenceLevel: 88,
    safetyCompliance: 100,
    totalAssessments: 12,
    completedAssessments: 11,
    overdueDays: 0,
    lastActivity: '2024-02-15',
    riskLevel: 'low',
  },
  {
    id: '2',
    name: 'Alex Thompson',
    role: 'Maintenance Specialist',
    department: 'Maintenance',
    team: 'Electrical Team',
    trainingCompliance: 72,
    competenceLevel: 85,
    safetyCompliance: 78,
    totalAssessments: 15,
    completedAssessments: 12,
    overdueDays: 14,
    lastActivity: '2024-02-10',
    riskLevel: 'medium',
  },
  {
    id: '3',
    name: 'Sarah Johnson',
    role: 'Quality Supervisor',
    department: 'Quality',
    team: 'Quality Assurance',
    trainingCompliance: 88,
    competenceLevel: 92,
    safetyCompliance: 95,
    totalAssessments: 10,
    completedAssessments: 9,
    overdueDays: 3,
    lastActivity: '2024-02-14',
    riskLevel: 'low',
  },
];

const mockTeamReports: TeamReport[] = [
  {
    id: '1',
    name: 'Production Line A',
    department: 'Manufacturing',
    teamLead: 'Emma Wilson',
    memberCount: 15,
    avgTrainingCompliance: 92,
    avgCompetenceLevel: 87,
    avgSafetyCompliance: 96,
    totalRiskExposure: 25,
    criticalGaps: ['Advanced Troubleshooting', 'Emergency Procedures'],
  },
  {
    id: '2',
    name: 'Electrical Team',
    department: 'Maintenance',
    teamLead: 'Michael Chen',
    memberCount: 8,
    avgTrainingCompliance: 78,
    avgCompetenceLevel: 83,
    avgSafetyCompliance: 89,
    totalRiskExposure: 42,
    criticalGaps: ['High Voltage Safety', 'Arc Flash Protection'],
  },
];

const mockDepartmentReports: DepartmentReport[] = [
  {
    id: '1',
    name: 'Manufacturing',
    manager: 'David Kim',
    employeeCount: 145,
    teamCount: 6,
    trainingCompliance: 89,
    competenceLevel: 85,
    safetyCompliance: 94,
    budgetUtilization: 87,
    keyMetrics: {
      onTimeCompletion: 92,
      qualityScore: 88,
      incidentRate: 0.2,
    },
  },
  {
    id: '2',
    name: 'Maintenance',
    manager: 'Lisa Chen',
    employeeCount: 32,
    teamCount: 3,
    trainingCompliance: 82,
    competenceLevel: 87,
    safetyCompliance: 91,
    budgetUtilization: 94,
    keyMetrics: {
      onTimeCompletion: 85,
      qualityScore: 91,
      incidentRate: 0.1,
    },
  },
];

const mockCompanyReport: CompanyReport = {
  totalEmployees: 328,
  totalDepartments: 8,
  overallCompliance: 87,
  trainingInvestment: 450000,
  competencyGrowth: 12,
  safetyIncidents: 3,
  topPerformingDepartments: ['Quality', 'Safety', 'Manufacturing'],
  areasForImprovement: ['Maintenance Training', 'New Employee Onboarding'],
};

export default function GranularReporting() {
  const [filters, setFilters] = useState<ReportFilter>({
    level: 'company',
    category: 'all',
    timeRange: 'month',
    departments: [],
    teams: [],
    individuals: [],
    skillAreas: [],
    statusFilter: 'all',
  });

  const [reportData] = useState<ReportData>({
    individual: mockIndividualReports,
    team: mockTeamReports,
    department: mockDepartmentReports,
    company: mockCompanyReport,
  });

  const updateFilter = (key: keyof ReportFilter, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleExportReport = (format: 'pdf' | 'excel' | 'csv') => {
    console.log(`Exporting report as ${format}`);
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'default';
      case 'medium': return 'secondary';
      case 'high': return 'destructive';
      default: return 'outline';
    }
  };

  const renderIndividualReports = () => (
    <div className="space-y-4">
      <div className="grid gap-4">
        {reportData.individual?.map(person => (
          <Card key={person.id} className="hover-elevate">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Avatar>
                    <AvatarFallback>
                      {person.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="font-medium">{person.name}</h4>
                    <p className="text-sm text-muted-foreground">{person.role} • {person.department}</p>
                    <p className="text-xs text-muted-foreground">{person.team}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-sm font-medium">Training</div>
                    <div className="text-2xl font-bold">{person.trainingCompliance}%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium">Competence</div>
                    <div className="text-2xl font-bold">{person.competenceLevel}%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium">Safety</div>
                    <div className="text-2xl font-bold">{person.safetyCompliance}%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium">Risk</div>
                    <Badge variant={getRiskColor(person.riskLevel)}>
                      {person.riskLevel}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Assessments: </span>
                  <span>{person.completedAssessments}/{person.totalAssessments}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Overdue: </span>
                  <span className={person.overdueDays > 0 ? 'text-red-500' : ''}>
                    {person.overdueDays} days
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Last Activity: </span>
                  <span>{person.lastActivity}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderTeamReports = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {reportData.team?.map(team => (
        <Card key={team.id}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{team.name}</span>
              <Badge variant="outline">{team.memberCount} members</Badge>
            </CardTitle>
            <CardDescription>{team.department} • Led by {team.teamLead}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-sm text-muted-foreground">Training</div>
                <div className="text-xl font-bold">{team.avgTrainingCompliance}%</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-muted-foreground">Competence</div>
                <div className="text-xl font-bold">{team.avgCompetenceLevel}%</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-muted-foreground">Safety</div>
                <div className="text-xl font-bold">{team.avgSafetyCompliance}%</div>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium">Risk Exposure</label>
              <Progress value={team.totalRiskExposure} className="mt-2" />
              <div className="text-xs text-muted-foreground mt-1">{team.totalRiskExposure}% overall risk</div>
            </div>

            {team.criticalGaps.length > 0 && (
              <div>
                <label className="text-sm font-medium">Critical Skill Gaps</label>
                <div className="flex flex-wrap gap-1 mt-2">
                  {team.criticalGaps.map(gap => (
                    <Badge key={gap} variant="destructive" className="text-xs">
                      {gap}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderDepartmentReports = () => (
    <div className="grid gap-6">
      {reportData.department?.map(dept => (
        <Card key={dept.id}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{dept.name} Department</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{dept.employeeCount} employees</Badge>
                <Badge variant="outline">{dept.teamCount} teams</Badge>
              </div>
            </CardTitle>
            <CardDescription>Managed by {dept.manager}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-medium">Compliance Metrics</h4>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Training Compliance</span>
                      <span>{dept.trainingCompliance}%</span>
                    </div>
                    <Progress value={dept.trainingCompliance} />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Competence Level</span>
                      <span>{dept.competenceLevel}%</span>
                    </div>
                    <Progress value={dept.competenceLevel} />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Safety Compliance</span>
                      <span>{dept.safetyCompliance}%</span>
                    </div>
                    <Progress value={dept.safetyCompliance} />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Budget Utilization</span>
                      <span>{dept.budgetUtilization}%</span>
                    </div>
                    <Progress value={dept.budgetUtilization} />
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <h4 className="font-medium">Key Performance Metrics</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 border rounded">
                    <div className="text-2xl font-bold">{dept.keyMetrics.onTimeCompletion}%</div>
                    <div className="text-xs text-muted-foreground">On-Time Completion</div>
                  </div>
                  <div className="text-center p-3 border rounded">
                    <div className="text-2xl font-bold">{dept.keyMetrics.qualityScore}%</div>
                    <div className="text-xs text-muted-foreground">Quality Score</div>
                  </div>
                  <div className="text-center p-3 border rounded">
                    <div className="text-2xl font-bold">{dept.keyMetrics.incidentRate}</div>
                    <div className="text-xs text-muted-foreground">Incident Rate</div>
                  </div>
                  <div className="text-center p-3 border rounded">
                    <div className="text-2xl font-bold">{dept.employeeCount}</div>
                    <div className="text-xs text-muted-foreground">Team Size</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderCompanyReport = () => {
    if (!reportData.company) return null;
    
    const company = reportData.company;
    
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Total Employees</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{company.totalEmployees}</div>
              <p className="text-xs text-muted-foreground">Across {company.totalDepartments} departments</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Overall Compliance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{company.overallCompliance}%</div>
              <p className="text-xs text-muted-foreground">Company-wide average</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Training Investment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${(company.trainingInvestment / 1000).toFixed(0)}K</div>
              <p className="text-xs text-muted-foreground">Annual training budget</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Competency Growth</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">+{company.competencyGrowth}%</div>
              <p className="text-xs text-muted-foreground">Year over year</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-green-600">Top Performing Departments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {company.topPerformingDepartments.map((dept, index) => (
                  <div key={dept} className="flex items-center gap-2">
                    <Badge variant="default">{index + 1}</Badge>
                    <span>{dept}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-orange-600">Areas for Improvement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {company.areasForImprovement.map((area, index) => (
                  <div key={area} className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    <span>{area}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Safety Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">{company.safetyIncidents}</div>
                  <div className="text-sm text-muted-foreground">Safety Incidents</div>
                  <div className="text-xs text-muted-foreground">This year</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">0</div>
                  <div className="text-sm text-muted-foreground">Lost Time Incidents</div>
                  <div className="text-xs text-muted-foreground">This year</div>
                </div>
              </div>
              <Badge variant="default" className="text-lg px-4 py-2">
                Excellent Safety Record
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileBarChart className="h-8 w-8" />
            Granular Reporting
          </h2>
          <p className="text-muted-foreground">
            Comprehensive reporting from individual to company-wide representation
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleExportReport('pdf')} data-testid="button-export-pdf">
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
          <Button variant="outline" onClick={() => handleExportReport('excel')} data-testid="button-export-excel">
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
          <Button variant="outline" onClick={() => handleExportReport('csv')} data-testid="button-export-csv">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Report Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Report Filters
          </CardTitle>
          <CardDescription>Configure your report parameters and scope</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Report Level</Label>
              <Select value={filters.level} onValueChange={(value: any) => updateFilter('level', value)}>
                <SelectTrigger data-testid="select-report-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="team">Team</SelectItem>
                  <SelectItem value="department">Department</SelectItem>
                  <SelectItem value="company">Company</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={filters.category} onValueChange={(value: any) => updateFilter('category', value)}>
                <SelectTrigger data-testid="select-report-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="training">Training</SelectItem>
                  <SelectItem value="competence">Competence</SelectItem>
                  <SelectItem value="safety">Safety</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Time Range</Label>
              <Select value={filters.timeRange} onValueChange={(value: any) => updateFilter('timeRange', value)}>
                <SelectTrigger data-testid="select-time-range">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="quarter">This Quarter</SelectItem>
                  <SelectItem value="year">This Year</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status Filter</Label>
              <Select value={filters.statusFilter} onValueChange={(value: any) => updateFilter('statusFilter', value)}>
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="compliant">Compliant</SelectItem>
                  <SelectItem value="non_compliant">Non-Compliant</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Content */}
      <div className="space-y-6">
        {filters.level === 'individual' && renderIndividualReports()}
        {filters.level === 'team' && renderTeamReports()}
        {filters.level === 'department' && renderDepartmentReports()}
        {filters.level === 'company' && renderCompanyReport()}
      </div>
    </div>
  );
}
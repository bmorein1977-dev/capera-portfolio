import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Target, 
  AlertTriangle, 
  CheckCircle,
  Calendar,
  BarChart3,
  Download
} from 'lucide-react';
import { useState } from 'react';

const trainingDistributionData = [
  { training: 'Safety', completed: 85, total: 100 },
  { training: 'Technical', completed: 72, total: 100 },
  { training: 'Leadership', completed: 68, total: 100 },
  { training: 'Digital', completed: 59, total: 100 },
  { training: 'Communication', completed: 78, total: 100 },
  { training: 'Quality', completed: 82, total: 100 },
];

const competencyTrendsData = [
  { month: 'Jan', safety: 78, technical: 65, leadership: 60 },
  { month: 'Feb', safety: 80, technical: 68, leadership: 62 },
  { month: 'Mar', safety: 82, technical: 70, leadership: 65 },
  { month: 'Apr', safety: 85, technical: 72, leadership: 68 },
  { month: 'May', safety: 85, technical: 72, leadership: 68 },
  { month: 'Jun', safety: 85, technical: 72, leadership: 68 },
];

const gapAnalysisData = [
  { department: 'Manufacturing', gaps: 12, critical: 3 },
  { department: 'Maintenance', gaps: 8, critical: 2 },
  { department: 'Quality', gaps: 6, critical: 1 },
  { department: 'Safety', gaps: 4, critical: 1 },
  { department: 'Management', gaps: 10, critical: 0 },
];

const certificationStatusData = [
  { name: 'Current', value: 245, color: '#22c55e' },
  { name: 'Expiring Soon', value: 47, color: '#eab308' },
  { name: 'Expired', value: 23, color: '#ef4444' },
];

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function AnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState('6months');
  const [department, setDepartment] = useState('all');

  const handleExport = () => {
    console.log('Exporting analytics data');
  };

  const handleDrillDown = (data: any) => {
    console.log('Drilling down into:', data);
  };

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-8 w-8" />
            Analytics Dashboard
          </h2>
          <p className="text-muted-foreground">
            Real-time workforce capability insights and strategic intelligence
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[140px]" data-testid="select-time-range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1month">Last Month</SelectItem>
              <SelectItem value="3months">Last 3 Months</SelectItem>
              <SelectItem value="6months">Last 6 Months</SelectItem>
              <SelectItem value="1year">Last Year</SelectItem>
            </SelectContent>
          </Select>
          <Select value={department} onValueChange={setDepartment}>
            <SelectTrigger className="w-[160px]" data-testid="select-department">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              <SelectItem value="manufacturing">Manufacturing</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
              <SelectItem value="quality">Quality</SelectItem>
              <SelectItem value="safety">Safety</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExport} data-testid="button-export-analytics">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card data-testid="metric-workforce-readiness">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Workforce Readiness</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">78.5%</div>
            <p className="text-xs text-muted-foreground flex items-center">
              <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
              +2.3% from last month
            </p>
          </CardContent>
        </Card>
        
        <Card data-testid="metric-training-gaps">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Training Gaps</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">47</div>
            <p className="text-xs text-muted-foreground flex items-center">
              <TrendingDown className="h-3 w-3 mr-1 text-green-500" />
              -8 from last month
            </p>
          </CardContent>
        </Card>

        <Card data-testid="metric-assessments-completed">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assessments Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">234</div>
            <p className="text-xs text-muted-foreground flex items-center">
              <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
              +15% from last month
            </p>
          </CardContent>
        </Card>

        <Card data-testid="metric-certification-compliance">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Certification Compliance</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">92.3%</div>
            <p className="text-xs text-muted-foreground flex items-center">
              <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
              +1.2% from last month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Training Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Training Distribution by Category</CardTitle>
            <CardDescription>Current competency levels across training categories</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={trainingDistributionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="training" />
                <YAxis />
                <Tooltip />
                <Bar 
                  dataKey="completed" 
                  fill="#3b82f6" 
                  radius={[4, 4, 0, 0]}
                  onClick={handleDrillDown}
                  style={{ cursor: 'pointer' }}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Certification Status */}
        <Card>
          <CardHeader>
            <CardTitle>Certification Status</CardTitle>
            <CardDescription>Overview of certification compliance</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={certificationStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {certificationStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-4">
              {certificationStatusData.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm">{item.name}: {item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Competency Trends */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Competency Trends</CardTitle>
            <CardDescription>Training development progress over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={competencyTrendsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Area 
                  type="monotone" 
                  dataKey="safety" 
                  stackId="1" 
                  stroke="#ef4444" 
                  fill="#ef4444" 
                  fillOpacity={0.6}
                />
                <Area 
                  type="monotone" 
                  dataKey="technical" 
                  stackId="1" 
                  stroke="#3b82f6" 
                  fill="#3b82f6" 
                  fillOpacity={0.6}
                />
                <Area 
                  type="monotone" 
                  dataKey="leadership" 
                  stackId="1" 
                  stroke="#10b981" 
                  fill="#10b981" 
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Gap Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Skills Gap Analysis by Department</CardTitle>
          <CardDescription>Identify critical skill shortages across departments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {gapAnalysisData.map((item) => (
              <div key={item.department} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="text-lg font-semibold w-32">{item.department}</div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{item.gaps} total gaps</Badge>
                    {item.critical > 0 && (
                      <Badge variant="destructive">{item.critical} critical</Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-40">
                    <Progress 
                      value={((20 - item.gaps) / 20) * 100} 
                      className="h-2"
                    />
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleDrillDown(item)}
                    data-testid={`button-view-gaps-${item.department.toLowerCase()}`}
                  >
                    View Details
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Action Items */}
      <Card>
        <CardHeader>
          <CardTitle>Recommended Actions</CardTitle>
          <CardDescription>AI-powered insights and recommendations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-950 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div className="flex-1">
                <div className="font-medium">Critical Safety Gap Identified</div>
                <div className="text-sm text-muted-foreground">
                  Manufacturing department has 3 workers with expired safety certifications
                </div>
              </div>
              <Button size="sm" data-testid="button-action-safety">Review</Button>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
              <Target className="h-5 w-5 text-yellow-600" />
              <div className="flex-1">
                <div className="font-medium">Training Opportunity</div>
                <div className="text-sm text-muted-foreground">
                  15 employees ready for advanced technical training based on current progress
                </div>
              </div>
              <Button size="sm" data-testid="button-action-training">Schedule</Button>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <Users className="h-5 w-5 text-blue-600" />
              <div className="flex-1">
                <div className="font-medium">Succession Planning</div>
                <div className="text-sm text-muted-foreground">
                  2 senior roles lack identified successors with required competencies
                </div>
              </div>
              <Button size="sm" data-testid="button-action-succession">Plan</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
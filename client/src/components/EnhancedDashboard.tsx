import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  TrendingUp,
  Users,
  Shield,
  Award,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Settings,
  Filter,
  Download,
  RefreshCw
} from 'lucide-react';
import { useState } from 'react';

interface DashboardConfig {
  showTrainingChart: boolean;
  showCompetenceChart: boolean;
  showSafetyChart: boolean;
  showTrendChart: boolean;
  chartType: 'pie' | 'bar' | 'area';
  timeRange: '7d' | '30d' | '90d' | '1y';
  groupBy: 'individual' | 'team' | 'department' | 'company';
}

interface MetricData {
  name: string;
  value: number;
  target?: number;
  color: string;
}

interface TrendData {
  date: string;
  training: number;
  competence: number;
  safety: number;
}

interface ComplianceData {
  category: string;
  compliant: number;
  nonCompliant: number;
  inProgress: number;
  overdue: number;
}

const trainingData: MetricData[] = [
  { name: 'Completed', value: 156, color: '#22c55e' },
  { name: 'In Progress', value: 89, color: '#3b82f6' },
  { name: 'Not Started', value: 23, color: '#ef4444' },
  { name: 'Overdue', value: 12, color: '#f59e0b' },
];

const competenceData: MetricData[] = [
  { name: 'Competent', value: 234, color: '#22c55e' },
  { name: 'Not Yet Competent', value: 45, color: '#f59e0b' },
  { name: 'Training Needs', value: 18, color: '#ef4444' },
  { name: 'Under Assessment', value: 31, color: '#3b82f6' },
];

const safetyData: MetricData[] = [
  { name: 'Compliant', value: 267, color: '#22c55e' },
  { name: 'Expiring Soon', value: 34, color: '#f59e0b' },
  { name: 'Expired', value: 8, color: '#ef4444' },
  { name: 'Pending', value: 19, color: '#6b7280' },
];

const trendData: TrendData[] = [
  { date: '2024-01-01', training: 65, competence: 78, safety: 92 },
  { date: '2024-01-08', training: 68, competence: 81, safety: 91 },
  { date: '2024-01-15', training: 72, competence: 83, safety: 94 },
  { date: '2024-01-22', training: 75, competence: 85, safety: 93 },
  { date: '2024-01-29', training: 78, competence: 87, safety: 95 },
  { date: '2024-02-05', training: 81, competence: 89, safety: 96 },
  { date: '2024-02-12', training: 84, competence: 91, safety: 97 },
];

const departmentComplianceData: ComplianceData[] = [
  { category: 'Manufacturing', compliant: 145, nonCompliant: 12, inProgress: 23, overdue: 5 },
  { category: 'Maintenance', compliant: 89, nonCompliant: 8, inProgress: 15, overdue: 3 },
  { category: 'Quality', compliant: 67, nonCompliant: 4, inProgress: 11, overdue: 2 },
  { category: 'Safety', compliant: 34, nonCompliant: 2, inProgress: 6, overdue: 1 },
];

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#6b7280'];

export default function EnhancedDashboard() {
  const [config, setConfig] = useState<DashboardConfig>({
    showTrainingChart: true,
    showCompetenceChart: true,
    showSafetyChart: true,
    showTrendChart: true,
    chartType: 'pie',
    timeRange: '30d',
    groupBy: 'department',
  });

  const updateConfig = (key: keyof DashboardConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const renderMetricChart = (data: MetricData[], title: string, description: string) => {
    if (config.chartType === 'pie') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, value }) => `${name}: ${value}`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      );
    } else if (config.chartType === 'bar') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      );
    } else {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
          </AreaChart>
        </ResponsiveContainer>
      );
    }
  };

  const calculateTotal = (data: MetricData[]) => data.reduce((sum, item) => sum + item.value, 0);
  const calculatePercentage = (value: number, total: number) => Math.round((value / total) * 100);

  const trainingTotal = calculateTotal(trainingData);
  const competenceTotal = calculateTotal(competenceData);
  const safetyTotal = calculateTotal(safetyData);

  const trainingCompliance = calculatePercentage(trainingData[0].value, trainingTotal);
  const competenceCompliance = calculatePercentage(competenceData[0].value, competenceTotal);
  const safetyCompliance = calculatePercentage(safetyData[0].value, safetyTotal);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <TrendingUp className="h-8 w-8" />
            Executive Dashboard
          </h2>
          <p className="text-muted-foreground">
            Customizable overview of training, competence, and safety compliance status
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" data-testid="button-refresh-dashboard">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" data-testid="button-export-dashboard">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" data-testid="button-dashboard-settings">
            <Settings className="h-4 w-4 mr-2" />
            Configure
          </Button>
        </div>
      </div>

      {/* Dashboard Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Dashboard Configuration
          </CardTitle>
          <CardDescription>Customize your dashboard view and metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Chart Type</label>
              <Select value={config.chartType} onValueChange={(value: any) => updateConfig('chartType', value)}>
                <SelectTrigger data-testid="select-chart-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pie">Pie Charts</SelectItem>
                  <SelectItem value="bar">Bar Charts</SelectItem>
                  <SelectItem value="area">Area Charts</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Time Range</label>
              <Select value={config.timeRange} onValueChange={(value: any) => updateConfig('timeRange', value)}>
                <SelectTrigger data-testid="select-time-range">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="1y">Last year</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Group By</label>
              <Select value={config.groupBy} onValueChange={(value: any) => updateConfig('groupBy', value)}>
                <SelectTrigger data-testid="select-group-by">
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

            <div className="space-y-3">
              <label className="text-sm font-medium">Visible Charts</label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="training-chart"
                    checked={config.showTrainingChart}
                    onCheckedChange={(checked) => updateConfig('showTrainingChart', checked)}
                    data-testid="switch-training-chart"
                  />
                  <label htmlFor="training-chart" className="text-sm">Training</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="competence-chart"
                    checked={config.showCompetenceChart}
                    onCheckedChange={(checked) => updateConfig('showCompetenceChart', checked)}
                    data-testid="switch-competence-chart"
                  />
                  <label htmlFor="competence-chart" className="text-sm">Competence</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="safety-chart"
                    checked={config.showSafetyChart}
                    onCheckedChange={(checked) => updateConfig('showSafetyChart', checked)}
                    data-testid="switch-safety-chart"
                  />
                  <label htmlFor="safety-chart" className="text-sm">Safety</label>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Training Compliance</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trainingCompliance}%</div>
            <p className="text-xs text-muted-foreground">
              {trainingData[0].value} of {trainingTotal} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Competence Rate</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{competenceCompliance}%</div>
            <p className="text-xs text-muted-foreground">
              {competenceData[0].value} of {competenceTotal} competent
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Safety Compliance</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{safetyCompliance}%</div>
            <p className="text-xs text-muted-foreground">
              {safetyData[0].value} of {safetyTotal} compliant
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.max(trainingTotal, competenceTotal, safetyTotal)}</div>
            <p className="text-xs text-muted-foreground">
              Active workforce
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {config.showTrainingChart && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Training Status
              </CardTitle>
              <CardDescription>Current training completion status across the organization</CardDescription>
            </CardHeader>
            <CardContent>
              {renderMetricChart(trainingData, 'Training Status', 'Training completion breakdown')}
            </CardContent>
          </Card>
        )}

        {config.showCompetenceChart && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Competence Assessment
              </CardTitle>
              <CardDescription>Employee competence levels and assessment outcomes</CardDescription>
            </CardHeader>
            <CardContent>
              {renderMetricChart(competenceData, 'Competence Status', 'Competence assessment results')}
            </CardContent>
          </Card>
        )}

        {config.showSafetyChart && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Safety Critical Compliance
              </CardTitle>
              <CardDescription>Safety-critical certification and compliance status</CardDescription>
            </CardHeader>
            <CardContent>
              {renderMetricChart(safetyData, 'Safety Compliance', 'Safety certification status')}
            </CardContent>
          </Card>
        )}

        {config.showTrendChart && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Compliance Trends
              </CardTitle>
              <CardDescription>Historical compliance trends over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="training" stroke="#3b82f6" name="Training" />
                  <Line type="monotone" dataKey="competence" stroke="#22c55e" name="Competence" />
                  <Line type="monotone" dataKey="safety" stroke="#ef4444" name="Safety" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Department Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Department Compliance Overview</CardTitle>
          <CardDescription>Detailed breakdown by department showing all compliance categories</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={departmentComplianceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="compliant" stackId="a" fill="#22c55e" name="Compliant" />
              <Bar dataKey="inProgress" stackId="a" fill="#3b82f6" name="In Progress" />
              <Bar dataKey="nonCompliant" stackId="a" fill="#f59e0b" name="Non-Compliant" />
              <Bar dataKey="overdue" stackId="a" fill="#ef4444" name="Overdue" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Alerts and Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Critical Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-2 border rounded">
              <div>
                <p className="font-medium">8 Safety Certifications Expired</p>
                <p className="text-sm text-muted-foreground">Manufacturing Department</p>
              </div>
              <Badge variant="destructive">Critical</Badge>
            </div>
            <div className="flex items-center justify-between p-2 border rounded">
              <div>
                <p className="font-medium">12 Training Modules Overdue</p>
                <p className="text-sm text-muted-foreground">Various Departments</p>
              </div>
              <Badge variant="destructive">High</Badge>
            </div>
            <div className="flex items-center justify-between p-2 border rounded">
              <div>
                <p className="font-medium">34 Certifications Expiring Soon</p>
                <p className="text-sm text-muted-foreground">Next 30 days</p>
              </div>
              <Badge variant="secondary">Medium</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              Recent Achievements
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-2 border rounded">
              <div>
                <p className="font-medium">15 New Competencies Achieved</p>
                <p className="text-sm text-muted-foreground">This week</p>
              </div>
              <Badge variant="default">Success</Badge>
            </div>
            <div className="flex items-center justify-between p-2 border rounded">
              <div>
                <p className="font-medium">Manufacturing Dept: 100% Safety Compliance</p>
                <p className="text-sm text-muted-foreground">Monthly target met</p>
              </div>
              <Badge variant="default">Success</Badge>
            </div>
            <div className="flex items-center justify-between p-2 border rounded">
              <div>
                <p className="font-medium">23 Training Modules Completed</p>
                <p className="text-sm text-muted-foreground">Above target</p>
              </div>
              <Badge variant="default">Success</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  ClipboardCheck, 
  AlertTriangle, 
  Calendar,
  Target,
  BookOpen 
} from 'lucide-react';
import { useAuth } from '@/lib/auth';

interface MetricCard {
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down';
  icon: React.ComponentType<any>;
}

const mockMetrics: MetricCard[] = [
  {
    title: 'Workforce Readiness',
    value: '78%',
    change: '+5%',
    trend: 'up',
    icon: Users,
  },
  {
    title: 'Active Assessments',
    value: '156',
    change: '+12',
    trend: 'up',
    icon: ClipboardCheck,
  },
  {
    title: 'Skills Gaps',
    value: '23',
    change: '-3',
    trend: 'down',
    icon: AlertTriangle,
  },
  {
    title: 'Certifications Due',
    value: '47',
    change: '+8',
    trend: 'up',
    icon: Calendar,
  },
];

const recentActivities = [
  { id: '1', user: 'Emma Wilson', action: 'Completed Safety Assessment', time: '2 hours ago' },
  { id: '2', user: 'David Kim', action: 'Assigned new competency standards', time: '4 hours ago' },
  { id: '3', user: 'Lisa Rodriguez', action: 'Verified 5 assessments', time: '6 hours ago' },
  { id: '4', user: 'Alex Thompson', action: 'Started Equipment Operation training', time: '1 day ago' },
];

const urgentActions = [
  { id: '1', title: 'Review expired certifications', count: 12, priority: 'high' },
  { id: '2', title: 'Approve pending assessments', count: 8, priority: 'medium' },
  { id: '3', title: 'Update safety standards', count: 3, priority: 'high' },
];

export default function DashboardOverview() {
  const { user } = useAuth();

  const getRoleDashboard = () => {
    switch (user.role) {
      case 'super_admin':
      case 'admin':
        return (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {mockMetrics.map((metric) => (
                <Card key={metric.title} data-testid={`metric-${metric.title.toLowerCase().replace(/\s+/g, '-')}`}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
                    <metric.icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metric.value}</div>
                    <p className="text-xs text-muted-foreground flex items-center">
                      {metric.trend === 'up' ? (
                        <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
                      ) : (
                        <TrendingDown className="h-3 w-3 mr-1 text-red-500" />
                      )}
                      {metric.change} from last month
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
              <Card className="col-span-4">
                <CardHeader>
                  <CardTitle>Workforce Skills Distribution</CardTitle>
                </CardHeader>
                <CardContent className="pl-2">
                  <div className="space-y-4">
                    <div className="flex items-center">
                      <div className="w-20 text-sm">Safety</div>
                      <div className="flex-1 mx-4">
                        <Progress value={85} className="h-2" />
                      </div>
                      <div className="w-12 text-sm text-right">85%</div>
                    </div>
                    <div className="flex items-center">
                      <div className="w-20 text-sm">Technical</div>
                      <div className="flex-1 mx-4">
                        <Progress value={72} className="h-2" />
                      </div>
                      <div className="w-12 text-sm text-right">72%</div>
                    </div>
                    <div className="flex items-center">
                      <div className="w-20 text-sm">Leadership</div>
                      <div className="flex-1 mx-4">
                        <Progress value={68} className="h-2" />
                      </div>
                      <div className="w-12 text-sm text-right">68%</div>
                    </div>
                    <div className="flex items-center">
                      <div className="w-20 text-sm">Digital</div>
                      <div className="flex-1 mx-4">
                        <Progress value={59} className="h-2" />
                      </div>
                      <div className="w-12 text-sm text-right">59%</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="col-span-3">
                <CardHeader>
                  <CardTitle>Urgent Actions</CardTitle>
                  <CardDescription>Items requiring immediate attention</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {urgentActions.map((action) => (
                      <div key={action.id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Badge variant={action.priority === 'high' ? 'destructive' : 'secondary'}>
                            {action.count}
                          </Badge>
                          <span className="text-sm">{action.title}</span>
                        </div>
                        <Button variant="outline" size="sm" data-testid={`action-${action.id}`}>
                          Review
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        );

      case 'candidate':
      case 'trainee':
        return (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card data-testid="metric-skills-completed">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Skills Completed</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">12/18</div>
                  <p className="text-xs text-muted-foreground">67% of required skills</p>
                </CardContent>
              </Card>
              <Card data-testid="metric-assessments-pending">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending Assessments</CardTitle>
                  <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">3</div>
                  <p className="text-xs text-muted-foreground">Due this week</p>
                </CardContent>
              </Card>
              <Card data-testid="metric-learning-hours">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Learning Hours</CardTitle>
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">24</div>
                  <p className="text-xs text-muted-foreground">This month</p>
                </CardContent>
              </Card>
              <Card data-testid="metric-certifications">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Certifications</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">5</div>
                  <p className="text-xs text-muted-foreground">Active certificates</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>My Learning Progress</CardTitle>
                <CardDescription>Current competency development path</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Equipment Operation</div>
                      <div className="text-sm text-muted-foreground">Level 2 Technician</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">80%</div>
                      <Progress value={80} className="w-20 h-2 mt-1" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Safety Procedures</div>
                      <div className="text-sm text-muted-foreground">Advanced Safety</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">95%</div>
                      <Progress value={95} className="w-20 h-2 mt-1" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Quality Control</div>
                      <div className="text-sm text-muted-foreground">Basic Quality</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">45%</div>
                      <Progress value={45} className="w-20 h-2 mt-1" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        );

      default:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Welcome to SkillForge</CardTitle>
              <CardDescription>Your role-specific dashboard will appear here</CardDescription>
            </CardHeader>
          </Card>
        );
    }
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">
          Welcome back, {user.name.split(' ')[0]}
        </h2>
        <div className="flex items-center space-x-2">
          <Button data-testid="button-sync-data">Sync Data</Button>
        </div>
      </div>
      {getRoleDashboard()}
      
      {(user.role === 'super_admin' || user.role === 'admin') && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest actions across the platform</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{activity.user}</div>
                    <div className="text-sm text-muted-foreground">{activity.action}</div>
                  </div>
                  <div className="text-sm text-muted-foreground">{activity.time}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
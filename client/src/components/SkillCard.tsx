import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Clock, Calendar, CheckCircle, AlertCircle, XCircle } from 'lucide-react';

type SkillStatus = 'completed' | 'in_progress' | 'not_started' | 'expired';
type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

interface Skill {
  id: string;
  name: string;
  category: string;
  level: SkillLevel;
  status: SkillStatus;
  progress: number;
  expiryDate?: string;
  lastAssessed?: string;
  assessor?: string;
  description: string;
  isSafetyCritical: boolean;
}

interface SkillCardProps {
  skill: Skill;
  onStartAssessment?: (skillId: string) => void;
  onViewDetails?: (skillId: string) => void;
}

const statusConfig = {
  completed: {
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-50 dark:bg-green-950',
    badge: 'default',
  },
  in_progress: {
    icon: Clock,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-950',
    badge: 'secondary',
  },
  not_started: {
    icon: AlertCircle,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50 dark:bg-gray-950',
    badge: 'outline',
  },
  expired: {
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-50 dark:bg-red-950',
    badge: 'destructive',
  },
};

const levelColors = {
  beginner: 'bg-green-500',
  intermediate: 'bg-yellow-500',
  advanced: 'bg-orange-500',
  expert: 'bg-red-500',
};

export default function SkillCard({ skill, onStartAssessment, onViewDetails }: SkillCardProps) {
  const config = statusConfig[skill.status];
  const StatusIcon = config.icon;

  const handleStartAssessment = () => {
    console.log('Starting assessment for skill:', skill.name);
    onStartAssessment?.(skill.id);
  };

  const handleViewDetails = () => {
    console.log('Viewing details for skill:', skill.name);
    onViewDetails?.(skill.id);
  };

  return (
    <Card 
      className={`hover-elevate transition-all duration-200 ${config.bgColor}`}
      data-testid={`skill-card-${skill.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              {skill.name}
              {skill.isSafetyCritical && (
                <Badge variant="destructive" className="text-xs">
                  Safety Critical
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              <span>{skill.category}</span>
              <span className="text-xs">•</span>
              <span className="capitalize">{skill.level} Level</span>
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <StatusIcon className={`h-5 w-5 ${config.color}`} />
            <div 
              className={`w-3 h-3 rounded-full ${levelColors[skill.level]}`}
              title={`${skill.level} level`}
            />
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {skill.description}
        </p>

        {skill.status === 'in_progress' && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{skill.progress}%</span>
            </div>
            <Progress value={skill.progress} className="h-2" />
          </div>
        )}

        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
          {skill.lastAssessed && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>Last assessed: {skill.lastAssessed}</span>
            </div>
          )}
          {skill.expiryDate && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>Expires: {skill.expiryDate}</span>
            </div>
          )}
          {skill.assessor && (
            <div className="flex items-center gap-2">
              <span>Assessor: {skill.assessor}</span>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleViewDetails}
            data-testid={`button-view-details-${skill.id}`}
          >
            View Details
          </Button>
          {skill.status !== 'completed' && (
            <Button 
              size="sm" 
              onClick={handleStartAssessment}
              data-testid={`button-start-assessment-${skill.id}`}
            >
              {skill.status === 'not_started' ? 'Start Assessment' : 'Continue Assessment'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
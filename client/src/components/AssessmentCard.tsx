import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, Clock, User, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

type AssessmentStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'expired';
type AssessmentType = 'practical' | 'written' | 'observation' | 'simulation';

interface Assessment {
  id: string;
  title: string;
  type: AssessmentType;
  status: AssessmentStatus;
  candidate: {
    name: string;
    avatar?: string;
    role: string;
  };
  assessor?: {
    name: string;
    avatar?: string;
  };
  dueDate: string;
  completedDate?: string;
  score?: number;
  skills: string[];
  isSafetyCritical: boolean;
  description: string;
}

interface AssessmentCardProps {
  assessment: Assessment;
  onStartAssessment?: (assessmentId: string) => void;
  onReviewAssessment?: (assessmentId: string) => void;
  onViewDetails?: (assessmentId: string) => void;
}

const statusConfig = {
  pending: {
    icon: Clock,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950',
    label: 'Pending',
  },
  in_progress: {
    icon: Clock,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-950',
    label: 'In Progress',
  },
  completed: {
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-50 dark:bg-green-950',
    label: 'Completed',
  },
  failed: {
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-50 dark:bg-red-950',
    label: 'Failed',
  },
  expired: {
    icon: AlertTriangle,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 dark:bg-orange-950',
    label: 'Expired',
  },
};

const typeLabels = {
  practical: 'Practical Assessment',
  written: 'Written Test',
  observation: 'Workplace Observation',
  simulation: 'Simulation Exercise',
};

export default function AssessmentCard({ 
  assessment, 
  onStartAssessment, 
  onReviewAssessment, 
  onViewDetails 
}: AssessmentCardProps) {
  const config = statusConfig[assessment.status];
  const StatusIcon = config.icon;

  const handleStartAssessment = () => {
    console.log('Starting assessment:', assessment.title);
    onStartAssessment?.(assessment.id);
  };

  const handleReviewAssessment = () => {
    console.log('Reviewing assessment:', assessment.title);
    onReviewAssessment?.(assessment.id);
  };

  const handleViewDetails = () => {
    console.log('Viewing assessment details:', assessment.title);
    onViewDetails?.(assessment.id);
  };

  const isOverdue = new Date(assessment.dueDate) < new Date() && 
                   assessment.status !== 'completed';

  return (
    <Card 
      className={`hover-elevate transition-all duration-200 ${config.bgColor} ${
        isOverdue ? 'border-red-300 dark:border-red-700' : ''
      }`}
      data-testid={`assessment-card-${assessment.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              {assessment.title}
              {assessment.isSafetyCritical && (
                <Badge variant="destructive" className="text-xs">
                  Safety Critical
                </Badge>
              )}
              {isOverdue && (
                <Badge variant="outline" className="text-xs border-red-300 text-red-600">
                  Overdue
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-1">
              {typeLabels[assessment.type]}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <StatusIcon className={`h-5 w-5 ${config.color}`} />
            <Badge variant="outline" className={config.color}>
              {config.label}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {assessment.description}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={assessment.candidate.avatar} />
              <AvatarFallback>
                {assessment.candidate.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="text-sm font-medium">{assessment.candidate.name}</div>
              <div className="text-xs text-muted-foreground">{assessment.candidate.role}</div>
            </div>
          </div>
          {assessment.assessor && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              <span>{assessment.assessor.name}</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-1">
          {assessment.skills.slice(0, 3).map((skill) => (
            <Badge key={skill} variant="secondary" className="text-xs">
              {skill}
            </Badge>
          ))}
          {assessment.skills.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{assessment.skills.length - 3} more
            </Badge>
          )}
        </div>

        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>Due: {assessment.dueDate}</span>
          </div>
          {assessment.completedDate && (
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              <span>Completed: {assessment.completedDate}</span>
            </div>
          )}
          {assessment.score !== undefined && (
            <div className="flex items-center gap-2">
              <span>Score: </span>
              <Badge variant={assessment.score >= 80 ? 'default' : 'secondary'}>
                {assessment.score}%
              </Badge>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleViewDetails}
            data-testid={`button-view-assessment-${assessment.id}`}
          >
            View Details
          </Button>
          {assessment.status === 'pending' && (
            <Button 
              size="sm" 
              onClick={handleStartAssessment}
              data-testid={`button-start-assessment-${assessment.id}`}
            >
              Start Assessment
            </Button>
          )}
          {assessment.status === 'completed' && (
            <Button 
              size="sm" 
              onClick={handleReviewAssessment}
              data-testid={`button-review-assessment-${assessment.id}`}
            >
              Review
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
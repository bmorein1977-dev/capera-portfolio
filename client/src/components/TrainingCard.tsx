import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Clock, Calendar, CheckCircle, AlertCircle, XCircle, Languages } from 'lucide-react';
import { useTranslation, useLanguagePreferences } from '@/hooks/useTranslation';

type TrainingStatus = 'completed' | 'in_progress' | 'not_started' | 'expired';
type TrainingLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

interface Training {
  id: string;
  name: string;
  category: string;
  level: TrainingLevel;
  status: TrainingStatus;
  progress: number;
  expiryDate?: string;
  lastAssessed?: string;
  assessor?: string;
  description: string;
  isSafetyCritical: boolean;
}

interface TrainingCardProps {
  training: Training;
  onStartAssessment?: (trainingId: string) => void;
  onViewDetails?: (trainingId: string) => void;
}

const statusConfig: Record<TrainingStatus, any> = {
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

const levelColors: Record<TrainingLevel, string> = {
  beginner: 'bg-green-500',
  intermediate: 'bg-yellow-500',
  advanced: 'bg-orange-500',
  expert: 'bg-red-500',
};

export default function TrainingCard({ training, onStartAssessment, onViewDetails }: TrainingCardProps) {
  const config = statusConfig[training.status];
  const StatusIcon = config.icon;
  
  // Get user language preferences
  const { primaryLanguage, autoTranslate } = useLanguagePreferences();
  
  // Translate training name and description
  const { 
    translatedText: translatedName, 
    isLoading: nameLoading 
  } = useTranslation(
    training.name, 
    primaryLanguage, 
    'training',
    { enabled: autoTranslate }
  );
  
  const { 
    translatedText: translatedDescription, 
    isLoading: descriptionLoading 
  } = useTranslation(
    training.description, 
    primaryLanguage, 
    'training',
    { enabled: autoTranslate }
  );
  
  const { 
    translatedText: translatedCategory 
  } = useTranslation(
    training.category, 
    primaryLanguage, 
    'training',
    { enabled: autoTranslate }
  );

  const handleStartAssessment = () => {
    console.log('Starting assessment for training:', training.name);
    onStartAssessment?.(training.id);
  };

  const handleViewDetails = () => {
    console.log('Viewing details for training:', training.name);
    onViewDetails?.(training.id);
  };

  return (
    <Card 
      className={`hover-elevate transition-all duration-200 ${config.bgColor}`}
      data-testid={`training-card-${training.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              {nameLoading ? (
                <div className="flex items-center gap-2">
                  <Languages className="h-4 w-4 animate-pulse text-muted-foreground" />
                  <span className="animate-pulse">{training.name}</span>
                </div>
              ) : (
                translatedName || training.name
              )}
              {training.isSafetyCritical && (
                <Badge variant="destructive" className="text-xs">
                  Safety Critical
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              <span>{translatedCategory || training.category}</span>
              <span className="text-xs">•</span>
              <span className="capitalize">{training.level} Level</span>
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <StatusIcon className={`h-5 w-5 ${config.color}`} />
            <div 
              className={`w-3 h-3 rounded-full ${levelColors[training.level]}`}
              title={`${training.level} level`}
            />
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {descriptionLoading ? (
            <span className="flex items-center gap-2 animate-pulse">
              <Languages className="h-3 w-3" />
              {training.description}
            </span>
          ) : (
            translatedDescription || training.description
          )}
        </p>

        {training.status === 'in_progress' && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{training.progress}%</span>
            </div>
            <Progress value={training.progress} className="h-2" />
          </div>
        )}

        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
          {training.lastAssessed && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>Last assessed: {training.lastAssessed}</span>
            </div>
          )}
          {training.expiryDate && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>Expires: {training.expiryDate}</span>
            </div>
          )}
          {training.assessor && (
            <div className="flex items-center gap-2">
              <span>Assessor: {training.assessor}</span>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleViewDetails}
            data-testid={`button-view-details-${training.id}`}
          >
            View Details
          </Button>
          {training.status !== 'completed' && (
            <Button 
              size="sm" 
              onClick={handleStartAssessment}
              data-testid={`button-start-assessment-${training.id}`}
            >
              {training.status === 'not_started' ? 'Start Assessment' : 'Continue Assessment'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
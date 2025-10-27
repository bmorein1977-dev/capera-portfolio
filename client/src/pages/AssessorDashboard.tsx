import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { 
  ClipboardCheck, 
  Search,
  Filter,
  Download,
  AlertCircle,
  CheckCircle,
  Clock,
  User,
  Calendar
} from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';

interface CandidateAllocation {
  id: number;
  candidateId: string;
  candidateName: string;
  candidateEmail?: string;
  location?: string;
  jobRole?: string;
  allocatedDate: string;
  isActive: boolean;
}

interface Assessment {
  id: number;
  candidateId: string;
  elementId: number;
  elementName?: string;
  assessmentDate: string;
  outcome: 'competent' | 'not_yet_competent' | 'competent_with_minor_needs';
  expiryDate?: string;
  comments?: string;
  isActive: boolean;
}

type ExpiryStatus = 'expired' | 'expiring_soon' | 'valid' | 'not_yet_competent';

interface AssessmentWithExpiry extends Assessment {
  expiryStatus: ExpiryStatus;
  daysUntilExpiry?: number;
}

export default function AssessorDashboard() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState('all');
  const [jobRoleFilter, setJobRoleFilter] = useState('all');
  const [expiryFilter, setExpiryFilter] = useState('all');

  // Fetch candidate allocations
  const { data: allocations = [], isLoading: allocationsLoading } = useQuery<CandidateAllocation[]>({
    queryKey: ['/api/candidate-allocations'],
    enabled: !!user,
  });

  // Fetch assessments for the assessor
  const { data: assessments = [], isLoading: assessmentsLoading } = useQuery<Assessment[]>({
    queryKey: ['/api/assessments'],
    enabled: !!user,
  });

  // Calculate expiry status for each assessment
  const assessmentsWithExpiry: AssessmentWithExpiry[] = assessments.map(assessment => {
    let expiryStatus: ExpiryStatus = 'not_yet_competent';
    let daysUntilExpiry: number | undefined;

    if (assessment.outcome === 'not_yet_competent') {
      expiryStatus = 'not_yet_competent';
    } else if (assessment.expiryDate) {
      const expiry = parseISO(assessment.expiryDate);
      const today = new Date();
      daysUntilExpiry = differenceInDays(expiry, today);

      if (daysUntilExpiry < 0) {
        expiryStatus = 'expired';
      } else if (daysUntilExpiry <= 90) {
        expiryStatus = 'expiring_soon';
      } else {
        expiryStatus = 'valid';
      }
    } else {
      expiryStatus = 'valid';
    }

    return {
      ...assessment,
      expiryStatus,
      daysUntilExpiry,
    };
  });

  // Group assessments by candidate
  const candidateAssessments = allocations.map(allocation => {
    const candidateAssmts = assessmentsWithExpiry.filter(
      a => a.candidateId === allocation.candidateId && a.isActive
    );

    // Calculate aggregate status
    const expiredCount = candidateAssmts.filter(a => a.expiryStatus === 'expired').length;
    const expiringSoonCount = candidateAssmts.filter(a => a.expiryStatus === 'expiring_soon').length;
    const notYetCompetentCount = candidateAssmts.filter(a => a.expiryStatus === 'not_yet_competent').length;
    const validCount = candidateAssmts.filter(a => a.expiryStatus === 'valid').length;

    // Default to not_yet_competent if no assessments or no competent assessments
    let overallStatus: ExpiryStatus = 'not_yet_competent';
    
    // If candidate has assessments, determine status based on priority
    if (candidateAssmts.length > 0) {
      if (expiredCount > 0) {
        overallStatus = 'expired';
      } else if (expiringSoonCount > 0) {
        overallStatus = 'expiring_soon';
      } else if (validCount > 0) {
        overallStatus = 'valid';
      }
      // else remains not_yet_competent if all assessments are not_yet_competent
    }

    return {
      ...allocation,
      assessments: candidateAssmts,
      overallStatus,
      expiredCount,
      expiringSoonCount,
      notYetCompetentCount,
    };
  });

  // Extract unique locations and job roles for filters
  const uniqueLocations = Array.from(new Set(allocations.map(a => a.location).filter(Boolean)));
  const uniqueJobRoles = Array.from(new Set(allocations.map(a => a.jobRole).filter(Boolean)));

  // Apply filters
  const filteredCandidates = candidateAssessments.filter(candidate => {
    const matchesSearch = candidate.candidateName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (candidate.candidateEmail?.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesLocation = locationFilter === 'all' || candidate.location === locationFilter;
    const matchesJobRole = jobRoleFilter === 'all' || candidate.jobRole === jobRoleFilter;
    const matchesExpiry = expiryFilter === 'all' || candidate.overallStatus === expiryFilter;
    
    return matchesSearch && matchesLocation && matchesJobRole && matchesExpiry;
  });

  const getExpiryBadgeVariant = (status: ExpiryStatus) => {
    switch (status) {
      case 'expired':
        return 'destructive';
      case 'expiring_soon':
        return 'secondary';
      case 'valid':
        return 'default';
      case 'not_yet_competent':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getExpiryIcon = (status: ExpiryStatus) => {
    switch (status) {
      case 'expired':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'expiring_soon':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'valid':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'not_yet_competent':
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
      default:
        return null;
    }
  };

  const getExpiryLabel = (status: ExpiryStatus) => {
    switch (status) {
      case 'expired':
        return 'Expired';
      case 'expiring_soon':
        return 'Expiring Soon';
      case 'valid':
        return 'Valid';
      case 'not_yet_competent':
        return 'Not Yet Competent';
      default:
        return 'Unknown';
    }
  };

  const handleExportToExcel = () => {
    // TODO: Implement Excel export functionality
    console.log('Exporting to Excel...');
  };

  // Statistics
  const totalCandidates = filteredCandidates.length;
  const expiredAssessments = filteredCandidates.reduce((sum, c) => sum + c.expiredCount, 0);
  const expiringSoonAssessments = filteredCandidates.reduce((sum, c) => sum + c.expiringSoonCount, 0);
  const notYetCompetentAssessments = filteredCandidates.reduce((sum, c) => sum + c.notYetCompetentCount, 0);

  if (allocationsLoading || assessmentsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardCheck className="h-8 w-8" />
            Assessor Dashboard
          </h2>
          <p className="text-muted-foreground mt-1">
            Monitor candidate progress and assessment expiry dates
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={handleExportToExcel}
          data-testid="button-export-excel"
        >
          <Download className="h-4 w-4 mr-2" />
          Export to Excel
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Candidates</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCandidates}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expired</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{expiredAssessments}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{expiringSoonAssessments}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Not Yet Competent</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{notYetCompetentAssessments}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
                data-testid="input-search-candidates"
              />
            </div>

            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger data-testid="select-location-filter">
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {uniqueLocations.map(location => (
                  <SelectItem key={location} value={location!}>{location}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={jobRoleFilter} onValueChange={setJobRoleFilter}>
              <SelectTrigger data-testid="select-job-role-filter">
                <SelectValue placeholder="All Job Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Job Roles</SelectItem>
                {uniqueJobRoles.map(role => (
                  <SelectItem key={role} value={role!}>{role}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={expiryFilter} onValueChange={setExpiryFilter}>
              <SelectTrigger data-testid="select-expiry-filter">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="expiring_soon">Expiring Soon (90 days)</SelectItem>
                <SelectItem value="valid">Valid</SelectItem>
                <SelectItem value="not_yet_competent">Not Yet Competent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Candidates List */}
      <div className="space-y-4">
        {filteredCandidates.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <User className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No candidates found</h3>
              <p className="text-muted-foreground text-center">
                {allocations.length === 0 
                  ? "You don't have any candidates allocated yet."
                  : "Try adjusting your filters to see more results."}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredCandidates.map(candidate => (
            <Card key={candidate.id} className="hover-elevate">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback>
                        {candidate.candidateName.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-lg">{candidate.candidateName}</CardTitle>
                      <CardDescription>
                        {candidate.jobRole && <span>{candidate.jobRole}</span>}
                        {candidate.location && <span> • {candidate.location}</span>}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant={getExpiryBadgeVariant(candidate.overallStatus)}>
                    <span className="flex items-center gap-1">
                      {getExpiryIcon(candidate.overallStatus)}
                      {getExpiryLabel(candidate.overallStatus)}
                    </span>
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {candidate.assessments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No assessments recorded</p>
                ) : (
                  <div className="space-y-3">
                    {candidate.assessments.map(assessment => (
                      <div 
                        key={assessment.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-sm">
                              {assessment.elementName || `Element ${assessment.elementId}`}
                            </h4>
                            <Badge variant={getExpiryBadgeVariant(assessment.expiryStatus)} className="text-xs">
                              <span className="flex items-center gap-1">
                                {getExpiryIcon(assessment.expiryStatus)}
                                {getExpiryLabel(assessment.expiryStatus)}
                              </span>
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Assessed: {format(parseISO(assessment.assessmentDate), 'MMM dd, yyyy')}
                            </span>
                            {assessment.expiryDate && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Expires: {format(parseISO(assessment.expiryDate), 'MMM dd, yyyy')}
                                {assessment.daysUntilExpiry !== undefined && assessment.daysUntilExpiry >= 0 && (
                                  <span className="ml-1">({assessment.daysUntilExpiry} days)</span>
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                        <Badge variant="outline">
                          {assessment.outcome.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

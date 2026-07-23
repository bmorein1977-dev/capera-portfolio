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
import { useToast } from '@/hooks/use-toast';
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
import * as XLSX from 'xlsx';

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
  plannedAssessmentDate?: string | null;
  plannedAssessmentLocation?: string | null;
}

type ExpiryStatus = 'expired' | 'expiring_soon' | 'valid' | 'not_yet_competent';

interface AssessmentWithExpiry extends Assessment {
  expiryStatus: ExpiryStatus;
  daysUntilExpiry?: number;
}

interface AssessorVerification {
  id: string;
  candidateId: string;
  candidateName: string;
  candidateLocation: string | null;
  elementName: string;
  verifierName: string;
  outcome: string;
  verificationDate: string;
  verifierComments: string | null;
}

export default function AssessorDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState('all');
  const [jobRoleFilter, setJobRoleFilter] = useState('all');
  const [expiryFilter, setExpiryFilter] = useState('all');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');

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

  // Fetch verifications completed on this assessor's own assessments
  const { data: verifications = [] } = useQuery<AssessorVerification[]>({
    queryKey: [`/api/assessors/${user?.id}/verifications`, { dateFrom: dateFromFilter, dateTo: dateToFilter }],
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
    const candidateAssmts = assessmentsWithExpiry
      .filter(a => a.candidateId === allocation.candidateId && a.isActive)
      // Most overdue/longest expired first; assessments with no expiry date sort last.
      .sort((a, b) => {
        if (a.daysUntilExpiry === undefined && b.daysUntilExpiry === undefined) return 0;
        if (a.daysUntilExpiry === undefined) return 1;
        if (b.daysUntilExpiry === undefined) return -1;
        return a.daysUntilExpiry - b.daysUntilExpiry;
      });

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
  const hasActiveDateFilter = !!dateFromFilter || !!dateToFilter;

  const isWithinDateRange = (dateStr?: string) => {
    if (!dateStr) return true;
    const date = parseISO(dateStr);
    if (dateFromFilter && date < parseISO(dateFromFilter)) return false;
    if (dateToFilter && date > parseISO(dateToFilter)) return false;
    return true;
  };

  // Which of a candidate's assessments match the currently-selected status and date filters -
  // used both to decide whether the candidate should appear at all, and which of their
  // assessments to actually show within their card.
  const getVisibleAssessments = (candidate: (typeof candidateAssessments)[number]) =>
    candidate.assessments.filter(a =>
      (expiryFilter === 'all' || a.expiryStatus === expiryFilter) &&
      (!hasActiveDateFilter || isWithinDateRange(a.assessmentDate))
    );

  const filteredCandidates = candidateAssessments.filter(candidate => {
    const term = searchTerm.trim().toLowerCase();
    // Word-based match against name + email combined, so a full "First Last" search still
    // matches even if the two fields render with different spacing than they're stored with.
    const haystack = `${candidate.candidateName || ''} ${candidate.candidateEmail || ''}`.toLowerCase();
    const matchesSearch = term === '' || term.split(/\s+/).every(word => haystack.includes(word));
    const matchesLocation = locationFilter === 'all' || candidate.location === locationFilter;
    const matchesJobRole = jobRoleFilter === 'all' || candidate.jobRole === jobRoleFilter;
    const matchesExpiry = expiryFilter === 'all' || candidate.overallStatus === expiryFilter;
    // Only require a matching assessment within the date window once a date filter is set -
    // otherwise candidates with zero assessments would vanish from the default view too.
    const matchesDateWindow = !hasActiveDateFilter || getVisibleAssessments(candidate).length > 0;

    return matchesSearch && matchesLocation && matchesJobRole && matchesExpiry && matchesDateWindow;
  });

  // Total completed assessments (filterable by date/location/candidate via the shared filters above)
  const totalCompletedAssessments = filteredCandidates.reduce(
    (sum, c) => sum + c.assessments.filter(a => a.outcome === 'competent' && isWithinDateRange(a.assessmentDate)).length,
    0
  );

  // Assessments planned - across the filtered candidates, soonest first
  const plannedAssessments = filteredCandidates
    .flatMap(c => c.assessments
      .filter(a => a.plannedAssessmentDate)
      .map(a => ({ ...a, candidateName: c.candidateName, candidateLocation: c.location }))
    )
    .sort((a, b) => new Date(a.plannedAssessmentDate!).getTime() - new Date(b.plannedAssessmentDate!).getTime());

  // Verifications completed on this assessor - location filtering happens client-side since
  // it's a candidate attribute, not stored on the verification record itself.
  const filteredVerifications = verifications.filter(v =>
    (locationFilter === 'all' || v.candidateLocation === locationFilter) &&
    (searchTerm === '' || v.candidateName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
        return 'Competent';
      case 'not_yet_competent':
        return 'Not Yet Competent';
      default:
        return 'Unknown';
    }
  };

  const handleExportToExcel = () => {
    try {
      // Prepare data for Excel export
      const exportData: any[] = [];

      filteredCandidates.forEach(candidate => {
        if (candidate.assessments.length === 0) {
          // Add candidate row even if no assessments
          exportData.push({
            'Candidate Name': candidate.candidateName,
            'Email': candidate.candidateEmail || '',
            'Job Role': candidate.jobRole || '',
            'Location': candidate.location || '',
            'Overall Status': getExpiryLabel(candidate.overallStatus),
            'Element Name': '',
            'Assessment Date': '',
            'Outcome': '',
            'Expiry Date': '',
            'Days Until Expiry': '',
            'Assessment Status': '',
          });
        } else {
          // Add row for each assessment
          candidate.assessments.forEach(assessment => {
            exportData.push({
              'Candidate Name': candidate.candidateName,
              'Email': candidate.candidateEmail || '',
              'Job Role': candidate.jobRole || '',
              'Location': candidate.location || '',
              'Overall Status': getExpiryLabel(candidate.overallStatus),
              'Element Name': assessment.elementName || `Element ${assessment.elementId}`,
              'Assessment Date': format(parseISO(assessment.assessmentDate), 'MMM dd, yyyy'),
              'Outcome': assessment.outcome.replace(/_/g, ' '),
              'Expiry Date': assessment.expiryDate 
                ? format(parseISO(assessment.expiryDate), 'MMM dd, yyyy') 
                : 'N/A',
              'Days Until Expiry': assessment.daysUntilExpiry !== undefined && assessment.daysUntilExpiry >= 0
                ? assessment.daysUntilExpiry.toString()
                : 'N/A',
              'Assessment Status': getExpiryLabel(assessment.expiryStatus),
            });
          });
        }
      });

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      const columnWidths = [
        { wch: 25 }, // Candidate Name
        { wch: 30 }, // Email
        { wch: 20 }, // Job Role
        { wch: 20 }, // Location
        { wch: 18 }, // Overall Status
        { wch: 30 }, // Element Name
        { wch: 15 }, // Assessment Date
        { wch: 25 }, // Outcome
        { wch: 15 }, // Expiry Date
        { wch: 18 }, // Days Until Expiry
        { wch: 20 }, // Assessment Status
      ];
      worksheet['!cols'] = columnWidths;

      // Create workbook
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Assessor Dashboard');

      // Generate filename with timestamp
      const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
      const filename = `Assessor_Dashboard_Export_${timestamp}.xlsx`;

      // Download file
      XLSX.writeFile(workbook, filename);

      toast({
        title: 'Export Successful',
        description: `Downloaded ${exportData.length} rows to ${filename}`,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export Failed',
        description: 'An error occurred while exporting to Excel',
        variant: 'destructive',
      });
    }
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
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totalCompletedAssessments}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Planned</CardTitle>
            <Calendar className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{plannedAssessments.length}</div>
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
                <SelectItem value="valid">Competent</SelectItem>
                <SelectItem value="not_yet_competent">Not Yet Competent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Completed From</label>
              <Input
                type="date"
                value={dateFromFilter}
                onChange={(e) => setDateFromFilter(e.target.value)}
                data-testid="input-date-from-filter"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Completed To</label>
              <Input
                type="date"
                value={dateToFilter}
                onChange={(e) => setDateToFilter(e.target.value)}
                data-testid="input-date-to-filter"
              />
            </div>
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
                {(() => {
                  const visibleAssessments = getVisibleAssessments(candidate);
                  return visibleAssessments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {candidate.assessments.length === 0 ? 'No assessments recorded' : 'No assessments match the selected filters'}
                    </p>
                  ) : (
                  <div className="space-y-3">
                    {visibleAssessments.map(assessment => (
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
                  );
                })()}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Assessments Planned */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Assessments Planned
          </CardTitle>
          <CardDescription>Scheduled assessments for your filtered candidates, soonest first</CardDescription>
        </CardHeader>
        <CardContent>
          {plannedAssessments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No assessments currently scheduled</p>
          ) : (
            <div className="space-y-2">
              {plannedAssessments.map(a => (
                <div key={a.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`planned-assessment-${a.id}`}>
                  <div>
                    <span className="font-medium text-sm">{a.candidateName}</span>
                    <span className="text-sm text-muted-foreground"> — {a.elementName || `Element ${a.elementId}`}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(parseISO(a.plannedAssessmentDate!), 'MMM dd, yyyy p')}
                    </span>
                    {a.plannedAssessmentLocation && <span>{a.plannedAssessmentLocation}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Verifications */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Verifications
          </CardTitle>
          <CardDescription>Verifications completed on your assessments, and their outcomes</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredVerifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">No verifications recorded for the current filters</p>
          ) : (
            <div className="space-y-2">
              {filteredVerifications.map(v => (
                <div key={v.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`verification-${v.id}`}>
                  <div>
                    <span className="font-medium text-sm">{v.candidateName}</span>
                    <span className="text-sm text-muted-foreground"> — {v.elementName}</span>
                    <div className="text-xs text-muted-foreground mt-0.5">Verified by {v.verifierName} on {format(parseISO(v.verificationDate), 'MMM dd, yyyy')}</div>
                  </div>
                  <Badge variant={v.outcome === 'agreed' ? 'default' : v.outcome === 'disagreed' ? 'destructive' : 'secondary'}>
                    {v.outcome.replace(/_/g, ' ')}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

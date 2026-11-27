import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { INTERNAL_VERIFICATION_CHECKLIST } from '@shared/schema';
import {
  ClipboardCheck,
  Search,
  Filter,
  Download,
  AlertCircle,
  CheckCircle,
  Clock,
  User,
  Calendar,
  UserCheck,
  ShieldCheck
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { daysUntil, decisionTime, isValidStatus, statusFromExpiry, COMPETENT_OUTCOMES } from '@shared/competence';
import * as XLSX from 'xlsx';

interface CandidateAllocation {
  id: number;
  candidateId: string;
  candidateName: string;
  candidateEmail?: string;
  candidateProfileImageUrl?: string | null;
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
  candidateReadyAt?: string | null;
  selfAssessmentCompletedAt?: string | null;
  selfAssessmentScorePercent?: number | null;
  signOffAt?: string | null;
  verificationStatus?: string | null;
  /** sent by the server: whether a result has been recorded, and when a pass runs out */
  decided?: boolean;
  effectiveExpiry?: string | null;
}

// the badge follows where the verification stands: only an agreement verifies
const VERIFICATION_BADGE: Record<string, { label: string; colour: string }> = {
  verified: { label: 'Verified', colour: 'bg-green-700 hover:bg-green-700' },
  action_required: { label: 'Verifier: action required', colour: 'bg-red-700 hover:bg-red-700' },
  resubmitted: { label: 'Back with verifier', colour: 'bg-orange-600 hover:bg-orange-600' },
};

const isPass = (a: Assessment) => !!a.decided && (COMPETENT_OUTCOMES as readonly string[]).includes(a.outcome);

// 'open' is an assessment nobody has decided yet: it is not a "not yet competent" result
type ExpiryStatus = 'expired' | 'expiring_soon' | 'valid' | 'not_yet_competent' | 'open';
// A candidate's overall status is a summary across ALL their assessments, so it needs one more
// state than a single assessment can be in: "in_progress" covers a mix of some complete and
// some not-yet-competent, which used to get misreported as fully "Competent" just because at
// least one assessment happened to be valid.
type OverallStatus = ExpiryStatus | 'in_progress';

interface AssessmentWithExpiry extends Assessment {
  expiryStatus: ExpiryStatus;
  daysUntilExpiry?: number;
}

interface AssessorVerification {
  id: string;
  assessmentId: string;
  candidateId: string;
  candidateName: string;
  candidateLocation: string | null;
  elementName: string;
  verifierName: string;
  outcome: string;
  verificationDate: string;
  verifierComments: string | null;
  acknowledgedAt: string | null;
  verificationType: string | null;
  assessmentLocation: string | null;
  samplingRateAtVerification: number | null;
  technicalExpertName: string | null;
  checklistAnswers: Record<string, 'yes' | 'no' | 'na'> | null;
  developmentNeedsRequired: boolean | null;
  developmentNeedsPlan: string | null;
  actionRequired?: boolean;
  assessmentVerificationStatus?: string | null;
  resolutionAction?: string | null;
  resolutionNote?: string | null;
  resolvedAt?: string | null;
}

export default function AssessorDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState('all');
  const [jobRoleFilter, setJobRoleFilter] = useState('all');
  const [expiryFilter, setExpiryFilter] = useState('all');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [selectedVerification, setSelectedVerification] = useState<AssessorVerification | null>(null);
  const [acknowledgeComment, setAcknowledgeComment] = useState('');
  const [resolutionAction, setResolutionAction] = useState('evidence_added');
  const [resolutionNote, setResolutionNote] = useState('');
  const resolveMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('POST', `/api/verifications/${id}/resolve`, { action: resolutionAction, note: resolutionNote }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/assessors/${user?.id}/verifications`] });
      toast({ title: "Sent back to the verifier", description: "The assessment is in the verification queue again." });
      setSelectedVerification(null);
      setResolutionNote('');
    },
    onError: (error: any) => toast({ title: "Not sent", description: error.message || "The response could not be recorded.", variant: "destructive" }),
  });

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

  const acknowledgeMutation = useMutation({
    mutationFn: async ({ id, comment }: { id: string; comment: string }) => {
      return await apiRequest('PATCH', `/api/verifications/${id}/acknowledge`, { comment });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/assessors/${user?.id}/verifications`] });
      toast({
        title: "Verification Acknowledged",
        description: "Your comment has been added to the assessment's feedback thread.",
      });
      setSelectedVerification(null);
      setAcknowledgeComment('');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to acknowledge verification.",
        variant: "destructive",
      });
    },
  });

  // One result for each person and standard: the latest decision. Earlier decisions it replaced are history, not things to act on.
  // Open assessments (including planned reassessments) are listed beside it.
  const latestDecision = new Map<string, Assessment>();
  for (const a of assessments) {
    if (!a.decided) continue;
    const key = `${a.candidateId}:${a.elementId}`;
    const held = latestDecision.get(key);
    if (!held || decisionTime(a) > decisionTime(held)) latestDecision.set(key, a);
  }

  // Where each of those stands
  const assessmentsWithExpiry: AssessmentWithExpiry[] = assessments
    .filter(a => !a.decided || latestDecision.get(`${a.candidateId}:${a.elementId}`) === a)
    .map(assessment => {
      let expiryStatus: ExpiryStatus = 'open';
      let daysUntilExpiry: number | undefined;
      const expiry = isPass(assessment) && assessment.effectiveExpiry ? parseISO(assessment.effectiveExpiry) : null;

      if (isPass(assessment)) {
        const status = statusFromExpiry(expiry, new Date());
        expiryStatus = !isValidStatus(status) ? 'expired' : status === 'current' ? 'valid' : 'expiring_soon';
        if (expiry) daysUntilExpiry = daysUntil(expiry, new Date());
      } else if (assessment.decided) {
        expiryStatus = 'not_yet_competent';
      }

      return {
        ...assessment,
        expiryDate: expiry ? expiry.toISOString() : undefined,
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
    const openCount = candidateAssmts.filter(a => a.expiryStatus === 'open').length;

    // until something has been decided, nothing has been assessed
    let overallStatus: OverallStatus = 'open';

    // If candidate has assessments, determine status based on priority
    if (candidateAssmts.length > 0) {
      if (expiredCount > 0) {
        overallStatus = 'expired';
      } else if (expiringSoonCount > 0) {
        overallStatus = 'expiring_soon';
      } else if (validCount > 0 && (notYetCompetentCount > 0 || openCount > 0)) {
        // A mix of complete and not-yet-competent is neither fully "Competent" nor
        // "Not Yet Competent" - it's still being worked through.
        overallStatus = 'in_progress';
      } else if (validCount > 0) {
        overallStatus = 'valid';
      } else if (notYetCompetentCount > 0) {
        overallStatus = 'not_yet_competent';
      }
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
      // "in_progress" is a candidate-level summary, not something a single assessment can be -
      // once a candidate matches that overall filter, show all of their assessments unfiltered.
      (expiryFilter === 'all' || expiryFilter === 'in_progress' || a.expiryStatus === expiryFilter) &&
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
    (sum, c) => sum + c.assessments.filter(a => isPass(a) && isWithinDateRange(a.signOffAt ?? a.assessmentDate)).length,
    0
  );

  // Assessments planned - across the filtered candidates, soonest first
  const plannedAssessments = filteredCandidates
    .flatMap(c => c.assessments
      .filter(a => !a.decided && a.plannedAssessmentDate)
      .map(a => ({ ...a, candidateName: c.candidateName, candidateLocation: c.location }))
    )
    .sort((a, b) => new Date(a.plannedAssessmentDate!).getTime() - new Date(b.plannedAssessmentDate!).getTime());

  // Candidates who've marked themselves ready but haven't been scheduled yet - across the
  // filtered candidates, longest-waiting first. This is the only dashboard surface for
  // candidateReadyAt; previously an assessor's only cue was the notification email.
  const readyAssessments = filteredCandidates
    .flatMap(c => c.assessments
      .filter(a => !a.decided && a.candidateReadyAt && !a.plannedAssessmentDate)
      .map(a => ({ ...a, candidateName: c.candidateName, candidateLocation: c.location }))
    )
    .sort((a, b) => new Date(a.candidateReadyAt!).getTime() - new Date(b.candidateReadyAt!).getTime());

  // Candidates who've completed their knowledge self-assessment but the assessment hasn't been
  // signed off yet - across the filtered candidates, most recently completed first.
  const selfAssessedCandidates = filteredCandidates
    .flatMap(c => c.assessments
      .filter(a => !a.decided && a.selfAssessmentCompletedAt)
      .map(a => ({ ...a, candidateName: c.candidateName, candidateLocation: c.location }))
    )
    .sort((a, b) => new Date(b.selfAssessmentCompletedAt!).getTime() - new Date(a.selfAssessmentCompletedAt!).getTime());

  // Verifications completed on this assessor - location filtering happens client-side since
  // it's a candidate attribute, not stored on the verification record itself.
  const filteredVerifications = verifications.filter(v =>
    (locationFilter === 'all' || v.candidateLocation === locationFilter) &&
    (searchTerm === '' || v.candidateName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getExpiryBadgeVariant = (status: OverallStatus) => {
    switch (status) {
      case 'expired':
        return 'destructive';
      case 'expiring_soon':
        return 'secondary';
      case 'valid':
        return 'default';
      case 'in_progress':
        return 'secondary';
      case 'not_yet_competent':
        return 'outline';
      default:
        return 'outline';
    }
  };

  // "In Progress" needs a color distinct from "Competent" (blue/default) - secondary alone
  // renders too close to "Expiring Soon", so give it its own class like the other custom badges.
  const getExpiryBadgeClassName = (status: OverallStatus) => {
    if (status === 'in_progress') {
      return 'bg-orange-500 text-white hover:bg-orange-500 dark:bg-orange-500';
    }
    return undefined;
  };

  const getExpiryIcon = (status: OverallStatus) => {
    switch (status) {
      case 'expired':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'expiring_soon':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'valid':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'in_progress':
        return <Clock className="h-4 w-4" />;
      case 'not_yet_competent':
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
      case 'open':
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      default:
        return null;
    }
  };

  const getExpiryLabel = (status: OverallStatus) => {
    switch (status) {
      case 'expired':
        return 'Expired';
      case 'expiring_soon':
        return 'Expiring Soon';
      case 'valid':
        return 'Competent';
      case 'in_progress':
        return 'In Progress';
      case 'not_yet_competent':
        return 'Not Yet Competent';
      case 'open':
        return 'Not Yet Assessed';
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
              'Assessment Date': assessment.decided && (assessment.signOffAt ?? assessment.assessmentDate)
                ? format(parseISO((assessment.signOffAt ?? assessment.assessmentDate)!), 'MMM dd, yyyy')
                : '',
              'Outcome': assessment.decided ? assessment.outcome.replace(/_/g, ' ') : '',
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

  // Which verifications haven't been acknowledged yet - surfaced as a prominent stat card since a
  // verification landing is something the assessor needs to notice, not just a passive record.
  const unacknowledgedVerifications = verifications.filter(v => !v.acknowledgedAt);

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
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4">
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

        <Card className={readyAssessments.length > 0 ? 'border-purple-400' : undefined}>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ready for Assessment</CardTitle>
            <UserCheck className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600" data-testid="stat-ready-for-assessment">{readyAssessments.length}</div>
          </CardContent>
        </Card>

        <Card className={selfAssessedCandidates.length > 0 ? 'border-teal-400' : undefined}>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Self-Assessment Completed</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-teal-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-teal-600" data-testid="stat-self-assessment-completed">{selfAssessedCandidates.length}</div>
          </CardContent>
        </Card>

        <Card className={unacknowledgedVerifications.length > 0 ? 'border-orange-400' : undefined}>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Verifications</CardTitle>
            <ShieldCheck className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600" data-testid="stat-new-verifications">{unacknowledgedVerifications.length}</div>
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
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="not_yet_competent">Not Yet Competent</SelectItem>
                <SelectItem value="open">Not Yet Assessed</SelectItem>
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
                      <AvatarImage src={candidate.candidateProfileImageUrl || undefined} alt={candidate.candidateName} />
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
                  <Badge variant={getExpiryBadgeVariant(candidate.overallStatus)} className={getExpiryBadgeClassName(candidate.overallStatus)}>
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
                        className="flex items-center justify-between p-3 border rounded-lg hover-elevate cursor-pointer"
                        onClick={() => navigate(`/assessor-workspace?candidateId=${candidate.candidateId}&assessmentId=${assessment.id}`)}
                        data-testid={`link-assessment-${assessment.id}`}
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
                            {assessment.candidateReadyAt && !assessment.plannedAssessmentDate && (
                              <Badge className="bg-purple-600 text-white hover:bg-purple-600 dark:bg-purple-600 text-xs" data-testid={`badge-ready-${assessment.id}`}>
                                Ready for Assessment
                              </Badge>
                            )}
                            {assessment.verificationStatus && VERIFICATION_BADGE[assessment.verificationStatus] && (
                              <Badge className={`${VERIFICATION_BADGE[assessment.verificationStatus].colour} text-white text-xs gap-1`} data-testid={`badge-verified-${assessment.id}`}>
                                <ShieldCheck className="h-3 w-3" />
                                {VERIFICATION_BADGE[assessment.verificationStatus].label}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            {(assessment.signOffAt ?? assessment.assessmentDate) && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {assessment.decided ? 'Assessed' : 'Assigned'}: {format(parseISO((assessment.decided ? assessment.signOffAt ?? assessment.assessmentDate : assessment.assessmentDate ?? assessment.signOffAt)!), 'MMM dd, yyyy')}
                              </span>
                            )}
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
                        {assessment.decided && (
                          <Badge variant="outline">
                            {assessment.outcome.replace(/_/g, ' ')}
                          </Badge>
                        )}
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

      {/* Ready for Assessment - candidates who've marked themselves ready and submitted evidence,
          but haven't been scheduled yet. Click-through lands directly on the assessment so the
          evidence is immediately visible, rather than jumping straight into the schedule dialog. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Ready for Assessment
          </CardTitle>
          <CardDescription>Candidates who've marked themselves ready and submitted evidence, not yet scheduled</CardDescription>
        </CardHeader>
        <CardContent>
          {readyAssessments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No candidates are currently waiting to be scheduled</p>
          ) : (
            <div className="space-y-2">
              {readyAssessments.map(a => (
                <div
                  key={a.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover-elevate cursor-pointer"
                  onClick={() => navigate(`/assessor-workspace?candidateId=${a.candidateId}&assessmentId=${a.id}`)}
                  data-testid={`ready-assessment-${a.id}`}
                >
                  <div>
                    <span className="font-medium text-sm">{a.candidateName}</span>
                    <span className="text-sm text-muted-foreground"> — {a.elementName || `Element ${a.elementId}`}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <Badge className="bg-purple-600 text-white hover:bg-purple-600 dark:bg-purple-600">Ready</Badge>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Since {format(parseISO(a.candidateReadyAt!), 'MMM dd, yyyy')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Self-Assessment Completed - candidates who've finished their knowledge self-assessment
          quiz, not yet signed off. Click-through lands on the assessment so the results are
          immediately visible. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Self-Assessment Completed
          </CardTitle>
          <CardDescription>Candidates who've completed their knowledge self-assessment, not yet signed off</CardDescription>
        </CardHeader>
        <CardContent>
          {selfAssessedCandidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No candidates have pending self-assessment results to review</p>
          ) : (
            <div className="space-y-2">
              {selfAssessedCandidates.map(a => (
                <div
                  key={a.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover-elevate cursor-pointer"
                  onClick={() => navigate(`/assessor-workspace?candidateId=${a.candidateId}&assessmentId=${a.id}`)}
                  data-testid={`self-assessed-${a.id}`}
                >
                  <div>
                    <span className="font-medium text-sm">{a.candidateName}</span>
                    <span className="text-sm text-muted-foreground"> — {a.elementName || `Element ${a.elementId}`}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <Badge className="bg-teal-600 text-white hover:bg-teal-600 dark:bg-teal-600">
                      {a.selfAssessmentScorePercent !== null && a.selfAssessmentScorePercent !== undefined ? `${a.selfAssessmentScorePercent}% score` : 'Review needed'}
                    </Badge>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(parseISO(a.selfAssessmentCompletedAt!), 'MMM dd, yyyy')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
                <div
                  key={a.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover-elevate cursor-pointer"
                  onClick={() => navigate(`/assessor-workspace?candidateId=${a.candidateId}&assessmentId=${a.id}&action=schedule`)}
                  data-testid={`planned-assessment-${a.id}`}
                >
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
                <div
                  key={v.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover-elevate cursor-pointer"
                  onClick={() => { setSelectedVerification(v); setAcknowledgeComment(''); }}
                  data-testid={`verification-${v.id}`}
                >
                  <div>
                    <span className="font-medium text-sm">{v.candidateName}</span>
                    <span className="text-sm text-muted-foreground"> — {v.elementName}</span>
                    <div className="text-xs text-muted-foreground mt-0.5">Verified by {v.verifierName} on {format(parseISO(v.verificationDate), 'MMM dd, yyyy')}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {v.actionRequired && (
                      <Badge variant="destructive" data-testid={`badge-action-required-${v.id}`}>Action required</Badge>
                    )}
                    {!v.acknowledgedAt && (
                      <Badge className="bg-orange-500 text-white hover:bg-orange-500 dark:bg-orange-500">Unacknowledged</Badge>
                    )}
                    <Badge variant={v.outcome === 'agreed' ? 'default' : v.outcome === 'disagreed' ? 'destructive' : 'secondary'}>
                      {v.outcome.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedVerification} onOpenChange={(open) => { if (!open) setSelectedVerification(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-0">
          <DialogHeader>
            <DialogTitle>Verification Details</DialogTitle>
            <DialogDescription>
              {selectedVerification?.candidateName} — {selectedVerification?.elementName}
            </DialogDescription>
          </DialogHeader>
          {selectedVerification && (
            <ScrollArea className="h-[calc(85vh-180px)] pr-4">
              <div className="space-y-4 pb-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={selectedVerification.outcome === 'agreed' ? 'default' : selectedVerification.outcome === 'disagreed' ? 'destructive' : 'secondary'}>
                    {selectedVerification.outcome.replace(/_/g, ' ')}
                  </Badge>
                  {selectedVerification.verificationType && (
                    <Badge variant="outline">{selectedVerification.verificationType}</Badge>
                  )}
                  {!selectedVerification.acknowledgedAt && (
                    <Badge className="bg-orange-500 text-white hover:bg-orange-500 dark:bg-orange-500">Unacknowledged</Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  Verified by {selectedVerification.verifierName} on {format(parseISO(selectedVerification.verificationDate), 'PPP')}
                </div>

                {(selectedVerification.assessmentLocation || selectedVerification.technicalExpertName || selectedVerification.samplingRateAtVerification !== null) && (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {selectedVerification.assessmentLocation && (
                      <div><Label className="text-muted-foreground">Location</Label><p>{selectedVerification.assessmentLocation}</p></div>
                    )}
                    {selectedVerification.technicalExpertName && (
                      <div><Label className="text-muted-foreground">Technical Expert / SME</Label><p>{selectedVerification.technicalExpertName}</p></div>
                    )}
                    {selectedVerification.samplingRateAtVerification !== null && (
                      <div><Label className="text-muted-foreground">Sampling Rate</Label><p>{selectedVerification.samplingRateAtVerification}%</p></div>
                    )}
                  </div>
                )}

                {selectedVerification.checklistAnswers && (
                  <>
                    <Separator />
                    <div className="space-y-1">
                      <Label className="text-muted-foreground">Verification Outcomes</Label>
                      {INTERNAL_VERIFICATION_CHECKLIST.map((c) => (
                        <div key={c.item} className="flex items-center justify-between text-sm gap-4">
                          <span className="flex-1">{c.item}. {c.question}</span>
                          <Badge variant="outline" className="uppercase shrink-0">{selectedVerification.checklistAnswers?.[String(c.item)] || 'na'}</Badge>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {selectedVerification.verifierComments && (
                  <div>
                    <Label>Verifier's Comments</Label>
                    <p className="text-sm mt-1 p-3 border rounded-lg bg-muted/50">{selectedVerification.verifierComments}</p>
                  </div>
                )}

                {selectedVerification.developmentNeedsRequired && (
                  <div>
                    <Label className="text-muted-foreground">Development Needs Identified</Label>
                    {selectedVerification.developmentNeedsPlan && (
                      <p className="text-sm mt-1 p-3 border rounded-lg bg-muted/50">{selectedVerification.developmentNeedsPlan}</p>
                    )}
                  </div>
                )}

                {selectedVerification.actionRequired && (
                  <div className="space-y-2 rounded-lg border border-destructive/50 p-3" data-testid="panel-resolve-verification">
                    <Label className="font-semibold">Action required</Label>
                    <p className="text-sm text-muted-foreground">This assessment is not verified. Say what you have done, then send it back to the verifier. If the competence decision itself must change, sign the assessment off again instead.</p>
                    <select className="w-full rounded-md border bg-background p-2 text-sm" value={resolutionAction} onChange={(e) => setResolutionAction(e.target.value)} aria-label="What was done" data-testid="select-resolution-action">
                      <option value="evidence_added">More evidence has been added</option>
                      <option value="record_corrected">The record has been corrected</option>
                      <option value="reassessed">The candidate has been assessed again</option>
                      <option value="explained">The decision is explained below</option>
                    </select>
                    <Textarea placeholder="What did you do?" value={resolutionNote} onChange={(e) => setResolutionNote(e.target.value)} data-testid="input-resolution-note" />
                    <Button size="sm" disabled={resolveMutation.isPending || resolutionNote.trim().length < 10} onClick={() => resolveMutation.mutate(selectedVerification.id)} data-testid="button-resolve-verification">
                      {resolveMutation.isPending ? 'Sending...' : 'Send back to verifier'}
                    </Button>
                  </div>
                )}
                {selectedVerification.resolvedAt && (
                  <div>
                    <Label className="text-muted-foreground">Assessor's response, {format(parseISO(selectedVerification.resolvedAt), 'PPP')}</Label>
                    <p className="text-sm mt-1 p-3 border rounded-lg bg-muted/50">{(selectedVerification.resolutionAction || '').replace(/_/g, ' ')}: {selectedVerification.resolutionNote}</p>
                  </div>
                )}

                {selectedVerification.acknowledgedAt ? (
                  <p className="text-sm text-muted-foreground">Acknowledged on {format(parseISO(selectedVerification.acknowledgedAt), 'PPP')}</p>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="acknowledge-comment">Your Comment (optional)</Label>
                    <Textarea
                      id="acknowledge-comment"
                      placeholder="Add a comment for the candidate/verifier..."
                      value={acknowledgeComment}
                      onChange={(e) => setAcknowledgeComment(e.target.value)}
                      data-testid="input-acknowledge-comment"
                    />
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedVerification(null)}>
              Close
            </Button>
            {selectedVerification && !selectedVerification.acknowledgedAt && (
              <Button
                onClick={() => acknowledgeMutation.mutate({ id: selectedVerification.id, comment: acknowledgeComment })}
                disabled={acknowledgeMutation.isPending}
                data-testid="button-acknowledge-verification"
              >
                {acknowledgeMutation.isPending ? 'Acknowledging...' : 'Acknowledge'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

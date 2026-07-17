import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import type {
  TrainingMatrixImportSummary,
  PendingTrainingLinkChange,
  PendingTrainingLinkConflict,
  PendingElementLinkSuggestion,
  ApplyTrainingMatrixPendingRequest,
} from "@shared/schema";

const REQUIREMENT_LEVEL_LABELS: Record<string, string> = {
  M: "Mandatory",
  R: "Role Specific",
  D: "Discretionary",
};

function levelBadge(level: string | null) {
  if (level === null) return <Badge variant="outline">Removed</Badge>;
  return <Badge variant="secondary">{REQUIREMENT_LEVEL_LABELS[level] || level}</Badge>;
}

type BucketKey = keyof ApplyTrainingMatrixPendingRequest;

const BUCKET_LABELS: Record<BucketKey, string> = {
  trainingLinkChanges: "Training requirement changes",
  trainingLinkRemovals: "Training requirements no longer in the matrix",
  elementLinkAdditions: "Suggested new competence element requirements",
  elementLinkChanges: "Suggested competence element requirement changes",
  elementLinkRemovals: "Suggested competence element requirement removals",
};

const BUCKET_ORDER: BucketKey[] = [
  "trainingLinkChanges",
  "trainingLinkRemovals",
  "elementLinkAdditions",
  "elementLinkChanges",
  "elementLinkRemovals",
];

const EMPTY_SELECTION: Record<BucketKey, Set<number>> = {
  trainingLinkChanges: new Set(),
  trainingLinkRemovals: new Set(),
  elementLinkAdditions: new Set(),
  elementLinkChanges: new Set(),
  elementLinkRemovals: new Set(),
};

function sortByRole<T extends { roleName: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.roleName.localeCompare(b.roleName));
}

export default function TrainingMatrixImport() {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [applying, setApplying] = useState(false);
  const [summary, setSummary] = useState<TrainingMatrixImportSummary | null>(null);
  const [selected, setSelected] = useState<Record<BucketKey, Set<number>>>(EMPTY_SELECTION);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith(".xlsx") && !selectedFile.name.endsWith(".xls")) {
        toast({
          title: "Invalid File",
          description: "Please select an Excel file (.xlsx or .xls)",
          variant: "destructive",
        });
        return;
      }
      setFile(selectedFile);
      setSummary(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    setSummary(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/training-import/matrix", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.details || result.error || "Import failed");
      }

      setSummary(result);
      setSelected(EMPTY_SELECTION);
      toast({
        title: "Import Complete",
        description: `Processed ${result.sheetsProcessed.length} sheet(s). ${result.jobRolesCreated} new job roles, ${result.trainingsCreated} new training courses, ${result.roleTrainingLinksCreated} new role requirements applied directly. Review the proposed changes below before applying anything else.`,
      });
    } catch (error: any) {
      toast({
        title: "Import Failed",
        description: error.message || "An error occurred during import",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const toggleItem = (bucket: BucketKey, index: number) => {
    setSelected(prev => {
      const next = new Set(prev[bucket]);
      if (next.has(index)) next.delete(index); else next.add(index);
      return { ...prev, [bucket]: next };
    });
  };

  const toggleAllInBucket = (bucket: BucketKey, items: unknown[]) => {
    setSelected(prev => {
      const allSelected = prev[bucket].size === items.length;
      return { ...prev, [bucket]: allSelected ? new Set() : new Set(items.map((_, i) => i)) };
    });
  };

  const totalSelected = BUCKET_ORDER.reduce((sum, bucket) => sum + selected[bucket].size, 0);

  const handleApply = async () => {
    if (!summary) return;
    setApplying(true);

    try {
      const payload: ApplyTrainingMatrixPendingRequest = {};
      for (const bucket of BUCKET_ORDER) {
        const items = sortByRole(summary.pendingChanges[bucket] as Array<PendingTrainingLinkChange | PendingElementLinkSuggestion>);
        const chosen = items.filter((_, i) => selected[bucket].has(i));
        if (chosen.length > 0) {
          (payload as any)[bucket] = chosen;
        }
      }

      const response = await fetch("/api/training-import/apply-pending", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.details || result.error || "Failed to apply changes");
      }

      toast({
        title: "Changes Applied",
        description: `${result.applied.trainingLinksUpdated} training requirement(s) updated, ${result.applied.trainingLinksRemoved} archived, ${result.applied.elementLinksAdded} element link(s) added, ${result.applied.elementLinksUpdated} updated, ${result.applied.elementLinksRemoved} archived.`,
      });

      if (result.errors.length > 0) {
        toast({
          title: `${result.errors.length} item(s) failed`,
          description: result.errors.slice(0, 3).join(" "),
          variant: "destructive",
        });
      }

      // Remove the applied items from the review list so it reflects what's left.
      setSummary(prev => {
        if (!prev) return prev;
        const nextPending = { ...prev.pendingChanges };
        for (const bucket of BUCKET_ORDER) {
          const items = sortByRole(nextPending[bucket] as Array<PendingTrainingLinkChange | PendingElementLinkSuggestion>);
          nextPending[bucket] = items.filter((_, i) => !selected[bucket].has(i)) as any;
        }
        return { ...prev, pendingChanges: nextPending };
      });
      setSelected(EMPTY_SELECTION);
    } catch (error: any) {
      toast({
        title: "Apply Failed",
        description: error.message || "An error occurred applying changes",
        variant: "destructive",
      });
    } finally {
      setApplying(false);
    }
  };

  const conflicts = summary?.pendingChanges.trainingLinkConflicts ?? [];
  const pendingTotal = summary
    ? BUCKET_ORDER.reduce((sum, bucket) => sum + summary.pendingChanges[bucket].length, 0) + conflicts.length
    : 0;

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">Training Matrix Import</h1>
        <p className="text-muted-foreground">
          Upload a training &amp; competence matrix workbook (one sheet per discipline/site, with a
          Category / Training Course layout and one column per job role marked M/R/D) to create
          training categories, courses, job roles, and role requirements.
        </p>
      </div>

      <Card data-testid="card-upload-file">
        <CardHeader>
          <CardTitle>Upload Workbook</CardTitle>
          <CardDescription>
            Re-uploading an updated revision is safe. New categories, courses, roles, and
            requirements are applied automatically. Anything that changes or removes an existing
            requirement - or a suggested competence element link - is held for your review below
            before it's applied.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
              id="matrix-file-upload"
              data-testid="input-file-upload"
            />
            <label htmlFor="matrix-file-upload">
              <Button variant="outline" className="gap-2" asChild data-testid="button-select-file">
                <span>
                  <Upload className="w-4 h-4" />
                  Select File
                </span>
              </Button>
            </label>
            {file && (
              <span className="text-sm text-muted-foreground" data-testid="text-selected-file">
                {file.name}
              </span>
            )}
          </div>

          {file && (
            <Button onClick={handleImport} disabled={importing} className="gap-2" data-testid="button-process-import">
              <Upload className="w-4 h-4" />
              {importing ? "Importing…" : "Import Workbook"}
            </Button>
          )}

          <Alert>
            <FileSpreadsheet className="w-4 h-4" />
            <AlertDescription>
              Only sheets matching the standard discipline/site layout are imported. Sheets that
              don't match (title pages, guidance notes, incomplete drafts) are listed as skipped
              below rather than guessed at.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {summary && (
        <Card className="mt-6" data-testid="card-import-summary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              Import Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 border rounded-lg" data-testid="stat-categories">
                <div className="text-2xl font-bold">{summary.categoriesCreated}</div>
                <div className="text-xs text-muted-foreground">New Categories</div>
                <div className="text-xs text-muted-foreground">({summary.categoriesReused} reused)</div>
              </div>
              <div className="text-center p-3 border rounded-lg" data-testid="stat-trainings">
                <div className="text-2xl font-bold">{summary.trainingsCreated}</div>
                <div className="text-xs text-muted-foreground">New Courses</div>
                <div className="text-xs text-muted-foreground">({summary.trainingsReused} reused)</div>
              </div>
              <div className="text-center p-3 border rounded-lg" data-testid="stat-roles">
                <div className="text-2xl font-bold">{summary.jobRolesCreated}</div>
                <div className="text-xs text-muted-foreground">New Job Roles</div>
                <div className="text-xs text-muted-foreground">({summary.jobRolesReused} reused)</div>
              </div>
              <div className="text-center p-3 border rounded-lg" data-testid="stat-links">
                <div className="text-2xl font-bold">{summary.roleTrainingLinksCreated}</div>
                <div className="text-xs text-muted-foreground">New Requirements Applied</div>
                <div className="text-xs text-muted-foreground">
                  ({summary.roleTrainingLinksSkipped} unchanged)
                </div>
              </div>
            </div>

            <div>
              <div className="text-sm font-medium mb-2">Sheets Processed ({summary.sheetsProcessed.length})</div>
              <div className="flex flex-wrap gap-2">
                {summary.sheetsProcessed.map(name => (
                  <Badge key={name} variant="secondary" data-testid={`badge-processed-${name}`}>{name}</Badge>
                ))}
              </div>
            </div>

            {summary.sheetsSkipped.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2">Sheets Skipped ({summary.sheetsSkipped.length})</div>
                <div className="flex flex-wrap gap-2">
                  {summary.sheetsSkipped.map(name => (
                    <Badge key={name} variant="outline" data-testid={`badge-skipped-${name}`}>{name}</Badge>
                  ))}
                </div>
              </div>
            )}

            {summary.errors.length > 0 && (
              <Alert variant="destructive" data-testid="alert-import-errors">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  <div className="font-medium mb-1">{summary.errors.length} error(s) occurred:</div>
                  <ul className="list-disc list-inside space-y-1">
                    {summary.errors.slice(0, 10).map((err, i) => (
                      <li key={i} className="text-sm">{err}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {summary && conflicts.length > 0 && (
        <Card className="mt-6" data-testid="card-conflicts">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              Inconsistent Values in the Workbook ({conflicts.length})
            </CardTitle>
            <CardDescription>
              The same job role appears as a column on more than one sheet, and those sheets
              disagree on the requirement for the same course. Nothing was changed for these -
              fix the source workbook or resolve them directly in Manage Trainings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {sortByRole(conflicts).map((c: PendingTrainingLinkConflict, i) => (
              <div key={i} className="p-3 border rounded-md" data-testid={`row-conflict-${i}`}>
                <div className="font-semibold">{c.roleName}</div>
                <div className="text-sm text-muted-foreground mb-2">{c.trainingName}</div>
                <div className="flex flex-wrap gap-2">
                  {c.observedValues.map((ov, j) => (
                    <div key={j} className="flex items-center gap-1">
                      {levelBadge(ov.value)}
                      <span className="text-xs text-muted-foreground">({ov.sheets.join(", ")})</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {summary && pendingTotal - conflicts.length > 0 && (
        <Card className="mt-6" data-testid="card-pending-review">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Review Before Applying ({pendingTotal - conflicts.length})</span>
              <Button
                onClick={handleApply}
                disabled={applying || totalSelected === 0}
                data-testid="button-apply-selected"
              >
                {applying ? "Applying…" : `Apply Selected (${totalSelected})`}
              </Button>
            </CardTitle>
            <CardDescription>
              Nothing here has been written to the database yet. Check the items you want to
              apply - removals are archived, not deleted, so nothing is ever lost.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {BUCKET_ORDER.map(bucket => {
              const items = sortByRole(summary.pendingChanges[bucket] as Array<PendingTrainingLinkChange | PendingElementLinkSuggestion>);
              if (items.length === 0) return null;
              const isElementBucket = bucket.startsWith("element");

              return (
                <div key={bucket} data-testid={`section-${bucket}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Checkbox
                      checked={selected[bucket].size === items.length}
                      onCheckedChange={() => toggleAllInBucket(bucket, items)}
                      data-testid={`checkbox-select-all-${bucket}`}
                    />
                    <span className="font-semibold">{BUCKET_LABELS[bucket]} ({items.length})</span>
                  </div>
                  <div className="space-y-1 border rounded-md p-2">
                    {items.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 p-2 rounded hover-elevate"
                        data-testid={`row-${bucket}-${i}`}
                      >
                        <Checkbox
                          checked={selected[bucket].has(i)}
                          onCheckedChange={() => toggleItem(bucket, i)}
                          data-testid={`checkbox-${bucket}-${i}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold truncate">{item.roleName}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {isElementBucket ? (item as PendingElementLinkSuggestion).elementName : (item as PendingTrainingLinkChange).trainingName}
                            {isElementBucket && (
                              <> · matched via code {(item as PendingElementLinkSuggestion).matchedCode} ({(item as PendingElementLinkSuggestion).matchedTrainingName})</>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {item.fromLevel && levelBadge(item.fromLevel)}
                          {item.fromLevel && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                          {levelBadge(item.toLevel)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle } from "lucide-react";
import type { TrainingMatrixImportSummary } from "@shared/schema";

export default function TrainingMatrixImport() {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<TrainingMatrixImportSummary | null>(null);
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
      toast({
        title: "Import Complete",
        description: `Processed ${result.sheetsProcessed.length} sheet(s). ${result.jobRolesCreated} new job roles, ${result.trainingsCreated} new training courses, ${result.roleTrainingLinksCreated} new role requirements.`,
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
            Re-uploading an updated revision is safe — existing categories, courses, roles, and
            requirements are matched by name and won't be duplicated.
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
                <div className="text-xs text-muted-foreground">New Requirements</div>
                <div className="text-xs text-muted-foreground">
                  ({summary.roleTrainingLinksUpdated} updated, {summary.roleTrainingLinksSkipped} unchanged)
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
    </div>
  );
}

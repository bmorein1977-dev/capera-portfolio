import { useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { FolderOpen, CheckCircle2, AlertTriangle } from "lucide-react";
import type { CompetenceDocumentImportSummary } from "@shared/schema";

// webkitdirectory isn't in React's built-in input typings
declare module "react" {
  interface InputHTMLAttributes<T> {
    webkitdirectory?: string;
    directory?: string;
  }
}

export default function CompetenceDocumentImport() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<CompetenceDocumentImportSummary | null>(null);
  const { toast } = useToast();

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(f => f.name.toLowerCase().endsWith(".docx"));
    setSelectedFiles(files);
    setSummary(null);
    if (files.length === 0) {
      toast({
        title: "No .docx files found",
        description: "The selected folder didn't contain any Word documents",
        variant: "destructive",
      });
    }
  };

  const handleImport = async () => {
    if (selectedFiles.length === 0) return;

    setImporting(true);
    setSummary(null);

    try {
      const formData = new FormData();
      const relativePaths = selectedFiles.map(f => (f as any).webkitRelativePath || f.name);
      formData.append("relativePaths", JSON.stringify(relativePaths));
      selectedFiles.forEach(f => formData.append("files", f));

      const response = await fetch("/api/training-import/knowledge-elements", {
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
        description: `Processed ${result.filesProcessed.length} document(s). ${result.elementsCreated} new elements, ${result.criteriaCreated} new criteria.`,
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
        <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">Competence Document Import</h1>
        <p className="text-muted-foreground">
          Select a folder of assessment standard documents (one .docx per competency element, with
          Safety / Underpinning Knowledge / Performance Criteria tables). Each document's top-level
          folder name identifies the discipline and site (e.g. "SC&I 47-3B") and must match an
          existing job role's department/location exactly.
        </p>
      </div>

      <Card data-testid="card-upload-folder">
        <CardHeader>
          <CardTitle>Select Folder</CardTitle>
          <CardDescription>
            Re-uploading a revised document is safe — the element, its subcategories, and its
            criteria are matched by name/code and updated rather than duplicated.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <input
              ref={inputRef}
              type="file"
              webkitdirectory=""
              directory=""
              multiple
              onChange={handleFolderChange}
              className="hidden"
              id="folder-upload"
              data-testid="input-folder-upload"
            />
            <label htmlFor="folder-upload">
              <Button variant="outline" className="gap-2" asChild data-testid="button-select-folder">
                <span>
                  <FolderOpen className="w-4 h-4" />
                  Select Folder
                </span>
              </Button>
            </label>
            {selectedFiles.length > 0 && (
              <span className="text-sm text-muted-foreground" data-testid="text-selected-count">
                {selectedFiles.length} document(s) found
              </span>
            )}
          </div>

          {selectedFiles.length > 0 && (
            <Button onClick={handleImport} disabled={importing} className="gap-2" data-testid="button-process-import">
              {importing ? "Importing…" : `Import ${selectedFiles.length} Document(s)`}
            </Button>
          )}
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
              <div className="text-center p-3 border rounded-lg" data-testid="stat-elements">
                <div className="text-2xl font-bold">{summary.elementsCreated}</div>
                <div className="text-xs text-muted-foreground">New Elements</div>
                <div className="text-xs text-muted-foreground">({summary.elementsReused} reused)</div>
              </div>
              <div className="text-center p-3 border rounded-lg" data-testid="stat-subcategories">
                <div className="text-2xl font-bold">{summary.subcategoriesCreated}</div>
                <div className="text-xs text-muted-foreground">New Subcategories</div>
                <div className="text-xs text-muted-foreground">({summary.subcategoriesReused} reused)</div>
              </div>
              <div className="text-center p-3 border rounded-lg" data-testid="stat-criteria">
                <div className="text-2xl font-bold">{summary.criteriaCreated}</div>
                <div className="text-xs text-muted-foreground">New Criteria</div>
                <div className="text-xs text-muted-foreground">({summary.criteriaUpdated} updated)</div>
              </div>
              <div className="text-center p-3 border rounded-lg" data-testid="stat-links">
                <div className="text-2xl font-bold">{summary.roleElementLinksCreated}</div>
                <div className="text-xs text-muted-foreground">New Role Links</div>
                <div className="text-xs text-muted-foreground">({summary.roleElementLinksSkipped} already existed)</div>
              </div>
            </div>

            <div>
              <div className="text-sm font-medium mb-2">Documents Processed ({summary.filesProcessed.length})</div>
              <div className="flex flex-wrap gap-2">
                {summary.filesProcessed.map(path => (
                  <Badge key={path} variant="secondary" data-testid={`badge-processed-${path}`}>{path}</Badge>
                ))}
              </div>
            </div>

            {summary.filesSkipped.length > 0 && (
              <Alert data-testid="alert-files-skipped">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  <div className="font-medium mb-1">{summary.filesSkipped.length} document(s) skipped:</div>
                  <ul className="list-disc list-inside space-y-1">
                    {summary.filesSkipped.map((item, i) => (
                      <li key={i} className="text-sm">
                        <span className="font-medium">{item.path}</span> — {item.reason}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
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

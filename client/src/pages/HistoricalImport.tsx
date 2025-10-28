import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Download, Upload, CheckCircle2, AlertCircle, FileSpreadsheet } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { apiRequest } from "@/lib/queryClient";

export default function HistoricalImport() {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: number;
    errors: Array<{ row: number; error: string }>;
    usersCreated: number;
    assessmentsCreated: number;
  } | null>(null);
  const { toast } = useToast();

  const downloadTemplate = async () => {
    try {
      const response = await fetch('/api/admin/historical-import/template', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to download template');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Capera Historical Data Import.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Template Downloaded",
        description: "The import template has been downloaded successfully.",
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Failed to download the template. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
        toast({
          title: "Invalid File",
          description: "Please select an Excel file (.xlsx or .xls)",
          variant: "destructive",
        });
        return;
      }
      setFile(selectedFile);
      setImportResult(null);
    }
  };

  const processImport = async () => {
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    try {
      // Read the Excel file
      const XLSX = await import('xlsx');
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        throw new Error('The Excel file is empty');
      }

      // Send to API
      const result = await apiRequest('/api/admin/historical-import', {
        method: 'POST',
        body: JSON.stringify({ data: jsonData }),
      });

      setImportResult(result);

      if (result.errors.length === 0) {
        toast({
          title: "Import Successful",
          description: `Successfully imported ${result.success} assessments for ${result.usersCreated} users.`,
        });
      } else {
        toast({
          title: "Import Completed with Errors",
          description: `Imported ${result.success} records. ${result.errors.length} errors occurred.`,
          variant: "destructive",
        });
      }
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
        <h1 className="text-3xl font-bold mb-2">Historical Data Import</h1>
        <p className="text-muted-foreground">
          Import legacy assessment data from your previous system
        </p>
      </div>

      <div className="grid gap-6">
        {/* Step 1: Download Template */}
        <Card data-testid="card-download-template">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">
                1
              </span>
              Download Template
            </CardTitle>
            <CardDescription>
              Download the Excel template and fill it with your historical data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={downloadTemplate}
              data-testid="button-download-template"
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Download Excel Template
            </Button>
            
            <Alert className="mt-4">
              <FileSpreadsheet className="w-4 h-4" />
              <AlertDescription>
                The template includes example data in row 2. Each row represents one assessment for one user.
                Users with multiple assessed elements should have multiple rows.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Step 2: Upload File */}
        <Card data-testid="card-upload-file">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">
                2
              </span>
              Upload Completed Template
            </CardTitle>
            <CardDescription>
              Select the completed Excel file to import
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
                data-testid="input-file-upload"
              />
              <label htmlFor="file-upload">
                <Button
                  variant="outline"
                  className="gap-2"
                  as Child
                  data-testid="button-select-file"
                >
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
              <Button
                onClick={processImport}
                disabled={importing}
                className="gap-2"
                data-testid="button-process-import"
              >
                {importing ? (
                  <>Processing...</>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Process Import
                  </>
                )}
              </Button>
            )}

            {importing && (
              <div className="space-y-2">
                <Progress value={undefined} className="w-full" />
                <p className="text-sm text-muted-foreground">Importing data...</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 3: Results */}
        {importResult && (
          <Card data-testid="card-import-results">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">
                  3
                </span>
                Import Results
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 p-4 rounded-lg bg-green-50 dark:bg-green-950">
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <div>
                    <p className="text-sm font-medium">Successful Imports</p>
                    <p className="text-2xl font-bold" data-testid="text-success-count">
                      {importResult.success}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-4 rounded-lg bg-blue-50 dark:bg-blue-950">
                  <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <div>
                    <p className="text-sm font-medium">Users Created</p>
                    <p className="text-2xl font-bold" data-testid="text-users-created">
                      {importResult.usersCreated}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-4 rounded-lg bg-purple-50 dark:bg-purple-950">
                  <CheckCircle2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <div>
                    <p className="text-sm font-medium">Assessments Created</p>
                    <p className="text-2xl font-bold" data-testid="text-assessments-created">
                      {importResult.assessmentsCreated}
                    </p>
                  </div>
                </div>

                {importResult.errors.length > 0 && (
                  <div className="flex items-center gap-2 p-4 rounded-lg bg-red-50 dark:bg-red-950">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                    <div>
                      <p className="text-sm font-medium">Errors</p>
                      <p className="text-2xl font-bold" data-testid="text-error-count">
                        {importResult.errors.length}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {importResult.errors.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-semibold mb-2">Error Details:</h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {importResult.errors.map((error, index) => (
                      <Alert key={index} variant="destructive" data-testid={`error-row-${error.row}`}>
                        <AlertCircle className="w-4 h-4" />
                        <AlertDescription>
                          <strong>Row {error.row}:</strong> {error.error}
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

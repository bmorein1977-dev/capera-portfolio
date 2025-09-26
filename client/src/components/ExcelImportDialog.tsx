import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ExcelImportResult } from "@shared/schema";

interface ExcelImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ExcelImportDialog({ isOpen, onClose, onSuccess }: ExcelImportDialogProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importResult, setImportResult] = useState<ExcelImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async (file: File): Promise<ExcelImportResult> => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/competence-standards/import', {
        method: 'POST',
        body: formData,
        credentials: 'include', // Important for auth
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Import failed' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      
      return response.json();
    },
    onSuccess: (data: ExcelImportResult) => {
      setImportResult(data);
      if (data.errorCount === 0) {
        toast({
          title: "Import Successful",
          description: `Successfully imported ${data.successCount} competence criteria with automatic K/P numbering.`,
        });
        onSuccess?.();
      } else {
        toast({
          title: "Import Completed with Errors", 
          description: `${data.successCount} successful, ${data.errorCount} errors. Review details below.`,
          variant: "destructive",
        });
      }
      setUploadProgress(100);
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to process Excel file",
        variant: "destructive",
      });
      setUploadProgress(0);
    },
  });

  const handleFileSelect = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: "Invalid File Type",
        description: "Please upload an Excel (.xlsx) or CSV (.csv) file.",
        variant: "destructive",
      });
      return;
    }

    setImportResult(null);
    setUploadProgress(10);
    uploadMutation.mutate(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleReset = () => {
    setImportResult(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadTemplate = async () => {
    try {
      const response = await fetch('/api/competence-standards/template', {
        method: 'GET',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to download template: ${response.status}`);
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'competence-standards-template.xlsx';
      link.click();
      URL.revokeObjectURL(url);
      
      toast({
        title: "Template Downloaded",
        description: "Excel template with proper A-J column structure has been downloaded.",
      });
    } catch (error) {
      console.error("Error downloading template:", error);
      toast({
        title: "Download Failed",
        description: "Failed to download Excel template. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]" data-testid="dialog-excel-import">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Excel Import - Competence Standards
          </DialogTitle>
          <DialogDescription>
            Import competence criteria with automatic K1.1, P1.1 numbering from Excel or CSV files
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Template Download */}
          <Card className="border-dashed">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Download Template</CardTitle>
              <CardDescription>Get the Excel template with proper column structure (A-J mapping)</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={downloadTemplate} className="w-full" data-testid="button-download-template">
                <Download className="h-4 w-4 mr-2" />
                Download Template (A-J Column Structure)
              </Button>
            </CardContent>
          </Card>

          {/* File Upload Area */}
          {!importResult && (
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
              onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={handleDrop}
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">Upload Excel File</h3>
              <p className="text-muted-foreground mb-4">
                Drag & drop your Excel file here, or click to browse
              </p>
              <Button onClick={() => fileInputRef.current?.click()} disabled={uploadMutation.isPending} data-testid="button-select-file">
                Select File (.xlsx, .csv)
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".xlsx,.csv"
                onChange={handleFileInput}
                data-testid="input-file-upload"
              />
            </div>
          )}

          {/* Upload Progress */}
          {uploadMutation.isPending && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Processing Excel file...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} data-testid="progress-upload" />
            </div>
          )}

          {/* Import Results */}
          {importResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Import Results</h3>
                <div className="flex gap-2">
                  <Badge variant={importResult.errorCount === 0 ? "default" : "destructive"}>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {importResult.successCount} Success
                  </Badge>
                  {importResult.errorCount > 0 && (
                    <Badge variant="destructive">
                      <XCircle className="h-3 w-3 mr-1" />
                      {importResult.errorCount} Errors
                    </Badge>
                  )}
                  {importResult.warnings && importResult.warnings.length > 0 && (
                    <Badge variant="secondary">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {importResult.warnings.length} Warnings
                    </Badge>
                  )}
                </div>
              </div>

              {/* Error Details */}
              {importResult.errors && importResult.errors.length > 0 && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-medium mb-2">Import Errors:</div>
                    <ScrollArea className="max-h-32">
                      <div className="space-y-1 text-sm" data-testid="error-list">
                        {importResult.errors.map((error, index) => (
                          <div key={index}>
                            <strong>Row {error.row}:</strong> {error.field && `${error.field} - `}{error.message}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </AlertDescription>
                </Alert>
              )}

              {/* Warning Details */}
              {importResult.warnings && importResult.warnings.length > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-medium mb-2">Warnings:</div>
                    <ScrollArea className="max-h-24">
                      <div className="space-y-1 text-sm">
                        {importResult.warnings.map((warning, index) => (
                          <div key={index}>
                            <strong>Row {warning.row}:</strong> {warning.message}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </AlertDescription>
                </Alert>
              )}

              <Separator />

              <div className="flex justify-between">
                <Button variant="outline" onClick={handleReset} data-testid="button-import-another">
                  Import Another File
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={onClose} data-testid="button-close-dialog">
                    Close
                  </Button>
                  {importResult.successCount > 0 && (
                    <Button onClick={onClose} data-testid="button-view-results">
                      View Imported Data
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Column Mapping Info */}
          <Card className="bg-muted/20">
            <CardHeader>
              <CardTitle className="text-sm">Column Mapping (A-J)</CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-1">
              <div><strong>A:</strong> Category | <strong>B:</strong> Element | <strong>C:</strong> Subcategory | <strong>D:</strong> Type (knowledge/performance) | <strong>E:</strong> Description</div>
              <div><strong>F:</strong> Proficiency Levels (1/3/4) | <strong>G:</strong> Level Terms | <strong>H:</strong> Assessment Methods (K,KE,KP,T) | <strong>I:</strong> Criticality | <strong>J:</strong> Validity Years</div>
              <div className="text-muted-foreground mt-2">System automatically generates K1.1, P1.1 codes and handles subcategory numbering</div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
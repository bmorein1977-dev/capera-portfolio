import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { CalendarDays, Upload, FileText, AlertCircle, CheckCircle, Clock, Download } from "lucide-react";
import { format } from "date-fns";
import LearningContentList from "@/components/LearningContentList";
import type { TrainingEnrollment, Training, TrainingCategory } from "@shared/schema";

type EnrollmentRecord = TrainingEnrollment & { training: Training };

function getExpiryStatus(expiryDate?: string | Date | null): 'green' | 'amber' | 'red' {
  if (!expiryDate) return 'green';
  const daysRemaining = Math.floor((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (daysRemaining < 0) return 'red';
  if (daysRemaining <= 90) return 'amber';
  return 'green';
}

interface TrainingCertificate {
  id: string;
  userId: string;
  trainingId: string;
  title: string;
  issuingOrganization: string;
  issueDate: string;
  expiryDate?: string;
  certificateNumber?: string;
  description?: string;
  filePath?: string;
}

export default function MyTraining() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedRecord, setSelectedRecord] = useState<EnrollmentRecord | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [certificateFile, setCertificateFile] = useState<File | null>(null);

  // Fetch the current user's training enrollments, with each enrollment's training details
  // embedded (name, description, category) so the UI doesn't need a second round-trip.
  const { data: trainingRecords, isLoading: recordsLoading } = useQuery<EnrollmentRecord[]>({
    queryKey: [`/api/training-enrollments?userId=${user?.id}`],
    enabled: !!user?.id,
  });

  const { data: categories = [] } = useQuery<TrainingCategory[]>({
    queryKey: ['/api/training-categories'],
    enabled: !!user,
  });
  const categoryName = (categoryId?: string | null) => categories.find(c => c.id === categoryId)?.name || 'Uncategorized';

  // Fetch user's certificates
  const { data: certificates, isLoading: certificatesLoading } = useQuery<TrainingCertificate[]>({
    queryKey: ['/api/training-certificates'],
    enabled: !!user
  });

  // Uploads straight to the enrollment's certificate slot (Object Storage-backed, same route
  // AdminUsers.tsx already uses) - training_enrollments only stores a filename + storage key,
  // not the richer certificate metadata a separate form previously implied but never persisted.
  const uploadCertificate = useMutation({
    mutationFn: async (file: File) => {
      if (!selectedRecord) throw new Error("No training selected");
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`/api/training-enrollments/${selectedRecord.id}/certificate`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to upload certificate');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Certificate uploaded successfully"
      });
      setIsUploadDialogOpen(false);
      setCertificateFile(null);
      queryClient.invalidateQueries({ queryKey: [`/api/training-enrollments?userId=${user?.id}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to upload certificate",
        variant: "destructive"
      });
    }
  });

  const getStatusIcon = (expiryStatus: string) => {
    switch (expiryStatus) {
      case 'green': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'amber': return <Clock className="h-4 w-4 text-amber-600" />;
      case 'red': return <AlertCircle className="h-4 w-4 text-red-600" />;
      default: return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string, expiryStatus: string) => {
    const baseClass = "capitalize";
    switch (expiryStatus) {
      case 'green':
        return <Badge className={baseClass} variant="default">{status.replace('_', ' ')}</Badge>;
      case 'amber':
        return <Badge className={baseClass} variant="secondary">{status.replace('_', ' ')}</Badge>;
      case 'red':
        return <Badge className={baseClass} variant="destructive">{status.replace('_', ' ')}</Badge>;
      default:
        return <Badge className={baseClass} variant="outline">{status.replace('_', ' ')}</Badge>;
    }
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord || !certificateFile) return;

    uploadCertificate.mutate(certificateFile);
  };

  if (recordsLoading || certificatesLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading your training records...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-my-training">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">My Training</h1>
          <p className="text-muted-foreground">View your training progress and manage certificates</p>
        </div>
      </div>

      {/* Training Records */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Training Records
          </CardTitle>
          <CardDescription>
            Your enrolled training programs and completion status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!trainingRecords || trainingRecords.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No training records found</p>
              <p className="text-sm">Contact your administrator to enroll in training programs</p>
            </div>
          ) : (
            <div className="space-y-4">
              {trainingRecords.map((record) => {
                const expiryStatus = getExpiryStatus(record.expiryDate);
                return (
                <div key={record.id} className="border rounded-lg p-4 space-y-3" data-testid={`training-record-${record.id}`}>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h3 className="font-semibold" data-testid={`text-training-title-${record.id}`}>
                        {record.training.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Category: {categoryName(record.training.categoryId)}
                      </p>
                      {record.training.description && (
                        <p className="text-sm text-muted-foreground">
                          {record.training.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(expiryStatus)}
                      {getStatusBadge(record.status, expiryStatus)}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Allocated:</span>
                      <p className="text-muted-foreground">
                        {record.allocatedDate ? format(new Date(record.allocatedDate), 'MMM dd, yyyy') : '—'}
                      </p>
                    </div>
                    {record.achievementDate && (
                      <div>
                        <span className="font-medium">Completed:</span>
                        <p className="text-muted-foreground">
                          {format(new Date(record.achievementDate), 'MMM dd, yyyy')}
                        </p>
                      </div>
                    )}
                    {record.expiryDate && (
                      <div>
                        <span className="font-medium">Expires:</span>
                        <p className="text-muted-foreground">
                          {format(new Date(record.expiryDate), 'MMM dd, yyyy')}
                        </p>
                      </div>
                    )}
                  </div>

                  <LearningContentList trainingId={record.trainingId} />

                  <div className="flex items-center justify-end gap-2">
                    {record.certificateFileName && (
                      <Button variant="ghost" size="sm" asChild data-testid={`button-download-certificate-${record.id}`}>
                        <a href={`/api/training-enrollments/${record.id}/certificate/download`} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4 mr-2" />
                          {record.certificateFileName}
                        </a>
                      </Button>
                    )}
                    {record.status === 'completed' && !record.certificateFileName && (
                      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setSelectedRecord(record); setCertificateFile(null); }}
                            data-testid={`button-upload-certificate-${record.id}`}
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Upload Certificate
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Upload Training Certificate</DialogTitle>
                            <DialogDescription>
                              Upload your certificate for {selectedRecord?.training.name}
                            </DialogDescription>
                          </DialogHeader>
                          <form onSubmit={handleUploadSubmit} className="space-y-4">
                            <div>
                              <Label htmlFor="certificateFile">Certificate File</Label>
                              <Input
                                id="certificateFile"
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                onChange={(e) => setCertificateFile(e.target.files?.[0] || null)}
                                required
                                data-testid="input-certificate-file"
                              />
                              <p className="text-sm text-muted-foreground mt-1">
                                Upload PDF, JPG, or PNG files only
                              </p>
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsUploadDialogOpen(false)}
                                data-testid="button-cancel-upload"
                              >
                                Cancel
                              </Button>
                              <Button
                                type="submit"
                                disabled={uploadCertificate.isPending || !certificateFile}
                                data-testid="button-submit-certificate"
                              >
                                {uploadCertificate.isPending ? "Uploading..." : "Upload Certificate"}
                              </Button>
                            </div>
                          </form>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Certificates */}
      {certificates && Array.isArray(certificates) && certificates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              My Certificates
            </CardTitle>
            <CardDescription>
              Your uploaded training certificates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.isArray(certificates) && certificates.map((cert: TrainingCertificate) => (
                <div key={cert.id} className="border rounded-lg p-4" data-testid={`certificate-${cert.id}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold" data-testid={`text-certificate-title-${cert.id}`}>
                        {cert.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Issued by: {cert.issuingOrganization}
                      </p>
                      {cert.certificateNumber && (
                        <p className="text-sm text-muted-foreground">
                          Certificate #: {cert.certificateNumber}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Issue Date:</span>
                      <p className="text-muted-foreground">
                        {format(new Date(cert.issueDate), 'MMM dd, yyyy')}
                      </p>
                    </div>
                    {cert.expiryDate && (
                      <div>
                        <span className="font-medium">Expiry Date:</span>
                        <p className="text-muted-foreground">
                          {format(new Date(cert.expiryDate), 'MMM dd, yyyy')}
                        </p>
                      </div>
                    )}
                  </div>

                  {cert.description && (
                    <div className="mt-3 text-sm">
                      <span className="font-medium">Description:</span>
                      <p className="text-muted-foreground mt-1">{cert.description}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
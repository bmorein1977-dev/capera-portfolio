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
import { CalendarDays, Upload, FileText, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { format } from "date-fns";

interface TrainingRecord {
  id: string;
  userId: string;
  trainingId: string;
  training: {
    id: string;
    title: string;
    description: string;
    category: string;
    validityPeriod: number;
  };
  status: 'not_started' | 'in_progress' | 'completed' | 'expired';
  expiryStatus: 'green' | 'amber' | 'red';
  enrollmentDate: string;
  completionDate?: string;
  expiryDate?: string;
  certificateId?: string;
  notes?: string;
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
  const [selectedRecord, setSelectedRecord] = useState<TrainingRecord | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    title: "",
    issuingOrganization: "",
    issueDate: "",
    expiryDate: "",
    certificateNumber: "",
    description: "",
    file: null as File | null
  });

  // Fetch user's training records
  const { data: trainingRecords, isLoading: recordsLoading } = useQuery({
    queryKey: ['/api/training/records'],
    enabled: !!user
  });

  // Fetch user's certificates
  const { data: certificates, isLoading: certificatesLoading } = useQuery({
    queryKey: ['/api/training-certificates'],
    enabled: !!user
  });

  // Certificate upload mutation
  const uploadCertificate = useMutation({
    mutationFn: async (data: any) => {
      let fileUrl = null;
      
      // Upload file to object storage if present
      if (data.file) {
        const formData = new FormData();
        formData.append('file', data.file);
        formData.append('directory', 'certificates');
        
        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });
        
        if (!uploadResponse.ok) {
          throw new Error('Failed to upload file');
        }
        
        const uploadResult = await uploadResponse.json();
        fileUrl = uploadResult.url;
      }
      
      return apiRequest('/api/training-certificates', 'POST', {
        ...data,
        fileUrl,
        userId: user?.id,
        trainingId: selectedRecord?.trainingId
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Certificate uploaded successfully"
      });
      setIsUploadDialogOpen(false);
      setUploadForm({
        title: "",
        issuingOrganization: "",
        issueDate: "",
        expiryDate: "",
        certificateNumber: "",
        description: "",
        file: null
      });
      queryClient.invalidateQueries({ queryKey: ['/api/training-certificates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/training/records'] });
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
    if (!selectedRecord) return;

    uploadCertificate.mutate(uploadForm);
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
          {!trainingRecords || !Array.isArray(trainingRecords) || trainingRecords.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No training records found</p>
              <p className="text-sm">Contact your administrator to enroll in training programs</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Array.isArray(trainingRecords) && trainingRecords.map((record: TrainingRecord) => (
                <div key={record.id} className="border rounded-lg p-4 space-y-3" data-testid={`training-record-${record.id}`}>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h3 className="font-semibold" data-testid={`text-training-title-${record.id}`}>
                        {record.training.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Category: {record.training.category}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {record.training.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(record.expiryStatus)}
                      {getStatusBadge(record.status, record.expiryStatus)}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Enrolled:</span>
                      <p className="text-muted-foreground">
                        {format(new Date(record.enrollmentDate), 'MMM dd, yyyy')}
                      </p>
                    </div>
                    {record.completionDate && (
                      <div>
                        <span className="font-medium">Completed:</span>
                        <p className="text-muted-foreground">
                          {format(new Date(record.completionDate), 'MMM dd, yyyy')}
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

                  {record.notes && (
                    <div className="text-sm">
                      <span className="font-medium">Notes:</span>
                      <p className="text-muted-foreground mt-1">{record.notes}</p>
                    </div>
                  )}

                  {record.status === 'completed' && !record.certificateId && (
                    <div className="flex justify-end">
                      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedRecord(record)}
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
                              Upload your certificate for {selectedRecord?.training.title}
                            </DialogDescription>
                          </DialogHeader>
                          <form onSubmit={handleUploadSubmit} className="space-y-4">
                            <div>
                              <Label htmlFor="title">Certificate Title</Label>
                              <Input
                                id="title"
                                value={uploadForm.title}
                                onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                                placeholder="Enter certificate title"
                                required
                                data-testid="input-certificate-title"
                              />
                            </div>
                            <div>
                              <Label htmlFor="issuingOrganization">Issuing Organization</Label>
                              <Input
                                id="issuingOrganization"
                                value={uploadForm.issuingOrganization}
                                onChange={(e) => setUploadForm({ ...uploadForm, issuingOrganization: e.target.value })}
                                placeholder="Enter issuing organization"
                                required
                                data-testid="input-issuing-organization"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor="issueDate">Issue Date</Label>
                                <Input
                                  id="issueDate"
                                  type="date"
                                  value={uploadForm.issueDate}
                                  onChange={(e) => setUploadForm({ ...uploadForm, issueDate: e.target.value })}
                                  required
                                  data-testid="input-issue-date"
                                />
                              </div>
                              <div>
                                <Label htmlFor="expiryDate">Expiry Date (Optional)</Label>
                                <Input
                                  id="expiryDate"
                                  type="date"
                                  value={uploadForm.expiryDate}
                                  onChange={(e) => setUploadForm({ ...uploadForm, expiryDate: e.target.value })}
                                  data-testid="input-expiry-date"
                                />
                              </div>
                            </div>
                            <div>
                              <Label htmlFor="certificateNumber">Certificate Number (Optional)</Label>
                              <Input
                                id="certificateNumber"
                                value={uploadForm.certificateNumber}
                                onChange={(e) => setUploadForm({ ...uploadForm, certificateNumber: e.target.value })}
                                placeholder="Enter certificate number"
                                data-testid="input-certificate-number"
                              />
                            </div>
                            <div>
                              <Label htmlFor="certificateFile">Certificate File</Label>
                              <Input
                                id="certificateFile"
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    setUploadForm({ ...uploadForm, file: file });
                                  }
                                }}
                                data-testid="input-certificate-file"
                              />
                              <p className="text-sm text-muted-foreground mt-1">
                                Upload PDF, JPG, or PNG files only
                              </p>
                            </div>
                            <div>
                              <Label htmlFor="description">Description (Optional)</Label>
                              <Textarea
                                id="description"
                                value={uploadForm.description}
                                onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                                placeholder="Additional notes about this certificate"
                                data-testid="input-certificate-description"
                              />
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
                                disabled={uploadCertificate.isPending}
                                data-testid="button-submit-certificate"
                              >
                                {uploadCertificate.isPending ? "Uploading..." : "Upload Certificate"}
                              </Button>
                            </div>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}
                </div>
              ))}
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
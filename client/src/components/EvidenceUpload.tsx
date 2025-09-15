import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { 
  Upload, 
  FileText, 
  Image, 
  Video, 
  Camera, 
  Mic, 
  X, 
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react';
import { useState, useCallback } from 'react';

type EvidenceType = 'document' | 'image' | 'video' | 'audio' | 'observation';
type EvidenceStatus = 'draft' | 'submitted' | 'verified' | 'rejected';

interface EvidenceFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  uploadProgress?: number;
  status: 'uploading' | 'completed' | 'error';
}

interface EvidenceSubmission {
  id: string;
  assessmentId: string;
  skillName: string;
  evidenceType: EvidenceType;
  title: string;
  description: string;
  files: EvidenceFile[];
  status: EvidenceStatus;
  submittedDate?: string;
  verifiedBy?: string;
  verificationDate?: string;
  comments?: string;
}

const mockEvidenceSubmissions: EvidenceSubmission[] = [
  {
    id: '1',
    assessmentId: 'ASS001',
    skillName: 'Equipment Operation',
    evidenceType: 'video',
    title: 'Machine Setup Procedure',
    description: 'Video demonstration of proper machine setup and safety checks',
    files: [
      { id: '1', name: 'machine_setup_demo.mp4', size: 15728640, type: 'video/mp4', status: 'completed' }
    ],
    status: 'verified',
    submittedDate: '2024-01-15',
    verifiedBy: 'David Kim',
    verificationDate: '2024-01-16',
  },
  {
    id: '2',
    assessmentId: 'ASS002',
    skillName: 'Safety Procedures',
    evidenceType: 'document',
    title: 'Safety Checklist Completion',
    description: 'Completed safety inspection checklist with signatures',
    files: [
      { id: '2', name: 'safety_checklist.pdf', size: 2048576, type: 'application/pdf', status: 'completed' }
    ],
    status: 'submitted',
    submittedDate: '2024-01-18',
  },
];

const evidenceTypes = [
  { value: 'document', label: 'Document', icon: FileText },
  { value: 'image', label: 'Image/Photo', icon: Image },
  { value: 'video', label: 'Video', icon: Video },
  { value: 'audio', label: 'Audio Recording', icon: Mic },
  { value: 'observation', label: 'Observation Record', icon: Camera },
];

export default function EvidenceUpload() {
  const [selectedAssessment, setSelectedAssessment] = useState('');
  const [evidenceType, setEvidenceType] = useState<EvidenceType>('document');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<EvidenceFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      handleFiles(selectedFiles);
    }
  };

  const handleFiles = (fileList: File[]) => {
    const newFiles: EvidenceFile[] = fileList.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'uploading',
      uploadProgress: 0,
    }));

    setFiles(prev => [...prev, ...newFiles]);

    // Simulate upload progress
    newFiles.forEach(file => {
      simulateUpload(file.id);
    });
  };

  const simulateUpload = (fileId: string) => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 30;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setFiles(prev => prev.map(f => 
          f.id === fileId ? { ...f, status: 'completed', uploadProgress: 100 } : f
        ));
      } else {
        setFiles(prev => prev.map(f => 
          f.id === fileId ? { ...f, uploadProgress: progress } : f
        ));
      }
    }, 200);
  };

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleSubmit = () => {
    console.log('Submitting evidence:', {
      assessmentId: selectedAssessment,
      evidenceType,
      title,
      description,
      files: files.filter(f => f.status === 'completed'),
    });
    
    // Reset form
    setSelectedAssessment('');
    setEvidenceType('document');
    setTitle('');
    setDescription('');
    setFiles([]);
  };

  const getStatusIcon = (status: EvidenceStatus) => {
    switch (status) {
      case 'draft': return <Clock className="h-4 w-4 text-gray-500" />;
      case 'submitted': return <Clock className="h-4 w-4 text-blue-500" />;
      case 'verified': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'rejected': return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusColor = (status: EvidenceStatus) => {
    switch (status) {
      case 'draft': return 'secondary';
      case 'submitted': return 'default';
      case 'verified': return 'default';
      case 'rejected': return 'destructive';
      default: return 'secondary';
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-6 w-6" />
            Upload Evidence
          </CardTitle>
          <CardDescription>
            Submit evidence to support your competency assessment
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="assessment">Assessment</Label>
              <Select value={selectedAssessment} onValueChange={setSelectedAssessment}>
                <SelectTrigger data-testid="select-assessment">
                  <SelectValue placeholder="Select assessment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ASS001">Equipment Operation - Level 3</SelectItem>
                  <SelectItem value="ASS002">Safety Procedures - Advanced</SelectItem>
                  <SelectItem value="ASS003">Quality Control - Intermediate</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="evidenceType">Evidence Type</Label>
              <Select value={evidenceType} onValueChange={(value) => setEvidenceType(value as EvidenceType)}>
                <SelectTrigger data-testid="select-evidence-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {evidenceTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Evidence Title</Label>
            <Input
              id="title"
              placeholder="Brief title describing the evidence"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              data-testid="input-evidence-title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe what this evidence demonstrates and how it relates to the competency"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              data-testid="textarea-evidence-description"
            />
          </div>

          {/* File Upload Area */}
          <div className="space-y-2">
            <Label>Files</Label>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragOver 
                  ? 'border-primary bg-primary/5' 
                  : 'border-muted-foreground/25 hover:border-muted-foreground/50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              data-testid="file-drop-zone"
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">Drop files here or click to browse</p>
              <p className="text-sm text-muted-foreground mb-4">
                Supports: PDF, Word, Excel, Images, Videos (Max 50MB each)
              </p>
              <input
                type="file"
                multiple
                className="hidden"
                id="file-upload"
                onChange={handleFileSelect}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.mp4,.mov,.avi"
              />
              <Button variant="outline" onClick={() => document.getElementById('file-upload')?.click()}>
                Browse Files
              </Button>
            </div>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-2">
              <Label>Uploaded Files</Label>
              <div className="space-y-2">
                {files.map(file => (
                  <div key={file.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{file.name}</span>
                        <span className="text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
                      </div>
                      {file.status === 'uploading' && (
                        <Progress value={file.uploadProgress || 0} className="h-1 mt-1" />
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(file.id)}
                      data-testid={`button-remove-file-${file.id}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button 
              onClick={handleSubmit}
              disabled={!selectedAssessment || !title || files.filter(f => f.status === 'completed').length === 0}
              data-testid="button-submit-evidence"
            >
              Submit Evidence
            </Button>
            <Button variant="outline" data-testid="button-save-draft">
              Save as Draft
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Previous Submissions */}
      <Card>
        <CardHeader>
          <CardTitle>Previous Submissions</CardTitle>
          <CardDescription>Your evidence submission history</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockEvidenceSubmissions.map(submission => (
              <div key={submission.id} className="border rounded-lg p-4" data-testid={`submission-${submission.id}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">{submission.title}</h4>
                      <Badge variant={getStatusColor(submission.status)}>
                        {getStatusIcon(submission.status)}
                        <span className="ml-1 capitalize">{submission.status}</span>
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{submission.description}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Skill: {submission.skillName}</span>
                      <span>Type: {evidenceTypes.find(t => t.value === submission.evidenceType)?.label}</span>
                      {submission.submittedDate && <span>Submitted: {submission.submittedDate}</span>}
                    </div>
                    {submission.verifiedBy && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Verified by {submission.verifiedBy} on {submission.verificationDate}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" data-testid={`button-view-${submission.id}`}>
                      View
                    </Button>
                    {submission.status === 'draft' && (
                      <Button size="sm" data-testid={`button-edit-${submission.id}`}>
                        Edit
                      </Button>
                    )}
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t">
                  <div className="text-xs text-muted-foreground">Files:</div>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {submission.files.map(file => (
                      <Badge key={file.id} variant="secondary" className="text-xs">
                        {file.name} ({formatFileSize(file.size)})
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
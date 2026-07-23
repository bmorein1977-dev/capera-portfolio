import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Plus, Pencil, Trash2, Video, FileText, Link as LinkIcon, Upload, PlayCircle } from "lucide-react";
import type { Training, TrainingContent } from "@shared/schema";

const TYPE_LABELS: Record<string, string> = {
  video_upload: "Video (uploaded)",
  video_link: "Video (link)",
  document: "Document",
  link: "Link",
};
const TYPE_ICONS: Record<string, any> = {
  video_upload: Video,
  video_link: PlayCircle,
  document: FileText,
  link: LinkIcon,
};

export default function TrainingContentAdmin() {
  const { toast } = useToast();
  const { data: trainings = [] } = useQuery<Training[]>({ queryKey: ['/api/trainings'] });
  const [trainingId, setTrainingId] = useState("");

  const { data: content = [], isLoading } = useQuery<TrainingContent[]>({
    queryKey: ['/api/trainings', trainingId, 'content'],
    enabled: !!trainingId,
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TrainingContent | null>(null);
  const [form, setForm] = useState({
    title: '', description: '', contentType: 'video_link', externalUrl: '', durationSeconds: '', order: '0',
  });
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const openDialog = (item?: TrainingContent) => {
    setEditing(item || null);
    setFile(null);
    setForm(item ? {
      title: item.title,
      description: item.description || '',
      contentType: item.contentType,
      externalUrl: item.externalUrl || '',
      durationSeconds: item.durationSeconds != null ? String(item.durationSeconds) : '',
      order: String(item.order ?? 0),
    } : { title: '', description: '', contentType: 'video_link', externalUrl: '', durationSeconds: '', order: String(content.length) });
    setIsDialogOpen(true);
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['/api/trainings', trainingId, 'content'] });

  const saveMetadataMutation = useMutation({
    mutationFn: async () => {
      const body = {
        title: form.title,
        description: form.description || null,
        contentType: form.contentType,
        externalUrl: form.externalUrl || null,
        durationSeconds: form.durationSeconds ? parseInt(form.durationSeconds, 10) : null,
        order: parseInt(form.order, 10) || 0,
      };
      const url = editing ? `/api/training-content/${editing.id}` : `/api/trainings/${trainingId}/content`;
      const res = await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Failed to save');
      return res.json();
    },
    onSuccess: () => { invalidate(); toast({ title: "Saved" }); setIsDialogOpen(false); },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Choose a file first");
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', form.title || file.name);
      if (form.description) formData.append('description', form.description);
      formData.append('order', form.order || '0');
      const res = await fetch(`/api/trainings/${trainingId}/content/upload`, {
        method: 'POST', credentials: 'include', body: formData,
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Failed to upload');
      return res.json();
    },
    onSuccess: () => { invalidate(); toast({ title: "Uploaded" }); setIsDialogOpen(false); },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/training-content/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Failed to delete');
    },
    onSuccess: () => { invalidate(); toast({ title: "Removed" }); },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const isFileType = form.contentType === 'video_upload' || form.contentType === 'document';

  const handleSubmit = () => {
    if (!form.title.trim()) return;
    if (isFileType && !editing) {
      setIsUploading(true);
      uploadMutation.mutate(undefined, { onSettled: () => setIsUploading(false) });
    } else {
      saveMetadataMutation.mutate();
    }
  };

  const selectedTraining = trainings.find(t => t.id === trainingId);

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-training-content-admin">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Learning Content</h1>
        <p className="text-muted-foreground">Host e-learning videos, documents and links against a training course</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Choose a Training Course</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={trainingId} onValueChange={setTrainingId}>
            <SelectTrigger className="max-w-md" data-testid="select-content-training"><SelectValue placeholder="Select a training course" /></SelectTrigger>
            <SelectContent>
              {trainings.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {trainingId && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{selectedTraining?.name}</CardTitle>
              <CardDescription>Content items shown to learners in order, with per-user progress tracked</CardDescription>
            </div>
            <Button onClick={() => openDialog()} data-testid="button-add-content">
              <Plus className="h-4 w-4 mr-2" />
              Add Content
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : content.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No content yet for this course</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...content].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(item => {
                    const Icon = TYPE_ICONS[item.contentType] || FileText;
                    return (
                      <TableRow key={item.id} data-testid={`row-content-${item.id}`}>
                        <TableCell>{item.order}</TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground" />{item.title}</div>
                        </TableCell>
                        <TableCell><Badge variant="outline">{TYPE_LABELS[item.contentType]}</Badge></TableCell>
                        <TableCell className="max-w-xs truncate">
                          {item.externalUrl || item.fileName || '—'}
                        </TableCell>
                        <TableCell>{item.durationSeconds ? `${Math.round(item.durationSeconds / 60)} min` : '—'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => openDialog(item)} data-testid={`button-edit-content-${item.id}`}><Pencil className="h-3 w-3" /></Button>
                            <Button variant="outline" size="sm" onClick={() => deleteMutation.mutate(item.id)} data-testid={`button-delete-content-${item.id}`}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent data-testid="dialog-content-form">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Content" : "Add Content"}</DialogTitle>
            <DialogDescription>A video, document or link a learner works through for this course</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="content-title">Title *</Label>
              <Input id="content-title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g., Module 1 - Site Overview" data-testid="input-content-title" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="content-description">Description</Label>
              <Textarea id="content-description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} data-testid="input-content-description" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="content-type">Content Type</Label>
              <Select value={form.contentType} onValueChange={v => setForm({ ...form, contentType: v })} disabled={!!editing}>
                <SelectTrigger id="content-type" data-testid="select-content-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {(form.contentType === 'video_link' || form.contentType === 'link') && (
              <div className="space-y-2">
                <Label htmlFor="content-url">URL *</Label>
                <Input id="content-url" value={form.externalUrl} onChange={e => setForm({ ...form, externalUrl: e.target.value })} placeholder="https://..." data-testid="input-content-url" />
              </div>
            )}
            {isFileType && !editing && (
              <div className="space-y-2">
                <Label htmlFor="content-file">File *</Label>
                <Input id="content-file" type="file" onChange={e => setFile(e.target.files?.[0] || null)} data-testid="input-content-file" />
              </div>
            )}
            {isFileType && editing && (
              <div className="text-sm text-muted-foreground">
                {editing.fileName} - to replace the file, delete this item and add a new one.
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              {form.contentType.startsWith('video') && (
                <div className="space-y-2">
                  <Label htmlFor="content-duration">Duration (seconds)</Label>
                  <Input id="content-duration" type="number" min={0} value={form.durationSeconds} onChange={e => setForm({ ...form, durationSeconds: e.target.value })} data-testid="input-content-duration" />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="content-order">Order</Label>
                <Input id="content-order" type="number" value={form.order} onChange={e => setForm({ ...form, order: e.target.value })} data-testid="input-content-order" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={saveMetadataMutation.isPending || isUploading || (isFileType && !editing && !file)}
              data-testid="button-save-content"
            >
              {isFileType && !editing ? <Upload className="h-4 w-4 mr-2" /> : null}
              {saveMetadataMutation.isPending || isUploading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

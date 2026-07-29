import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Upload, FileText, Download, Trash2, ShieldCheck } from "lucide-react";
import { OPITO_CATEGORIES } from "@shared/schema";
import type { OpitoDocument } from "@shared/schema";

const SECTIONS = Array.from(new Set(OPITO_CATEGORIES.map(c => c.section)));

export default function OpitoAdmin() {
  const { toast } = useToast();
  const [uploadCategory, setUploadCategory] = useState<{ key: string; title: string } | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const { data: documents = [], isLoading } = useQuery<OpitoDocument[]>({
    queryKey: ['/api/opito/documents'],
  });

  const documentsByCategory = useMemo(() => {
    const map = new Map<string, OpitoDocument[]>();
    for (const doc of documents) {
      const list = map.get(doc.categoryKey) ?? [];
      list.push(doc);
      map.set(doc.categoryKey, list);
    }
    return map;
  }, [documents]);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!uploadCategory || !file) throw new Error("Choose a file first");
      const formData = new FormData();
      formData.append('file', file);
      formData.append('categoryKey', uploadCategory.key);
      formData.append('title', title || file.name);
      if (description) formData.append('description', description);
      const res = await fetch('/api/opito/documents', { method: 'POST', credentials: 'include', body: formData });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Failed to upload');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Uploaded" });
      queryClient.invalidateQueries({ queryKey: ['/api/opito/documents'] });
      setUploadCategory(null);
      setTitle("");
      setDescription("");
      setFile(null);
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/opito/documents/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Failed to delete');
    },
    onSuccess: () => {
      toast({ title: "Removed" });
      queryClient.invalidateQueries({ queryKey: ['/api/opito/documents'] });
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const openUploadDialog = (key: string, title: string) => {
    setUploadCategory({ key, title });
    setFile(null);
    setTitle("");
    setDescription("");
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-opito-admin">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <ShieldCheck className="h-7 w-7" />
          OPITO
        </h1>
        <p className="text-muted-foreground">Certification and audit evidence, organised by the assurance scheme's own categories</p>
        <p className="text-xs text-muted-foreground">
          <Badge variant="outline" className="mr-1.5">*</Badge>
          marks a core evidence category
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : (
        <Accordion type="multiple" defaultValue={[SECTIONS[0]]} className="space-y-2">
          {SECTIONS.map(section => (
            <AccordionItem key={section} value={section} className="border rounded-lg px-4">
              <AccordionTrigger data-testid={`accordion-section-${section}`}>{section}</AccordionTrigger>
              <AccordionContent className="space-y-4">
                {OPITO_CATEGORIES.filter(c => c.section === section).map(category => {
                  const docs = documentsByCategory.get(category.key) ?? [];
                  return (
                    <Card key={category.key} data-testid={`card-category-${category.key}`}>
                      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            {category.key} {category.title}
                            {'core' in category && category.core && <Badge variant="outline">*</Badge>}
                          </CardTitle>
                          <CardDescription>{docs.length} document(s)</CardDescription>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => openUploadDialog(category.key, category.title)} data-testid={`button-upload-${category.key}`}>
                          <Upload className="h-4 w-4 mr-2" />Upload
                        </Button>
                      </CardHeader>
                      {docs.length > 0 && (
                        <CardContent>
                          <div className="space-y-2">
                            {docs.map(doc => (
                              <div key={doc.id} className="flex items-center justify-between border rounded-md p-2" data-testid={`row-document-${doc.id}`}>
                                <div className="flex items-center gap-2 min-w-0">
                                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                  <div className="min-w-0">
                                    <div className="font-medium truncate">{doc.title}</div>
                                    {doc.description && <div className="text-xs text-muted-foreground truncate">{doc.description}</div>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <Button variant="ghost" size="sm" asChild data-testid={`button-download-${doc.id}`}>
                                    <a href={`/api/opito/documents/${doc.id}/download`} target="_blank" rel="noopener noreferrer">
                                      <Download className="h-3.5 w-3.5" />
                                    </a>
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => { if (confirm(`Remove "${doc.title}"?`)) deleteMutation.mutate(doc.id); }}
                                    data-testid={`button-delete-${doc.id}`}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      <Dialog open={!!uploadCategory} onOpenChange={(open) => !open && setUploadCategory(null)}>
        <DialogContent data-testid="dialog-upload-opito-document">
          <DialogHeader>
            <DialogTitle>Upload to {uploadCategory?.key} {uploadCategory?.title}</DialogTitle>
            <DialogDescription>Add a certification or audit evidence file to this category</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="opito-title">Title</Label>
              <Input id="opito-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Defaults to the file name" data-testid="input-opito-title" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="opito-description">Description</Label>
              <Textarea id="opito-description" value={description} onChange={e => setDescription(e.target.value)} rows={2} data-testid="input-opito-description" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="opito-file">File *</Label>
              <Input id="opito-file" type="file" onChange={e => setFile(e.target.files?.[0] || null)} data-testid="input-opito-file" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadCategory(null)}>Cancel</Button>
            <Button onClick={() => uploadMutation.mutate()} disabled={!file || uploadMutation.isPending} data-testid="button-submit-opito-upload">
              {uploadMutation.isPending ? "Uploading..." : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Pencil, Trash2, Building2, Mail, Phone, Globe } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { TrainingProvider } from "@shared/schema";

const providerFormSchema = z.object({
  name: z.string().min(1, "Provider name is required"),
  description: z.string().optional(),
  contactEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),
});

type ProviderFormData = z.infer<typeof providerFormSchema>;

export default function TrainingProvidersAdmin() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<TrainingProvider | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const form = useForm<ProviderFormData>({
    resolver: zodResolver(providerFormSchema),
    defaultValues: {
      name: "",
      description: "",
      contactEmail: "",
      contactPhone: "",
      website: "",
    },
  });

  // Fetch providers
  const { data: providers = [], isLoading } = useQuery<TrainingProvider[]>({
    queryKey: ['/api/training/providers'],
  });

  // Create/Update provider mutation
  const saveProviderMutation = useMutation({
    mutationFn: async (data: ProviderFormData) => {
      if (editingProvider) {
        return apiRequest('PUT', `/api/training/providers/${editingProvider.id}`, data);
      } else {
        return apiRequest('POST', '/api/training/providers', data);
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: editingProvider ? "Provider updated successfully" : "Provider created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/training/providers'] });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save provider",
        variant: "destructive",
      });
    },
  });

  // Delete provider mutation
  const deleteProviderMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/training/providers/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Provider deactivated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/training/providers'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete provider",
        variant: "destructive",
      });
    },
  });

  const handleOpenDialog = (provider?: TrainingProvider) => {
    if (provider) {
      setEditingProvider(provider);
      form.reset({
        name: provider.name,
        description: provider.description || "",
        contactEmail: provider.contactEmail || "",
        contactPhone: provider.contactPhone || "",
        website: provider.website || "",
      });
    } else {
      setEditingProvider(null);
      form.reset({
        name: "",
        description: "",
        contactEmail: "",
        contactPhone: "",
        website: "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingProvider(null);
    form.reset();
  };

  const handleSubmit = (data: ProviderFormData) => {
    saveProviderMutation.mutate(data);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to deactivate this provider?")) {
      deleteProviderMutation.mutate(id);
    }
  };

  const filteredProviders = providers.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-training-providers-admin">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Training Providers</h1>
          <p className="text-muted-foreground">Manage external training provider organizations</p>
        </div>
        <Button onClick={() => handleOpenDialog()} data-testid="button-add-provider">
          <Plus className="h-4 w-4 mr-2" />
          Add Provider
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <Input
          placeholder="Search providers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
          data-testid="input-search-providers"
        />
      </div>

      {/* Providers Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Training Providers</CardTitle>
          <CardDescription>{filteredProviders.length} provider(s) found</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading providers...</div>
          ) : filteredProviders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? "No providers match your search" : "No providers added yet"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Website</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProviders.map((provider) => (
                    <TableRow key={provider.id} data-testid={`row-provider-${provider.id}`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {provider.name}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{provider.description || "—"}</TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          {provider.contactEmail && (
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              {provider.contactEmail}
                            </div>
                          )}
                          {provider.contactPhone && (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              {provider.contactPhone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {provider.website && (
                          <a
                            href={provider.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-sm text-primary hover:underline"
                          >
                            <Globe className="h-3 w-3" />
                            Visit
                          </a>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={provider.isActive ? "default" : "secondary"}>
                          {provider.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenDialog(provider)}
                            data-testid={`button-edit-provider-${provider.id}`}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(provider.id)}
                            data-testid={`button-delete-provider-${provider.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-provider-form">
          <DialogHeader>
            <DialogTitle>{editingProvider ? "Edit Provider" : "Add New Provider"}</DialogTitle>
            <DialogDescription>
              {editingProvider ? "Update provider information" : "Add a new external training provider organization"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Provider Name *</Label>
              <Input
                id="name"
                {...form.register("name")}
                placeholder="e.g., Safety Training Institute"
                data-testid="input-provider-name"
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...form.register("description")}
                placeholder="Brief description of the provider..."
                rows={3}
                data-testid="input-provider-description"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Contact Email</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  {...form.register("contactEmail")}
                  placeholder="contact@provider.com"
                  data-testid="input-provider-email"
                />
                {form.formState.errors.contactEmail && (
                  <p className="text-sm text-destructive">{form.formState.errors.contactEmail.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactPhone">Contact Phone</Label>
                <Input
                  id="contactPhone"
                  {...form.register("contactPhone")}
                  placeholder="+44 20 1234 5678"
                  data-testid="input-provider-phone"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                {...form.register("website")}
                placeholder="https://www.provider.com"
                data-testid="input-provider-website"
              />
              {form.formState.errors.website && (
                <p className="text-sm text-destructive">{form.formState.errors.website.message}</p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog} data-testid="button-cancel">
                Cancel
              </Button>
              <Button type="submit" disabled={saveProviderMutation.isPending} data-testid="button-save-provider">
                {saveProviderMutation.isPending ? "Saving..." : editingProvider ? "Update Provider" : "Add Provider"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Pencil, Trash2, MapPin, Building2, Layers, RefreshCw } from "lucide-react";
import type { Location, BusinessUnit, JobFamily, User } from "@shared/schema";

function useEntityCrud<T extends { id: string }>(basePath: string, queryKey: string) {
  const { toast } = useToast();
  const { data = [], isLoading } = useQuery<T[]>({ queryKey: [queryKey] });

  const saveMutation = useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: any }) => {
      return id
        ? apiRequest('PATCH', `${basePath}/${id}`, data)
        : apiRequest('POST', basePath, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      toast({ title: "Saved" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to save", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('DELETE', `${basePath}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      toast({ title: "Deactivated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete", variant: "destructive" });
    },
  });

  return { items: data, isLoading, saveMutation, deleteMutation };
}

function LocationsTab() {
  const { items, isLoading, saveMutation, deleteMutation } = useEntityCrud<Location>('/api/org/locations', '/api/org/locations');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [form, setForm] = useState({ name: '', code: '', assetType: '', region: '' });

  const openDialog = (loc?: Location) => {
    setEditing(loc || null);
    setForm(loc ? { name: loc.name, code: loc.code || '', assetType: loc.assetType || '', region: loc.region || '' } : { name: '', code: '', assetType: '', region: '' });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    saveMutation.mutate({ id: editing?.id, data: form }, { onSuccess: () => setIsDialogOpen(false) });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Locations</CardTitle>
          <CardDescription>Physical sites and assets - platforms, terminals, offices</CardDescription>
        </div>
        <Button onClick={() => openDialog()} data-testid="button-add-location">
          <Plus className="h-4 w-4 mr-2" />
          Add Location
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No locations yet</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Asset Type</TableHead>
                <TableHead>Region</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(loc => (
                <TableRow key={loc.id} data-testid={`row-location-${loc.id}`}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />{loc.name}</div>
                  </TableCell>
                  <TableCell>{loc.code || '—'}</TableCell>
                  <TableCell>{loc.assetType || '—'}</TableCell>
                  <TableCell>{loc.region || '—'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openDialog(loc)} data-testid={`button-edit-location-${loc.id}`}><Pencil className="h-3 w-3" /></Button>
                      <Button variant="outline" size="sm" onClick={() => { if (confirm("Deactivate this location?")) deleteMutation.mutate(loc.id); }} data-testid={`button-delete-location-${loc.id}`}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent data-testid="dialog-location-form">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Location" : "Add Location"}</DialogTitle>
            <DialogDescription>Physical sites and assets used across job roles and users</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="location-name">Name *</Label>
              <Input id="location-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g., Rough 47-3B" data-testid="input-location-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location-code">Code</Label>
              <Input id="location-code" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} data-testid="input-location-code" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location-asset-type">Asset Type</Label>
              <Input id="location-asset-type" value={form.assetType} onChange={e => setForm({ ...form, assetType: e.target.value })} placeholder="e.g., Offshore Platform, Onshore Terminal, Office" data-testid="input-location-asset-type" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location-region">Region</Label>
              <Input id="location-region" value={form.region} onChange={e => setForm({ ...form, region: e.target.value })} data-testid="input-location-region" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saveMutation.isPending} data-testid="button-save-location">
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function BusinessUnitsTab() {
  const { items, isLoading, saveMutation, deleteMutation } = useEntityCrud<BusinessUnit>('/api/org/business-units', '/api/org/business-units');
  const { data: users = [] } = useQuery<User[]>({ queryKey: ['/api/users'] });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BusinessUnit | null>(null);
  const [form, setForm] = useState({ name: '', code: '', parentBusinessUnitId: '', leaderId: '' });

  const openDialog = (bu?: BusinessUnit) => {
    setEditing(bu || null);
    setForm(bu ? { name: bu.name, code: bu.code || '', parentBusinessUnitId: bu.parentBusinessUnitId || '', leaderId: bu.leaderId || '' } : { name: '', code: '', parentBusinessUnitId: '', leaderId: '' });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    const data = {
      name: form.name,
      code: form.code || null,
      parentBusinessUnitId: form.parentBusinessUnitId || null,
      leaderId: form.leaderId || null,
    };
    saveMutation.mutate({ id: editing?.id, data }, { onSuccess: () => setIsDialogOpen(false) });
  };

  const nameById = new Map(items.map(b => [b.id, b.name]));
  const userNameById = new Map(users.map(u => [u.id, `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email]));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Business Units</CardTitle>
          <CardDescription>Organisational divisions, with an optional parent unit and leader for rollup reporting</CardDescription>
        </div>
        <Button onClick={() => openDialog()} data-testid="button-add-business-unit">
          <Plus className="h-4 w-4 mr-2" />
          Add Business Unit
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No business units yet</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Parent Unit</TableHead>
                <TableHead>Leader</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(bu => (
                <TableRow key={bu.id} data-testid={`row-business-unit-${bu.id}`}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" />{bu.name}</div>
                  </TableCell>
                  <TableCell>{bu.code || '—'}</TableCell>
                  <TableCell>{bu.parentBusinessUnitId ? (nameById.get(bu.parentBusinessUnitId) || '—') : '—'}</TableCell>
                  <TableCell>{bu.leaderId ? (userNameById.get(bu.leaderId) || '—') : '—'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openDialog(bu)} data-testid={`button-edit-business-unit-${bu.id}`}><Pencil className="h-3 w-3" /></Button>
                      <Button variant="outline" size="sm" onClick={() => { if (confirm("Deactivate this business unit?")) deleteMutation.mutate(bu.id); }} data-testid={`button-delete-business-unit-${bu.id}`}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent data-testid="dialog-business-unit-form">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Business Unit" : "Add Business Unit"}</DialogTitle>
            <DialogDescription>Used for org structure, job role grouping and rollup reporting</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bu-name">Name *</Label>
              <Input id="bu-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} data-testid="input-business-unit-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bu-code">Code</Label>
              <Input id="bu-code" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} data-testid="input-business-unit-code" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bu-parent">Parent Business Unit</Label>
              <Select value={form.parentBusinessUnitId || 'none'} onValueChange={v => setForm({ ...form, parentBusinessUnitId: v === 'none' ? '' : v })}>
                <SelectTrigger id="bu-parent" data-testid="select-business-unit-parent"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {items.filter(b => b.id !== editing?.id).map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bu-leader">Leader</Label>
              <Select value={form.leaderId || 'none'} onValueChange={v => setForm({ ...form, leaderId: v === 'none' ? '' : v })}>
                <SelectTrigger id="bu-leader" data-testid="select-business-unit-leader"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {users.map(u => <SelectItem key={u.id} value={u.id}>{userNameById.get(u.id)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saveMutation.isPending} data-testid="button-save-business-unit">
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function JobFamiliesTab() {
  const { items, isLoading, saveMutation, deleteMutation } = useEntityCrud<JobFamily>('/api/org/job-families', '/api/org/job-families');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<JobFamily | null>(null);
  const [form, setForm] = useState({ name: '', code: '', description: '' });

  const openDialog = (jf?: JobFamily) => {
    setEditing(jf || null);
    setForm(jf ? { name: jf.name, code: jf.code || '', description: jf.description || '' } : { name: '', code: '', description: '' });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    saveMutation.mutate({ id: editing?.id, data: form }, { onSuccess: () => setIsDialogOpen(false) });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Job Families</CardTitle>
          <CardDescription>Groups of related job roles - e.g. a progression ladder within a discipline</CardDescription>
        </div>
        <Button onClick={() => openDialog()} data-testid="button-add-job-family">
          <Plus className="h-4 w-4 mr-2" />
          Add Job Family
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No job families yet</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(jf => (
                <TableRow key={jf.id} data-testid={`row-job-family-${jf.id}`}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2"><Layers className="h-4 w-4 text-muted-foreground" />{jf.name}</div>
                  </TableCell>
                  <TableCell>{jf.code || '—'}</TableCell>
                  <TableCell className="max-w-md truncate">{jf.description || '—'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openDialog(jf)} data-testid={`button-edit-job-family-${jf.id}`}><Pencil className="h-3 w-3" /></Button>
                      <Button variant="outline" size="sm" onClick={() => { if (confirm("Deactivate this job family?")) deleteMutation.mutate(jf.id); }} data-testid={`button-delete-job-family-${jf.id}`}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent data-testid="dialog-job-family-form">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Job Family" : "Add Job Family"}</DialogTitle>
            <DialogDescription>Group related job roles for reporting and progression planning</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="jf-name">Name *</Label>
              <Input id="jf-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g., Electrical Technical Family" data-testid="input-job-family-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jf-code">Code</Label>
              <Input id="jf-code" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} data-testid="input-job-family-code" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jf-description">Description</Label>
              <Textarea id="jf-description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} data-testid="input-job-family-description" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saveMutation.isPending} data-testid="button-save-job-family">
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function OrganisationStructureAdmin() {
  const { toast } = useToast();
  const backfillMutation = useMutation({
    mutationFn: async () => apiRequest('POST', '/api/org/backfill', {}),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/org/locations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/org/business-units'] });
      toast({
        title: "Backfill Complete",
        description: `${result.locationsCreated} locations and ${result.businessUnitsCreated} business units created from existing data; ${result.usersLinked} users and ${result.jobRolesLinked} job roles linked.`,
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Backfill failed", variant: "destructive" });
    },
  });

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-organisation-structure-admin">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Organisation Structure</h1>
          <p className="text-muted-foreground">Manage locations, business units and job families used across job roles and users</p>
        </div>
        <Button
          variant="outline"
          onClick={() => backfillMutation.mutate()}
          disabled={backfillMutation.isPending}
          data-testid="button-run-backfill"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${backfillMutation.isPending ? 'animate-spin' : ''}`} />
          {backfillMutation.isPending ? "Backfilling..." : "Backfill from Existing Data"}
        </Button>
      </div>

      <Tabs defaultValue="locations">
        <TabsList>
          <TabsTrigger value="locations" data-testid="tab-locations">Locations</TabsTrigger>
          <TabsTrigger value="business-units" data-testid="tab-business-units">Business Units</TabsTrigger>
          <TabsTrigger value="job-families" data-testid="tab-job-families">Job Families</TabsTrigger>
        </TabsList>
        <TabsContent value="locations" className="mt-4">
          <LocationsTab />
        </TabsContent>
        <TabsContent value="business-units" className="mt-4">
          <BusinessUnitsTab />
        </TabsContent>
        <TabsContent value="job-families" className="mt-4">
          <JobFamiliesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

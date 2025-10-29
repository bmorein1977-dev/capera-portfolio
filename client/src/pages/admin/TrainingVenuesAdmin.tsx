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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Pencil, Trash2, MapPin, Building, Users } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { TrainingVenue } from "@shared/schema";

const venueFormSchema = z.object({
  name: z.string().min(1, "Venue name is required"),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  isVirtual: z.boolean().default(false),
  capacity: z.coerce.number().int().min(1).optional(),
  amenities: z.string().optional(), // Comma-separated
});

type VenueFormData = z.infer<typeof venueFormSchema>;

export default function TrainingVenuesAdmin() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState<TrainingVenue | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const form = useForm<VenueFormData>({
    resolver: zodResolver(venueFormSchema),
    defaultValues: {
      name: "",
      address: "",
      city: "",
      country: "",
      latitude: "",
      longitude: "",
      isVirtual: false,
      capacity: undefined,
      amenities: "",
    },
  });

  // Fetch venues
  const { data: venues = [], isLoading } = useQuery<TrainingVenue[]>({
    queryKey: ['/api/training/venues'],
  });

  // Create/Update venue mutation
  const saveVenueMutation = useMutation({
    mutationFn: async (data: VenueFormData) => {
      const payload = {
        ...data,
        amenities: data.amenities ? data.amenities.split(',').map(a => a.trim()).filter(Boolean) : [],
      };
      if (editingVenue) {
        return apiRequest('PUT', `/api/training/venues/${editingVenue.id}`, payload);
      } else {
        return apiRequest('POST', '/api/training/venues', payload);
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: editingVenue ? "Venue updated successfully" : "Venue created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/training/venues'] });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save venue",
        variant: "destructive",
      });
    },
  });

  // Delete venue mutation
  const deleteVenueMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/training/venues/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Venue deactivated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/training/venues'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete venue",
        variant: "destructive",
      });
    },
  });

  const handleOpenDialog = (venue?: TrainingVenue) => {
    if (venue) {
      setEditingVenue(venue);
      form.reset({
        name: venue.name || "",
        address: venue.address || "",
        city: venue.city || "",
        country: venue.country || "",
        latitude: venue.latitude || "",
        longitude: venue.longitude || "",
        isVirtual: venue.isVirtual || false,
        capacity: venue.capacity || undefined,
        amenities: venue.amenities?.join(', ') || "",
      });
    } else {
      setEditingVenue(null);
      form.reset({
        name: "",
        address: "",
        city: "",
        country: "",
        latitude: "",
        longitude: "",
        isVirtual: false,
        capacity: undefined,
        amenities: "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingVenue(null);
    form.reset();
  };

  const handleSubmit = (data: VenueFormData) => {
    saveVenueMutation.mutate(data);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to deactivate this venue?")) {
      deleteVenueMutation.mutate(id);
    }
  };

  const filteredVenues = venues.filter(v =>
    v.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.country?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-training-venues-admin">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Training Venues</h1>
          <p className="text-muted-foreground">Manage physical locations and virtual platforms for training</p>
        </div>
        <Button onClick={() => handleOpenDialog()} data-testid="button-add-venue">
          <Plus className="h-4 w-4 mr-2" />
          Add Venue
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <Input
          placeholder="Search venues..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
          data-testid="input-search-venues"
        />
      </div>

      {/* Venues Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Training Venues</CardTitle>
          <CardDescription>{filteredVenues.length} venue(s) found</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading venues...</div>
          ) : filteredVenues.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? "No venues match your search" : "No venues added yet"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Capacity</TableHead>
                    <TableHead>Amenities</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVenues.map((venue) => (
                    <TableRow key={venue.id} data-testid={`row-venue-${venue.id}`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          {venue.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        {venue.city || venue.country ? (
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            {[venue.city, venue.country].filter(Boolean).join(', ')}
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={venue.isVirtual ? "secondary" : "outline"}>
                          {venue.isVirtual ? "Virtual" : "Physical"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {venue.capacity && (
                          <div className="flex items-center gap-1 text-sm">
                            <Users className="h-3 w-3 text-muted-foreground" />
                            {venue.capacity}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                        {venue.amenities?.join(', ') || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={venue.isActive ? "default" : "secondary"}>
                          {venue.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenDialog(venue)}
                            data-testid={`button-edit-venue-${venue.id}`}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(venue.id)}
                            data-testid={`button-delete-venue-${venue.id}`}
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-venue-form">
          <DialogHeader>
            <DialogTitle>{editingVenue ? "Edit Venue" : "Add New Venue"}</DialogTitle>
            <DialogDescription>
              {editingVenue ? "Update venue information" : "Add a new training venue location"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Venue Name *</Label>
              <Input
                id="name"
                {...form.register("name")}
                placeholder="e.g., London Training Center"
                data-testid="input-venue-name"
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="isVirtual"
                checked={form.watch("isVirtual")}
                onCheckedChange={(checked) => form.setValue("isVirtual", checked as boolean)}
                data-testid="checkbox-is-virtual"
              />
              <Label htmlFor="isVirtual" className="cursor-pointer">
                This is a virtual/online venue
              </Label>
            </div>

            {!form.watch("isVirtual") && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    {...form.register("address")}
                    placeholder="Street address..."
                    rows={2}
                    data-testid="input-venue-address"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      {...form.register("city")}
                      placeholder="e.g., London"
                      data-testid="input-venue-city"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      {...form.register("country")}
                      placeholder="e.g., United Kingdom"
                      data-testid="input-venue-country"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="latitude">Latitude (optional)</Label>
                    <Input
                      id="latitude"
                      {...form.register("latitude")}
                      placeholder="e.g., 51.5074"
                      data-testid="input-venue-latitude"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="longitude">Longitude (optional)</Label>
                    <Input
                      id="longitude"
                      {...form.register("longitude")}
                      placeholder="e.g., -0.1278"
                      data-testid="input-venue-longitude"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="capacity">Capacity</Label>
              <Input
                id="capacity"
                type="number"
                {...form.register("capacity")}
                placeholder="Maximum number of participants"
                data-testid="input-venue-capacity"
              />
              {form.formState.errors.capacity && (
                <p className="text-sm text-destructive">{form.formState.errors.capacity.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="amenities">Amenities (comma-separated)</Label>
              <Input
                id="amenities"
                {...form.register("amenities")}
                placeholder="e.g., WiFi, Parking, Catering, Projector"
                data-testid="input-venue-amenities"
              />
              <p className="text-xs text-muted-foreground">Separate multiple amenities with commas</p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog} data-testid="button-cancel">
                Cancel
              </Button>
              <Button type="submit" disabled={saveVenueMutation.isPending} data-testid="button-save-venue">
                {saveVenueMutation.isPending ? "Saving..." : editingVenue ? "Update Venue" : "Add Venue"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

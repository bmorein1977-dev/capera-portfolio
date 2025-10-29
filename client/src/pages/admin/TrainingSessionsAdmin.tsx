import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Pencil, Trash2, Calendar, MapPin, Users, Clock } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { CourseTrainingSession, ExternalTrainingCourse, TrainingVenue } from "@shared/schema";

const sessionFormSchema = z.object({
  courseId: z.string().min(1, "Course is required"),
  venueId: z.string().optional().nullable(),
  startAt: z.string().min(1, "Start date/time is required"),
  endAt: z.string().min(1, "End date/time is required"),
  capacity: z.coerce.number().int().min(1, "Must have at least 1 participant"),
  status: z.string().default("scheduled"),
  instructor: z.string().optional(),
  notes: z.string().optional(),
});

type SessionFormData = z.infer<typeof sessionFormSchema>;

type SessionWithDetails = CourseTrainingSession & {
  courseName?: string;
  venueName?: string;
};

export default function TrainingSessionsAdmin() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<CourseTrainingSession | null>(null);
  const [filterCourse, setFilterCourse] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const form = useForm<SessionFormData>({
    resolver: zodResolver(sessionFormSchema),
    defaultValues: {
      courseId: "",
      venueId: null,
      startAt: "",
      endAt: "",
      capacity: 20,
      status: "scheduled",
      instructor: "",
      notes: "",
    },
  });

  // Fetch sessions with course and venue details
  const { data: sessions = [], isLoading } = useQuery<SessionWithDetails[]>({
    queryKey: ['/api/course-training-sessions'],
  });

  // Fetch courses for dropdown
  const { data: courses = [] } = useQuery<ExternalTrainingCourse[]>({
    queryKey: ['/api/external-training-courses'],
  });

  // Fetch venues for dropdown
  const { data: venues = [] } = useQuery<TrainingVenue[]>({
    queryKey: ['/api/training/venues'],
  });

  // Create/Update session mutation
  const saveSessionMutation = useMutation({
    mutationFn: async (data: SessionFormData) => {
      const payload = {
        ...data,
        venueId: data.venueId || null,
        seatsRemaining: data.capacity, // Initialize seats remaining to capacity
      };
      if (editingSession) {
        return apiRequest('PUT', `/api/course-training-sessions/${editingSession.id}`, payload);
      } else {
        return apiRequest('POST', '/api/course-training-sessions', payload);
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: editingSession ? "Session updated successfully" : "Session created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/course-training-sessions'] });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save session",
        variant: "destructive",
      });
    },
  });

  // Delete session mutation
  const deleteSessionMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/course-training-sessions/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Session deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/course-training-sessions'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete session",
        variant: "destructive",
      });
    },
  });

  const handleOpenDialog = (session?: CourseTrainingSession) => {
    if (session) {
      setEditingSession(session);
      // Format dates for datetime-local input
      const formatForInput = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toISOString().slice(0, 16);
      };
      form.reset({
        courseId: session.courseId || "",
        venueId: session.venueId || null,
        startAt: formatForInput(session.startAt as any),
        endAt: formatForInput(session.endAt as any),
        capacity: session.capacity || 20,
        status: session.status || "scheduled",
        instructor: session.instructor || "",
        notes: session.notes || "",
      });
    } else {
      setEditingSession(null);
      form.reset({
        courseId: "",
        venueId: null,
        startAt: "",
        endAt: "",
        capacity: 20,
        status: "scheduled",
        instructor: "",
        notes: "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingSession(null);
    form.reset();
  };

  const handleSubmit = (data: SessionFormData) => {
    saveSessionMutation.mutate(data);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this session? All bookings will be affected.")) {
      deleteSessionMutation.mutate(id);
    }
  };

  const filteredSessions = sessions.filter(s => {
    if (filterCourse !== "all" && s.courseId !== filterCourse) return false;
    if (filterStatus !== "all" && s.status !== filterStatus) return false;
    return true;
  });

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getCourseName = (courseId: string | null) => {
    if (!courseId) return "—";
    const course = courses.find(c => c.id === courseId);
    return course?.title || "Unknown";
  };

  const getVenueName = (venueId: string | null) => {
    if (!venueId) return "Online/TBD";
    const venue = venues.find(v => v.id === venueId);
    return venue?.name || "Unknown";
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-training-sessions-admin">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Training Sessions</h1>
          <p className="text-muted-foreground">Schedule and manage training course sessions</p>
        </div>
        <Button onClick={() => handleOpenDialog()} data-testid="button-add-session">
          <Plus className="h-4 w-4 mr-2" />
          Add Session
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <Select value={filterCourse} onValueChange={setFilterCourse}>
          <SelectTrigger className="w-[250px]" data-testid="select-filter-course">
            <SelectValue placeholder="Filter by course" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Courses</SelectItem>
            {courses.map(course => (
              <SelectItem key={course.id} value={course.id}>
                {course.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]" data-testid="select-filter-status">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sessions Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Training Sessions</CardTitle>
          <CardDescription>{filteredSessions.length} session(s) found</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading sessions...</div>
          ) : filteredSessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No sessions found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course</TableHead>
                    <TableHead>Start Date/Time</TableHead>
                    <TableHead>End Date/Time</TableHead>
                    <TableHead>Venue</TableHead>
                    <TableHead>Capacity</TableHead>
                    <TableHead>Instructor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSessions.map((session) => (
                    <TableRow key={session.id} data-testid={`row-session-${session.id}`}>
                      <TableCell className="font-medium max-w-xs truncate">
                        {getCourseName(session.courseId)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {formatDateTime(session.startAt as any)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {formatDateTime(session.endAt as any)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {getVenueName(session.venueId)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Users className="h-3 w-3 text-muted-foreground" />
                          {(session.capacity - session.seatsRemaining) || 0}/{session.capacity}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{session.instructor || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={
                          session.status === 'scheduled' ? 'default' :
                          session.status === 'in_progress' ? 'secondary' :
                          session.status === 'cancelled' ? 'destructive' : 'outline'
                        }>
                          {session.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenDialog(session)}
                            data-testid={`button-edit-session-${session.id}`}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(session.id)}
                            data-testid={`button-delete-session-${session.id}`}
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-session-form">
          <DialogHeader>
            <DialogTitle>{editingSession ? "Edit Session" : "Schedule New Session"}</DialogTitle>
            <DialogDescription>
              {editingSession ? "Update session details" : "Schedule a new training session for a course"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="courseId">Course *</Label>
              <Controller
                name="courseId"
                control={form.control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger data-testid="select-course">
                      <SelectValue placeholder="Select course" />
                    </SelectTrigger>
                    <SelectContent>
                      {courses.map(course => (
                        <SelectItem key={course.id} value={course.id}>
                          {course.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.courseId && (
                <p className="text-sm text-destructive">{form.formState.errors.courseId.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startAt">Start Date & Time *</Label>
                <Input
                  id="startAt"
                  type="datetime-local"
                  {...form.register("startAt")}
                  data-testid="input-start-time"
                />
                {form.formState.errors.startAt && (
                  <p className="text-sm text-destructive">{form.formState.errors.startAt.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="endAt">End Date & Time *</Label>
                <Input
                  id="endAt"
                  type="datetime-local"
                  {...form.register("endAt")}
                  data-testid="input-end-time"
                />
                {form.formState.errors.endAt && (
                  <p className="text-sm text-destructive">{form.formState.errors.endAt.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="venueId">Venue</Label>
              <Controller
                name="venueId"
                control={form.control}
                render={({ field }) => (
                  <Select value={field.value || ""} onValueChange={(val) => field.onChange(val || null)}>
                    <SelectTrigger data-testid="select-venue">
                      <SelectValue placeholder="Select venue (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None / Online</SelectItem>
                      {venues.map(venue => (
                        <SelectItem key={venue.id} value={venue.id}>
                          {venue.name} {venue.city && `(${venue.city})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="capacity">Capacity *</Label>
                <Input
                  id="capacity"
                  type="number"
                  {...form.register("capacity")}
                  placeholder="e.g., 20"
                  data-testid="input-capacity"
                />
                {form.formState.errors.capacity && (
                  <p className="text-sm text-destructive">{form.formState.errors.capacity.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Controller
                  name="status"
                  control={form.control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger data-testid="select-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="instructor">Instructor Name</Label>
              <Input
                id="instructor"
                {...form.register("instructor")}
                placeholder="e.g., John Smith"
                data-testid="input-instructor"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                {...form.register("notes")}
                placeholder="Any special notes or requirements..."
                data-testid="input-notes"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog} data-testid="button-cancel">
                Cancel
              </Button>
              <Button type="submit" disabled={saveSessionMutation.isPending} data-testid="button-save-session">
                {saveSessionMutation.isPending ? "Saving..." : editingSession ? "Update Session" : "Create Session"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

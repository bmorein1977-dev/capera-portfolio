import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Search, Calendar, MapPin, Users, Clock, BookOpen, CheckCircle2 } from "lucide-react";
import type { ExternalTrainingCourse, CourseTrainingSession } from "@shared/schema";

type SessionWithVenue = CourseTrainingSession & {
  venueName?: string;
  city?: string;
  country?: string;
};

export default function TrainingCatalog() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModality, setSelectedModality] = useState<string>("all");
  const [selectedCourse, setSelectedCourse] = useState<ExternalTrainingCourse | null>(null);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionWithVenue | null>(null);

  // Fetch courses with filters
  const { data: courses = [], isLoading: isLoadingCourses } = useQuery<ExternalTrainingCourse[]>({
    queryKey: ['/api/external-training-courses', { query: searchQuery, modality: selectedModality !== 'all' ? selectedModality : undefined }],
  });

  // Fetch sessions for selected course
  const { data: sessions = [], isLoading: isLoadingSessions } = useQuery<SessionWithVenue[]>({
    queryKey: ['/api/course-training-sessions', selectedCourse?.id],
    enabled: !!selectedCourse,
  });

  // Fetch current user
  const { data: currentUser } = useQuery<{ id: string }>({
    queryKey: ['/api/auth/user'],
  });

  // Book session mutation
  const bookSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      // SECURITY: userId is derived server-side from authenticated session
      return apiRequest('POST', '/api/course-bookings', {
        sessionId,
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Your booking request has been submitted successfully.",
      });
      setBookingDialogOpen(false);
      setSelectedSession(null);
      queryClient.invalidateQueries({ queryKey: ['/api/course-bookings'] });
    },
    onError: (error: any) => {
      toast({
        title: "Booking Failed",
        description: error.message || "Failed to create booking. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleBookSession = (session: SessionWithVenue) => {
    setSelectedSession(session);
    setBookingDialogOpen(true);
  };

  const confirmBooking = () => {
    if (selectedSession) {
      bookSessionMutation.mutate(selectedSession.id);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-training-catalog">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold" data-testid="text-page-title">External Training Catalog</h1>
        <p className="text-muted-foreground">Browse and book training courses from external providers</p>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            data-testid="input-search-courses"
            placeholder="Search courses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedModality} onValueChange={setSelectedModality}>
          <SelectTrigger className="w-[180px]" data-testid="select-modality">
            <SelectValue placeholder="Modality" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modalities</SelectItem>
            <SelectItem value="in_person">In Person</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="hybrid">Hybrid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Course Listing */}
      {selectedCourse ? (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedCourse(null);
                setSelectedSession(null);
              }}
              data-testid="button-back-to-catalog"
            >
              ← Back to Catalog
            </Button>
            <h2 className="text-2xl font-bold">{selectedCourse.title}</h2>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Course Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">{selectedCourse.description}</p>
              <div className="flex flex-wrap gap-2">
                {selectedCourse.tags?.map((tag) => (
                  <Badge key={tag} variant="secondary">{tag}</Badge>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                {(selectedCourse as any).durationDays && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>Duration: {(selectedCourse as any).durationDays} days</span>
                  </div>
                )}
                {(selectedCourse as any).level && (
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    <span>Level: {(selectedCourse as any).level}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>Modality: {selectedCourse.modality?.replace('_', ' ') || 'N/A'}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Available Sessions */}
          <div>
            <h3 className="text-xl font-semibold mb-4">Available Sessions</h3>
            {isLoadingSessions ? (
              <div className="text-center py-8 text-muted-foreground">Loading sessions...</div>
            ) : sessions.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8 text-muted-foreground">
                  No sessions available at the moment.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {sessions.map((session) => (
                  <Card key={session.id} data-testid={`card-session-${session.id}`}>
                    <CardContent className="pt-6">
                      <div className="flex flex-wrap justify-between items-start gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              {formatDate(session.startAt as any)} - {formatDate(session.endAt as any)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              {formatTime(session.startAt as any)} - {formatTime(session.endAt as any)}
                            </span>
                          </div>
                          {session.venueName && (
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">
                                {session.venueName}, {session.city}, {session.country}
                              </span>
                            </div>
                          )}
                          {(session as any).maxParticipants && (
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">
                                {(session as any).maxParticipants} seats available
                              </span>
                            </div>
                          )}
                        </div>
                        <Button
                          onClick={() => handleBookSession(session)}
                          data-testid={`button-book-${session.id}`}
                        >
                          Book Session
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div>
          {isLoadingCourses ? (
            <div className="text-center py-12 text-muted-foreground">Loading courses...</div>
          ) : courses.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12 text-muted-foreground">
                No courses found. Try adjusting your search or filters.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map((course) => (
                <Card
                  key={course.id}
                  className="hover-elevate cursor-pointer"
                  onClick={() => setSelectedCourse(course)}
                  data-testid={`card-course-${course.id}`}
                >
                  <CardHeader>
                    <CardTitle className="line-clamp-2">{course.title}</CardTitle>
                    <CardDescription className="line-clamp-3">{course.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {course.tags?.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary">{tag}</Badge>
                      ))}
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      {(course as any).durationDays && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          <span>{(course as any).durationDays} days</span>
                        </div>
                      )}
                      {(course as any).level && (
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-3 w-3" />
                          <span>{(course as any).level}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Badge variant="outline">{course.modality?.replace('_', ' ') || 'N/A'}</Badge>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Booking Confirmation Dialog */}
      <Dialog open={bookingDialogOpen} onOpenChange={setBookingDialogOpen}>
        <DialogContent data-testid="dialog-booking-confirmation">
          <DialogHeader>
            <DialogTitle>Confirm Booking</DialogTitle>
            <DialogDescription>
              Are you sure you want to book this training session?
            </DialogDescription>
          </DialogHeader>
          {selectedSession && selectedCourse && (
            <div className="space-y-4 py-4">
              <div>
                <p className="font-semibold">{selectedCourse.title}</p>
                <p className="text-sm text-muted-foreground">{selectedCourse.description}</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{formatDate(selectedSession.startAt as any)} - {formatDate(selectedSession.endAt as any)}</span>
                </div>
                {selectedSession.venueName && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedSession.venueName}, {selectedSession.city}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBookingDialogOpen(false)}
              data-testid="button-cancel-booking"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmBooking}
              disabled={bookSessionMutation.isPending}
              data-testid="button-confirm-booking"
            >
              {bookSessionMutation.isPending ? "Booking..." : "Confirm Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

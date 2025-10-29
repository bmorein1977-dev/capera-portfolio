import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Calendar, MapPin, XCircle, Clock, BookOpen } from "lucide-react";
import type { CourseBooking } from "@shared/schema";

type BookingWithDetails = CourseBooking & {
  sessionInfo?: {
    startAt: string;
    endAt: string;
    venueId: string | null;
  };
  courseInfo?: {
    title: string;
    description: string;
    modality: string;
    durationDays: number;
  };
};

export default function MyBookings() {
  const { toast } = useToast();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingWithDetails | null>(null);

  // Fetch user's bookings
  const { data: bookings = [], isLoading } = useQuery<BookingWithDetails[]>({
    queryKey: ['/api/course-bookings'],
  });

  // Cancel booking mutation
  const cancelBookingMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      return apiRequest('DELETE', `/api/course-bookings/${bookingId}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Booking cancelled successfully.",
      });
      setCancelDialogOpen(false);
      setSelectedBooking(null);
      queryClient.invalidateQueries({ queryKey: ['/api/course-bookings'] });
    },
    onError: (error: any) => {
      toast({
        title: "Cancellation Failed",
        description: error.message || "Failed to cancel booking. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCancelBooking = (booking: BookingWithDetails) => {
    setSelectedBooking(booking);
    setCancelDialogOpen(true);
  };

  const confirmCancellation = () => {
    if (selectedBooking) {
      cancelBookingMutation.mutate(selectedBooking.id);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'cancelled':
        return 'destructive';
      case 'completed':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  // Separate bookings by status
  const activeBookings = bookings.filter(b => b.status === 'confirmed' || b.status === 'pending');
  const pastBookings = bookings.filter(b => b.status === 'completed' || b.status === 'cancelled');

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-my-bookings">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold" data-testid="text-page-title">My Training Bookings</h1>
        <p className="text-muted-foreground">View and manage your external training course bookings</p>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading bookings...</div>
      ) : bookings.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">You haven't made any training bookings yet.</p>
            <p className="text-sm text-muted-foreground mt-2">
              Browse the training catalog to find courses that match your development needs.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Active Bookings */}
          {activeBookings.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold">Active Bookings</h2>
              <div className="grid gap-4">
                {activeBookings.map((booking) => (
                  <Card key={booking.id} data-testid={`card-booking-${booking.id}`}>
                    <CardHeader>
                      <div className="flex justify-between items-start gap-4">
                        <div className="space-y-1 flex-1">
                          <CardTitle className="text-xl">
                            {booking.courseInfo?.title || 'Course Details Unavailable'}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {booking.courseInfo?.description}
                          </p>
                        </div>
                        <Badge variant={getStatusColor(booking.status)} data-testid={`status-${booking.id}`}>
                          {booking.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {booking.sessionInfo && (
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span>
                              {formatDate(booking.sessionInfo.startAt)} - {formatDate(booking.sessionInfo.endAt)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span>
                              {formatTime(booking.sessionInfo.startAt)} - {formatTime(booking.sessionInfo.endAt)}
                            </span>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm">
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                        <span>Modality: {booking.courseInfo?.modality?.replace('_', ' ') || 'N/A'}</span>
                      </div>
                      {booking.status !== 'cancelled' && booking.status !== 'completed' && (
                        <div className="pt-2">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleCancelBooking(booking)}
                            data-testid={`button-cancel-${booking.id}`}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Cancel Booking
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Past Bookings */}
          {pastBookings.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold">Past Bookings</h2>
              <div className="grid gap-4">
                {pastBookings.map((booking) => (
                  <Card key={booking.id} className="opacity-75" data-testid={`card-booking-${booking.id}`}>
                    <CardHeader>
                      <div className="flex justify-between items-start gap-4">
                        <div className="space-y-1 flex-1">
                          <CardTitle className="text-xl">
                            {booking.courseInfo?.title || 'Course Details Unavailable'}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {booking.courseInfo?.description}
                          </p>
                        </div>
                        <Badge variant={getStatusColor(booking.status)} data-testid={`status-${booking.id}`}>
                          {booking.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      {booking.sessionInfo && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {formatDate(booking.sessionInfo.startAt)} - {formatDate(booking.sessionInfo.endAt)}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                        <span>Modality: {booking.courseInfo?.modality?.replace('_', ' ') || 'N/A'}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cancellation Confirmation Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent data-testid="dialog-cancel-confirmation">
          <DialogHeader>
            <DialogTitle>Cancel Booking</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this booking? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {selectedBooking && (
            <div className="py-4">
              <p className="font-semibold">{selectedBooking.courseInfo?.title}</p>
              {selectedBooking.sessionInfo && (
                <p className="text-sm text-muted-foreground mt-2">
                  {formatDate(selectedBooking.sessionInfo.startAt)} - {formatDate(selectedBooking.sessionInfo.endAt)}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
              data-testid="button-cancel-dialog"
            >
              Keep Booking
            </Button>
            <Button
              variant="destructive"
              onClick={confirmCancellation}
              disabled={cancelBookingMutation.isPending}
              data-testid="button-confirm-cancel"
            >
              {cancelBookingMutation.isPending ? "Cancelling..." : "Cancel Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

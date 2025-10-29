import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CheckCircle2, XCircle, Calendar, User, BookOpen, MapPin } from "lucide-react";
import type { CourseBooking } from "@shared/schema";

type BookingWithDetails = CourseBooking & {
  userName?: string;
  userEmail?: string;
  courseName?: string;
  sessionStart?: string;
  sessionEnd?: string;
  venueName?: string;
};

export default function BookingManagementAdmin() {
  const { toast } = useToast();
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingWithDetails | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch all bookings with user and course details
  const { data: bookings = [], isLoading } = useQuery<BookingWithDetails[]>({
    queryKey: ['/api/course-bookings/admin'],
  });

  // Approve booking mutation
  const approveBookingMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      return apiRequest('PUT', `/api/course-bookings/${bookingId}/approve`, {});
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Booking approved successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/course-bookings/admin'] });
      setConfirmDialogOpen(false);
      setSelectedBooking(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve booking",
        variant: "destructive",
      });
    },
  });

  // Reject booking mutation
  const rejectBookingMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      return apiRequest('PUT', `/api/course-bookings/${bookingId}/reject`, {});
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Booking rejected successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/course-bookings/admin'] });
      setRejectDialogOpen(false);
      setSelectedBooking(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject booking",
        variant: "destructive",
      });
    },
  });

  // Cancel booking mutation
  const cancelBookingMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      return apiRequest('DELETE', `/api/course-bookings/${bookingId}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Booking cancelled successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/course-bookings/admin'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel booking",
        variant: "destructive",
      });
    },
  });

  const handleApprove = (booking: BookingWithDetails) => {
    setSelectedBooking(booking);
    setConfirmDialogOpen(true);
  };

  const handleReject = (booking: BookingWithDetails) => {
    setSelectedBooking(booking);
    setRejectDialogOpen(true);
  };

  const handleCancel = (booking: BookingWithDetails) => {
    if (confirm("Are you sure you want to cancel this booking?")) {
      cancelBookingMutation.mutate(booking.id);
    }
  };

  const confirmApproval = () => {
    if (selectedBooking) {
      approveBookingMutation.mutate(selectedBooking.id);
    }
  };

  const confirmRejection = () => {
    if (selectedBooking) {
      rejectBookingMutation.mutate(selectedBooking.id);
    }
  };

  const filteredBookings = bookings.filter(b => {
    if (filterStatus !== "all" && b.status !== filterStatus) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        b.userName?.toLowerCase().includes(query) ||
        b.userEmail?.toLowerCase().includes(query) ||
        b.courseName?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const formatDateTime = (dateStr: string | undefined) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
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

  const statusCounts = {
    all: bookings.length,
    pending: bookings.filter(b => b.status === 'pending').length,
    confirmed: bookings.filter(b => b.status === 'confirmed').length,
    cancelled: bookings.filter(b => b.status === 'cancelled').length,
    completed: bookings.filter(b => b.status === 'completed').length,
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-booking-management-admin">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Course Booking Management</h1>
        <p className="text-muted-foreground">Review and manage all training course bookings</p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="hover-elevate cursor-pointer" onClick={() => setFilterStatus("all")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts.all}</div>
          </CardContent>
        </Card>
        <Card className="hover-elevate cursor-pointer" onClick={() => setFilterStatus("pending")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{statusCounts.pending}</div>
          </CardContent>
        </Card>
        <Card className="hover-elevate cursor-pointer" onClick={() => setFilterStatus("confirmed")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Confirmed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{statusCounts.confirmed}</div>
          </CardContent>
        </Card>
        <Card className="hover-elevate cursor-pointer" onClick={() => setFilterStatus("completed")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{statusCounts.completed}</div>
          </CardContent>
        </Card>
        <Card className="hover-elevate cursor-pointer" onClick={() => setFilterStatus("cancelled")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Cancelled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{statusCounts.cancelled}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <Input
          placeholder="Search by user or course..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
          data-testid="input-search-bookings"
        />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]" data-testid="select-filter-status">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bookings Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Course Bookings</CardTitle>
          <CardDescription>{filteredBookings.length} booking(s) found</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading bookings...</div>
          ) : filteredBookings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery || filterStatus !== "all" ? "No bookings match your filters" : "No bookings yet"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Session Date</TableHead>
                    <TableHead>Venue</TableHead>
                    <TableHead>Booked At</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBookings.map((booking) => (
                    <TableRow key={booking.id} data-testid={`row-booking-${booking.id}`}>
                      <TableCell>
                        <div className="flex items-start gap-2">
                          <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div>
                            <div className="font-medium">{booking.userName || "Unknown User"}</div>
                            <div className="text-xs text-muted-foreground">{booking.userEmail}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{booking.courseName || "Unknown Course"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {formatDateTime(booking.sessionStart)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {booking.venueName || "Online/TBD"}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(booking.createdAt as any)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(booking.status)}>
                          {booking.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {booking.status === 'pending' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleApprove(booking)}
                                data-testid={`button-approve-${booking.id}`}
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Approve
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleReject(booking)}
                                data-testid={`button-reject-${booking.id}`}
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                Reject
                              </Button>
                            </>
                          )}
                          {(booking.status === 'pending' || booking.status === 'confirmed') && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCancel(booking)}
                              data-testid={`button-cancel-${booking.id}`}
                            >
                              <XCircle className="h-3 w-3" />
                            </Button>
                          )}
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

      {/* Approve Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent data-testid="dialog-approve-booking">
          <DialogHeader>
            <DialogTitle>Approve Booking</DialogTitle>
            <DialogDescription>
              Are you sure you want to approve this booking?
            </DialogDescription>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-2 py-4">
              <p><strong>User:</strong> {selectedBooking.userName}</p>
              <p><strong>Course:</strong> {selectedBooking.courseName}</p>
              <p><strong>Session:</strong> {formatDateTime(selectedBooking.sessionStart)}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)} data-testid="button-cancel-approve">
              Cancel
            </Button>
            <Button onClick={confirmApproval} disabled={approveBookingMutation.isPending} data-testid="button-confirm-approve">
              {approveBookingMutation.isPending ? "Approving..." : "Approve Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Confirmation Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent data-testid="dialog-reject-booking">
          <DialogHeader>
            <DialogTitle>Reject Booking</DialogTitle>
            <DialogDescription>
              Are you sure you want to reject this booking? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-2 py-4">
              <p><strong>User:</strong> {selectedBooking.userName}</p>
              <p><strong>Course:</strong> {selectedBooking.courseName}</p>
              <p><strong>Session:</strong> {formatDateTime(selectedBooking.sessionStart)}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)} data-testid="button-cancel-reject">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmRejection}
              disabled={rejectBookingMutation.isPending}
              data-testid="button-confirm-reject"
            >
              {rejectBookingMutation.isPending ? "Rejecting..." : "Reject Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

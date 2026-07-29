import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CheckCircle2, XCircle, Calendar, User, BookOpen, MapPin, ClipboardList, Pencil, DollarSign, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import type { CourseBooking, CourseTrainingSession, TrainingRequest } from "@shared/schema";

type BookingWithDetails = CourseBooking & {
  userName?: string;
  userEmail?: string;
  courseName?: string;
  sessionStart?: string;
  sessionEnd?: string;
  venueName?: string;
};

type PendingRequest = TrainingRequest & { requestorName: string; trainingName: string };

const REQUEST_TYPE_LABELS: Record<string, string> = { date_request: "Date Request", approval: "Approved - Ready to Book" };

function formatDateTime(dateStr: string | undefined) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// Books a session against a request that's either a Mandatory date-request or an already-approved
// discretionary/role-specific request - the same generic courseBookings creation + trainingEnrollments
// bridge either way, since by this point both kinds of request are just "ready to book".
function FulfillRequestDialog({ request, open, onClose }: { request: PendingRequest; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [cost, setCost] = useState("");

  const { data: sessions = [], isLoading } = useQuery<Array<CourseTrainingSession & { venueName?: string }>>({
    queryKey: [`/api/trainings/${request.trainingId}/external-sessions`],
    enabled: open,
  });

  const fulfillMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await apiRequest('PUT', `/api/training-requests/${request.id}/fulfill`, {
        sessionId,
        cost: cost ? parseFloat(cost) : undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Booked", description: `${request.requestorName} has been booked onto ${request.trainingName}.` });
      queryClient.invalidateQueries({ queryKey: ['/api/training-requests/pending-fulfillment'] });
      queryClient.invalidateQueries({ queryKey: ['/api/course-bookings/admin'] });
      onClose();
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid={`dialog-fulfill-${request.id}`}>
        <DialogHeader>
          <DialogTitle>Book {request.requestorName} onto {request.trainingName}</DialogTitle>
          <DialogDescription>
            {request.requestType === 'date_request'
              ? `Preferred dates: ${request.comment}${request.preferredVenue ? ` · Preferred venue: ${request.preferredVenue}` : ''}`
              : `Approved ${request.requirementLevel === 'R' ? 'Role Specific' : 'Discretionary'} request`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor={`fulfill-cost-${request.id}`}>Cost (optional)</Label>
          <Input
            id={`fulfill-cost-${request.id}`}
            type="number"
            min={0}
            step="0.01"
            value={cost}
            onChange={e => setCost(e.target.value)}
            placeholder="e.g., 450.00"
            data-testid={`input-fulfill-cost-${request.id}`}
          />
        </div>

        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground text-sm">Loading sessions...</div>
        ) : sessions.length === 0 ? (
          <div className="text-sm text-muted-foreground space-y-2 py-2">
            <p>No sessions are scheduled for this course yet.</p>
            <Link href="/admin/training-sessions" className="inline-flex items-center gap-1 text-primary hover:underline" data-testid="link-create-session">
              Create one on Training Sessions <ExternalLink className="h-3 w-3" />
            </Link>
            <p>then come back here to fulfill this request.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map(s => (
              <div key={s.id} className="flex items-center justify-between border rounded-md p-3" data-testid={`fulfill-session-option-${s.id}`}>
                <div className="text-sm">
                  <div className="font-medium">{formatDateTime(s.startAt as any)}</div>
                  {s.venueName && <div className="text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{s.venueName}</div>}
                  <div className="text-muted-foreground">{s.seatsRemaining} seat(s) remaining</div>
                </div>
                <Button size="sm" onClick={() => fulfillMutation.mutate(s.id)} disabled={fulfillMutation.isPending} data-testid={`button-fulfill-session-${s.id}`}>
                  Book
                </Button>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditCostDialog({ booking, open, onClose }: { booking: BookingWithDetails; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [cost, setCost] = useState(booking.cost ?? "");

  const updateCostMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('PUT', `/api/course-bookings/${booking.id}`, { cost: cost || null });
    },
    onSuccess: () => {
      toast({ title: "Cost updated" });
      queryClient.invalidateQueries({ queryKey: ['/api/course-bookings/admin'] });
      onClose();
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid={`dialog-edit-cost-${booking.id}`}>
        <DialogHeader>
          <DialogTitle>Cost for {booking.courseName}</DialogTitle>
          <DialogDescription>{booking.userName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={`cost-${booking.id}`}>Cost</Label>
          <Input
            id={`cost-${booking.id}`}
            type="number"
            min={0}
            step="0.01"
            value={cost}
            onChange={e => setCost(e.target.value)}
            data-testid={`input-cost-${booking.id}`}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => updateCostMutation.mutate()} disabled={updateCostMutation.isPending} data-testid={`button-save-cost-${booking.id}`}>
            {updateCostMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function BookingManagementAdmin() {
  const { toast } = useToast();
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingWithDetails | null>(null);
  const [costEditBooking, setCostEditBooking] = useState<BookingWithDetails | null>(null);
  const [fulfillRequest, setFulfillRequest] = useState<PendingRequest | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch all bookings with user and course details
  const { data: bookings = [], isLoading } = useQuery<BookingWithDetails[]>({
    queryKey: ['/api/course-bookings/admin'],
  });

  const { data: pendingRequests = [], isLoading: requestsLoading } = useQuery<PendingRequest[]>({
    queryKey: ['/api/training-requests/pending-fulfillment'],
  });

  // Approve/reject use the generic booking update route with an explicit status - there's no
  // dedicated /approve or /reject endpoint. "Rejected" and "Cancelled" (the separate Cancel action
  // below) are deliberately distinct status values even though both end a booking, so admins can
  // tell "never approved" apart from "was confirmed, then pulled" in the status history.
  const approveBookingMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      return apiRequest('PUT', `/api/course-bookings/${bookingId}`, { status: 'confirmed' });
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
      return apiRequest('PUT', `/api/course-bookings/${bookingId}`, { status: 'rejected' });
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'cancelled':
      case 'rejected':
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
    rejected: bookings.filter(b => b.status === 'rejected').length,
    cancelled: bookings.filter(b => b.status === 'cancelled').length,
    completed: bookings.filter(b => b.status === 'completed').length,
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-booking-management-admin">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Course Booking Management</h1>
        <p className="text-muted-foreground">Review and manage all training course bookings</p>
      </div>

      <Tabs defaultValue="bookings">
        <TabsList>
          <TabsTrigger value="bookings" data-testid="tab-bookings">All Bookings</TabsTrigger>
          <TabsTrigger value="requests" data-testid="tab-requests">
            Pending Requests
            {pendingRequests.length > 0 && (
              <Badge variant="secondary" className="ml-2">{pendingRequests.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bookings" className="space-y-6 mt-4">
      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
        <Card className="hover-elevate cursor-pointer" onClick={() => setFilterStatus("rejected")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{statusCounts.rejected}</div>
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
            <SelectItem value="rejected">Rejected</SelectItem>
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
                    <TableHead>Cost</TableHead>
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
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-1 -m-1"
                          onClick={() => setCostEditBooking(booking)}
                          data-testid={`button-edit-cost-${booking.id}`}
                        >
                          {booking.cost ? (
                            <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{booking.cost}</span>
                          ) : (
                            <span className="text-muted-foreground flex items-center gap-1"><Pencil className="h-3 w-3" />Set cost</span>
                          )}
                        </Button>
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
        </TabsContent>

        <TabsContent value="requests" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Requests Ready to Book</CardTitle>
              <CardDescription>
                Mandatory training with preferred dates submitted, plus discretionary/role-specific
                requests that have already been approved
              </CardDescription>
            </CardHeader>
            <CardContent>
              {requestsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : pendingRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No requests waiting to be booked</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingRequests.map(r => (
                    <div key={r.id} className="border rounded-lg p-4 flex items-start justify-between gap-4" data-testid={`row-pending-request-${r.id}`}>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{r.trainingName}</span>
                          <Badge variant="outline">{REQUEST_TYPE_LABELS[r.requestType]}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {r.requestorName} · {r.createdAt ? formatDateTime(r.createdAt as any) : '—'}
                        </div>
                        <div className="text-sm">{r.comment}</div>
                        {r.preferredVenue && <div className="text-sm text-muted-foreground">Preferred venue: {r.preferredVenue}</div>}
                      </div>
                      <Button size="sm" onClick={() => setFulfillRequest(r)} data-testid={`button-fulfill-${r.id}`}>
                        Fulfill
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {fulfillRequest && (
        <FulfillRequestDialog request={fulfillRequest} open={!!fulfillRequest} onClose={() => setFulfillRequest(null)} />
      )}
      {costEditBooking && (
        <EditCostDialog booking={costEditBooking} open={!!costEditBooking} onClose={() => setCostEditBooking(null)} />
      )}

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

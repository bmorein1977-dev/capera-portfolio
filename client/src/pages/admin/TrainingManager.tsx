import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import TrainingProvidersAdmin from "./TrainingProvidersAdmin";
import TrainingVenuesAdmin from "./TrainingVenuesAdmin";
import TrainingCoursesAdmin from "./TrainingCoursesAdmin";
import TrainingSessionsAdmin from "./TrainingSessionsAdmin";
import TrainingPolicyMatrixAdmin from "./TrainingPolicyMatrixAdmin";
import BookingManagementAdmin from "./BookingManagementAdmin";
import { Building2, MapPin, BookOpen, Calendar, Shield, ClipboardList } from "lucide-react";

export default function TrainingManager() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="heading-training-manager">Training Manager</h1>
        <p className="text-muted-foreground mt-2">
          Manage external training providers, courses, sessions, and policies
        </p>
      </div>

      <Tabs defaultValue="providers" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-grid" data-testid="tabs-training-manager">
          <TabsTrigger value="providers" className="gap-2" data-testid="tab-providers">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Providers</span>
          </TabsTrigger>
          <TabsTrigger value="venues" className="gap-2" data-testid="tab-venues">
            <MapPin className="h-4 w-4" />
            <span className="hidden sm:inline">Venues</span>
          </TabsTrigger>
          <TabsTrigger value="courses" className="gap-2" data-testid="tab-courses">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Courses</span>
          </TabsTrigger>
          <TabsTrigger value="sessions" className="gap-2" data-testid="tab-sessions">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Sessions</span>
          </TabsTrigger>
          <TabsTrigger value="policy" className="gap-2" data-testid="tab-policy">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Policy</span>
          </TabsTrigger>
          <TabsTrigger value="bookings" className="gap-2" data-testid="tab-bookings">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Bookings</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className="space-y-4">
          <TrainingProvidersAdmin />
        </TabsContent>

        <TabsContent value="venues" className="space-y-4">
          <TrainingVenuesAdmin />
        </TabsContent>

        <TabsContent value="courses" className="space-y-4">
          <TrainingCoursesAdmin />
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4">
          <TrainingSessionsAdmin />
        </TabsContent>

        <TabsContent value="policy" className="space-y-4">
          <TrainingPolicyMatrixAdmin />
        </TabsContent>

        <TabsContent value="bookings" className="space-y-4">
          <BookingManagementAdmin />
        </TabsContent>
      </Tabs>
    </div>
  );
}

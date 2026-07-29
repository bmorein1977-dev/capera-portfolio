import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, Calendar, Users, Download } from "lucide-react";
import type { TrainingCostReport } from "@shared/schema";

function formatCurrency(n: number): string {
  return n.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' });
}

function formatMonth(month: string): string {
  const [year, m] = month.split('-');
  return new Date(Number(year), Number(m) - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

export default function TrainingCostReportPage() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const params = new URLSearchParams();
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  const queryString = params.toString();

  const { data: report, isLoading } = useQuery<TrainingCostReport>({
    queryKey: [`/api/reports/training-cost-activity${queryString ? `?${queryString}` : ''}`],
  });

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-training-cost-report">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Training Cost &amp; Activity Report</h1>
          <p className="text-muted-foreground">Confirmed and completed course bookings only</p>
        </div>
        <Button
          variant="outline"
          onClick={() => window.open(`/api/reports/training-cost-activity/export${queryString ? `?${queryString}` : ''}`, '_blank')}
          data-testid="button-export-cost-report"
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          <div className="space-y-2">
            <Label htmlFor="report-start-date">From</Label>
            <Input id="report-start-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} data-testid="input-report-start-date" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-end-date">To</Label>
            <Input id="report-end-date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} data-testid="input-report-end-date" />
          </div>
          {(startDate || endDate) && (
            <Button variant="ghost" onClick={() => { setStartDate(""); setEndDate(""); }} data-testid="button-clear-report-dates">
              Clear
            </Button>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading report...</div>
      ) : !report ? (
        <div className="text-center py-8 text-muted-foreground">No data available</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />Total Cost
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="stat-total-cost">{formatCurrency(report.summary.totalCost)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />Total Bookings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="stat-total-bookings">{report.summary.totalBookings}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />Persons Trained
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="stat-persons-trained">{report.summary.personsTrainedCount}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>By Month</CardTitle>
              <CardDescription>Grouped by the training session's own date</CardDescription>
            </CardHeader>
            <CardContent>
              {report.byMonth.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">No bookings in this range</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Bookings</TableHead>
                      <TableHead className="text-right">Persons Trained</TableHead>
                      <TableHead className="text-right">Total Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.byMonth.map(row => (
                      <TableRow key={row.month} data-testid={`row-month-${row.month}`}>
                        <TableCell>{formatMonth(row.month)}</TableCell>
                        <TableCell className="text-right">{row.bookingsCount}</TableCell>
                        <TableCell className="text-right">{row.personsTrainedCount}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(row.totalCost)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>By Course</CardTitle>
              <CardDescription>Highest spend first</CardDescription>
            </CardHeader>
            <CardContent>
              {report.byCourse.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">No bookings in this range</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Course</TableHead>
                      <TableHead className="text-right">Bookings</TableHead>
                      <TableHead className="text-right">Total Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.byCourse.map(row => (
                      <TableRow key={row.courseName} data-testid={`row-course-${row.courseName}`}>
                        <TableCell>{row.courseName}</TableCell>
                        <TableCell className="text-right">{row.bookingsCount}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(row.totalCost)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

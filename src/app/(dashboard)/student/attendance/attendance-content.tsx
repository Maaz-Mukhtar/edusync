"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle2, XCircle, Clock, AlertCircle, Calendar, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AttendanceHistoryData } from "@/lib/data/student";

interface AttendanceContentProps {
  data: AttendanceHistoryData;
}

const STATUS_CONFIG = {
  PRESENT: {
    label: "Present",
    icon: CheckCircle2,
    color: "text-green-600",
    bgColor: "bg-green-100",
    badgeVariant: "default" as const,
  },
  ABSENT: {
    label: "Absent",
    icon: XCircle,
    color: "text-red-600",
    bgColor: "bg-red-100",
    badgeVariant: "destructive" as const,
  },
  LATE: {
    label: "Late",
    icon: Clock,
    color: "text-yellow-600",
    bgColor: "bg-yellow-100",
    badgeVariant: "secondary" as const,
  },
  EXCUSED: {
    label: "Excused",
    icon: AlertCircle,
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    badgeVariant: "outline" as const,
  },
};

export default function AttendanceContent({ data }: AttendanceContentProps) {
  const [filterMonth, setFilterMonth] = useState<string>("all");

  const { stats, monthlyStats, records } = data;

  // Filter records by month
  const filteredRecords = filterMonth === "all"
    ? records
    : records.filter((r) => {
        const date = new Date(r.date);
        const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
        return monthKey === filterMonth;
      });

  // Get unique months for filter
  const availableMonths = Array.from(
    new Set(
      records.map((r) => {
        const date = new Date(r.date);
        return `${date.getFullYear()}-${date.getMonth()}`;
      })
    )
  ).map((key) => {
    const [year, month] = key.split("-").map(Number);
    const monthNames = ["January", "February", "March", "April", "May", "June",
                        "July", "August", "September", "October", "November", "December"];
    return {
      value: key,
      label: `${monthNames[month]} ${year}`,
    };
  });

  const getPercentageColor = (percentage: number) => {
    if (percentage >= 90) return "text-green-600";
    if (percentage >= 75) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Attendance</h1>
        <p className="text-muted-foreground">
          {data.className} - {data.sectionName} attendance history
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Overall Attendance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", getPercentageColor(stats.percentage))}>
              {stats.percentage}%
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.presentDays + stats.lateDays} / {stats.totalDays} days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Present
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.presentDays}</div>
            <p className="text-xs text-muted-foreground">days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <XCircle className="h-4 w-4 text-red-600" />
              Absent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.absentDays}</div>
            <p className="text-xs text-muted-foreground">days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Clock className="h-4 w-4 text-yellow-600" />
              Late
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.lateDays}</div>
            <p className="text-xs text-muted-foreground">days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              Excused
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.excusedDays}</div>
            <p className="text-xs text-muted-foreground">days</p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trend */}
      {monthlyStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Monthly Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              {monthlyStats.map((month) => (
                <div
                  key={`${month.month}-${month.year}`}
                  className="text-center p-3 rounded-lg border"
                >
                  <p className="text-sm font-medium">{month.month} {month.year}</p>
                  <p className={cn("text-2xl font-bold", getPercentageColor(month.percentage))}>
                    {month.percentage}%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {month.present + month.late} / {month.total}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Attendance Records */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Attendance Records
            </CardTitle>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Records</SelectItem>
                {availableMonths.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredRecords.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Day</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.slice(0, 50).map((record) => {
                  const config = STATUS_CONFIG[record.status];
                  const StatusIcon = config.icon;
                  const date = new Date(record.date);
                  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

                  return (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {date.toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </TableCell>
                      <TableCell>{dayNames[date.getDay()]}</TableCell>
                      <TableCell>
                        <Badge variant={config.badgeVariant} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {record.remarks || "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No attendance records found</p>
            </div>
          )}
          {filteredRecords.length > 50 && (
            <p className="text-sm text-muted-foreground text-center mt-4">
              Showing first 50 records of {filteredRecords.length}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

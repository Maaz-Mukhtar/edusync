"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { fetcher, swrConfig } from "@/lib/swr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckSquare,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Save,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

interface Section {
  id: string;
  name: string;
  studentCount: number;
  isMarkedToday: boolean;
  isClassTeacher: boolean;
}

interface AttendanceRecord {
  studentId: string;
  rollNumber: string | null;
  studentName: string;
  status: AttendanceStatus | null;
  remarks: string | null;
}

interface AttendanceData {
  date: string;
  isMarked: boolean;
  records: AttendanceRecord[];
}

const statusConfig: Record<AttendanceStatus, { icon: typeof CheckCircle; color: string; bg: string }> = {
  PRESENT: { icon: CheckCircle, color: "text-green-600", bg: "bg-green-100 hover:bg-green-200" },
  ABSENT: { icon: XCircle, color: "text-red-600", bg: "bg-red-100 hover:bg-red-200" },
  LATE: { icon: Clock, color: "text-yellow-600", bg: "bg-yellow-100 hover:bg-yellow-200" },
  EXCUSED: { icon: AlertCircle, color: "text-blue-600", bg: "bg-blue-100 hover:bg-blue-200" },
};

interface SectionsResponse {
  sections: Section[];
}

export default function TeacherAttendancePage() {
  const searchParams = useSearchParams();
  const initialSectionId = searchParams.get("section");

  // Fetch sections with SWR
  const { data: sectionsData, isLoading: loading } = useSWR<SectionsResponse>(
    "/api/teacher/attendance",
    fetcher,
    swrConfig
  );
  const sections = sectionsData?.sections || [];

  const [selectedSectionId, setSelectedSectionId] = useState<string>(initialSectionId || "");
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [attendanceData, setAttendanceData] = useState<AttendanceData | null>(null);
  const [localRecords, setLocalRecords] = useState<Map<string, { status: AttendanceStatus; remarks: string }>>(
    new Map()
  );
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Set initial section when data loads
  useEffect(() => {
    if (!selectedSectionId && sections.length > 0) {
      setSelectedSectionId(initialSectionId || sections[0].id);
    }
  }, [sections, selectedSectionId, initialSectionId]);

  // Fetch attendance for selected section and date
  const fetchAttendance = useCallback(async () => {
    if (!selectedSectionId || !selectedDate) return;

    setLoadingAttendance(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/teacher/attendance?sectionId=${selectedSectionId}&date=${selectedDate}`
      );
      if (response.ok) {
        const result = await response.json();
        setAttendanceData(result);

        // Initialize local records
        const records = new Map<string, { status: AttendanceStatus; remarks: string }>();
        result.records.forEach((r: AttendanceRecord) => {
          if (r.status) {
            records.set(r.studentId, { status: r.status, remarks: r.remarks || "" });
          }
        });
        setLocalRecords(records);
      }
    } catch (error) {
      console.error("Failed to fetch attendance:", error);
      setError("Failed to load attendance data");
    } finally {
      setLoadingAttendance(false);
    }
  }, [selectedSectionId, selectedDate]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setLocalRecords((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(studentId);
      newMap.set(studentId, { status, remarks: existing?.remarks || "" });
      return newMap;
    });
  };

  const handleRemarksChange = (studentId: string, remarks: string) => {
    setLocalRecords((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(studentId);
      if (existing) {
        newMap.set(studentId, { ...existing, remarks });
      }
      return newMap;
    });
  };

  const markAllPresent = () => {
    if (!attendanceData) return;
    const newMap = new Map<string, { status: AttendanceStatus; remarks: string }>();
    attendanceData.records.forEach((r) => {
      newMap.set(r.studentId, { status: "PRESENT", remarks: "" });
    });
    setLocalRecords(newMap);
  };

  const saveAttendance = async () => {
    if (!selectedSectionId || localRecords.size === 0) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    const records = Array.from(localRecords.entries()).map(([studentId, data]) => ({
      studentId,
      status: data.status,
      remarks: data.remarks || undefined,
    }));

    try {
      const response = await fetch("/api/teacher/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionId: selectedSectionId,
          date: selectedDate,
          records,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setSuccess(result.message);
        // Refresh attendance data
        fetchAttendance();
      } else {
        const result = await response.json();
        setError(result.error || "Failed to save attendance");
      }
    } catch (error) {
      console.error("Failed to save attendance:", error);
      setError("Failed to save attendance");
    } finally {
      setSaving(false);
    }
  };

  const selectedSection = sections.find((s) => s.id === selectedSectionId);

  if (loading && sections.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Attendance</h1>
        <p className="text-muted-foreground">
          Mark and manage student attendance
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Section</Label>
              <Select value={selectedSectionId} onValueChange={setSelectedSectionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select section" />
                </SelectTrigger>
                <SelectContent>
                  {sections.map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      <div className="flex items-center gap-2">
                        {section.name}
                        {section.isMarkedToday && (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
              />
            </div>

            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <div className="flex gap-2">
                <Button onClick={markAllPresent} variant="outline" className="flex-1">
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Mark All Present
                </Button>
                <Button onClick={() => fetchAttendance()} variant="outline" size="icon">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {/* Attendance Table */}
      {selectedSectionId && attendanceData && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {selectedSection?.name}
                  {attendanceData.isMarked && (
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      Attendance Marked
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {attendanceData.records.length} students • {selectedDate}
                </CardDescription>
              </div>
              <Button onClick={saveAttendance} disabled={saving || localRecords.size === 0}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save Attendance"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {attendanceData.records.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No students in this section
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Roll No</TableHead>
                    <TableHead>Student Name</TableHead>
                    <TableHead className="w-80">Status</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceData.records.map((record) => {
                    const localRecord = localRecords.get(record.studentId);
                    const currentStatus = localRecord?.status || record.status;

                    return (
                      <TableRow key={record.studentId}>
                        <TableCell className="font-medium">
                          {record.rollNumber || "-"}
                        </TableCell>
                        <TableCell>{record.studentName}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {(Object.keys(statusConfig) as AttendanceStatus[]).map((status) => {
                              const config = statusConfig[status];
                              const Icon = config.icon;
                              const isSelected = currentStatus === status;

                              return (
                                <Button
                                  key={status}
                                  variant="ghost"
                                  size="sm"
                                  className={cn(
                                    "h-8 px-2",
                                    isSelected && config.bg,
                                    isSelected && config.color
                                  )}
                                  onClick={() => handleStatusChange(record.studentId, status)}
                                >
                                  <Icon className={cn("h-4 w-4 mr-1", isSelected && config.color)} />
                                  <span className="text-xs">{status}</span>
                                </Button>
                              );
                            })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            placeholder="Optional remarks"
                            value={localRecord?.remarks || ""}
                            onChange={(e) => handleRemarksChange(record.studentId, e.target.value)}
                            className="h-8"
                            disabled={!localRecord}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {localRecords.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-6">
              {(Object.keys(statusConfig) as AttendanceStatus[]).map((status) => {
                const count = Array.from(localRecords.values()).filter(
                  (r) => r.status === status
                ).length;
                const config = statusConfig[status];
                const Icon = config.icon;

                return (
                  <div key={status} className="flex items-center gap-2">
                    <Icon className={cn("h-5 w-5", config.color)} />
                    <span className="font-medium">{count}</span>
                    <span className="text-muted-foreground">{status.toLowerCase()}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

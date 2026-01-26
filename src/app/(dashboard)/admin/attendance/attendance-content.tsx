"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { CheckCircle, RotateCcw, Save, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminAttendanceData, AdminAttendanceRecordData, AdminAttendanceSection } from "@/lib/data/admin-attendance";

type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

const statusConfig: Record<
  AttendanceStatus,
  { label: string; color: string; bg: string }
> = {
  PRESENT: { label: "Present", color: "text-green-600", bg: "bg-green-100 hover:bg-green-200" },
  ABSENT: { label: "Absent", color: "text-red-600", bg: "bg-red-100 hover:bg-red-200" },
  LATE: { label: "Late", color: "text-yellow-600", bg: "bg-yellow-100 hover:bg-yellow-200" },
  EXCUSED: { label: "Excused", color: "text-blue-600", bg: "bg-blue-100 hover:bg-blue-200" },
};

interface AdminAttendanceContentProps {
  initialData: AdminAttendanceData;
}

export default function AdminAttendanceContent({ initialData }: AdminAttendanceContentProps) {
  const [sections, setSections] = useState<AdminAttendanceSection[]>(initialData.sections);
  const [selectedSectionId, setSelectedSectionId] = useState<string>(initialData.initialSectionId || "");
  const [selectedDate, setSelectedDate] = useState<string>(initialData.initialDate);
  const [attendanceData, setAttendanceData] = useState<AdminAttendanceRecordData | null>(
    initialData.initialRecords
  );

  const [localRecords, setLocalRecords] = useState<Map<string, { status: AttendanceStatus; remarks: string }>>(
    () => {
      const map = new Map<string, { status: AttendanceStatus; remarks: string }>();
      initialData.initialRecords?.records.forEach((r) => {
        if (r.status) {
          map.set(r.studentId, { status: r.status, remarks: r.remarks || "" });
        }
      });
      return map;
    }
  );

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedSection = useMemo(
    () => sections.find((s) => s.id === selectedSectionId) || null,
    [sections, selectedSectionId]
  );

  // Support deep links: /admin/attendance?sectionId=...&date=YYYY-MM-DD
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sectionId = params.get("sectionId");
    const date = params.get("date");

    if (sectionId && sections.some((s) => s.id === sectionId)) {
      setSelectedSectionId(sectionId);
    }

    if (date) {
      const parsed = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (Number.isFinite(parsed.getTime()) && parsed <= today) {
        setSelectedDate(date);
      }
    }
  }, [sections]);

  const refreshSectionsForDate = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/attendance?date=${selectedDate}`);
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || "Failed to load sections");
        return;
      }
      setSections(
        (data.sections || []).map((s: { id: string; name: string; studentCount: number; isMarked: boolean; classTeacher: { name: string } | null }) => ({
          id: s.id,
          name: s.name,
          studentCount: s.studentCount,
          isMarkedToday: Boolean(s.isMarked),
          classTeacherName: s.classTeacher?.name ?? null,
        }))
      );
    } catch {
      toast.error("Failed to load sections");
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  const fetchAttendance = useCallback(async () => {
    if (!selectedSectionId || !selectedDate) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/attendance?sectionId=${selectedSectionId}&date=${selectedDate}`
      );
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "Failed to load attendance");
        return;
      }
      setAttendanceData(result);

      const map = new Map<string, { status: AttendanceStatus; remarks: string }>();
      result.records.forEach((r: { studentId: string; status: AttendanceStatus | null; remarks: string | null }) => {
        if (r.status) {
          map.set(r.studentId, { status: r.status, remarks: r.remarks || "" });
        }
      });
      setLocalRecords(map);
    } catch {
      setError("Failed to load attendance");
    } finally {
      setLoading(false);
    }
  }, [selectedSectionId, selectedDate]);

  useEffect(() => {
    refreshSectionsForDate();
  }, [refreshSectionsForDate]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setLocalRecords((prev) => {
      const next = new Map(prev);
      const existing = next.get(studentId);
      next.set(studentId, { status, remarks: existing?.remarks || "" });
      return next;
    });
  };

  const handleRemarksChange = (studentId: string, remarks: string) => {
    setLocalRecords((prev) => {
      const next = new Map(prev);
      const existing = next.get(studentId);
      if (existing) next.set(studentId, { ...existing, remarks });
      return next;
    });
  };

  const markAllPresent = () => {
    if (!attendanceData) return;
    const next = new Map<string, { status: AttendanceStatus; remarks: string }>();
    attendanceData.records.forEach((r) => {
      next.set(r.studentId, { status: "PRESENT", remarks: "" });
    });
    setLocalRecords(next);
  };

  const saveAttendance = async () => {
    if (!selectedSectionId || localRecords.size === 0) return;
    setSaving(true);
    setError(null);
    const records = Array.from(localRecords.entries()).map(([studentId, data]) => ({
      studentId,
      status: data.status,
      remarks: data.remarks || undefined,
    }));
    try {
      const response = await fetch("/api/admin/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId: selectedSectionId, date: selectedDate, records }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "Failed to save attendance");
        return;
      }
      toast.success(result.message || "Attendance saved");
      await refreshSectionsForDate();
      await fetchAttendance();
    } catch {
      setError("Failed to save attendance");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Attendance</h1>
        <p className="text-muted-foreground">Monitor and override attendance across the school</p>
      </div>

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
                  {sections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <div className="flex items-center gap-2">
                        {s.name}
                        {s.isMarkedToday && <CheckCircle className="h-4 w-4 text-green-500" />}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedSection?.classTeacherName && (
                <p className="text-xs text-muted-foreground">
                  Class teacher: {selectedSection.classTeacherName}
                </p>
              )}
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
                <Button onClick={markAllPresent} variant="outline" className="flex-1" disabled={!attendanceData}>
                  Mark All Present
                </Button>
                <Button onClick={refreshSectionsForDate} variant="outline" size="icon" disabled={loading}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Loading attendance data...
          </CardContent>
        </Card>
      )}

      {!loading && selectedSectionId && attendanceData && (
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
              <p className="text-center text-muted-foreground py-8">No students in this section</p>
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
                        <TableCell className="font-medium">{record.rollNumber || "-"}</TableCell>
                        <TableCell>{record.studentName}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {(Object.keys(statusConfig) as AttendanceStatus[]).map((status) => {
                              const config = statusConfig[status];
                              const isSelected = currentStatus === status;
                              return (
                                <Button
                                  key={status}
                                  variant="ghost"
                                  size="sm"
                                  className={cn("h-8 px-2", isSelected && config.bg, isSelected && config.color)}
                                  onClick={() => handleStatusChange(record.studentId, status)}
                                >
                                  <span className={cn("text-xs", isSelected && config.color)}>
                                    {config.label}
                                  </span>
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
    </div>
  );
}

"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
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
  ArrowLeft,
  Save,
  CheckCircle,
  AlertCircle,
  FileText,
  Users,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface StudentResult {
  studentId: string;
  rollNumber: string | null;
  studentName: string;
  marksObtained: number | null;
  grade: string | null;
  remarks: string | null;
  percentage: string | null;
}

interface AssessmentDetail {
  id: string;
  title: string;
  type: string;
  totalMarks: number;
  date: string;
  description: string | null;
  topics: string[];
  section: {
    id: string;
    name: string;
  };
  subject: {
    id: string;
    name: string;
    color: string | null;
  };
  students: StudentResult[];
}

export default function AssessmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [assessment, setAssessment] = useState<AssessmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Local marks state
  const [localMarks, setLocalMarks] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    async function fetchAssessment() {
      try {
        const response = await fetch(`/api/teacher/assessments/${id}`);
        if (response.ok) {
          const data = await response.json();
          setAssessment(data.assessment);

          // Initialize local marks
          const marks = new Map<string, number>();
          data.assessment.students.forEach((s: StudentResult) => {
            if (s.marksObtained !== null) {
              marks.set(s.studentId, s.marksObtained);
            }
          });
          setLocalMarks(marks);
        } else if (response.status === 404) {
          router.push("/teacher/assessments");
        }
      } catch (error) {
        console.error("Failed to fetch assessment:", error);
        setError("Failed to load assessment");
      } finally {
        setLoading(false);
      }
    }

    fetchAssessment();
  }, [id, router]);

  const handleMarksChange = (studentId: string, value: string) => {
    const marks = parseFloat(value);
    setLocalMarks((prev) => {
      const newMap = new Map(prev);
      if (isNaN(marks) || value === "") {
        newMap.delete(studentId);
      } else {
        newMap.set(studentId, marks);
      }
      return newMap;
    });
  };

  const saveResults = async () => {
    if (!assessment || localMarks.size === 0) return;

    // Validate marks
    for (const [, marks] of localMarks) {
      if (marks < 0 || marks > assessment.totalMarks) {
        setError(`Marks must be between 0 and ${assessment.totalMarks}`);
        return;
      }
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    const results = Array.from(localMarks.entries()).map(([studentId, marksObtained]) => ({
      studentId,
      marksObtained,
      grade: calculateGrade(marksObtained, assessment.totalMarks),
    }));

    try {
      const response = await fetch(`/api/teacher/assessments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ results }),
      });

      if (response.ok) {
        setSuccess("Results saved successfully");
        // Refresh data
        const refreshRes = await fetch(`/api/teacher/assessments/${id}`);
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          setAssessment(data.assessment);
        }
      } else {
        const result = await response.json();
        setError(result.error || "Failed to save results");
      }
    } catch (error) {
      console.error("Failed to save:", error);
      setError("Failed to save results");
    } finally {
      setSaving(false);
    }
  };

  const calculateGrade = (marks: number, total: number): string => {
    const percentage = (marks / total) * 100;
    if (percentage >= 90) return "A+";
    if (percentage >= 80) return "A";
    if (percentage >= 70) return "B";
    if (percentage >= 60) return "C";
    if (percentage >= 50) return "D";
    return "F";
  };

  const getPercentageColor = (percentage: number) => {
    if (percentage >= 80) return "text-green-600 bg-green-50";
    if (percentage >= 60) return "text-blue-600 bg-blue-50";
    if (percentage >= 40) return "text-yellow-600 bg-yellow-50";
    return "text-red-600 bg-red-50";
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Assessment not found</p>
      </div>
    );
  }

  const gradedCount = assessment.students.filter((s) => s.marksObtained !== null).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/teacher/assessments">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{assessment.title}</h1>
            <p className="text-muted-foreground">
              {assessment.section.name} • {assessment.subject.name}
            </p>
          </div>
        </div>

        <Button onClick={saveResults} disabled={saving || localMarks.size === 0}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : "Save Results"}
        </Button>
      </div>

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

      {/* Assessment Info */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline">{assessment.type}</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Marks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assessment.totalMarks}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Date
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-medium">
              {new Date(assessment.date).toLocaleDateString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {gradedCount}/{assessment.students.length}
            </div>
            <p className="text-xs text-muted-foreground">students graded</p>
          </CardContent>
        </Card>
      </div>

      {assessment.description && (
        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{assessment.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Grading Table */}
      <Card>
        <CardHeader>
          <CardTitle>Student Results</CardTitle>
          <CardDescription>
            Enter marks for each student. Grades are calculated automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Roll No</TableHead>
                <TableHead>Student Name</TableHead>
                <TableHead className="w-32">Marks</TableHead>
                <TableHead className="w-24 text-center">Grade</TableHead>
                <TableHead className="w-32 text-center">Percentage</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assessment.students.map((student) => {
                const currentMarks = localMarks.get(student.studentId);
                const displayMarks = currentMarks ?? student.marksObtained;
                const percentage = displayMarks !== null
                  ? ((displayMarks / assessment.totalMarks) * 100)
                  : null;
                const grade = displayMarks !== null
                  ? calculateGrade(displayMarks, assessment.totalMarks)
                  : null;

                return (
                  <TableRow key={student.studentId}>
                    <TableCell className="font-medium">
                      {student.rollNumber || "-"}
                    </TableCell>
                    <TableCell>{student.studentName}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={currentMarks ?? student.marksObtained ?? ""}
                        onChange={(e) => handleMarksChange(student.studentId, e.target.value)}
                        placeholder="Enter marks"
                        min={0}
                        max={assessment.totalMarks}
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      {grade ? (
                        <Badge
                          className={cn(
                            grade === "A+" || grade === "A"
                              ? "bg-green-100 text-green-800"
                              : grade === "B"
                                ? "bg-blue-100 text-blue-800"
                                : grade === "C"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : grade === "D"
                                    ? "bg-orange-100 text-orange-800"
                                    : "bg-red-100 text-red-800"
                          )}
                        >
                          {grade}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {percentage !== null ? (
                        <span
                          className={cn(
                            "px-2 py-1 rounded text-sm font-medium",
                            getPercentageColor(percentage)
                          )}
                        >
                          {percentage.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {student.marksObtained !== null ? (
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Graded
                        </Badge>
                      ) : localMarks.has(student.studentId) ? (
                        <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                          Unsaved
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

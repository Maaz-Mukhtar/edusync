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
import { calculateGradeFromMarks } from "@/lib/grades";

interface StudentResult {
  studentId: string;
  rollNumber: string | null;
  studentName: string;
  marksObtained: number | null;
  grade: string | null;
  remarks: string | null;
  percentage: string | null;
}

interface AssessmentQuestion {
  id: string;
  type: "MCQ" | "SHORT_ANSWER";
  marks: number;
  orderIndex: number;
}

interface QuestionResultEntry {
  studentId: string;
  questionId: string;
  marksAwarded: number;
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
  questions: AssessmentQuestion[];
  questionResults: QuestionResultEntry[];
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
  const [initialQuestionMarks, setInitialQuestionMarks] = useState<Map<string, Map<string, number>>>(new Map());
  const [localQuestionMarks, setLocalQuestionMarks] = useState<Map<string, Map<string, number>>>(new Map());

  useEffect(() => {
    async function fetchAssessment() {
      try {
        const response = await fetch(`/api/teacher/assessments/${id}/question-results`);
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

          const qMarks = new Map<string, Map<string, number>>();
          (data.assessment.questionResults ?? []).forEach((r: QuestionResultEntry) => {
            const studentMap = qMarks.get(r.studentId) ?? new Map<string, number>();
            studentMap.set(r.questionId, r.marksAwarded);
            qMarks.set(r.studentId, studentMap);
          });
          setInitialQuestionMarks(qMarks);
          setLocalQuestionMarks(new Map(Array.from(qMarks.entries()).map(([k, v]) => [k, new Map(v)])));
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
      grade: calculateGradeFromMarks(marksObtained, assessment.totalMarks),
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
        const refreshRes = await fetch(`/api/teacher/assessments/${id}/question-results`);
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

  const getPercentageColor = (percentage: number) => {
    if (percentage >= 80) return "text-green-600 bg-green-50";
    if (percentage >= 60) return "text-blue-600 bg-blue-50";
    if (percentage >= 40) return "text-yellow-600 bg-yellow-50";
    return "text-red-600 bg-red-50";
  };

  const setQuestionMark = (studentId: string, question: AssessmentQuestion, value: string) => {
    const parsed = value === "" ? undefined : Number(value);
    setLocalQuestionMarks((prev) => {
      const next = new Map(prev);
      const studentMap = new Map(next.get(studentId) ?? []);

      if (parsed === undefined || Number.isNaN(parsed)) {
        studentMap.delete(question.id);
      } else {
        let marks = parsed;
        if (marks < 0) marks = 0;
        if (marks > question.marks) marks = question.marks;
        if (question.type === "MCQ") {
          marks = marks === 0 ? 0 : question.marks;
        }
        studentMap.set(question.id, marks);
      }

      if (studentMap.size === 0) next.delete(studentId);
      else next.set(studentId, studentMap);

      return next;
    });
  };

  const hasUnsavedQuestionChanges = (studentId: string, questions: AssessmentQuestion[]) => {
    const initialMap = initialQuestionMarks.get(studentId);
    const currentMap = localQuestionMarks.get(studentId);
    for (const q of questions) {
      const initial = initialMap?.get(q.id);
      const current = currentMap?.get(q.id);
      if (initial !== current) return true;
    }
    return false;
  };

  const saveQuestionResults = async () => {
    if (!assessment || assessment.questions.length === 0) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    const entries: Array<{ studentId: string; questionId: string; marksAwarded: number | null }> = [];

    for (const student of assessment.students) {
      const initialMap = initialQuestionMarks.get(student.studentId);
      const currentMap = localQuestionMarks.get(student.studentId);
      for (const q of assessment.questions) {
        const initial = initialMap?.get(q.id);
        const current = currentMap?.get(q.id);
        if (current === undefined && initial !== undefined) {
          entries.push({ studentId: student.studentId, questionId: q.id, marksAwarded: null });
        } else if (current !== undefined && current !== initial) {
          entries.push({ studentId: student.studentId, questionId: q.id, marksAwarded: current });
        }
      }
    }

    if (entries.length === 0) {
      setSuccess("No changes to save");
      setSaving(false);
      return;
    }

    try {
      const response = await fetch(`/api/teacher/assessments/${id}/question-results`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });

      if (response.ok) {
        setSuccess("Per-question marks saved successfully");
        const refreshRes = await fetch(`/api/teacher/assessments/${id}/question-results`);
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          setAssessment(data.assessment);

          const qMarks = new Map<string, Map<string, number>>();
          (data.assessment.questionResults ?? []).forEach((r: QuestionResultEntry) => {
            const studentMap = qMarks.get(r.studentId) ?? new Map<string, number>();
            studentMap.set(r.questionId, r.marksAwarded);
            qMarks.set(r.studentId, studentMap);
          });
          setInitialQuestionMarks(qMarks);
          setLocalQuestionMarks(new Map(Array.from(qMarks.entries()).map(([k, v]) => [k, new Map(v)])));
        }
      } else {
        const result = await response.json();
        setError(result.error || "Failed to save per-question marks");
      }
    } catch (error) {
      console.error("Failed to save per-question marks:", error);
      setError("Failed to save per-question marks");
    } finally {
      setSaving(false);
    }
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
  const hasQuestions = assessment.questions.length > 0;
  const hasUnsavedAnyQuestionChanges =
    hasQuestions && assessment.students.some((s) => hasUnsavedQuestionChanges(s.studentId, assessment.questions));

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

        {hasQuestions ? (
          <Button onClick={saveQuestionResults} disabled={saving || !hasUnsavedAnyQuestionChanges}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Marks"}
          </Button>
        ) : (
          <Button onClick={saveResults} disabled={saving || localMarks.size === 0}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Results"}
          </Button>
        )}
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
      {hasQuestions ? (
        <Card>
          <CardHeader>
            <CardTitle>Per-question Marks</CardTitle>
            <CardDescription>
              Enter marks per question for each student. MCQ is enforced as all-or-nothing (0 or full marks).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table className="min-w-max">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Roll No</TableHead>
                    <TableHead className="min-w-[220px]">Student Name</TableHead>
                    {assessment.questions.map((q, idx) => (
                      <TableHead key={q.id} className="w-24 text-center">
                        <div className="leading-tight">
                          <div className="font-medium">Q{idx + 1}</div>
                          <div className="text-xs text-muted-foreground">{q.marks} marks</div>
                        </div>
                      </TableHead>
                    ))}
                    <TableHead className="w-24 text-center">Total</TableHead>
                    <TableHead className="w-24 text-center">Grade</TableHead>
                    <TableHead className="w-32 text-center">Percentage</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assessment.students.map((student) => {
                    const studentMap = localQuestionMarks.get(student.studentId);
                    const isComplete = assessment.questions.every((q) => studentMap?.has(q.id));
                    const sum = assessment.questions.reduce((acc, q) => acc + (studentMap?.get(q.id) ?? 0), 0);
                    const percentage = isComplete ? (sum / assessment.totalMarks) * 100 : null;
                    const grade = isComplete ? calculateGradeFromMarks(sum, assessment.totalMarks) : null;
                    const hasUnsaved = hasUnsavedQuestionChanges(student.studentId, assessment.questions);
                    const hasSavedProgress = (initialQuestionMarks.get(student.studentId)?.size ?? 0) > 0;

                    return (
                      <TableRow key={student.studentId}>
                        <TableCell className="font-medium">{student.rollNumber || "-"}</TableCell>
                        <TableCell>{student.studentName}</TableCell>
                        {assessment.questions.map((q) => (
                          <TableCell key={q.id} className="text-center">
                            <Input
                              type="number"
                              value={studentMap?.get(q.id) ?? ""}
                              onChange={(e) => setQuestionMark(student.studentId, q, e.target.value)}
                              placeholder="-"
                              min={0}
                              max={q.marks}
                              className="w-20 mx-auto"
                            />
                          </TableCell>
                        ))}
                        <TableCell className="text-center">
                          {isComplete ? <span className="font-medium">{sum}</span> : <span className="text-muted-foreground">-</span>}
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
                            <span className={cn("px-2 py-1 rounded text-sm font-medium", getPercentageColor(percentage))}>
                              {percentage.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {student.marksObtained !== null && !hasUnsaved ? (
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Graded
                            </Badge>
                          ) : hasUnsaved ? (
                            <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                              Unsaved
                            </Badge>
                          ) : hasSavedProgress ? (
                            <Badge variant="outline" className="text-blue-600 border-blue-600">
                              In progress
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
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Student Results</CardTitle>
            <CardDescription>Enter marks for each student. Grades are calculated automatically.</CardDescription>
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
                  const percentage = displayMarks !== null ? (displayMarks / assessment.totalMarks) * 100 : null;
                  const grade = displayMarks !== null ? calculateGradeFromMarks(displayMarks, assessment.totalMarks) : null;

                  return (
                    <TableRow key={student.studentId}>
                      <TableCell className="font-medium">{student.rollNumber || "-"}</TableCell>
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
                          <span className={cn("px-2 py-1 rounded text-sm font-medium", getPercentageColor(percentage))}>
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
      )}
    </div>
  );
}

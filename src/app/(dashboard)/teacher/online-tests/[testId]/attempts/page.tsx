"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Clock,
  Users,
  CheckCircle,
  AlertCircle,
  Eye,
} from "lucide-react";

type AttemptStatus = "IN_PROGRESS" | "SUBMITTED" | "GRADED";

interface Attempt {
  id: string;
  status: AttemptStatus;
  startedAt: string;
  submittedAt: string | null;
  timeTakenSecs: number | null;
  totalScore: number | null;
  maxScore: number | null;
  percentage: number | null;
  isPassed: boolean | null;
  student: {
    id: string;
    name: string;
    email: string | null;
  };
  gradingProgress: {
    total: number;
    graded: number;
    shortAnswerTotal: number;
    shortAnswerGraded: number;
    needsGrading: boolean;
  };
}

interface TestInfo {
  id: string;
  status: string;
  assessment: {
    id: string;
    title: string;
  };
  section: {
    id: string;
    name: string;
  };
  subject: {
    id: string;
    name: string;
  };
}

interface Stats {
  totalAttempts: number;
  inProgress: number;
  submitted: number;
  graded: number;
  needsGrading: number;
  averageScore: number | null;
  passRate: number | null;
}

const statusColors: Record<AttemptStatus, string> = {
  IN_PROGRESS: "bg-yellow-100 text-yellow-800",
  SUBMITTED: "bg-blue-100 text-blue-800",
  GRADED: "bg-green-100 text-green-800",
};

export default function AttemptsPage() {
  const params = useParams();
  const testId = params.testId as string;

  const [loading, setLoading] = useState(true);
  const [test, setTest] = useState<TestInfo | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const fetchAttempts = useCallback(async () => {
    try {
      let url = `/api/teacher/online-tests/${testId}/attempts`;
      if (filterStatus !== "all") {
        url += `?status=${filterStatus}`;
      }

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setTest(data.test);
        setAttempts(data.attempts);
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Failed to fetch attempts:", error);
    } finally {
      setLoading(false);
    }
  }, [testId, filterStatus]);

  useEffect(() => {
    fetchAttempts();
  }, [fetchAttempts]);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "-";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/teacher/online-tests/${testId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Test Attempts</h1>
          <p className="text-muted-foreground">
            {test?.assessment.title} &bull; {test?.section.name}
          </p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Attempts</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalAttempts}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Needs Grading</CardTitle>
              <AlertCircle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.needsGrading}</div>
              <p className="text-xs text-muted-foreground">
                Short answers pending
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Score</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.averageScore !== null ? `${stats.averageScore.toFixed(1)}%` : "-"}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
              <CheckCircle className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.passRate !== null ? `${stats.passRate.toFixed(1)}%` : "-"}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="space-y-2">
              <Label>Filter by Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="SUBMITTED">Submitted</SelectItem>
                  <SelectItem value="GRADED">Graded</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attempts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Student Attempts</CardTitle>
          <CardDescription>
            {attempts.length} attempt{attempts.length !== 1 ? "s" : ""} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {attempts.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">No Attempts Yet</h3>
              <p className="text-sm text-muted-foreground">
                No students have attempted this test yet.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Started</TableHead>
                  <TableHead className="text-center">Duration</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead className="text-center">Grading</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attempts.map((attempt) => (
                  <TableRow key={attempt.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{attempt.student.name}</div>
                        {attempt.student.email && (
                          <div className="text-sm text-muted-foreground">
                            {attempt.student.email}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={statusColors[attempt.status]}>
                        {attempt.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {formatDate(attempt.startedAt)}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {formatDuration(attempt.timeTakenSecs)}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {attempt.percentage !== null ? (
                        <div>
                          <span className="font-medium">
                            {attempt.percentage.toFixed(1)}%
                          </span>
                          <div className="text-xs text-muted-foreground">
                            {attempt.totalScore}/{attempt.maxScore}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {attempt.gradingProgress.needsGrading ? (
                        <Badge variant="outline" className="border-orange-500 text-orange-600">
                          {attempt.gradingProgress.shortAnswerGraded}/
                          {attempt.gradingProgress.shortAnswerTotal} graded
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-green-500 text-green-600">
                          Complete
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/teacher/online-tests/${testId}/attempts/${attempt.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

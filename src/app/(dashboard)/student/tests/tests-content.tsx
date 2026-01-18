"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Clock,
  FileText,
  CheckCircle,
  PlayCircle,
  AlertCircle,
  Trophy,
  XCircle,
} from "lucide-react";

interface TestItem {
  id: string;
  status: string;
  timeLimitMins: number | null;
  questionCount: number;
  passingScore: number | null;
  showResults: boolean;
  startTime: string | null;
  endTime: string | null;
  isExpired: boolean;
  assessment: {
    id: string;
    title: string;
    totalMarks: number;
    date: string;
  };
  section: {
    id: string;
    name: string;
  };
  subject: {
    id: string;
    name: string;
    color: string | null;
  };
  attempt: {
    id: string;
    status: string;
    totalScore: number | null;
    maxScore: number | null;
    percentage: number | null;
    isPassed: boolean | null;
    submittedAt: string | null;
  } | null;
  canStart: boolean;
  canResume: boolean;
  isCompleted: boolean;
}

interface Stats {
  total: number;
  available: number;
  inProgress: number;
  completed: number;
}

export default function TestsContent() {
  const [loading, setLoading] = useState(true);
  const [tests, setTests] = useState<TestItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filter, setFilter] = useState("all");

  const fetchTests = useCallback(async () => {
    try {
      const response = await fetch(`/api/student/tests?status=${filter}`, { cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        setTests(data.tests);
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Failed to fetch tests:", error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchTests();
  }, [fetchTests]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Online Tests</h1>
        <p className="text-muted-foreground">
          View and take tests assigned to your class
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available</CardTitle>
              <PlayCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.available}</div>
              <p className="text-xs text-muted-foreground">Tests to take</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.inProgress}</div>
              <p className="text-xs text-muted-foreground">Resume these tests</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completed}</div>
              <p className="text-xs text-muted-foreground">Tests finished</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tests</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">All assigned tests</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="space-y-2">
              <Label>Filter Tests</Label>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All tests" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tests</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tests List */}
      <div className="space-y-4">
        {tests.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">No Tests Available</h3>
              <p className="text-sm text-muted-foreground">
                {filter === "all"
                  ? "No tests have been assigned to your class yet."
                  : `No ${filter} tests found.`}
              </p>
            </CardContent>
          </Card>
        ) : (
          tests.map((test) => (
            <Card key={test.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {test.assessment.title}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: test.subject.color || "#888" }}
                      />
                      {test.subject.name}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {test.isExpired && (
                      <Badge variant="secondary" className="bg-gray-100 text-gray-800">
                        Expired
                      </Badge>
                    )}
                    {test.canResume && (
                      <Badge className="bg-yellow-100 text-yellow-800">
                        In Progress
                      </Badge>
                    )}
                    {test.canStart && !test.isExpired && (
                      <Badge className="bg-green-100 text-green-800">
                        Available
                      </Badge>
                    )}
                    {test.isCompleted && test.attempt?.isPassed === true && (
                      <Badge className="bg-green-100 text-green-800">
                        <Trophy className="h-3 w-3 mr-1" />
                        Passed
                      </Badge>
                    )}
                    {test.isCompleted && test.attempt?.isPassed === false && (
                      <Badge className="bg-red-100 text-red-800">
                        <XCircle className="h-3 w-3 mr-1" />
                        Failed
                      </Badge>
                    )}
                    {test.isCompleted && test.attempt?.isPassed === null && (
                      <Badge className="bg-blue-100 text-blue-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Completed
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-6 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>{test.questionCount} Questions</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="outline">{test.assessment.totalMarks} Marks</Badge>
                  </div>
                  {test.timeLimitMins && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{test.timeLimitMins} Minutes</span>
                    </div>
                  )}
                  {test.passingScore && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Passing: {test.passingScore}%</span>
                    </div>
                  )}
                </div>

                {/* Show score for completed tests */}
                {test.isCompleted && test.attempt && (
                  <div className="flex items-center gap-4 mb-4 p-3 bg-muted rounded-lg">
                    <div>
                      <span className="text-sm text-muted-foreground">Your Score:</span>
                      <span className="ml-2 font-bold text-lg">
                        {test.attempt.totalScore}/{test.attempt.maxScore}
                      </span>
                      <span className="ml-2 text-muted-foreground">
                        ({test.attempt.percentage?.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  {test.canStart && !test.isExpired && (
                    <Button asChild>
                      <Link href={`/student/tests/${test.id}`}>
                        <PlayCircle className="h-4 w-4 mr-2" />
                        Start Test
                      </Link>
                    </Button>
                  )}
                  {test.canResume && (
                    <Button asChild>
                      <Link href={`/student/tests/${test.id}/take`}>
                        <PlayCircle className="h-4 w-4 mr-2" />
                        Resume Test
                      </Link>
                    </Button>
                  )}
                  {test.isCompleted && test.showResults && (
                    <Button variant="outline" asChild>
                      <Link href={`/student/tests/${test.id}/result`}>
                        View Results
                      </Link>
                    </Button>
                  )}
                  {test.isExpired && !test.isCompleted && (
                    <Button variant="outline" disabled>
                      <AlertCircle className="h-4 w-4 mr-2" />
                      Test Expired
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

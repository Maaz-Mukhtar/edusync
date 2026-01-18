"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Clock,
  FileText,
  AlertCircle,
  PlayCircle,
  CheckCircle,
  XCircle,
} from "lucide-react";

interface TestData {
  test: {
    id: string;
    status: string;
    timeLimitMins: number | null;
    instructions: string | null;
    questionCount: number;
    totalMarks: number;
    passingScore: number | null;
    showResults: boolean;
    startTime: string | null;
    endTime: string | null;
    isExpired: boolean;
    assessment: {
      id: string;
      title: string;
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
  };
  attempt: {
    id: string;
    status: string;
    startedAt: string;
    submittedAt: string | null;
    totalScore: number | null;
    maxScore: number | null;
    percentage: number | null;
    isPassed: boolean | null;
  } | null;
  canStart: boolean;
  canResume: boolean;
  isCompleted: boolean;
}

export default function TestInfoPage() {
  const params = useParams();
  const router = useRouter();
  const testId = params.testId as string;

  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [data, setData] = useState<TestData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchTest = useCallback(async () => {
    try {
      const response = await fetch(`/api/student/tests/${testId}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else {
        const result = await response.json();
        setError(result.error || "Failed to load test");
      }
    } catch (error) {
      console.error("Failed to fetch test:", error);
      setError("Failed to load test");
    } finally {
      setLoading(false);
    }
  }, [testId]);

  useEffect(() => {
    fetchTest();
  }, [fetchTest]);

  const handleStart = async () => {
    setStarting(true);
    setError(null);

    try {
      const response = await fetch(`/api/student/tests/${testId}/start`, {
        method: "POST",
      });

      if (response.ok) {
        router.push(`/student/tests/${testId}/take`);
      } else {
        const result = await response.json();
        setError(result.error || "Failed to start test");
        setStarting(false);
      }
    } catch (error) {
      console.error("Failed to start test:", error);
      setError("Failed to start test");
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-2xl mx-auto">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || "Test not found"}</AlertDescription>
        </Alert>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/student/tests">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Tests
          </Link>
        </Button>
      </div>
    );
  }

  const { test, attempt, canStart, canResume, isCompleted } = data;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/student/tests">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Test Details</h1>
          <p className="text-muted-foreground">{test.subject.name}</p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Test Info Card */}
      <Card>
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl">{test.assessment.title}</CardTitle>
          <CardDescription>
            <span
              className="inline-block w-2 h-2 rounded-full mr-2"
              style={{ backgroundColor: test.subject.color || "#888" }}
            />
            {test.subject.name} &bull; {test.section.name}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Badge */}
          <div className="flex justify-center">
            {test.isExpired && !isCompleted && (
              <Badge variant="secondary" className="bg-gray-100 text-gray-800 text-sm px-4 py-1">
                <XCircle className="h-4 w-4 mr-2" />
                Test Expired
              </Badge>
            )}
            {canStart && !test.isExpired && (
              <Badge className="bg-green-100 text-green-800 text-sm px-4 py-1">
                <PlayCircle className="h-4 w-4 mr-2" />
                Ready to Start
              </Badge>
            )}
            {canResume && (
              <Badge className="bg-yellow-100 text-yellow-800 text-sm px-4 py-1">
                <Clock className="h-4 w-4 mr-2" />
                In Progress
              </Badge>
            )}
            {isCompleted && (
              <Badge className="bg-blue-100 text-blue-800 text-sm px-4 py-1">
                <CheckCircle className="h-4 w-4 mr-2" />
                Completed
              </Badge>
            )}
          </div>

          {/* Test Details */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-4 bg-muted rounded-lg">
              <FileText className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
              <div className="text-2xl font-bold">{test.questionCount}</div>
              <div className="text-xs text-muted-foreground">Questions</div>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <Badge variant="outline" className="mb-2">Marks</Badge>
              <div className="text-2xl font-bold">{test.totalMarks}</div>
              <div className="text-xs text-muted-foreground">Total Marks</div>
            </div>
            {test.timeLimitMins && (
              <div className="p-4 bg-muted rounded-lg">
                <Clock className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                <div className="text-2xl font-bold">{test.timeLimitMins}</div>
                <div className="text-xs text-muted-foreground">Minutes</div>
              </div>
            )}
            {test.passingScore && (
              <div className="p-4 bg-muted rounded-lg">
                <div className="text-xs text-muted-foreground mb-2">Passing</div>
                <div className="text-2xl font-bold">{test.passingScore}%</div>
                <div className="text-xs text-muted-foreground">Required</div>
              </div>
            )}
          </div>

          {/* Instructions */}
          {test.instructions && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h3 className="font-medium mb-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                Instructions
              </h3>
              <p className="text-sm whitespace-pre-wrap">{test.instructions}</p>
            </div>
          )}

          {/* Completed Test Score */}
          {isCompleted && attempt && (
            <div className="p-4 bg-muted rounded-lg text-center">
              <div className="text-sm text-muted-foreground mb-2">Your Score</div>
              <div className="text-3xl font-bold">
                {attempt.totalScore}/{attempt.maxScore}
              </div>
              <div className="text-lg">
                {attempt.percentage?.toFixed(1)}%
              </div>
              {attempt.isPassed !== null && (
                <Badge
                  className={`mt-2 ${
                    attempt.isPassed
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {attempt.isPassed ? "Passed" : "Failed"}
                </Badge>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-center gap-3">
            {canStart && !test.isExpired && (
              <Button size="lg" onClick={handleStart} disabled={starting}>
                <PlayCircle className="h-4 w-4 mr-2" />
                {starting ? "Starting..." : "Start Test"}
              </Button>
            )}
            {canResume && (
              <Button size="lg" asChild>
                <Link href={`/student/tests/${testId}/take`}>
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Resume Test
                </Link>
              </Button>
            )}
            {isCompleted && test.showResults && (
              <Button size="lg" variant="outline" asChild>
                <Link href={`/student/tests/${testId}/result`}>
                  View Detailed Results
                </Link>
              </Button>
            )}
          </div>

          {/* Warning for timed tests */}
          {(canStart || canResume) && test.timeLimitMins && (
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                This test has a time limit of {test.timeLimitMins} minutes. Once you start, the timer
                will begin and cannot be paused.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Trophy,
} from "lucide-react";

interface QuestionResult {
  question: {
    id: string;
    type: "MCQ" | "SHORT_ANSWER";
    questionText: string;
    marks: number;
    orderIndex: number;
    explanation: string | null;
    options: Array<{
      id: string;
      optionText: string;
      isCorrect: boolean;
    }>;
  };
  answer: {
    answerText: string | null;
    selectedOptionId: string | null;
    selectedOptionText: string | null;
    isCorrect: boolean | null;
    marksAwarded: number | null;
    feedback: string | null;
  };
  correctAnswer: {
    optionId: string | undefined;
    optionText: string | undefined;
  } | null;
}

interface ResultData {
  attempt: {
    id: string;
    status: string;
    startedAt: string;
    submittedAt: string;
    timeTakenSecs: number | null;
    totalScore: number | null;
    maxScore: number | null;
    percentage: number | null;
    isPassed: boolean | null;
  };
  test: {
    id: string;
    passingScore: number | null;
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
      color: string | null;
    };
  };
  questionsWithResults: QuestionResult[];
  summary: {
    totalQuestions: number;
    correctAnswers: number;
    incorrectAnswers: number;
    pendingGrading: number;
  };
  showDetailedResults: boolean;
  message?: string;
}

export default function ResultPage() {
  const params = useParams();
  const testId = params.testId as string;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ResultData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchResult = useCallback(async () => {
    try {
      const response = await fetch(`/api/student/tests/${testId}/result`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else {
        const result = await response.json();
        setError(result.error || "Failed to load results");
      }
    } catch (error) {
      console.error("Failed to fetch results:", error);
      setError("Failed to load results");
    } finally {
      setLoading(false);
    }
  }, [testId]);

  useEffect(() => {
    fetchResult();
  }, [fetchResult]);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "-";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl mx-auto">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || "Results not found"}</AlertDescription>
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

  const { attempt, test, questionsWithResults, summary, showDetailedResults } = data;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/student/tests">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Test Results</h1>
          <p className="text-muted-foreground">{test.assessment.title}</p>
        </div>
      </div>

      {/* Score Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            {/* Pass/Fail Badge */}
            {attempt.isPassed !== null && (
              <div className="mb-4">
                {attempt.isPassed ? (
                  <Badge className="bg-green-100 text-green-800 text-lg px-6 py-2">
                    <Trophy className="h-5 w-5 mr-2" />
                    Passed!
                  </Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-800 text-lg px-6 py-2">
                    <XCircle className="h-5 w-5 mr-2" />
                    Not Passed
                  </Badge>
                )}
              </div>
            )}

            {/* Score */}
            <div className="text-5xl font-bold mb-2">
              {attempt.totalScore !== null ? attempt.totalScore : "-"}/
              {attempt.maxScore !== null ? attempt.maxScore : "-"}
            </div>
            <div className="text-2xl text-muted-foreground mb-4">
              {attempt.percentage !== null ? `${attempt.percentage.toFixed(1)}%` : "-"}
            </div>

            {/* Score Bar */}
            <div className="max-w-md mx-auto mb-6">
              <Progress
                value={attempt.percentage || 0}
                className={`h-3 ${
                  attempt.isPassed ? "[&>div]:bg-green-500" : "[&>div]:bg-red-500"
                }`}
              />
              {test.passingScore && (
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>0%</span>
                  <span>Passing: {test.passingScore}%</span>
                  <span>100%</span>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-lg mx-auto">
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-green-600">{summary.correctAnswers}</div>
                <div className="text-xs text-muted-foreground">Correct</div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-red-600">{summary.incorrectAnswers}</div>
                <div className="text-xs text-muted-foreground">Incorrect</div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold">{summary.totalQuestions}</div>
                <div className="text-xs text-muted-foreground">Questions</div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center justify-center gap-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="font-bold">{formatDuration(attempt.timeTakenSecs)}</span>
                </div>
                <div className="text-xs text-muted-foreground">Time Taken</div>
              </div>
            </div>

            {summary.pendingGrading > 0 && (
              <Alert className="mt-4 max-w-md mx-auto">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {summary.pendingGrading} short answer question(s) are pending grading. Your final
                  score may change.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Results */}
      {showDetailedResults && questionsWithResults.length > 0 && (
        <>
          <Separator />

          <div className="space-y-4">
            <h2 className="text-xl font-bold">Question Review</h2>

            {questionsWithResults.map((qr, index) => {
              const { question, answer, correctAnswer } = qr;
              const isCorrect = answer.isCorrect === true;
              const isIncorrect = answer.isCorrect === false;
              const isPending = answer.marksAwarded === null;

              return (
                <Card
                  key={question.id}
                  className={`border-l-4 ${
                    isCorrect
                      ? "border-l-green-500"
                      : isIncorrect
                      ? "border-l-red-500"
                      : "border-l-yellow-500"
                  }`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Question {index + 1}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {question.type === "MCQ" ? "Multiple Choice" : "Short Answer"}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className={
                            isCorrect
                              ? "bg-green-100 text-green-700"
                              : isIncorrect
                              ? "bg-red-100 text-red-700"
                              : "bg-yellow-100 text-yellow-700"
                          }
                        >
                          {answer.marksAwarded ?? 0}/{question.marks}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p>{question.questionText}</p>

                    {/* MCQ Options */}
                    {question.type === "MCQ" && question.options.length > 0 && (
                      <div className="space-y-2">
                        {question.options.map((option, optIndex) => {
                          const isSelected = answer.selectedOptionId === option.id;
                          const isCorrectOption = option.isCorrect;

                          let bgColor = "";
                          if (isSelected && isCorrectOption) bgColor = "bg-green-100 border-green-500";
                          else if (isSelected && !isCorrectOption) bgColor = "bg-red-100 border-red-500";
                          else if (isCorrectOption) bgColor = "bg-green-50 border-green-300";

                          return (
                            <div
                              key={option.id}
                              className={`flex items-center gap-3 p-3 rounded-lg border ${bgColor || "border-gray-200"}`}
                            >
                              <div
                                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-medium ${
                                  isSelected
                                    ? isCorrectOption
                                      ? "border-green-500 bg-green-500 text-white"
                                      : "border-red-500 bg-red-500 text-white"
                                    : isCorrectOption
                                    ? "border-green-500 bg-green-500 text-white"
                                    : "border-gray-300"
                                }`}
                              >
                                {String.fromCharCode(65 + optIndex)}
                              </div>
                              <span className="flex-1">{option.optionText}</span>
                              {isSelected && isCorrectOption && (
                                <CheckCircle className="h-5 w-5 text-green-600" />
                              )}
                              {isSelected && !isCorrectOption && (
                                <XCircle className="h-5 w-5 text-red-600" />
                              )}
                              {!isSelected && isCorrectOption && (
                                <Badge variant="outline" className="border-green-500 text-green-600">
                                  Correct
                                </Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Short Answer */}
                    {question.type === "SHORT_ANSWER" && (
                      <div className="space-y-2">
                        <div className="p-3 bg-muted rounded-lg">
                          <div className="text-xs text-muted-foreground mb-1">Your Answer:</div>
                          <p className="whitespace-pre-wrap">
                            {answer.answerText || (
                              <span className="text-muted-foreground italic">No answer provided</span>
                            )}
                          </p>
                        </div>
                        {answer.feedback && (
                          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="text-xs text-blue-700 mb-1">Teacher Feedback:</div>
                            <p className="text-sm text-blue-800">{answer.feedback}</p>
                          </div>
                        )}
                        {isPending && (
                          <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              This question is pending manual grading.
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    )}

                    {/* Explanation */}
                    {question.explanation && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="text-xs text-blue-700 mb-1">Explanation:</div>
                        <p className="text-sm text-blue-800">{question.explanation}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {!showDetailedResults && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Detailed results are not available for this test.
          </AlertDescription>
        </Alert>
      )}

      {/* Back Button */}
      <div className="flex justify-center">
        <Button asChild>
          <Link href="/student/tests">Back to Tests</Link>
        </Button>
      </div>
    </div>
  );
}

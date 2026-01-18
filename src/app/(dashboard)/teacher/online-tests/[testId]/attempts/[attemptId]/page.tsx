"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Save,
  User,
} from "lucide-react";

interface QuestionOption {
  id: string;
  optionText: string;
  isCorrect: boolean;
  orderIndex: number;
}

interface QuestionWithAnswer {
  question: {
    id: string;
    type: "MCQ" | "SHORT_ANSWER";
    questionText: string;
    marks: number;
    orderIndex: number;
    explanation: string | null;
    options: QuestionOption[];
  };
  answer: {
    id: string;
    answerText: string | null;
    selectedOptionId: string | null;
    selectedOptionText: string | null;
    isCorrect: boolean | null;
    marksAwarded: number | null;
    feedback: string | null;
    gradedAt: string | null;
  } | null;
}

interface AttemptData {
  test: {
    id: string;
    status: string;
    timeLimitMins: number | null;
    passingScore: number | null;
    assessment: {
      id: string;
      title: string;
      totalMarks: number;
    };
    section: {
      id: string;
      name: string;
    };
    subject: {
      id: string;
      name: string;
    };
  };
  attempt: {
    id: string;
    status: string;
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
  };
  questionsWithAnswers: QuestionWithAnswer[];
  gradingSummary: {
    totalQuestions: number;
    answeredQuestions: number;
    gradedAnswers: number;
    mcqQuestions: number;
    shortAnswerQuestions: number;
    shortAnswerGraded: number;
    needsGrading: boolean;
    allGraded: boolean;
  };
}

interface GradeInput {
  marksAwarded: number;
  feedback: string;
}

export default function GradeAttemptPage() {
  const params = useParams();
  const testId = params.testId as string;
  const attemptId = params.attemptId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<AttemptData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Track grades for short answer questions
  const [grades, setGrades] = useState<Record<string, GradeInput>>({});

  const fetchAttempt = useCallback(async () => {
    try {
      const response = await fetch(`/api/teacher/online-tests/${testId}/attempts/${attemptId}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);

        // Initialize grades from existing data
        const initialGrades: Record<string, GradeInput> = {};
        result.questionsWithAnswers.forEach((qa: QuestionWithAnswer) => {
          if (qa.question.type === "SHORT_ANSWER" && qa.answer) {
            initialGrades[qa.answer.id] = {
              marksAwarded: qa.answer.marksAwarded ?? 0,
              feedback: qa.answer.feedback || "",
            };
          }
        });
        setGrades(initialGrades);
      }
    } catch (error) {
      console.error("Failed to fetch attempt:", error);
      setError("Failed to load attempt data");
    } finally {
      setLoading(false);
    }
  }, [testId, attemptId]);

  useEffect(() => {
    fetchAttempt();
  }, [fetchAttempt]);

  const handleSaveGrades = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const gradesToSubmit = Object.entries(grades).map(([answerId, grade]) => ({
        answerId,
        marksAwarded: grade.marksAwarded,
        feedback: grade.feedback || null,
      }));

      const response = await fetch(
        `/api/teacher/online-tests/${testId}/attempts/${attemptId}/grade`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ grades: gradesToSubmit }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        setSuccess(result.message);
        fetchAttempt(); // Refresh data
      } else {
        const result = await response.json();
        setError(result.error || "Failed to save grades");
      }
    } catch (error) {
      console.error("Failed to save grades:", error);
      setError("Failed to save grades");
    } finally {
      setSaving(false);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "-";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium">Attempt Not Found</h3>
      </div>
    );
  }

  const { test, attempt, questionsWithAnswers, gradingSummary } = data;
  const gradingProgress =
    gradingSummary.shortAnswerQuestions > 0
      ? (gradingSummary.shortAnswerGraded / gradingSummary.shortAnswerQuestions) * 100
      : 100;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/teacher/online-tests/${testId}/attempts`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Grade Attempt</h1>
          <p className="text-muted-foreground">
            {test.assessment.title} &bull; {test.section.name}
          </p>
        </div>
        {gradingSummary.needsGrading && (
          <Button onClick={handleSaveGrades} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Grades"}
          </Button>
        )}
      </div>

      {/* Alerts */}
      {success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Student Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                <User className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-lg">{attempt.student.name}</CardTitle>
                <CardDescription>{attempt.student.email}</CardDescription>
              </div>
            </div>
            <Badge
              className={
                attempt.status === "GRADED"
                  ? "bg-green-100 text-green-800"
                  : attempt.status === "SUBMITTED"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-yellow-100 text-yellow-800"
              }
            >
              {attempt.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Time Taken</div>
              <div className="font-medium flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {formatDuration(attempt.timeTakenSecs)}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Score</div>
              <div className="font-medium">
                {attempt.totalScore !== null
                  ? `${attempt.totalScore}/${attempt.maxScore}`
                  : "-"}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Percentage</div>
              <div className="font-medium">
                {attempt.percentage !== null ? `${attempt.percentage.toFixed(1)}%` : "-"}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Result</div>
              <div className="font-medium">
                {attempt.isPassed !== null ? (
                  attempt.isPassed ? (
                    <span className="text-green-600">Passed</span>
                  ) : (
                    <span className="text-red-600">Failed</span>
                  )
                ) : (
                  "-"
                )}
              </div>
            </div>
          </div>

          {gradingSummary.shortAnswerQuestions > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-1">
                <span>Grading Progress</span>
                <span>
                  {gradingSummary.shortAnswerGraded}/{gradingSummary.shortAnswerQuestions} short
                  answers graded
                </span>
              </div>
              <Progress value={gradingProgress} />
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Questions & Answers */}
      <div className="space-y-6">
        {questionsWithAnswers.map((qa, index) => {
          const { question, answer } = qa;
          const isShortAnswer = question.type === "SHORT_ANSWER";

          return (
            <Card key={question.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Question {index + 1}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {question.type === "MCQ" ? "Multiple Choice" : "Short Answer"}
                    </Badge>
                    <Badge variant="secondary">
                      {question.marks} mark{question.marks !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-base">{question.questionText}</p>

                {/* MCQ Options */}
                {question.type === "MCQ" && question.options.length > 0 && (
                  <div className="space-y-2 pl-4">
                    {question.options.map((option, optIndex) => {
                      const isSelected = answer?.selectedOptionId === option.id;
                      const isCorrect = option.isCorrect;

                      let bgColor = "border-gray-200";
                      if (isSelected && isCorrect) bgColor = "border-green-500 bg-green-50";
                      else if (isSelected && !isCorrect) bgColor = "border-red-500 bg-red-50";
                      else if (isCorrect) bgColor = "border-green-500 bg-green-50";

                      return (
                        <div key={option.id} className={`flex items-center gap-3 p-3 rounded-lg border ${bgColor}`}>
                          <div
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-sm font-medium ${
                              isSelected
                                ? isCorrect
                                  ? "border-green-500 bg-green-500 text-white"
                                  : "border-red-500 bg-red-500 text-white"
                                : isCorrect
                                ? "border-green-500 bg-green-500 text-white"
                                : "border-gray-300"
                            }`}
                          >
                            {String.fromCharCode(65 + optIndex)}
                          </div>
                          <span className="flex-1">{option.optionText}</span>
                          {isSelected && (
                            isCorrect ? (
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-600" />
                            )
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Short Answer Response */}
                {isShortAnswer && (
                  <div className="space-y-4">
                    <div className="p-4 bg-muted rounded-lg">
                      <Label className="text-sm text-muted-foreground">Student&apos;s Answer:</Label>
                      <p className="mt-1 whitespace-pre-wrap">
                        {answer?.answerText || (
                          <span className="text-muted-foreground italic">No answer provided</span>
                        )}
                      </p>
                    </div>

                    {/* Grading Form */}
                    {answer && (
                      <div className="border rounded-lg p-4 space-y-4">
                        <h4 className="font-medium">Grade this answer</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Marks Awarded (max {question.marks})</Label>
                            <Input
                              type="number"
                              value={grades[answer.id]?.marksAwarded ?? 0}
                              onChange={(e) =>
                                setGrades({
                                  ...grades,
                                  [answer.id]: {
                                    ...grades[answer.id],
                                    marksAwarded: Math.min(
                                      question.marks,
                                      Math.max(0, parseInt(e.target.value) || 0)
                                    ),
                                  },
                                })
                              }
                              min={0}
                              max={question.marks}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Feedback (Optional)</Label>
                          <Textarea
                            value={grades[answer.id]?.feedback || ""}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                              setGrades({
                                ...grades,
                                [answer.id]: {
                                  ...grades[answer.id],
                                  feedback: e.target.value,
                                },
                              })
                            }
                            placeholder="Provide feedback for the student..."
                            rows={2}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* MCQ Result */}
                {question.type === "MCQ" && answer && (
                  <div className="flex items-center gap-2 p-3 rounded-lg border">
                    <div className="flex-1">
                      <span className="text-sm text-muted-foreground">Marks:</span>
                      <span className="ml-2 font-medium">
                        {answer.marksAwarded ?? 0}/{question.marks}
                      </span>
                    </div>
                    {answer.isCorrect ? (
                      <Badge className="bg-green-100 text-green-800">Correct</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-800">Incorrect</Badge>
                    )}
                  </div>
                )}

                {/* Explanation */}
                {question.explanation && (
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <h4 className="text-sm font-medium text-blue-800 mb-1">Explanation:</h4>
                    <p className="text-sm text-blue-700">{question.explanation}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Save Button at Bottom */}
      {gradingSummary.needsGrading && (
        <div className="sticky bottom-4 flex justify-center">
          <Button size="lg" onClick={handleSaveGrades} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save All Grades"}
          </Button>
        </div>
      )}
    </div>
  );
}

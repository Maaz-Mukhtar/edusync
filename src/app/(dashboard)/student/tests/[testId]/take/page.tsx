"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Send,
  AlertCircle,
} from "lucide-react";

interface QuestionOption {
  id: string;
  optionText: string;
}

interface Question {
  id: string;
  type: "MCQ" | "SHORT_ANSWER";
  questionText: string;
  marks: number;
  displayNumber: number;
  options: QuestionOption[];
  currentAnswer: {
    answerText: string | null;
    selectedOptionId: string | null;
  };
}

interface AttemptData {
  attempt: {
    id: string;
    status: string;
    startedAt: string;
  };
  test: {
    id: string;
    timeLimitMins: number | null;
    instructions: string | null;
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
  questions: Question[];
  timeRemainingMs: number | null;
  questionCount: number;
  answeredCount: number;
}

export default function TakeTestPage() {
  const params = useParams();
  const router = useRouter();
  const testId = params.testId as string;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AttemptData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { answerText: string | null; selectedOptionId: string | null }>>({});
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null);

  const fetchAttempt = useCallback(async () => {
    try {
      const response = await fetch(`/api/student/tests/${testId}/attempt`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
        setTimeRemaining(result.timeRemainingMs);

        // Initialize answers from fetched data
        const initialAnswers: Record<string, { answerText: string | null; selectedOptionId: string | null }> = {};
        result.questions.forEach((q: Question) => {
          initialAnswers[q.id] = q.currentAnswer;
        });
        setAnswers(initialAnswers);
      } else {
        const result = await response.json();
        setError(result.error || "Failed to load test");
      }
    } catch (error) {
      console.error("Failed to fetch attempt:", error);
      setError("Failed to load test");
    } finally {
      setLoading(false);
    }
  }, [testId]);

  useEffect(() => {
    fetchAttempt();

    // Cleanup on unmount
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    };
  }, [fetchAttempt]);

  // Timer countdown
  useEffect(() => {
    if (timeRemaining !== null && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev === null) return null;
          if (prev <= 1000) {
            // Time expired - auto submit
            handleSubmit(true);
            return 0;
          }
          return prev - 1000;
        });
      }, 1000);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [timeRemaining !== null]);

  // Auto-save every 30 seconds
  useEffect(() => {
    autoSaveRef.current = setInterval(() => {
      // Auto-save current answer if changed
      const currentQuestion = data?.questions[currentQuestionIndex];
      if (currentQuestion) {
        const answer = answers[currentQuestion.id];
        if (answer && (answer.answerText || answer.selectedOptionId)) {
          saveAnswer(currentQuestion.id, answer);
        }
      }
    }, 30000);

    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    };
  }, [data, currentQuestionIndex, answers]);

  const saveAnswer = async (questionId: string, answer: { answerText: string | null; selectedOptionId: string | null }) => {
    try {
      await fetch(`/api/student/tests/${testId}/attempt/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId,
          answerText: answer.answerText,
          selectedOptionId: answer.selectedOptionId,
        }),
      });
    } catch (error) {
      console.error("Failed to save answer:", error);
    }
  };

  const handleAnswerChange = (questionId: string, type: "MCQ" | "SHORT_ANSWER", value: string) => {
    const newAnswer = type === "MCQ"
      ? { answerText: null, selectedOptionId: value }
      : { answerText: value, selectedOptionId: null };

    setAnswers({ ...answers, [questionId]: newAnswer });

    // Debounce save for short answers
    if (type === "MCQ") {
      saveAnswer(questionId, newAnswer);
    }
  };

  const handleNavigate = async (direction: "prev" | "next") => {
    // Save current answer before navigating
    const currentQuestion = data?.questions[currentQuestionIndex];
    if (currentQuestion) {
      const answer = answers[currentQuestion.id];
      if (answer) {
        await saveAnswer(currentQuestion.id, answer);
      }
    }

    if (direction === "prev" && currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    } else if (direction === "next" && data && currentQuestionIndex < data.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handleSubmit = async (autoSubmit = false) => {
    if (!autoSubmit && !confirm("Are you sure you want to submit? You cannot change your answers after submission.")) {
      return;
    }

    setSubmitting(true);
    setSubmitDialogOpen(false);

    try {
      // Save all remaining answers first
      for (const [questionId, answer] of Object.entries(answers)) {
        if (answer.answerText || answer.selectedOptionId) {
          await saveAnswer(questionId, answer);
        }
      }

      const response = await fetch(`/api/student/tests/${testId}/attempt/submit`, {
        method: "POST",
      });

      if (response.ok) {
        const result = await response.json();
        if (result.showResults) {
          router.push(`/student/tests/${testId}/result`);
        } else {
          router.push("/student/tests?success=submitted");
        }
      } else {
        const result = await response.json();
        setError(result.error || "Failed to submit test");
        setSubmitting(false);
      }
    } catch (error) {
      console.error("Failed to submit:", error);
      setError("Failed to submit test");
      setSubmitting(false);
    }
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const getAnsweredCount = () => {
    return Object.values(answers).filter(
      (a) => a.answerText || a.selectedOptionId
    ).length;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl mx-auto">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || "Failed to load test"}</AlertDescription>
        </Alert>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/student/tests">Back to Tests</Link>
        </Button>
      </div>
    );
  }

  const currentQuestion = data.questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / data.questions.length) * 100;
  const isLowTime = timeRemaining !== null && timeRemaining < 60000; // Less than 1 minute

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <Card className="sticky top-0 z-10 bg-card shadow-md">
        <CardContent className="py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-bold">{data.test.assessment.title}</h1>
              <p className="text-sm text-muted-foreground">
                {data.test.subject.name}
              </p>
            </div>

            {/* Timer */}
            {timeRemaining !== null && (
              <div
                className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                  isLowTime ? "bg-red-100 text-red-700 animate-pulse" : "bg-muted"
                }`}
              >
                <Clock className="h-5 w-5" />
                <span className="font-mono text-lg font-bold">
                  {formatTime(timeRemaining)}
                </span>
              </div>
            )}

            <Button
              variant="destructive"
              onClick={() => setSubmitDialogOpen(true)}
              disabled={submitting}
            >
              <Send className="h-4 w-4 mr-2" />
              Submit Test
            </Button>
          </div>

          {/* Progress */}
          <div className="mt-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>
                Question {currentQuestionIndex + 1} of {data.questions.length}
              </span>
              <span>{getAnsweredCount()} answered</span>
            </div>
            <Progress value={progress} />
          </div>
        </CardContent>
      </Card>

      {/* Question */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              Question {currentQuestion.displayNumber}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {currentQuestion.type === "MCQ" ? "Multiple Choice" : "Short Answer"}
              </Badge>
              <Badge variant="secondary">
                {currentQuestion.marks} mark{currentQuestion.marks !== 1 ? "s" : ""}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-lg">{currentQuestion.questionText}</p>

          {/* MCQ Options */}
          {currentQuestion.type === "MCQ" && (
            <div className="space-y-3">
              {currentQuestion.options.map((option, index) => {
                const isSelected = answers[currentQuestion.id]?.selectedOptionId === option.id;

                return (
                  <button
                    key={option.id}
                    onClick={() => handleAnswerChange(currentQuestion.id, "MCQ", option.id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-lg border-2 text-left transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-primary/50"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-medium ${
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground"
                      }`}
                    >
                      {String.fromCharCode(65 + index)}
                    </div>
                    <span className="flex-1">{option.optionText}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Short Answer */}
          {currentQuestion.type === "SHORT_ANSWER" && (
            <Textarea
              value={answers[currentQuestion.id]?.answerText || ""}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                handleAnswerChange(currentQuestion.id, "SHORT_ANSWER", e.target.value)
              }
              placeholder="Type your answer here..."
              rows={6}
              className="resize-none"
            />
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => handleNavigate("prev")}
          disabled={currentQuestionIndex === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>

        {/* Question Navigator */}
        <div className="flex gap-1 flex-wrap justify-center max-w-md">
          {data.questions.map((q, index) => {
            const hasAnswer = answers[q.id]?.answerText || answers[q.id]?.selectedOptionId;
            const isCurrent = index === currentQuestionIndex;

            return (
              <button
                key={q.id}
                onClick={async () => {
                  // Save current answer before jumping
                  const curr = data.questions[currentQuestionIndex];
                  if (answers[curr.id]) {
                    await saveAnswer(curr.id, answers[curr.id]);
                  }
                  setCurrentQuestionIndex(index);
                }}
                className={`w-8 h-8 text-xs rounded-md border transition-colors ${
                  isCurrent
                    ? "border-primary bg-primary text-primary-foreground"
                    : hasAnswer
                    ? "border-green-500 bg-green-100 text-green-700"
                    : "border-muted hover:border-primary"
                }`}
              >
                {index + 1}
              </button>
            );
          })}
        </div>

        <Button
          variant="outline"
          onClick={() => handleNavigate("next")}
          disabled={currentQuestionIndex === data.questions.length - 1}
        >
          Next
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>

      {/* Submit Confirmation Dialog */}
      <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Submit Test?
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to submit your test? You cannot change your answers after
              submission.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="flex justify-between text-sm mb-2">
              <span>Questions answered:</span>
              <span className="font-medium">
                {getAnsweredCount()} / {data.questions.length}
              </span>
            </div>
            {getAnsweredCount() < data.questions.length && (
              <Alert variant="destructive" className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  You have {data.questions.length - getAnsweredCount()} unanswered question(s).
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitDialogOpen(false)}>
              Continue Test
            </Button>
            <Button onClick={() => handleSubmit()} disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Test"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

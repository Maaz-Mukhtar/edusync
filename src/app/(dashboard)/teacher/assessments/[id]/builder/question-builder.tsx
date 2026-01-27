"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Plus,
  FileText,
  AlertCircle,
  CheckCircle,
  Edit,
  Trash2,
  GripVertical,
  Printer,
  ListChecks,
  X,
} from "lucide-react";
import { SubjectTopicsDialog } from "@/components/topics/subject-topics-dialog";

type QuestionType = "MCQ" | "SHORT_ANSWER";

interface QuestionOption {
  id?: string;
  optionText: string;
  isCorrect: boolean;
  orderIndex: number;
}

interface Question {
  id: string;
  type: QuestionType;
  questionText: string;
  topicId: string | null;
  marks: number;
  orderIndex: number;
  explanation: string | null;
  options: QuestionOption[];
}

interface AssessmentData {
  id: string;
  title: string;
  type: string;
  totalMarks: number;
  date: Date;
  description: string | null;
  section: {
    id: string;
    name: string;
  };
  subject: {
    id: string;
    name: string;
    color: string | null;
  };
  hasOnlineTest: boolean;
  onlineTestStatus: string | null;
  topics: Array<{ id: string; name: string; source: "ADMIN" | "TEACHER"; status: "ACTIVE" | "ARCHIVED" }>;
  questions: Question[];
}

interface QuestionBuilderProps {
  initialData: AssessmentData;
}

const typeColors: Record<string, string> = {
  TEST: "bg-blue-100 text-blue-800",
  QUIZ: "bg-green-100 text-green-800",
  ASSIGNMENT: "bg-purple-100 text-purple-800",
  EXAM: "bg-red-100 text-red-800",
};

export default function QuestionBuilder({ initialData }: QuestionBuilderProps) {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>(initialData.questions);
  const [topics, setTopics] = useState(initialData.topics);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [topicsDialogOpen, setTopicsDialogOpen] = useState(false);

  // Question dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [questionForm, setQuestionForm] = useState({
    type: "MCQ" as QuestionType,
    questionText: "",
    topicId: "none",
    marks: 1,
    explanation: "",
  });
  const [options, setOptions] = useState<QuestionOption[]>([
    { optionText: "", isCorrect: true, orderIndex: 0 },
    { optionText: "", isCorrect: false, orderIndex: 1 },
    { optionText: "", isCorrect: false, orderIndex: 2 },
    { optionText: "", isCorrect: false, orderIndex: 3 },
  ]);

  const isLocked = initialData.hasOnlineTest && initialData.onlineTestStatus === "PUBLISHED";

  const refreshTopics = useCallback(async () => {
    try {
      const res = await fetch(`/api/subjects/${initialData.subject.id}/topics`);
      const json = (await res.json()) as {
        topics?: Array<{ id: string; name: string; source: "ADMIN" | "TEACHER"; status: "ACTIVE" | "ARCHIVED" }>;
      };
      if (!res.ok) return;
      if (!Array.isArray(json.topics)) return;
      setTopics(json.topics.map((t) => ({ id: t.id, name: t.name, source: t.source, status: t.status })));
    } catch {
      // best-effort (dialog itself shows errors)
    }
  }, [initialData.subject.id]);

  const resetForm = () => {
    setQuestionForm({
      type: "MCQ",
      questionText: "",
      topicId: "none",
      marks: 1,
      explanation: "",
    });
    setOptions([
      { optionText: "", isCorrect: true, orderIndex: 0 },
      { optionText: "", isCorrect: false, orderIndex: 1 },
      { optionText: "", isCorrect: false, orderIndex: 2 },
      { optionText: "", isCorrect: false, orderIndex: 3 },
    ]);
    setEditingQuestion(null);
  };

  const openAddDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (question: Question) => {
    setEditingQuestion(question);
    setQuestionForm({
      type: question.type,
      questionText: question.questionText,
      topicId: question.topicId ?? "none",
      marks: question.marks,
      explanation: question.explanation || "",
    });
    if (question.type === "MCQ") {
      setOptions(
        question.options.length > 0
          ? question.options
          : [
              { optionText: "", isCorrect: true, orderIndex: 0 },
              { optionText: "", isCorrect: false, orderIndex: 1 },
            ]
      );
    }
    setDialogOpen(true);
  };

  const handleSaveQuestion = async () => {
    if (!questionForm.questionText.trim()) {
      setError("Please enter a question");
      return;
    }

    if (questionForm.type === "MCQ") {
      const validOptions = options.filter((o) => o.optionText.trim());
      if (validOptions.length < 2) {
        setError("Please add at least 2 options for MCQ");
        return;
      }
      if (!validOptions.some((o) => o.isCorrect)) {
        setError("Please mark at least one option as correct");
        return;
      }
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        ...questionForm,
        topicId: questionForm.topicId === "none" ? null : questionForm.topicId,
        options: questionForm.type === "MCQ" ? options.filter((o) => o.optionText.trim()) : [],
      };

      const url = editingQuestion
        ? `/api/teacher/assessments/${initialData.id}/questions/${editingQuestion.id}`
        : `/api/teacher/assessments/${initialData.id}/questions`;

      const response = await fetch(url, {
        method: editingQuestion ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        if (editingQuestion) {
          setQuestions(questions.map((q) => (q.id === editingQuestion.id ? data.question : q)));
          setSuccess("Question updated");
        } else {
          setQuestions([...questions, data.question]);
          setSuccess("Question added");
        }
        setDialogOpen(false);
        resetForm();
        router.refresh();
      } else {
        const result = await response.json();
        setError(result.error || "Failed to save question");
      }
    } catch (error) {
      console.error("Failed to save question:", error);
      setError("Failed to save question");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm("Are you sure you want to delete this question?")) return;

    try {
      const response = await fetch(
        `/api/teacher/assessments/${initialData.id}/questions/${questionId}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        setQuestions(questions.filter((q) => q.id !== questionId));
        setSuccess("Question deleted");
        router.refresh();
      } else {
        setError("Failed to delete question");
      }
    } catch (error) {
      console.error("Failed to delete question:", error);
      setError("Failed to delete question");
    }
  };

  const addOption = () => {
    setOptions([
      ...options,
      { optionText: "", isCorrect: false, orderIndex: options.length },
    ]);
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) return;
    const newOptions = options.filter((_, i) => i !== index);
    setOptions(newOptions.map((o, i) => ({ ...o, orderIndex: i })));
  };

  const updateOption = (index: number, field: keyof QuestionOption, value: string | boolean) => {
    const newOptions = [...options];
    if (field === "isCorrect" && value === true) {
      // For single correct answer, unmark others
      newOptions.forEach((o, i) => {
        o.isCorrect = i === index;
      });
    } else if (field === "optionText" && typeof value === "string") {
      newOptions[index].optionText = value;
    } else if (field === "isCorrect" && typeof value === "boolean") {
      newOptions[index].isCorrect = value;
    }
    setOptions(newOptions);
  };

  const totalQuestionMarks = questions.reduce((sum, q) => sum + q.marks, 0);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/teacher/assessments">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight">{initialData.title}</h1>
            <Badge className={typeColors[initialData.type]} variant="secondary">
              {initialData.type}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {initialData.section.name} &bull; {initialData.subject.name}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              void refreshTopics();
              setTopicsDialogOpen(true);
            }}
          >
            <ListChecks className="h-4 w-4 mr-2" />
            Topics
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/teacher/assessments/${initialData.id}`}>
              <Printer className="h-4 w-4 mr-2" />
              Print / Grade
            </Link>
          </Button>
        </div>
      </div>

      <SubjectTopicsDialog
        open={topicsDialogOpen}
        onOpenChange={(next) => {
          setTopicsDialogOpen(next);
          if (!next) void refreshTopics();
        }}
        subjectId={initialData.subject.id}
        mode="teacher"
      />

      {/* Alerts */}
      {success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {error && !dialogOpen && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLocked && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This assessment has a published online test. Questions cannot be modified.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Questions</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{questions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Question Marks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalQuestionMarks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assessment Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{initialData.totalMarks}</div>
            {totalQuestionMarks !== initialData.totalMarks && (
              <p className="text-xs text-amber-600">
                Question marks differ from assessment total
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Questions List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Questions</CardTitle>
              <CardDescription>
                Add and manage questions for this assessment
              </CardDescription>
            </div>
            <Button onClick={openAddDialog} disabled={isLocked}>
              <Plus className="h-4 w-4 mr-2" />
              Add Question
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {questions.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">No Questions Yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add questions to this assessment
              </p>
              <Button onClick={openAddDialog} disabled={isLocked}>
                <Plus className="h-4 w-4 mr-2" />
                Add Question
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((question, index) => (
                <Card key={question.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-4">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <GripVertical className="h-4 w-4" />
                        <span className="font-medium">Q{index + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <p className="font-medium">{question.questionText}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline">
                                {question.type === "MCQ" ? "Multiple Choice" : "Short Answer"}
                              </Badge>
                              <Badge variant="secondary">
                                {question.marks} mark{question.marks !== 1 ? "s" : ""}
                              </Badge>
                            </div>
                            {question.type === "MCQ" && question.options.length > 0 && (
                              <div className="mt-3 space-y-1">
                                {question.options.map((opt, i) => (
                                  <div
                                    key={i}
                                    className={`text-sm flex items-center gap-2 ${
                                      opt.isCorrect ? "text-green-700 font-medium" : "text-muted-foreground"
                                    }`}
                                  >
                                    <span className="w-5 h-5 rounded-full border text-xs flex items-center justify-center">
                                      {String.fromCharCode(65 + i)}
                                    </span>
                                    {opt.optionText}
                                    {opt.isCorrect && (
                                      <CheckCircle className="h-3 w-3 text-green-600" />
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(question)}
                              disabled={isLocked}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-500 hover:text-red-600"
                              onClick={() => handleDeleteQuestion(question.id)}
                              disabled={isLocked}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Question Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingQuestion ? "Edit Question" : "Add Question"}</DialogTitle>
            <DialogDescription>
              {editingQuestion ? "Update the question details" : "Add a new question to this assessment"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Question Type</Label>
                <Select
                  value={questionForm.type}
                  onValueChange={(v) => setQuestionForm({ ...questionForm, type: v as QuestionType })}
                  disabled={!!editingQuestion}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MCQ">Multiple Choice</SelectItem>
                    <SelectItem value="SHORT_ANSWER">Short Answer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Marks</Label>
                <Input
                  type="number"
                  value={questionForm.marks}
                  onChange={(e) => setQuestionForm({ ...questionForm, marks: parseFloat(e.target.value) || 0 })}
                  min={0.5}
                  step={0.5}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Question Text *</Label>
              <Textarea
                value={questionForm.questionText}
                onChange={(e) => setQuestionForm({ ...questionForm, questionText: e.target.value })}
                placeholder="Enter your question..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Topic</Label>
              <Select
                value={questionForm.topicId}
                onValueChange={(v) => setQuestionForm({ ...questionForm, topicId: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Uncategorized" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Uncategorized</SelectItem>
                  {topics.map((t) => (
                    <SelectItem key={t.id} value={t.id} disabled={t.status === "ARCHIVED"}>
                      <span className="flex w-full items-center justify-between gap-2">
                        <span className="truncate">{t.name}</span>
                        <span className="flex items-center gap-2">
                          <Badge variant={t.source === "ADMIN" ? "default" : "secondary"}>{t.source}</Badge>
                          {t.status === "ARCHIVED" ? <Badge variant="outline">Archived</Badge> : null}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground">Archived topics can’t be used for new questions.</div>
            </div>

            {questionForm.type === "MCQ" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Options</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addOption}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add Option
                  </Button>
                </div>
                {options.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full border flex items-center justify-center text-sm font-medium">
                      {String.fromCharCode(65 + index)}
                    </div>
                    <Input
                      value={option.optionText}
                      onChange={(e) => updateOption(index, "optionText", e.target.value)}
                      placeholder={`Option ${String.fromCharCode(65 + index)}`}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant={option.isCorrect ? "default" : "outline"}
                      size="sm"
                      onClick={() => updateOption(index, "isCorrect", true)}
                    >
                      {option.isCorrect ? <CheckCircle className="h-4 w-4" /> : "Correct"}
                    </Button>
                    {options.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeOption(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <Label>Explanation (Optional)</Label>
              <Textarea
                value={questionForm.explanation}
                onChange={(e) => setQuestionForm({ ...questionForm, explanation: e.target.value })}
                placeholder="Add an explanation for the answer..."
                rows={2}
              />
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveQuestion} disabled={saving}>
              {saving ? "Saving..." : editingQuestion ? "Update" : "Add Question"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

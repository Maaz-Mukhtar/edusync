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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Plus,
  Clock,
  FileText,
  AlertCircle,
  CheckCircle,
  Edit,
  Trash2,
  Play,
  Lock,
  Eye,
  FileDown,
  GripVertical,
  Save,
} from "lucide-react";

type QuestionType = "MCQ" | "SHORT_ANSWER";
type OnlineTestStatus = "DRAFT" | "PUBLISHED" | "CLOSED";

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
  marks: number;
  orderIndex: number;
  explanation: string | null;
  options: QuestionOption[];
}

interface TestData {
  id: string;
  status: OnlineTestStatus;
  timeLimitMins: number | null;
  instructions: string | null;
  shuffleQuestions: boolean;
  showResults: boolean;
  passingScore: number | null;
  startTime: Date | null;
  endTime: Date | null;
  attemptCount: number;
  assessment: {
    id: string;
    title: string;
    totalMarks: number;
    date: Date;
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
  questions: Question[];
}

interface TestBuilderProps {
  initialData: TestData;
}

const statusColors: Record<OnlineTestStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  PUBLISHED: "bg-green-100 text-green-800",
  CLOSED: "bg-red-100 text-red-800",
};

export default function TestBuilder({ initialData }: TestBuilderProps) {
  const router = useRouter();
  const [test, setTest] = useState(initialData);
  const [questions, setQuestions] = useState<Question[]>(initialData.questions);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Question editor state
  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [questionType, setQuestionType] = useState<QuestionType>("MCQ");
  const [questionForm, setQuestionForm] = useState({
    questionText: "",
    marks: 1,
    explanation: "",
    options: [
      { optionText: "", isCorrect: true, orderIndex: 0 },
      { optionText: "", isCorrect: false, orderIndex: 1 },
      { optionText: "", isCorrect: false, orderIndex: 2 },
      { optionText: "", isCorrect: false, orderIndex: 3 },
    ] as QuestionOption[],
  });

  // Settings form state
  const [settingsForm, setSettingsForm] = useState({
    timeLimitMins: test.timeLimitMins || 60,
    instructions: test.instructions || "",
    shuffleQuestions: test.shuffleQuestions,
    showResults: test.showResults,
    passingScore: test.passingScore || 40,
  });

  const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);
  const isReadOnly = test.status !== "DRAFT";

  const refreshQuestions = useCallback(async () => {
    try {
      const response = await fetch(`/api/teacher/online-tests/${test.id}/questions`);
      if (response.ok) {
        const data = await response.json();
        setQuestions(data.questions);
      }
    } catch (error) {
      console.error("Failed to refresh questions:", error);
    }
  }, [test.id]);

  const handleSaveSettings = async () => {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/teacher/online-tests/${test.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsForm),
      });

      if (response.ok) {
        const data = await response.json();
        setTest({ ...test, ...data.onlineTest });
        setSuccess("Settings saved successfully");
      } else {
        const result = await response.json();
        setError(result.error || "Failed to save settings");
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      setError("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const openAddQuestion = (type: QuestionType) => {
    setEditingQuestion(null);
    setQuestionType(type);
    setQuestionForm({
      questionText: "",
      marks: 1,
      explanation: "",
      options: [
        { optionText: "", isCorrect: true, orderIndex: 0 },
        { optionText: "", isCorrect: false, orderIndex: 1 },
        { optionText: "", isCorrect: false, orderIndex: 2 },
        { optionText: "", isCorrect: false, orderIndex: 3 },
      ],
    });
    setQuestionDialogOpen(true);
  };

  const openEditQuestion = (question: Question) => {
    setEditingQuestion(question);
    setQuestionType(question.type);
    setQuestionForm({
      questionText: question.questionText,
      marks: question.marks,
      explanation: question.explanation || "",
      options: question.options.length > 0
        ? question.options
        : [
            { optionText: "", isCorrect: true, orderIndex: 0 },
            { optionText: "", isCorrect: false, orderIndex: 1 },
            { optionText: "", isCorrect: false, orderIndex: 2 },
            { optionText: "", isCorrect: false, orderIndex: 3 },
          ],
    });
    setQuestionDialogOpen(true);
  };

  const handleSaveQuestion = async () => {
    if (!questionForm.questionText.trim()) {
      setError("Question text is required");
      return;
    }

    if (questionType === "MCQ") {
      const validOptions = questionForm.options.filter((o) => o.optionText.trim());
      if (validOptions.length < 2) {
        setError("MCQ questions must have at least 2 options");
        return;
      }
      if (!validOptions.some((o) => o.isCorrect)) {
        setError("MCQ questions must have at least one correct answer");
        return;
      }
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        type: questionType,
        questionText: questionForm.questionText,
        marks: questionForm.marks,
        orderIndex: editingQuestion ? editingQuestion.orderIndex : questions.length,
        explanation: questionForm.explanation || null,
        ...(questionType === "MCQ" && {
          options: questionForm.options
            .filter((o) => o.optionText.trim())
            .map((o, index) => ({
              optionText: o.optionText,
              isCorrect: o.isCorrect,
              orderIndex: index,
            })),
        }),
      };

      let response;
      if (editingQuestion) {
        response = await fetch(
          `/api/teacher/online-tests/${test.id}/questions/${editingQuestion.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
      } else {
        response = await fetch(`/api/teacher/online-tests/${test.id}/questions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (response.ok) {
        setQuestionDialogOpen(false);
        setSuccess(editingQuestion ? "Question updated" : "Question added");
        refreshQuestions();
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
        `/api/teacher/online-tests/${test.id}/questions/${questionId}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        setSuccess("Question deleted");
        refreshQuestions();
      } else {
        const result = await response.json();
        setError(result.error || "Failed to delete question");
      }
    } catch (error) {
      console.error("Failed to delete question:", error);
      setError("Failed to delete question");
    }
  };

  const handlePublish = async () => {
    if (questions.length === 0) {
      setError("Cannot publish a test with no questions");
      return;
    }

    try {
      const response = await fetch(`/api/teacher/online-tests/${test.id}/publish`, {
        method: "POST",
      });

      if (response.ok) {
        setSuccess("Test published successfully! Students can now take it.");
        setTest({ ...test, status: "PUBLISHED" });
      } else {
        const result = await response.json();
        setError(result.error || "Failed to publish test");
      }
    } catch (error) {
      console.error("Failed to publish:", error);
      setError("Failed to publish test");
    }
  };

  const handleClose = async () => {
    if (!confirm("Are you sure you want to close this test? Students won't be able to take it anymore.")) return;

    try {
      const response = await fetch(`/api/teacher/online-tests/${test.id}/close`, {
        method: "POST",
      });

      if (response.ok) {
        setSuccess("Test closed");
        setTest({ ...test, status: "CLOSED" });
      } else {
        const result = await response.json();
        setError(result.error || "Failed to close test");
      }
    } catch (error) {
      console.error("Failed to close:", error);
      setError("Failed to close test");
    }
  };

  const updateOption = (index: number, field: keyof QuestionOption, value: string | boolean | number) => {
    const newOptions = [...questionForm.options];
    if (field === "isCorrect" && value === true) {
      // For MCQ with single answer, unset other correct options
      newOptions.forEach((o, i) => {
        if (i !== index) o.isCorrect = false;
      });
    }
    newOptions[index] = { ...newOptions[index], [field]: value };
    setQuestionForm({ ...questionForm, options: newOptions });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/teacher/online-tests">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">
                {test.assessment.title}
              </h1>
              <Badge className={statusColors[test.status]}>{test.status}</Badge>
            </div>
            <p className="text-muted-foreground">
              {test.section.name} &bull; {test.subject.name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/teacher/online-tests/${test.id}/preview`}>
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/teacher/online-tests/${test.id}/export`}>
              <FileDown className="h-4 w-4 mr-2" />
              Export
            </Link>
          </Button>
          {test.status === "DRAFT" && questions.length > 0 && (
            <Button onClick={handlePublish}>
              <Play className="h-4 w-4 mr-2" />
              Publish
            </Button>
          )}
          {test.status === "PUBLISHED" && (
            <Button variant="destructive" onClick={handleClose}>
              <Lock className="h-4 w-4 mr-2" />
              Close Test
            </Button>
          )}
        </div>
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

      {isReadOnly && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This test is {test.status.toLowerCase()}. Questions and settings cannot be modified.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Questions Section */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Questions</CardTitle>
                <CardDescription>
                  {questions.length} question{questions.length !== 1 ? "s" : ""} &bull;{" "}
                  {totalMarks} marks total
                </CardDescription>
              </div>
              {!isReadOnly && (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => openAddQuestion("MCQ")}>
                    <Plus className="h-4 w-4 mr-2" />
                    MCQ
                  </Button>
                  <Button variant="outline" onClick={() => openAddQuestion("SHORT_ANSWER")}>
                    <Plus className="h-4 w-4 mr-2" />
                    Short Answer
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {questions.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium">No Questions Yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Add questions to your test
                  </p>
                  {!isReadOnly && (
                    <div className="flex gap-2 justify-center">
                      <Button onClick={() => openAddQuestion("MCQ")}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add MCQ
                      </Button>
                      <Button variant="outline" onClick={() => openAddQuestion("SHORT_ANSWER")}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Short Answer
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {questions.map((question, index) => (
                    <div
                      key={question.id}
                      className="flex items-start gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      {!isReadOnly && (
                        <div className="cursor-move text-muted-foreground">
                          <GripVertical className="h-5 w-5" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">Q{index + 1}</span>
                          <Badge variant="outline" className="text-xs">
                            {question.type === "MCQ" ? "Multiple Choice" : "Short Answer"}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {question.marks} mark{question.marks !== 1 ? "s" : ""}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {question.questionText}
                        </p>
                        {question.type === "MCQ" && question.options.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {question.options.map((opt, optIndex) => (
                              <span
                                key={optIndex}
                                className={`text-xs px-2 py-0.5 rounded ${
                                  opt.isCorrect
                                    ? "bg-green-100 text-green-700"
                                    : "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {String.fromCharCode(65 + optIndex)}.{" "}
                                {opt.optionText.substring(0, 20)}
                                {opt.optionText.length > 20 ? "..." : ""}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {!isReadOnly && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditQuestion(question)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteQuestion(question.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Settings Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Test Settings</CardTitle>
              <CardDescription>Configure how the test works</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Time Limit (minutes)</Label>
                <Input
                  type="number"
                  value={settingsForm.timeLimitMins}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      timeLimitMins: parseInt(e.target.value) || 0,
                    })
                  }
                  min={1}
                  max={300}
                  disabled={isReadOnly}
                />
              </div>

              <div className="space-y-2">
                <Label>Passing Score (%)</Label>
                <Input
                  type="number"
                  value={settingsForm.passingScore}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      passingScore: parseInt(e.target.value) || 0,
                    })
                  }
                  min={0}
                  max={100}
                  disabled={isReadOnly}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Shuffle Questions</Label>
                  <p className="text-xs text-muted-foreground">
                    Randomize order for each student
                  </p>
                </div>
                <Switch
                  checked={settingsForm.shuffleQuestions}
                  onCheckedChange={(checked) =>
                    setSettingsForm({ ...settingsForm, shuffleQuestions: checked })
                  }
                  disabled={isReadOnly}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Show Results</Label>
                  <p className="text-xs text-muted-foreground">
                    Students see results after submission
                  </p>
                </div>
                <Switch
                  checked={settingsForm.showResults}
                  onCheckedChange={(checked) =>
                    setSettingsForm({ ...settingsForm, showResults: checked })
                  }
                  disabled={isReadOnly}
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Instructions</Label>
                <Textarea
                  value={settingsForm.instructions}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setSettingsForm({ ...settingsForm, instructions: e.target.value })
                  }
                  placeholder="Instructions for students..."
                  rows={4}
                  disabled={isReadOnly}
                />
              </div>

              {!isReadOnly && (
                <Button
                  className="w-full"
                  onClick={handleSaveSettings}
                  disabled={saving}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Saving..." : "Save Settings"}
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Test Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Questions</span>
                <span className="font-medium">{questions.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Marks</span>
                <span className="font-medium">{totalMarks}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Time Limit</span>
                <span className="font-medium">
                  {settingsForm.timeLimitMins} min
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Attempts</span>
                <span className="font-medium">{test.attemptCount}</span>
              </div>
              {test.attemptCount > 0 && (
                <Button variant="outline" className="w-full" asChild>
                  <Link href={`/teacher/online-tests/${test.id}/attempts`}>
                    View Attempts
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Question Editor Dialog */}
      <Dialog open={questionDialogOpen} onOpenChange={setQuestionDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingQuestion ? "Edit Question" : "Add Question"}
            </DialogTitle>
            <DialogDescription>
              {questionType === "MCQ"
                ? "Multiple choice question with one correct answer"
                : "Short answer question requiring text response"}
            </DialogDescription>
          </DialogHeader>

          <Tabs value={questionType} onValueChange={(v) => setQuestionType(v as QuestionType)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="MCQ" disabled={!!editingQuestion}>
                Multiple Choice
              </TabsTrigger>
              <TabsTrigger value="SHORT_ANSWER" disabled={!!editingQuestion}>
                Short Answer
              </TabsTrigger>
            </TabsList>

            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Question Text *</Label>
                <Textarea
                  value={questionForm.questionText}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setQuestionForm({ ...questionForm, questionText: e.target.value })
                  }
                  placeholder="Enter your question..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Marks</Label>
                <Input
                  type="number"
                  value={questionForm.marks}
                  onChange={(e) =>
                    setQuestionForm({
                      ...questionForm,
                      marks: parseInt(e.target.value) || 1,
                    })
                  }
                  min={1}
                  max={100}
                />
              </div>

              <TabsContent value="MCQ" className="mt-0 space-y-4">
                <div className="space-y-3">
                  <Label>Options (select the correct answer)</Label>
                  {questionForm.options.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="correctOption"
                        checked={option.isCorrect}
                        onChange={() => updateOption(index, "isCorrect", true)}
                        className="h-4 w-4"
                      />
                      <span className="font-medium w-6">
                        {String.fromCharCode(65 + index)}.
                      </span>
                      <Input
                        value={option.optionText}
                        onChange={(e) =>
                          updateOption(index, "optionText", e.target.value)
                        }
                        placeholder={`Option ${String.fromCharCode(65 + index)}`}
                        className={option.isCorrect ? "border-green-500" : ""}
                      />
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="SHORT_ANSWER" className="mt-0">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Students will see a text area to type their answer. You will need to
                    manually grade short answer questions.
                  </p>
                </div>
              </TabsContent>

              <div className="space-y-2">
                <Label>Explanation (Optional)</Label>
                <Textarea
                  value={questionForm.explanation}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setQuestionForm({ ...questionForm, explanation: e.target.value })
                  }
                  placeholder="Explain the correct answer..."
                  rows={2}
                />
                <p className="text-xs text-muted-foreground">
                  Shown to students after they submit the test
                </p>
              </div>
            </div>
          </Tabs>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setQuestionDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveQuestion} disabled={saving}>
              {saving ? "Saving..." : editingQuestion ? "Update Question" : "Add Question"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

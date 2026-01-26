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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  FileText,
  Plus,
  Calendar,
  Users,
  MoreHorizontal,
  Eye,
  Trash2,
  AlertCircle,
  CheckCircle,
  Pencil,
  FileQuestion,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  AssessmentsData,
  AssessmentItem,
  AssessmentSection,
  AssessmentSubject,
  AssessmentType,
} from "@/lib/data/teacher";

const typeColors: Record<AssessmentType, string> = {
  TEST: "bg-blue-100 text-blue-800",
  QUIZ: "bg-green-100 text-green-800",
  ASSIGNMENT: "bg-purple-100 text-purple-800",
  EXAM: "bg-red-100 text-red-800",
};

interface AssessmentsTabProps {
  initialData: AssessmentsData;
}

export default function AssessmentsTab({ initialData }: AssessmentsTabProps) {
  const router = useRouter();
  const [assessments, setAssessments] = useState<AssessmentItem[]>(initialData.assessments);
  const [sections] = useState<AssessmentSection[]>(initialData.sections);
  const [subjects] = useState<AssessmentSubject[]>(initialData.subjects);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Filter states
  const [filterSection, setFilterSection] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  // Form states
  const [formData, setFormData] = useState({
    sectionId: "",
    subjectId: "",
    title: "",
    type: "TEST" as AssessmentType,
    totalMarks: 100,
    date: new Date().toISOString().split("T")[0],
    description: "",
  });

  const refreshAssessments = useCallback(async () => {
    try {
      let url = "/api/teacher/assessments";
      const params = new URLSearchParams();
      if (filterSection !== "all") params.append("sectionId", filterSection);
      if (filterType !== "all") params.append("type", filterType);
      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        setAssessments(data.assessments);
      }
    } catch (error) {
      console.error("Failed to refresh:", error);
    }
  }, [filterSection, filterType]);

  // Filter assessments client-side for initial render
  const filteredAssessments = assessments.filter((a) => {
    if (filterSection !== "all" && a.section.id !== filterSection) return false;
    if (filterType !== "all" && a.type !== filterType) return false;
    return true;
  });

  const handleCreate = async () => {
    if (!formData.sectionId || !formData.subjectId || !formData.title) {
      setError("Please fill in all required fields");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/teacher/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const result = await response.json();
        setSuccess("Assessment created successfully");
        setDialogOpen(false);
        setFormData({
          sectionId: "",
          subjectId: "",
          title: "",
          type: "TEST",
          totalMarks: 100,
          date: new Date().toISOString().split("T")[0],
          description: "",
        });
        refreshAssessments();
        router.refresh();
        // Navigate to the question builder for the new assessment
        if (result.assessment?.id) {
          router.push(`/teacher/assessments/${result.assessment.id}/builder`);
        }
      } else {
        const result = await response.json();
        setError(result.error || "Failed to create assessment");
      }
    } catch (error) {
      console.error("Failed to create:", error);
      setError("Failed to create assessment");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this assessment?")) return;

    try {
      const response = await fetch(`/api/teacher/assessments/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setSuccess("Assessment deleted");
        refreshAssessments();
        router.refresh();
      } else {
        setError("Failed to delete assessment");
      }
    } catch (error) {
      console.error("Failed to delete:", error);
      setError("Failed to delete assessment");
    }
  };

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Create printable tests with questions, or grade paper-based assessments
        </p>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Assessment
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create Assessment</DialogTitle>
              <DialogDescription>
                Add a new test, quiz, or assignment for your class
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Section *</Label>
                  <Select
                    value={formData.sectionId}
                    onValueChange={(v) => setFormData({ ...formData, sectionId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select section" />
                    </SelectTrigger>
                    <SelectContent>
                      {sections.map((section) => (
                        <SelectItem key={section.id} value={section.id}>
                          {section.className} - {section.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Subject *</Label>
                  <Select
                    value={formData.subjectId}
                    onValueChange={(v) => setFormData({ ...formData, subjectId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((subject) => (
                        <SelectItem key={subject.id} value={subject.id}>
                          {subject.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Chapter 5 Quiz"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(v) => setFormData({ ...formData, type: v as AssessmentType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TEST">Test</SelectItem>
                      <SelectItem value="QUIZ">Quiz</SelectItem>
                      <SelectItem value="ASSIGNMENT">Assignment</SelectItem>
                      <SelectItem value="EXAM">Exam</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Total Marks</Label>
                  <Input
                    type="number"
                    value={formData.totalMarks}
                    onChange={(e) => setFormData({ ...formData, totalMarks: parseInt(e.target.value) || 0 })}
                    min={1}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description (Optional)</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Add any notes or instructions..."
                  rows={3}
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
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? "Creating..." : "Create & Add Questions"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Alerts */}
      {success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Filter by Section</Label>
              <Select value={filterSection} onValueChange={setFilterSection}>
                <SelectTrigger>
                  <SelectValue placeholder="All sections" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sections</SelectItem>
                  {sections.map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.className} - {section.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Filter by Type</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="TEST">Test</SelectItem>
                  <SelectItem value="QUIZ">Quiz</SelectItem>
                  <SelectItem value="ASSIGNMENT">Assignment</SelectItem>
                  <SelectItem value="EXAM">Exam</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assessments Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Assessments</CardTitle>
          <CardDescription>
            {filteredAssessments.length} assessment{filteredAssessments.length !== 1 ? "s" : ""} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredAssessments.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">No Assessments</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first assessment to get started
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Assessment
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assessment</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead className="text-center">Type</TableHead>
                  <TableHead className="text-center">Marks</TableHead>
                  <TableHead className="text-center">Questions</TableHead>
                  <TableHead className="text-center">Progress</TableHead>
                  <TableHead className="text-center">Date</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssessments.map((assessment) => (
                  <TableRow key={assessment.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/teacher/assessments/${assessment.id}`}
                        className="hover:underline"
                      >
                        {assessment.title}
                      </Link>
                    </TableCell>
                    <TableCell>{assessment.section.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: assessment.subject.color || "#888" }}
                        />
                        {assessment.subject.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={typeColors[assessment.type]} variant="secondary">
                        {assessment.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{assessment.totalMarks}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <FileQuestion className="h-4 w-4 text-muted-foreground" />
                        <span>{assessment.questionCount || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {assessment.gradedCount}/{assessment.totalStudents}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{new Date(assessment.date).toLocaleDateString()}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/teacher/assessments/${assessment.id}/builder`}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit Questions
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/teacher/assessments/${assessment.id}`}>
                              <Eye className="h-4 w-4 mr-2" />
                              View & Grade
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDelete(assessment.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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

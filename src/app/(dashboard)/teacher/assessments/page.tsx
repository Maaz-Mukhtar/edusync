"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { fetcher, swrConfig } from "@/lib/swr";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type AssessmentType = "TEST" | "QUIZ" | "ASSIGNMENT" | "EXAM";

interface Assessment {
  id: string;
  title: string;
  type: AssessmentType;
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
  gradedCount: number;
  totalStudents: number;
  createdAt: string;
}

interface Section {
  id: string;
  name: string;
  className: string;
}

interface Subject {
  id: string;
  name: string;
  color: string | null;
}

const typeColors: Record<AssessmentType, string> = {
  TEST: "bg-blue-100 text-blue-800",
  QUIZ: "bg-green-100 text-green-800",
  ASSIGNMENT: "bg-purple-100 text-purple-800",
  EXAM: "bg-red-100 text-red-800",
};

interface AssessmentsResponse {
  assessments: Assessment[];
}

interface ClassesResponse {
  sections: Section[];
  subjects: Subject[];
}

export default function TeacherAssessmentsPage() {
  // Fetch assessments and classes with SWR
  const { data: assessmentsData, isLoading: loadingAssessments, mutate: mutateAssessments } = useSWR<AssessmentsResponse>(
    "/api/teacher/assessments",
    fetcher,
    swrConfig
  );
  const { data: classesData, isLoading: loadingClasses } = useSWR<ClassesResponse>(
    "/api/teacher/classes",
    fetcher,
    swrConfig
  );

  const loading = loadingAssessments || loadingClasses;
  const assessments = assessmentsData?.assessments || [];
  const sections = classesData?.sections || [];
  const subjects = classesData?.subjects || [];

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

  const refreshAssessments = async () => {
    // Use SWR mutate to revalidate the cache
    await mutateAssessments();
  };

  // Note: For filtered data, we would need to use a dynamic SWR key
  // For now, filters work with the initial data or use local filtering
  useEffect(() => {
    if (!loading && (filterSection !== "all" || filterType !== "all")) {
      // Trigger a refetch with filters by mutating SWR
      const fetchFiltered = async () => {
        let url = "/api/teacher/assessments";
        const params = new URLSearchParams();
        if (filterSection !== "all") params.append("sectionId", filterSection);
        if (filterType !== "all") params.append("type", filterType);
        if (params.toString()) url += `?${params.toString()}`;

        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          mutateAssessments(data, false);
        }
      };
      fetchFiltered();
    } else if (!loading) {
      mutateAssessments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSection, filterType]);

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
      } else {
        setError("Failed to delete assessment");
      }
    } catch (error) {
      console.error("Failed to delete:", error);
      setError("Failed to delete assessment");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Assessments</h1>
          <p className="text-muted-foreground">
            Create and manage tests, quizzes, and assignments
          </p>
        </div>

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
                {creating ? "Creating..." : "Create Assessment"}
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
            {assessments.length} assessment{assessments.length !== 1 ? "s" : ""} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assessments.length === 0 ? (
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
                  <TableHead className="text-center">Progress</TableHead>
                  <TableHead className="text-center">Date</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assessments.map((assessment) => (
                  <TableRow key={assessment.id}>
                    <TableCell className="font-medium">{assessment.title}</TableCell>
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
                            <Link href={`/teacher/assessments/${assessment.id}`}>
                              <Eye className="h-4 w-4 mr-2" />
                              View & Grade
                            </Link>
                          </DropdownMenuItem>
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

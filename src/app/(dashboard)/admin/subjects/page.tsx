"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  BookOpen,
  MoreHorizontal,
  Users,
  FileText,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface Subject {
  id: string;
  name: string;
  code: string | null;
  color: string | null;
  _count: {
    teachers: number;
    assessments: number;
  };
}

const subjectColors = [
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Yellow", value: "#eab308" },
  { name: "Green", value: "#22c55e" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Purple", value: "#a855f7" },
  { name: "Pink", value: "#ec4899" },
];

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Form states
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [deletingSubject, setDeletingSubject] = useState<Subject | null>(null);

  // Form data
  const [subjectName, setSubjectName] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [subjectColor, setSubjectColor] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchSubjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/subjects");
      const data = await response.json();

      if (response.ok) {
        setSubjects(data.subjects);
      } else {
        toast.error(data.error || "Failed to fetch subjects");
      }
    } catch {
      toast.error("Failed to fetch subjects");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  const openDialog = (subject?: Subject) => {
    if (subject) {
      setEditingSubject(subject);
      setSubjectName(subject.name);
      setSubjectCode(subject.code || "");
      setSubjectColor(subject.color || "");
    } else {
      setEditingSubject(null);
      setSubjectName("");
      setSubjectCode("");
      setSubjectColor("");
    }
    setDialogOpen(true);
  };

  const openDeleteDialog = (subject: Subject) => {
    setDeletingSubject(subject);
    setDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    if (!subjectName.trim()) {
      toast.error("Subject name is required");
      return;
    }

    setIsSaving(true);
    try {
      const url = editingSubject ? `/api/subjects/${editingSubject.id}` : "/api/subjects";
      const method = editingSubject ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: subjectName,
          code: subjectCode || null,
          color: subjectColor || null,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(editingSubject ? "Subject updated successfully" : "Subject created successfully");
        setDialogOpen(false);
        fetchSubjects();
      } else {
        toast.error(data.error || "Failed to save subject");
      }
    } catch {
      toast.error("Failed to save subject");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingSubject) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/subjects/${deletingSubject.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Subject deleted successfully");
        setDeleteDialogOpen(false);
        setDeletingSubject(null);
        fetchSubjects();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to delete subject");
      }
    } catch {
      toast.error("Failed to delete subject");
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading subjects...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subjects</h1>
          <p className="text-muted-foreground">
            Manage your school&apos;s academic subjects
          </p>
        </div>
        <Button onClick={() => openDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Add Subject
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Subjects</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subjects.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assessments</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {subjects.reduce((acc, s) => acc + s._count.assessments, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Subjects Grid */}
      {subjects.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <BookOpen className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No subjects yet</h3>
            <p className="text-muted-foreground">
              Get started by creating your first subject
            </p>
            <Button className="mt-4" onClick={() => openDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Add Subject
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {subjects.map((subject) => (
            <Card key={subject.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-lg flex items-center justify-center"
                      style={{
                        backgroundColor: subject.color || "#6366f1",
                      }}
                    >
                      <BookOpen className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{subject.name}</CardTitle>
                      {subject.code && (
                        <CardDescription>{subject.code}</CardDescription>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openDialog(subject)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => openDeleteDialog(subject)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {subject._count.teachers} teacher{subject._count.teachers !== 1 ? "s" : ""}
                  </div>
                  <div className="flex items-center gap-1">
                    <FileText className="h-4 w-4" />
                    {subject._count.assessments} assessment{subject._count.assessments !== 1 ? "s" : ""}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Subject Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSubject ? "Edit Subject" : "Add New Subject"}</DialogTitle>
            <DialogDescription>
              {editingSubject ? "Update the subject details" : "Create a new subject for your school"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="subjectName">Subject Name *</Label>
              <Input
                id="subjectName"
                placeholder="e.g., Mathematics, English"
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subjectCode">Subject Code (Optional)</Label>
              <Input
                id="subjectCode"
                placeholder="e.g., MATH, ENG"
                value={subjectCode}
                onChange={(e) => setSubjectCode(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Color (Optional)</Label>
              <div className="flex flex-wrap gap-2">
                {subjectColors.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    className={`h-8 w-8 rounded-full border-2 transition-all ${
                      subjectColor === color.value
                        ? "border-primary scale-110"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: color.value }}
                    onClick={() => setSubjectColor(color.value)}
                    title={color.name}
                  />
                ))}
                {subjectColor && (
                  <button
                    type="button"
                    className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setSubjectColor("")}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : editingSubject ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{deletingSubject?.name}&quot;.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

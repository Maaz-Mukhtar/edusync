"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  BookOpen,
  MoreHorizontal,
  Users,
  ChevronRight,
  ArrowLeft,
  UserPlus,
  X,
  GraduationCap,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Class {
  id: string;
  name: string;
  displayOrder: number;
  _count: {
    sections: number;
  };
}

interface Teacher {
  id: string; // User ID
  teacherProfileId: string; // TeacherProfile ID
  firstName: string;
  lastName: string;
  email: string | null;
}

interface SubjectTeacher {
  id: string;
  teacherId: string;
  firstName: string;
  lastName: string;
  email: string | null;
}

interface Subject {
  id: string;
  name: string;
  code: string | null;
  color: string | null;
  classId: string;
  teachers: SubjectTeacher[];
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
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);

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

  // Teacher management states
  const [teacherDialogOpen, setTeacherDialogOpen] = useState(false);
  const [allTeachers, setAllTeachers] = useState<Teacher[]>([]);
  const [selectedSubjectForTeachers, setSelectedSubjectForTeachers] = useState<Subject | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");
  const [addingTeacher, setAddingTeacher] = useState(false);

  const fetchClasses = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/classes");
      const data = await response.json();

      if (response.ok) {
        setClasses(data.classes);
      } else {
        toast.error(data.error || "Failed to fetch classes");
      }
    } catch {
      toast.error("Failed to fetch classes");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchSubjects = useCallback(async (classId: string) => {
    setIsLoadingSubjects(true);
    try {
      const response = await fetch(`/api/classes/${classId}/subjects`);
      const data = await response.json();

      if (response.ok) {
        setSubjects(data.subjects);
      } else {
        toast.error(data.error || "Failed to fetch subjects");
      }
    } catch {
      toast.error("Failed to fetch subjects");
    } finally {
      setIsLoadingSubjects(false);
    }
  }, []);

  const fetchAllTeachers = async () => {
    try {
      const response = await fetch("/api/teachers?limit=1000");
      const data = await response.json();
      if (response.ok) {
        // Map the API response to match our Teacher interface
        const mappedTeachers = data.teachers.map((t: {
          id: string;
          firstName: string;
          lastName: string;
          email: string | null;
          teacherProfile: { id: string } | null;
        }) => ({
          id: t.id,
          teacherProfileId: t.teacherProfile?.id || "",
          firstName: t.firstName,
          lastName: t.lastName,
          email: t.email,
        })).filter((t: Teacher) => t.teacherProfileId); // Only include teachers with profiles
        setAllTeachers(mappedTeachers);
      }
    } catch {
      toast.error("Failed to fetch teachers");
    }
  };

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  useEffect(() => {
    if (selectedClass) {
      fetchSubjects(selectedClass.id);
    }
  }, [selectedClass, fetchSubjects]);

  const openTeacherDialog = async (subject: Subject) => {
    setSelectedSubjectForTeachers(subject);
    setTeacherDialogOpen(true);
    await fetchAllTeachers();
  };

  const handleAddTeacher = async () => {
    if (!selectedSubjectForTeachers || !selectedTeacherId || !selectedClass) return;

    // Find the teacher to get their teacherProfileId
    const teacher = allTeachers.find(t => t.teacherProfileId === selectedTeacherId);
    if (!teacher) {
      toast.error("Teacher not found");
      return;
    }

    setAddingTeacher(true);
    try {
      const response = await fetch(
        `/api/classes/${selectedClass.id}/subjects/${selectedSubjectForTeachers.id}/teachers`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teacherId: teacher.teacherProfileId }),
        }
      );

      if (response.ok) {
        toast.success("Teacher assigned successfully");
        setSelectedTeacherId("");
        await fetchSubjects(selectedClass.id);
        // Update the selected subject
        const updatedSubjects = await fetch(`/api/classes/${selectedClass.id}/subjects`).then(r => r.json());
        const updatedSubject = updatedSubjects.subjects.find((s: Subject) => s.id === selectedSubjectForTeachers.id);
        if (updatedSubject) {
          setSelectedSubjectForTeachers(updatedSubject);
        }
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to assign teacher");
      }
    } catch {
      toast.error("Failed to assign teacher");
    } finally {
      setAddingTeacher(false);
    }
  };

  const handleRemoveTeacher = async (teacherId: string) => {
    if (!selectedSubjectForTeachers || !selectedClass) return;

    try {
      const response = await fetch(
        `/api/classes/${selectedClass.id}/subjects/${selectedSubjectForTeachers.id}/teachers?teacherId=${teacherId}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        toast.success("Teacher removed successfully");
        await fetchSubjects(selectedClass.id);
        // Update the selected subject
        const updatedSubjects = await fetch(`/api/classes/${selectedClass.id}/subjects`).then(r => r.json());
        const updatedSubject = updatedSubjects.subjects.find((s: Subject) => s.id === selectedSubjectForTeachers.id);
        if (updatedSubject) {
          setSelectedSubjectForTeachers(updatedSubject);
        }
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to remove teacher");
      }
    } catch {
      toast.error("Failed to remove teacher");
    }
  };

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
    if (!subjectName.trim() || !selectedClass) {
      toast.error("Subject name is required");
      return;
    }

    setIsSaving(true);
    try {
      const url = editingSubject
        ? `/api/classes/${selectedClass.id}/subjects/${editingSubject.id}`
        : `/api/classes/${selectedClass.id}/subjects`;
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
        fetchSubjects(selectedClass.id);
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
    if (!deletingSubject || !selectedClass) return;

    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/classes/${selectedClass.id}/subjects/${deletingSubject.id}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        toast.success("Subject deleted successfully");
        setDeleteDialogOpen(false);
        setDeletingSubject(null);
        fetchSubjects(selectedClass.id);
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
        <div className="text-muted-foreground">Loading classes...</div>
      </div>
    );
  }

  // Show classes list
  if (!selectedClass) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Subjects</h1>
            <p className="text-muted-foreground">
              Select a class to manage its subjects
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Classes</CardTitle>
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{classes.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sections</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {classes.reduce((acc, c) => acc + c._count.sections, 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Classes Grid */}
        {classes.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <GraduationCap className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No classes yet</h3>
              <p className="text-muted-foreground">
                Create classes first before adding subjects
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {classes.map((classItem) => (
              <Card
                key={classItem.id}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => setSelectedClass(classItem)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <GraduationCap className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{classItem.name}</CardTitle>
                        <CardDescription>
                          {classItem._count.sections} section{classItem._count.sections !== 1 ? "s" : ""}
                        </CardDescription>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Show subjects for selected class
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedClass(null)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {selectedClass.name} - Subjects
            </h1>
            <p className="text-muted-foreground">
              Manage subjects for {selectedClass.name}
            </p>
          </div>
        </div>
        <Button onClick={() => openDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Add Subject
        </Button>
      </div>

      {/* Subjects Grid */}
      {isLoadingSubjects ? (
        <div className="flex items-center justify-center h-32">
          <div className="text-muted-foreground">Loading subjects...</div>
        </div>
      ) : subjects.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <BookOpen className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No subjects yet</h3>
            <p className="text-muted-foreground">
              Get started by creating a subject for {selectedClass.name}
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
                      <DropdownMenuItem onClick={() => openTeacherDialog(subject)}>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Manage Teachers
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
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  {subject.teachers.length} teacher{subject.teachers.length !== 1 ? "s" : ""}
                  {subject.teachers.length > 0 && (
                    <span className="ml-1">
                      ({subject.teachers.map(t => `${t.firstName} ${t.lastName}`).join(", ")})
                    </span>
                  )}
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
              {editingSubject
                ? "Update the subject details"
                : `Create a new subject for ${selectedClass.name}`}
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

      {/* Teacher Management Dialog */}
      <Dialog open={teacherDialogOpen} onOpenChange={setTeacherDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Teachers</DialogTitle>
            <DialogDescription>
              Assign teachers to {selectedSubjectForTeachers?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Add Teacher */}
            <div className="space-y-2">
              <Label>Add Teacher</Label>
              <div className="flex gap-2">
                <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a teacher" />
                  </SelectTrigger>
                  <SelectContent>
                    {allTeachers
                      .filter(
                        (t) => !selectedSubjectForTeachers?.teachers.some((st) => st.teacherId === t.teacherProfileId)
                      )
                      .map((teacher) => (
                        <SelectItem key={teacher.teacherProfileId} value={teacher.teacherProfileId}>
                          {teacher.firstName} {teacher.lastName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleAddTeacher}
                  disabled={!selectedTeacherId || addingTeacher}
                >
                  {addingTeacher ? "Adding..." : "Add"}
                </Button>
              </div>
            </div>

            {/* Assigned Teachers List */}
            <div className="space-y-2">
              <Label>Assigned Teachers</Label>
              {selectedSubjectForTeachers?.teachers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No teachers assigned</p>
              ) : (
                <div className="space-y-2">
                  {selectedSubjectForTeachers?.teachers.map((teacher) => (
                    <div
                      key={teacher.id}
                      className="flex items-center justify-between p-2 border rounded-md"
                    >
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {teacher.firstName} {teacher.lastName}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleRemoveTeacher(teacher.teacherId)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTeacherDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  ChevronDown,
  ChevronRight,
  School,
  MoreHorizontal,
  UserPlus,
  X,
  Crown,
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

interface Teacher {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  employeeId: string | null;
}

interface SectionTeacher {
  id: string;
  teacherId: string;
  isClassTeacher: boolean;
  teacher: Teacher;
}

interface Section {
  id: string;
  name: string;
  capacity: number | null;
  _count: {
    students: number;
    teachers: number;
  };
  teachers?: SectionTeacher[];
}

interface Class {
  id: string;
  name: string;
  displayOrder: number;
  sections: Section[];
  _count: {
    sections: number;
  };
}

export default function ClassesPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());

  // Dialog states
  const [classDialogOpen, setClassDialogOpen] = useState(false);
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [teacherDialogOpen, setTeacherDialogOpen] = useState(false);

  // Teacher management states
  const [allTeachers, setAllTeachers] = useState<Teacher[]>([]);
  const [selectedSectionForTeachers, setSelectedSectionForTeachers] = useState<{ section: Section; className: string } | null>(null);
  const [sectionTeachers, setSectionTeachers] = useState<SectionTeacher[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");
  const [isClassTeacher, setIsClassTeacher] = useState(false);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [addingTeacher, setAddingTeacher] = useState(false);

  // Form states
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [editingSection, setEditingSection] = useState<{ section: Section; classId: string } | null>(null);
  const [deletingItem, setDeletingItem] = useState<{ type: "class" | "section"; id: string; name: string } | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  // Form data
  const [className, setClassName] = useState("");
  const [sectionName, setSectionName] = useState("");
  const [sectionCapacity, setSectionCapacity] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchClasses = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/classes");
      const data = await response.json();

      if (response.ok) {
        setClasses(data.classes);
        // Expand all by default
        setExpandedClasses(new Set(data.classes.map((c: Class) => c.id)));
      } else {
        toast.error(data.error || "Failed to fetch classes");
      }
    } catch {
      toast.error("Failed to fetch classes");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  // Fetch all teachers for assignment
  const fetchAllTeachers = useCallback(async () => {
    try {
      const response = await fetch("/api/teachers");
      const data = await response.json();
      if (response.ok) {
        setAllTeachers(data.teachers);
      }
    } catch {
      console.error("Failed to fetch teachers");
    }
  }, []);

  useEffect(() => {
    fetchAllTeachers();
  }, [fetchAllTeachers]);

  // Fetch teachers for a specific section
  const fetchSectionTeachers = async (sectionId: string) => {
    setLoadingTeachers(true);
    try {
      const response = await fetch(`/api/sections/${sectionId}/teachers`);
      const data = await response.json();
      if (response.ok) {
        setSectionTeachers(data.teachers);
      } else {
        toast.error("Failed to load teachers");
      }
    } catch {
      toast.error("Failed to load teachers");
    } finally {
      setLoadingTeachers(false);
    }
  };

  // Open teacher management dialog
  const openTeacherDialog = (section: Section, className: string) => {
    setSelectedSectionForTeachers({ section, className });
    setSelectedTeacherId("");
    setIsClassTeacher(false);
    fetchSectionTeachers(section.id);
    setTeacherDialogOpen(true);
  };

  // Add teacher to section
  const handleAddTeacher = async () => {
    if (!selectedTeacherId || !selectedSectionForTeachers) return;

    setAddingTeacher(true);
    try {
      const response = await fetch(`/api/sections/${selectedSectionForTeachers.section.id}/teachers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: selectedTeacherId,
          isClassTeacher,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Teacher assigned successfully");
        setSelectedTeacherId("");
        setIsClassTeacher(false);
        fetchSectionTeachers(selectedSectionForTeachers.section.id);
        fetchClasses(); // Refresh counts
      } else {
        toast.error(data.error || "Failed to assign teacher");
      }
    } catch {
      toast.error("Failed to assign teacher");
    } finally {
      setAddingTeacher(false);
    }
  };

  // Remove teacher from section
  const handleRemoveTeacher = async (teacherId: string) => {
    if (!selectedSectionForTeachers) return;

    try {
      const response = await fetch(
        `/api/sections/${selectedSectionForTeachers.section.id}/teachers?teacherId=${teacherId}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        toast.success("Teacher removed successfully");
        fetchSectionTeachers(selectedSectionForTeachers.section.id);
        fetchClasses(); // Refresh counts
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to remove teacher");
      }
    } catch {
      toast.error("Failed to remove teacher");
    }
  };

  const toggleExpand = (classId: string) => {
    const newExpanded = new Set(expandedClasses);
    if (newExpanded.has(classId)) {
      newExpanded.delete(classId);
    } else {
      newExpanded.add(classId);
    }
    setExpandedClasses(newExpanded);
  };

  const openClassDialog = (classData?: Class) => {
    if (classData) {
      setEditingClass(classData);
      setClassName(classData.name);
    } else {
      setEditingClass(null);
      setClassName("");
    }
    setClassDialogOpen(true);
  };

  const openSectionDialog = (classId: string, section?: Section) => {
    setSelectedClassId(classId);
    if (section) {
      setEditingSection({ section, classId });
      setSectionName(section.name);
      setSectionCapacity(section.capacity?.toString() || "");
    } else {
      setEditingSection(null);
      setSectionName("");
      setSectionCapacity("");
    }
    setSectionDialogOpen(true);
  };

  const openDeleteDialog = (type: "class" | "section", id: string, name: string) => {
    setDeletingItem({ type, id, name });
    setDeleteDialogOpen(true);
  };

  const handleSaveClass = async () => {
    if (!className.trim()) {
      toast.error("Class name is required");
      return;
    }

    setIsSaving(true);
    try {
      const url = editingClass ? `/api/classes/${editingClass.id}` : "/api/classes";
      const method = editingClass ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: className }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(editingClass ? "Class updated successfully" : "Class created successfully");
        setClassDialogOpen(false);
        fetchClasses();
      } else {
        toast.error(data.error || "Failed to save class");
      }
    } catch {
      toast.error("Failed to save class");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSection = async () => {
    if (!sectionName.trim()) {
      toast.error("Section name is required");
      return;
    }

    setIsSaving(true);
    try {
      const url = editingSection
        ? `/api/sections/${editingSection.section.id}`
        : `/api/classes/${selectedClassId}/sections`;
      const method = editingSection ? "PUT" : "POST";

      const body: Record<string, unknown> = { name: sectionName };
      if (sectionCapacity) {
        body.capacity = parseInt(sectionCapacity);
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(editingSection ? "Section updated successfully" : "Section created successfully");
        setSectionDialogOpen(false);
        fetchClasses();
      } else {
        toast.error(data.error || "Failed to save section");
      }
    } catch {
      toast.error("Failed to save section");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingItem) return;

    setIsDeleting(true);
    try {
      const url = deletingItem.type === "class"
        ? `/api/classes/${deletingItem.id}`
        : `/api/sections/${deletingItem.id}`;

      const response = await fetch(url, { method: "DELETE" });

      if (response.ok) {
        toast.success(`${deletingItem.type === "class" ? "Class" : "Section"} deleted successfully`);
        setDeleteDialogOpen(false);
        setDeletingItem(null);
        fetchClasses();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to delete");
      }
    } catch {
      toast.error("Failed to delete");
    } finally {
      setIsDeleting(false);
    }
  };

  const getTotalStudents = () => {
    return classes.reduce((acc, cls) => {
      return acc + cls.sections.reduce((sAcc, section) => sAcc + section._count.students, 0);
    }, 0);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading classes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Classes & Sections</h1>
          <p className="text-muted-foreground">
            Manage your school&apos;s academic structure
          </p>
        </div>
        <Button onClick={() => openClassDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Add Class
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Classes</CardTitle>
            <School className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{classes.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sections</CardTitle>
            <School className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {classes.reduce((acc, cls) => acc + cls.sections.length, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getTotalStudents()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Classes List */}
      <div className="space-y-4">
        {classes.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <School className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No classes yet</h3>
              <p className="text-muted-foreground">
                Get started by creating your first class
              </p>
              <Button className="mt-4" onClick={() => openClassDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Add Class
              </Button>
            </CardContent>
          </Card>
        ) : (
          classes.map((cls) => (
            <Card key={cls.id}>
              <Collapsible
                open={expandedClasses.has(cls.id)}
                onOpenChange={() => toggleExpand(cls.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="p-0 hover:bg-transparent">
                        <div className="flex items-center gap-2">
                          {expandedClasses.has(cls.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <CardTitle className="text-lg">{cls.name}</CardTitle>
                        </div>
                      </Button>
                    </CollapsibleTrigger>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {cls.sections.length} section{cls.sections.length !== 1 ? "s" : ""}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openSectionDialog(cls.id)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Section
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openClassDialog(cls)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit Class
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => openDeleteDialog("class", cls.id, cls.name)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Class
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    {cls.sections.length === 0 ? (
                      <div className="py-4 text-center text-muted-foreground">
                        No sections yet.{" "}
                        <button
                          className="text-primary underline"
                          onClick={() => openSectionDialog(cls.id)}
                        >
                          Add one
                        </button>
                      </div>
                    ) : (
                      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                        {cls.sections.map((section) => (
                          <div
                            key={section.id}
                            className="flex items-center justify-between rounded-lg border p-3"
                          >
                            <div>
                              <div className="font-medium">
                                {cls.name} - {section.name}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {section._count.students} student{section._count.students !== 1 ? "s" : ""}
                                {section.capacity && ` / ${section.capacity} capacity`}
                                {" | "}
                                {section._count.teachers} teacher{section._count.teachers !== 1 ? "s" : ""}
                              </div>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openTeacherDialog(section, cls.name)}>
                                  <UserPlus className="mr-2 h-4 w-4" />
                                  Manage Teachers
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openSectionDialog(cls.id, section)}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => openDeleteDialog("section", section.id, `${cls.name} - ${section.name}`)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))
        )}
      </div>

      {/* Class Dialog */}
      <Dialog open={classDialogOpen} onOpenChange={setClassDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingClass ? "Edit Class" : "Add New Class"}</DialogTitle>
            <DialogDescription>
              {editingClass ? "Update the class name" : "Create a new class for your school"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="className">Class Name</Label>
              <Input
                id="className"
                placeholder="e.g., Grade 6, Class 10"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClassDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveClass} disabled={isSaving}>
              {isSaving ? "Saving..." : editingClass ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Section Dialog */}
      <Dialog open={sectionDialogOpen} onOpenChange={setSectionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSection ? "Edit Section" : "Add New Section"}</DialogTitle>
            <DialogDescription>
              {editingSection ? "Update the section details" : "Create a new section for this class"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="sectionName">Section Name</Label>
              <Input
                id="sectionName"
                placeholder="e.g., A, B, Blue"
                value={sectionName}
                onChange={(e) => setSectionName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sectionCapacity">Capacity (Optional)</Label>
              <Input
                id="sectionCapacity"
                type="number"
                placeholder="e.g., 30"
                value={sectionCapacity}
                onChange={(e) => setSectionCapacity(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSectionDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSection} disabled={isSaving}>
              {isSaving ? "Saving..." : editingSection ? "Update" : "Create"}
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
              This will permanently delete &quot;{deletingItem?.name}&quot;.
              {deletingItem?.type === "class" && " All sections in this class will also be deleted."}
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
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Manage Teachers</DialogTitle>
            <DialogDescription>
              {selectedSectionForTeachers &&
                `Assign teachers to ${selectedSectionForTeachers.className} - ${selectedSectionForTeachers.section.name}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Add Teacher Form */}
            <div className="space-y-3">
              <Label>Add Teacher</Label>
              <div className="flex gap-2">
                <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a teacher" />
                  </SelectTrigger>
                  <SelectContent>
                    {allTeachers
                      .filter((t) => !sectionTeachers.some((st) => st.teacherId === t.id))
                      .map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                          {teacher.firstName} {teacher.lastName}
                          {teacher.employeeId && ` (${teacher.employeeId})`}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleAddTeacher} disabled={!selectedTeacherId || addingTeacher}>
                  {addingTeacher ? "Adding..." : "Add"}
                </Button>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isClassTeacher"
                  checked={isClassTeacher}
                  onCheckedChange={(checked) => setIsClassTeacher(checked === true)}
                />
                <Label htmlFor="isClassTeacher" className="text-sm font-normal">
                  Set as Class Teacher
                </Label>
              </div>
            </div>

            {/* Assigned Teachers List */}
            <div className="space-y-2">
              <Label>Assigned Teachers</Label>
              {loadingTeachers ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : sectionTeachers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No teachers assigned yet</p>
              ) : (
                <div className="space-y-2">
                  {sectionTeachers.map((st) => (
                    <div
                      key={st.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {st.teacher.firstName} {st.teacher.lastName}
                        </span>
                        {st.isClassTeacher && (
                          <Badge variant="secondary" className="gap-1">
                            <Crown className="h-3 w-3" />
                            Class Teacher
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveTeacher(st.teacherId)}
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

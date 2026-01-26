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
  Crown,
  Layers,
  LayoutGrid,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

// Naming convention presets for bulk creation
const NAMING_PRESETS: Record<string, string[]> = {
  letters: ["A", "B", "C", "D", "E", "F", "G", "H"],
  colors: ["Blue", "Green", "Red", "Yellow", "Orange", "Purple", "Pink", "White"],
  numbers: ["1", "2", "3", "4", "5", "6", "7", "8"],
  roman: ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"],
};

const GRADE_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

interface Teacher {
  id: string; // User ID
  teacherProfileId: string; // TeacherProfile ID
  firstName: string;
  lastName: string;
  email: string | null;
  employeeId: string | null;
}

interface AvailableTeacher {
  id: string;
  firstName: string;
  lastName: string;
}

interface SubjectAssignment {
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
  subjectColor: string | null;
  assignedTeacher: AvailableTeacher | null;
  availableTeachers: AvailableTeacher[];
}

interface SectionInfo {
  id: string;
  name: string;
  className: string;
  classTeacher: AvailableTeacher | null;
}

interface Section {
  id: string;
  name: string;
  capacity: number | null;
  _count: {
    students: number;
  };
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

interface TeachingAssignmentsResponse {
  class: { id: string; name: string };
  sections: Array<{ id: string; name: string }>;
  subjects: Array<{ id: string; name: string; code: string | null; color: string | null }>;
  teachers: Array<{ id: string; firstName: string; lastName: string }>;
  assignments: Array<{ sectionId: string; subjectId: string; teacherId: string }>;
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
  const [selectedSectionForTeachers, setSelectedSectionForTeachers] = useState<{ section: Section; className: string; classId: string } | null>(null);
  const [sectionInfo, setSectionInfo] = useState<SectionInfo | null>(null);
  const [subjectAssignments, setSubjectAssignments] = useState<SubjectAssignment[]>([]);
  const [selectedClassTeacherId, setSelectedClassTeacherId] = useState<string>("");
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [savingTeacher, setSavingTeacher] = useState(false);

  // Class-wide teaching assignments matrix
  const [teachingDialogOpen, setTeachingDialogOpen] = useState(false);
  const [selectedClassForTeaching, setSelectedClassForTeaching] = useState<Class | null>(null);
  const [teachingSections, setTeachingSections] = useState<Array<{ id: string; name: string }>>([]);
  const [teachingSubjects, setTeachingSubjects] = useState<Array<{ id: string; name: string; code: string | null; color: string | null }>>([]);
  const [teachingTeachers, setTeachingTeachers] = useState<Array<{ id: string; firstName: string; lastName: string }>>([]);
  const [teachingInitial, setTeachingInitial] = useState<Map<string, string | null>>(new Map());
  const [teachingDraft, setTeachingDraft] = useState<Map<string, string | null>>(new Map());
  const [teachingLoading, setTeachingLoading] = useState(false);
  const [teachingSaving, setTeachingSaving] = useState(false);

  // Form states
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [editingSection, setEditingSection] = useState<{ section: Section; classId: string } | null>(null);
  const [deletingItem, setDeletingItem] = useState<{ type: "class" | "section"; id: string; name: string } | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  // Form data - Single Class
  const [className, setClassName] = useState("");
  const [sectionName, setSectionName] = useState("");
  const [sectionCapacity, setSectionCapacity] = useState("");

  // Form data - Bulk Setup
  const [activeTab, setActiveTab] = useState("single");
  const [bulkFromGrade, setBulkFromGrade] = useState(1);
  const [bulkToGrade, setBulkToGrade] = useState(12);
  const [bulkSectionsPerClass, setBulkSectionsPerClass] = useState(3);
  const [bulkNamingConvention, setBulkNamingConvention] = useState("letters");
  const [bulkCustomNames, setBulkCustomNames] = useState("");

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
      const response = await fetch("/api/teachers?limit=1000");
      const data = await response.json();
      if (response.ok) {
        // Map the API response to include teacherProfileId
        const mappedTeachers = data.teachers.map((t: {
          id: string;
          firstName: string;
          lastName: string;
          email: string | null;
          teacherProfile: { id: string; employeeId: string | null } | null;
        }) => ({
          id: t.id,
          teacherProfileId: t.teacherProfile?.id || "",
          firstName: t.firstName,
          lastName: t.lastName,
          email: t.email,
          employeeId: t.teacherProfile?.employeeId || null,
        })).filter((t: Teacher) => t.teacherProfileId); // Only include teachers with profiles
        setAllTeachers(mappedTeachers);
      }
    } catch {
      console.error("Failed to fetch teachers");
    }
  }, []);

  useEffect(() => {
    fetchAllTeachers();
  }, [fetchAllTeachers]);

  const makeTeachingKey = (sectionId: string, subjectId: string) => `${sectionId}:${subjectId}`;

  const openTeachingAssignmentsDialog = async (cls: Class) => {
    setSelectedClassForTeaching(cls);
    setTeachingDialogOpen(true);
    setTeachingLoading(true);

    try {
      const response = await fetch(`/api/classes/${cls.id}/teaching-assignments`);
      const data = (await response.json()) as TeachingAssignmentsResponse & { error?: string };

      if (!response.ok) {
        toast.error(data.error || "Failed to load teaching assignments");
        return;
      }

      setTeachingSections(data.sections);
      setTeachingSubjects(data.subjects);
      setTeachingTeachers(data.teachers);

      const initial = new Map<string, string | null>();
      for (const section of data.sections) {
        for (const subject of data.subjects) {
          initial.set(makeTeachingKey(section.id, subject.id), null);
        }
      }

      for (const a of data.assignments) {
        initial.set(makeTeachingKey(a.sectionId, a.subjectId), a.teacherId);
      }

      setTeachingInitial(initial);
      setTeachingDraft(new Map(initial));
    } catch {
      toast.error("Failed to load teaching assignments");
    } finally {
      setTeachingLoading(false);
    }
  };

  const setTeachingCell = (sectionId: string, subjectId: string, teacherId: string | null) => {
    const key = makeTeachingKey(sectionId, subjectId);
    setTeachingDraft((prev) => {
      const next = new Map(prev);
      next.set(key, teacherId);
      return next;
    });
  };

  const setTeachingSubjectAll = (subjectId: string, teacherId: string | null) => {
    setTeachingDraft((prev) => {
      const next = new Map(prev);
      for (const section of teachingSections) {
        next.set(makeTeachingKey(section.id, subjectId), teacherId);
      }
      return next;
    });
  };

  const handleSaveTeachingAssignments = async () => {
    if (!selectedClassForTeaching) return;

    const changes: Array<{ sectionId: string; subjectId: string; teacherId: string | null }> = [];
    for (const [key, nextTeacherId] of teachingDraft.entries()) {
      const prevTeacherId = teachingInitial.get(key) ?? null;
      if (nextTeacherId !== prevTeacherId) {
        const [sectionId, subjectId] = key.split(":");
        changes.push({ sectionId, subjectId, teacherId: nextTeacherId });
      }
    }

    if (changes.length === 0) {
      toast.info("No changes to save");
      setTeachingDialogOpen(false);
      return;
    }

    setTeachingSaving(true);
    try {
      const response = await fetch(`/api/classes/${selectedClassForTeaching.id}/teaching-assignments`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignments: changes }),
      });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to save teaching assignments");
        return;
      }

      toast.success(`Saved ${changes.length} assignment${changes.length !== 1 ? "s" : ""}`);
      setTeachingInitial(new Map(teachingDraft));
      setTeachingDialogOpen(false);
    } catch {
      toast.error("Failed to save teaching assignments");
    } finally {
      setTeachingSaving(false);
    }
  };

  // Fetch section subjects and teacher assignments
  const fetchSectionSubjects = async (sectionId: string) => {
    setLoadingTeachers(true);
    try {
      const response = await fetch(`/api/sections/${sectionId}/subjects`);
      const data = await response.json();
      if (response.ok) {
        setSectionInfo(data.section);
        setSubjectAssignments(data.subjectAssignments);
        setSelectedClassTeacherId(data.section.classTeacher?.id || "__none__");
      } else {
        toast.error("Failed to load section data");
      }
    } catch {
      toast.error("Failed to load section data");
    } finally {
      setLoadingTeachers(false);
    }
  };

  // Open teacher management dialog
  const openTeacherDialog = (section: Section, className: string, classId: string) => {
    setSelectedSectionForTeachers({ section, className, classId });
    fetchSectionSubjects(section.id);
    setTeacherDialogOpen(true);
  };

  // Save class teacher
  const handleSaveClassTeacher = async () => {
    if (!selectedSectionForTeachers) return;

    setSavingTeacher(true);
    try {
      if (selectedClassTeacherId && selectedClassTeacherId !== "__none__") {
        const response = await fetch(`/api/sections/${selectedSectionForTeachers.section.id}/class-teacher`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teacherId: selectedClassTeacherId }),
        });

        if (response.ok) {
          toast.success("Class teacher assigned successfully");
          fetchSectionSubjects(selectedSectionForTeachers.section.id);
        } else {
          const data = await response.json();
          toast.error(data.error || "Failed to assign class teacher");
        }
      } else {
        // Remove class teacher
        const response = await fetch(`/api/sections/${selectedSectionForTeachers.section.id}/class-teacher`, {
          method: "DELETE",
        });

        if (response.ok) {
          toast.success("Class teacher removed");
          fetchSectionSubjects(selectedSectionForTeachers.section.id);
        }
      }
    } catch {
      toast.error("Failed to update class teacher");
    } finally {
      setSavingTeacher(false);
    }
  };

  // Assign subject teacher
  const handleAssignSubjectTeacher = async (subjectId: string, teacherId: string) => {
    if (!selectedSectionForTeachers) return;

    setSavingTeacher(true);
    try {
      if (teacherId && teacherId !== "__none__") {
        const response = await fetch(`/api/sections/${selectedSectionForTeachers.section.id}/subjects`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subjectId, teacherId }),
        });

        if (response.ok) {
          toast.success("Subject teacher assigned");
          fetchSectionSubjects(selectedSectionForTeachers.section.id);
        } else {
          const data = await response.json();
          toast.error(data.error || "Failed to assign teacher");
        }
      } else {
        // Remove subject teacher
        const response = await fetch(
          `/api/sections/${selectedSectionForTeachers.section.id}/subjects?subjectId=${subjectId}`,
          { method: "DELETE" }
        );

        if (response.ok) {
          toast.success("Subject teacher removed");
          fetchSectionSubjects(selectedSectionForTeachers.section.id);
        }
      }
    } catch {
      toast.error("Failed to update subject teacher");
    } finally {
      setSavingTeacher(false);
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
      setActiveTab("single"); // Always open in single mode when editing
    } else {
      setEditingClass(null);
      setClassName("");
      // Reset bulk form
      setBulkFromGrade(1);
      setBulkToGrade(12);
      setBulkSectionsPerClass(3);
      setBulkNamingConvention("letters");
      setBulkCustomNames("");
    }
    setClassDialogOpen(true);
  };

  // Get section names based on naming convention
  const getBulkSectionNames = () => {
    if (bulkNamingConvention === "custom") {
      return bulkCustomNames
        .split(",")
        .map((n) => n.trim())
        .filter((n) => n)
        .slice(0, bulkSectionsPerClass);
    }
    return NAMING_PRESETS[bulkNamingConvention]?.slice(0, bulkSectionsPerClass) || [];
  };

  // Generate preview data for bulk creation
  const getBulkPreview = () => {
    const sectionNames = getBulkSectionNames();
    const preview = [];
    for (let grade = bulkFromGrade; grade <= bulkToGrade; grade++) {
      preview.push({
        name: `Grade ${grade}`,
        sections: sectionNames.join(", "),
      });
    }
    return preview;
  };

  // Handle bulk class creation
  const handleBulkCreate = async () => {
    // Validate
    if (bulkFromGrade > bulkToGrade) {
      toast.error("From grade must be less than or equal to To grade");
      return;
    }

    if (bulkNamingConvention === "custom") {
      const customNamesList = bulkCustomNames
        .split(",")
        .map((n) => n.trim())
        .filter((n) => n);
      if (customNamesList.length < bulkSectionsPerClass) {
        toast.error(
          `Please provide at least ${bulkSectionsPerClass} section names (comma-separated)`
        );
        return;
      }
    }

    setIsSaving(true);
    try {
      const customNamesList =
        bulkNamingConvention === "custom"
          ? bulkCustomNames
              .split(",")
              .map((n) => n.trim())
              .filter((n) => n)
          : null;

      const response = await fetch("/api/classes/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromGrade: bulkFromGrade,
          toGrade: bulkToGrade,
          sectionsPerClass: bulkSectionsPerClass,
          namingConvention: bulkNamingConvention,
          customNames: customNamesList,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.created.classes > 0) {
          toast.success(data.message);
        } else {
          toast.info(data.message);
        }
        setClassDialogOpen(false);
        fetchClasses();
      } else {
        toast.error(data.error || "Failed to create classes");
      }
    } catch {
      toast.error("Failed to create classes");
    } finally {
      setIsSaving(false);
    }
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

  const teachingChangesCount = Array.from(teachingDraft.entries()).filter(
    ([key, value]) => (teachingInitial.get(key) ?? null) !== value
  ).length;

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
                    <div className="flex items-center gap-2">
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label="Toggle sections">
                          {expandedClasses.has(cls.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <button
                        type="button"
                        className="text-lg font-semibold hover:underline underline-offset-4"
                        onClick={() => openClassDialog(cls)}
                      >
                        {cls.name}
                      </button>
                    </div>
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
                          <DropdownMenuItem onClick={() => openTeachingAssignmentsDialog(cls)}>
                            <LayoutGrid className="mr-2 h-4 w-4" />
                            Teaching Assignments
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
                                <span className="text-muted-foreground">{cls.name} - </span>
                                <button
                                  type="button"
                                  className="hover:underline underline-offset-4"
                                  onClick={() => openSectionDialog(cls.id, section)}
                                >
                                  {section.name}
                                </button>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {section._count.students} student{section._count.students !== 1 ? "s" : ""}
                                {section.capacity && ` / ${section.capacity} capacity`}
                              </div>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openTeacherDialog(section, cls.name, cls.id)}>
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

      {/* Class Dialog - with Tabs for Single/Bulk */}
      <Dialog open={classDialogOpen} onOpenChange={setClassDialogOpen}>
        <DialogContent className={editingClass ? "" : "sm:max-w-[600px]"}>
          <DialogHeader>
            <DialogTitle>{editingClass ? "Edit Class" : "Add Classes"}</DialogTitle>
            <DialogDescription>
              {editingClass
                ? "Update the class name"
                : "Create a single class or set up multiple classes at once"}
            </DialogDescription>
          </DialogHeader>

          {editingClass ? (
            // Simple edit mode - no tabs
            <>
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
                  {isSaving ? "Saving..." : "Update"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            // Create mode - with tabs
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="single">
                  <Plus className="mr-2 h-4 w-4" />
                  Single Class
                </TabsTrigger>
                <TabsTrigger value="bulk">
                  <Layers className="mr-2 h-4 w-4" />
                  Bulk Setup
                </TabsTrigger>
              </TabsList>

              {/* Single Class Tab */}
              <TabsContent value="single" className="mt-4">
                <div className="space-y-4">
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
                <DialogFooter className="mt-6">
                  <Button variant="outline" onClick={() => setClassDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveClass} disabled={isSaving}>
                    {isSaving ? "Creating..." : "Create"}
                  </Button>
                </DialogFooter>
              </TabsContent>

              {/* Bulk Setup Tab */}
              <TabsContent value="bulk" className="mt-4">
                <div className="space-y-4">
                  {/* Class Range */}
                  <div className="space-y-2">
                    <Label>Class Range</Label>
                    <div className="flex items-center gap-2">
                      <Select
                        value={bulkFromGrade.toString()}
                        onValueChange={(v) => setBulkFromGrade(parseInt(v))}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="From" />
                        </SelectTrigger>
                        <SelectContent>
                          {GRADE_OPTIONS.map((grade) => (
                            <SelectItem key={grade} value={grade.toString()}>
                              Grade {grade}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-muted-foreground">to</span>
                      <Select
                        value={bulkToGrade.toString()}
                        onValueChange={(v) => setBulkToGrade(parseInt(v))}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="To" />
                        </SelectTrigger>
                        <SelectContent>
                          {GRADE_OPTIONS.map((grade) => (
                            <SelectItem key={grade} value={grade.toString()}>
                              Grade {grade}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Sections per Class */}
                  <div className="space-y-2">
                    <Label>Sections per Class</Label>
                    <Select
                      value={bulkSectionsPerClass.toString()}
                      onValueChange={(v) => setBulkSectionsPerClass(parseInt(v))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                          <SelectItem key={n} value={n.toString()}>
                            {n} section{n > 1 ? "s" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Section Naming */}
                  <div className="space-y-2">
                    <Label>Section Naming</Label>
                    <Select
                      value={bulkNamingConvention}
                      onValueChange={setBulkNamingConvention}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select naming convention" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="letters">Letters (A, B, C...)</SelectItem>
                        <SelectItem value="colors">Colors (Blue, Green, Red...)</SelectItem>
                        <SelectItem value="numbers">Numbers (1, 2, 3...)</SelectItem>
                        <SelectItem value="roman">Roman (I, II, III...)</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                    {bulkNamingConvention === "custom" && (
                      <Input
                        placeholder="Enter names separated by commas (e.g., Morning, Afternoon, Evening)"
                        value={bulkCustomNames}
                        onChange={(e) => setBulkCustomNames(e.target.value)}
                        className="mt-2"
                      />
                    )}
                  </div>

                  {/* Preview */}
                  <div className="space-y-2">
                    <Label>Preview</Label>
                    <div className="rounded-md border">
                      <ScrollArea className="h-[200px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Class</TableHead>
                              <TableHead>Sections</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {getBulkPreview().map((item) => (
                              <TableRow key={item.name}>
                                <TableCell className="font-medium">{item.name}</TableCell>
                                <TableCell>{item.sections || "-"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <Badge variant="secondary" className="mr-2">
                        {bulkToGrade - bulkFromGrade + 1} classes
                      </Badge>
                      <Badge variant="secondary">
                        {(bulkToGrade - bulkFromGrade + 1) * bulkSectionsPerClass} sections
                      </Badge>
                    </div>
                  </div>
                </div>

                <DialogFooter className="mt-6">
                  <Button variant="outline" onClick={() => setClassDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleBulkCreate} disabled={isSaving}>
                    {isSaving ? "Creating..." : "Create All"}
                  </Button>
                </DialogFooter>
              </TabsContent>
            </Tabs>
          )}
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

      {/* Class-wide Teaching Assignments */}
      <Dialog
        open={teachingDialogOpen}
        onOpenChange={(open) => {
          setTeachingDialogOpen(open);
          if (!open) {
            setSelectedClassForTeaching(null);
          }
        }}
      >
        <DialogContent className="max-w-6xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Teaching Assignments</DialogTitle>
            <DialogDescription>
              {selectedClassForTeaching
                ? `Set subject teachers across sections for ${selectedClassForTeaching.name}.`
                : "Set subject teachers across sections."}
            </DialogDescription>
          </DialogHeader>

          {teachingLoading ? (
            <div className="py-10 text-center text-muted-foreground">Loading...</div>
          ) : teachingSections.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              This class has no sections. Add sections first.
            </div>
          ) : teachingSubjects.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              This class has no subjects. Add subjects first from the Subjects page.
            </div>
          ) : (
            <div className="space-y-3 py-4">
              <p className="text-sm text-muted-foreground">
                Tip: use the &quot;Set all sections&quot; column to quickly assign the same teacher to A/B/C,
                then override individual sections if needed.
              </p>

              <div className="rounded-md border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[220px]">Subject</TableHead>
                      <TableHead className="min-w-[240px]">Set all sections</TableHead>
                      {teachingSections.map((section) => (
                        <TableHead key={section.id} className="min-w-[220px]">
                          {section.name}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teachingSubjects.map((subject) => {
                      const values = teachingSections.map((section) => {
                        return teachingDraft.get(makeTeachingKey(section.id, subject.id)) ?? null;
                      });
                      const unique = new Set(values.map((v) => v ?? "__none__"));
                      const rowValue =
                        unique.size === 1 ? (values[0] ?? "__none__") : "__mixed__";

                      return (
                        <TableRow key={subject.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div
                                className="h-3 w-3 rounded-full"
                                style={{ backgroundColor: subject.color || "#6b7280" }}
                              />
                              <div>
                                <div className="font-medium">{subject.name}</div>
                                {subject.code && (
                                  <div className="text-xs text-muted-foreground">
                                    {subject.code}
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={rowValue}
                              onValueChange={(value) => {
                                if (value === "__mixed__") return;
                                setTeachingSubjectAll(
                                  subject.id,
                                  value === "__none__" ? null : value
                                );
                              }}
                              disabled={teachingSaving}
                            >
                              <SelectTrigger className="w-[220px]">
                                <SelectValue placeholder="Set all sections" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__mixed__" disabled>
                                  Mixed
                                </SelectItem>
                                <SelectItem value="__none__">Not assigned</SelectItem>
                                {teachingTeachers.map((t) => (
                                  <SelectItem key={t.id} value={t.id}>
                                    {t.firstName} {t.lastName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          {teachingSections.map((section) => {
                            const key = makeTeachingKey(section.id, subject.id);
                            const value = teachingDraft.get(key) ?? null;
                            const isChanged = (teachingInitial.get(key) ?? null) !== value;

                            return (
                              <TableCell key={section.id}>
                                <Select
                                  value={value ?? "__none__"}
                                  onValueChange={(v) =>
                                    setTeachingCell(
                                      section.id,
                                      subject.id,
                                      v === "__none__" ? null : v
                                    )
                                  }
                                  disabled={teachingSaving}
                                >
                                  <SelectTrigger className={isChanged ? "border-primary" : ""}>
                                    <SelectValue placeholder="Select teacher" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">Not assigned</SelectItem>
                                    {teachingTeachers.map((t) => (
                                      <SelectItem key={t.id} value={t.id}>
                                        {t.firstName} {t.lastName}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setTeachingDialogOpen(false)} disabled={teachingSaving}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveTeachingAssignments}
              disabled={teachingSaving || teachingLoading || teachingSubjects.length === 0 || teachingSections.length === 0 || teachingChangesCount === 0}
            >
              {teachingSaving ? "Saving..." : `Save Changes${teachingChangesCount > 0 ? ` (${teachingChangesCount})` : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Teacher Management Dialog */}
      <Dialog open={teacherDialogOpen} onOpenChange={setTeacherDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Teachers</DialogTitle>
            <DialogDescription>
              {selectedSectionForTeachers &&
                `Assign teachers to ${selectedSectionForTeachers.className} - ${selectedSectionForTeachers.section.name}`}
            </DialogDescription>
          </DialogHeader>

          {loadingTeachers ? (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          ) : (
            <div className="space-y-6 py-4">
              {/* Class Teacher */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Crown className="h-4 w-4 text-amber-500" />
                  <Label className="font-semibold">Class Teacher</Label>
                </div>
                <div className="flex gap-2">
                  <Select
                    value={selectedClassTeacherId}
                    onValueChange={setSelectedClassTeacherId}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select class teacher" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No class teacher</SelectItem>
                      {allTeachers.map((teacher) => (
                        <SelectItem key={teacher.teacherProfileId} value={teacher.teacherProfileId}>
                          {teacher.firstName} {teacher.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleSaveClassTeacher}
                    disabled={savingTeacher}
                    variant={sectionInfo?.classTeacher?.id === selectedClassTeacherId ? "outline" : "default"}
                  >
                    {savingTeacher ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>

              {/* Subject Teachers */}
              <div className="space-y-3">
                <Label className="font-semibold">Subject Teachers</Label>
                {subjectAssignments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No subjects in this class. Add subjects first from the Subjects page.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {subjectAssignments.map((assignment) => (
                      <div
                        key={assignment.subjectId}
                        className="flex items-center gap-3 rounded-lg border p-3"
                      >
                        <div
                          className="h-8 w-8 rounded flex items-center justify-center text-white text-xs font-medium"
                          style={{ backgroundColor: assignment.subjectColor || "#6366f1" }}
                        >
                          {assignment.subjectName.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{assignment.subjectName}</div>
                          {assignment.subjectCode && (
                            <div className="text-xs text-muted-foreground">{assignment.subjectCode}</div>
                          )}
                        </div>
                        <Select
                          value={assignment.assignedTeacher?.id || "__none__"}
                          onValueChange={(value) => handleAssignSubjectTeacher(assignment.subjectId, value)}
                          disabled={savingTeacher}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Select teacher" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Not assigned</SelectItem>
                            {assignment.availableTeachers.map((teacher) => (
                              <SelectItem key={teacher.id} value={teacher.id}>
                                {teacher.firstName} {teacher.lastName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                )}
                {subjectAssignments.length > 0 && subjectAssignments.some(a => a.availableTeachers.length === 0) && (
                  <p className="text-xs text-muted-foreground">
                    Note: Some subjects have no teachers assigned. Go to Subjects page to assign teachers to subjects first.
                  </p>
                )}
              </div>
            </div>
          )}

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

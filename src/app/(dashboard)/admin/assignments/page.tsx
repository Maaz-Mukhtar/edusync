"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Save,
  X,
  AlertTriangle,
  Loader2,
  UserPlus,
  Grid3X3,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Teacher {
  id: string;
  firstName: string;
  lastName: string;
}

interface Section {
  id: string;
  name: string;
}

interface Subject {
  id: string;
  name: string;
  code: string | null;
  color: string | null;
  availableTeachers: Teacher[];
  sectionTeachers: Record<string, Teacher | null>;
}

interface ClassData {
  id: string;
  name: string;
}

interface AssignmentData {
  class: ClassData;
  sections: Section[];
  subjects: Subject[];
  allTeachers: Teacher[];
}

interface PendingChange {
  subjectId: string;
  sectionId: string;
  oldTeacherId: string | null;
  newTeacherId: string | null;
}

interface PendingTeacherAdd {
  subjectId: string;
  teacherId: string;
}

export default function AssignmentsPage() {
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [assignmentData, setAssignmentData] = useState<AssignmentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMatrix, setIsLoadingMatrix] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Track changes
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [pendingTeacherAdds, setPendingTeacherAdds] = useState<PendingTeacherAdd[]>([]);
  const [localAssignments, setLocalAssignments] = useState<Record<string, Record<string, string | null>>>({});

  // Dialogs
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showAddTeacherDialog, setShowAddTeacherDialog] = useState(false);
  const [selectedSubjectForAdd, setSelectedSubjectForAdd] = useState<Subject | null>(null);
  const [selectedTeacherToAdd, setSelectedTeacherToAdd] = useState<string>("");

  const hasChanges = pendingChanges.length > 0 || pendingTeacherAdds.length > 0;

  // Fetch classes
  const fetchClasses = useCallback(async () => {
    try {
      const response = await fetch("/api/classes");
      const data = await response.json();
      if (response.ok) {
        setClasses(data.classes);
        if (data.classes.length > 0 && !selectedClassId) {
          setSelectedClassId(data.classes[0].id);
        }
      }
    } catch {
      toast.error("Failed to fetch classes");
    } finally {
      setIsLoading(false);
    }
  }, [selectedClassId]);

  // Fetch assignment matrix for selected class
  const fetchAssignments = useCallback(async (classId: string) => {
    setIsLoadingMatrix(true);
    try {
      const response = await fetch(`/api/assignments?classId=${classId}`);
      const data = await response.json();
      if (response.ok) {
        setAssignmentData(data);
        // Initialize local assignments from fetched data
        const initial: Record<string, Record<string, string | null>> = {};
        for (const subject of data.subjects) {
          initial[subject.id] = {};
          for (const sectionId of Object.keys(subject.sectionTeachers)) {
            initial[subject.id][sectionId] = subject.sectionTeachers[sectionId]?.id || null;
          }
        }
        setLocalAssignments(initial);
        setPendingChanges([]);
        setPendingTeacherAdds([]);
      } else {
        toast.error(data.error || "Failed to fetch assignments");
      }
    } catch {
      toast.error("Failed to fetch assignments");
    } finally {
      setIsLoadingMatrix(false);
    }
  }, []);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  useEffect(() => {
    if (selectedClassId) {
      fetchAssignments(selectedClassId);
    }
  }, [selectedClassId, fetchAssignments]);

  // Handle teacher selection change
  const handleTeacherChange = (subjectId: string, sectionId: string, teacherId: string | null) => {
    const subject = assignmentData?.subjects.find((s) => s.id === subjectId);
    if (!subject) return;

    const oldTeacherId = subject.sectionTeachers[sectionId]?.id || null;
    const newTeacherId = teacherId === "__none__" ? null : teacherId;

    // Update local state
    setLocalAssignments((prev) => ({
      ...prev,
      [subjectId]: {
        ...prev[subjectId],
        [sectionId]: newTeacherId,
      },
    }));

    // Track the change
    setPendingChanges((prev) => {
      // Remove any existing change for this subject-section
      const filtered = prev.filter(
        (c) => !(c.subjectId === subjectId && c.sectionId === sectionId)
      );

      // Only add if different from original
      if (newTeacherId !== oldTeacherId) {
        return [...filtered, { subjectId, sectionId, oldTeacherId, newTeacherId }];
      }
      return filtered;
    });
  };

  // Open add teacher dialog
  const openAddTeacherDialog = (subject: Subject) => {
    setSelectedSubjectForAdd(subject);
    setSelectedTeacherToAdd("");
    setShowAddTeacherDialog(true);
  };

  // Handle adding a teacher to a subject
  const handleAddTeacherToSubject = () => {
    if (!selectedSubjectForAdd || !selectedTeacherToAdd) return;

    // Add to pending teacher adds
    setPendingTeacherAdds((prev) => {
      const exists = prev.some(
        (p) => p.subjectId === selectedSubjectForAdd.id && p.teacherId === selectedTeacherToAdd
      );
      if (exists) return prev;
      return [...prev, { subjectId: selectedSubjectForAdd.id, teacherId: selectedTeacherToAdd }];
    });

    // Update assignment data locally to show the new teacher
    if (assignmentData) {
      const teacher = assignmentData.allTeachers.find((t) => t.id === selectedTeacherToAdd);
      if (teacher) {
        setAssignmentData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            subjects: prev.subjects.map((s) => {
              if (s.id === selectedSubjectForAdd.id) {
                return {
                  ...s,
                  availableTeachers: [...s.availableTeachers, teacher],
                };
              }
              return s;
            }),
          };
        });
      }
    }

    setShowAddTeacherDialog(false);
    toast.success("Teacher added to subject (save to confirm)");
  };

  // Get removals that affect sections
  const getRemovalsWithSectionImpact = () => {
    return pendingChanges.filter((c) => c.oldTeacherId && !c.newTeacherId);
  };

  // Save all changes
  const handleSave = async () => {
    if (!assignmentData) return;

    setIsSaving(true);
    try {
      const response = await fetch("/api/assignments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: assignmentData.class.id,
          assignments: pendingChanges.map((c) => ({
            subjectId: c.subjectId,
            sectionId: c.sectionId,
            teacherId: c.newTeacherId,
          })),
          addTeachersToSubjects: pendingTeacherAdds,
        }),
      });

      if (response.ok) {
        toast.success("Assignments saved successfully");
        setShowSaveDialog(false);
        // Refresh data
        fetchAssignments(assignmentData.class.id);
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to save assignments");
      }
    } catch {
      toast.error("Failed to save assignments");
    } finally {
      setIsSaving(false);
    }
  };

  // Cancel changes
  const handleCancel = () => {
    if (assignmentData) {
      fetchAssignments(assignmentData.class.id);
    }
  };

  // Prompt save with warning if there are removals
  const promptSave = () => {
    const removals = getRemovalsWithSectionImpact();
    if (removals.length > 0) {
      setShowSaveDialog(true);
    } else {
      handleSave();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Grid3X3 className="h-6 w-6" />
            Teacher Assignments
          </h1>
          <p className="text-muted-foreground">
            Assign teachers to subjects across all sections
          </p>
        </div>
        {hasChanges && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-amber-600 border-amber-600">
              {pendingChanges.length + pendingTeacherAdds.length} unsaved changes
            </Badge>
            <Button variant="outline" onClick={handleCancel}>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button onClick={promptSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Changes
            </Button>
          </div>
        )}
      </div>

      {/* Class Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Select Class</CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={selectedClassId}
            onValueChange={(value) => {
              if (hasChanges) {
                if (confirm("You have unsaved changes. Discard them?")) {
                  setSelectedClassId(value);
                }
              } else {
                setSelectedClassId(value);
              }
            }}
          >
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Select a class" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((cls) => (
                <SelectItem key={cls.id} value={cls.id}>
                  {cls.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Assignment Matrix */}
      {isLoadingMatrix ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : assignmentData ? (
        <Card>
          <CardHeader>
            <CardTitle>{assignmentData.class.name} - Assignment Matrix</CardTitle>
            <CardDescription>
              Select a teacher for each subject in each section. Add teachers to subjects first if needed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {assignmentData.subjects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="mx-auto h-12 w-12 mb-4" />
                <p>No subjects found for this class.</p>
                <p className="text-sm">Add subjects from the Subjects page first.</p>
              </div>
            ) : assignmentData.sections.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="mx-auto h-12 w-12 mb-4" />
                <p>No sections found for this class.</p>
                <p className="text-sm">Add sections from the Classes page first.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left p-3 border-b font-medium bg-muted/50">
                        Subject
                      </th>
                      {assignmentData.sections.map((section) => (
                        <th
                          key={section.id}
                          className="text-center p-3 border-b font-medium bg-muted/50 min-w-[180px]"
                        >
                          {section.name}
                        </th>
                      ))}
                      <th className="text-center p-3 border-b font-medium bg-muted/50 w-[100px]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignmentData.subjects.map((subject) => {
                      const availableTeacherIds = new Set([
                        ...subject.availableTeachers.map((t) => t.id),
                        ...pendingTeacherAdds
                          .filter((p) => p.subjectId === subject.id)
                          .map((p) => p.teacherId),
                      ]);

                      const availableTeachersForSubject = assignmentData.allTeachers.filter(
                        (t) => availableTeacherIds.has(t.id)
                      );

                      return (
                        <tr key={subject.id} className="border-b hover:bg-muted/30">
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div
                                className="h-6 w-6 rounded flex items-center justify-center text-white text-xs font-medium"
                                style={{ backgroundColor: subject.color || "#6366f1" }}
                              >
                                {subject.name.substring(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-medium">{subject.name}</div>
                                {subject.code && (
                                  <div className="text-xs text-muted-foreground">
                                    {subject.code}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          {assignmentData.sections.map((section) => {
                            const currentTeacherId =
                              localAssignments[subject.id]?.[section.id] || null;
                            const hasChange = pendingChanges.some(
                              (c) =>
                                c.subjectId === subject.id && c.sectionId === section.id
                            );

                            return (
                              <td key={section.id} className="p-3">
                                <Select
                                  value={currentTeacherId || "__none__"}
                                  onValueChange={(value) =>
                                    handleTeacherChange(subject.id, section.id, value)
                                  }
                                >
                                  <SelectTrigger
                                    className={`w-full ${
                                      hasChange ? "border-amber-500 ring-1 ring-amber-500" : ""
                                    }`}
                                  >
                                    <SelectValue placeholder="Not assigned" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">Not assigned</SelectItem>
                                    {availableTeachersForSubject.map((teacher) => (
                                      <SelectItem key={teacher.id} value={teacher.id}>
                                        {teacher.firstName} {teacher.lastName}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </td>
                            );
                          })}
                          <td className="p-3 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openAddTeacherDialog(subject)}
                              title="Add teacher to this subject"
                            >
                              <UserPlus className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Add Teacher to Subject Dialog */}
      <Dialog open={showAddTeacherDialog} onOpenChange={setShowAddTeacherDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Teacher to Subject</DialogTitle>
            <DialogDescription>
              Add a teacher who can teach {selectedSubjectForAdd?.name}. They will then be
              available for assignment to sections.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Teacher</Label>
              <Select value={selectedTeacherToAdd} onValueChange={setSelectedTeacherToAdd}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a teacher" />
                </SelectTrigger>
                <SelectContent>
                  {assignmentData?.allTeachers
                    .filter(
                      (t) =>
                        !selectedSubjectForAdd?.availableTeachers.some((at) => at.id === t.id) &&
                        !pendingTeacherAdds.some(
                          (p) => p.subjectId === selectedSubjectForAdd?.id && p.teacherId === t.id
                        )
                    )
                    .map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.id}>
                        {teacher.firstName} {teacher.lastName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTeacherDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddTeacherToSubject} disabled={!selectedTeacherToAdd}>
              Add Teacher
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Confirmation Dialog (with removal warning) */}
      <AlertDialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirm Changes
            </AlertDialogTitle>
            <AlertDialogDescription>
              <p className="mb-4">
                You are about to remove {getRemovalsWithSectionImpact().length} teacher
                assignment(s) from sections. This means those sections will have no teacher
                for those subjects.
              </p>
              <div className="bg-muted p-3 rounded-md text-sm space-y-1">
                {getRemovalsWithSectionImpact().map((removal, idx) => {
                  const subject = assignmentData?.subjects.find(
                    (s) => s.id === removal.subjectId
                  );
                  const section = assignmentData?.sections.find(
                    (s) => s.id === removal.sectionId
                  );
                  const teacher = subject?.sectionTeachers[removal.sectionId];
                  return (
                    <div key={idx}>
                      • {subject?.name} in {section?.name}: removing{" "}
                      {teacher?.firstName} {teacher?.lastName}
                    </div>
                  );
                })}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

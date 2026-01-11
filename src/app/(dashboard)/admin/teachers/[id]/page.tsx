"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  BookOpen,
  GraduationCap,
  Users,
  UserCog,
  Pencil,
  Plus,
  X,
  Loader2,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";
import { getInitials } from "@/lib/utils";

interface Teacher {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string;
  lastName: string;
  avatar: string | null;
  isActive: boolean;
  createdAt: string;
  teacherProfile: {
    id: string;
    employeeId: string | null;
    qualification: string | null;
    classTeacherOf: Array<{
      id: string;
      section: {
        id: string;
        name: string;
        class: { id: string; name: string };
      };
    }>;
    sectionSubjects: Array<{
      id: string;
      section: {
        id: string;
        name: string;
        class: { id: string; name: string };
      };
      subject: {
        id: string;
        name: string;
        color: string | null;
      };
    }>;
    subjectsTaught: Array<{
      id: string;
      subject: {
        id: string;
        name: string;
        color: string | null;
        class: { id: string; name: string };
      };
    }>;
  };
}

interface ClassData {
  id: string;
  name: string;
  sections: Array<{
    id: string;
    name: string;
  }>;
  subjects: Array<{
    id: string;
    name: string;
    color: string | null;
  }>;
}

export default function TeacherDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Dialog states
  const [showSubjectDialog, setShowSubjectDialog] = useState(false);
  const [showClassTeacherDialog, setShowClassTeacherDialog] = useState(false);
  const [showSectionSubjectDialog, setShowSectionSubjectDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");

  const fetchTeacher = async () => {
    try {
      const response = await fetch(`/api/users/${id}`);
      const data = await response.json();

      if (response.ok && data.user.role === "TEACHER") {
        setTeacher(data.user);
      } else {
        toast.error("Teacher not found");
        router.push("/admin/teachers");
      }
    } catch {
      toast.error("Failed to fetch teacher");
      router.push("/admin/teachers");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchClasses = async () => {
    try {
      const response = await fetch("/api/classes");
      const data = await response.json();

      if (response.ok) {
        const classesWithSubjects = await Promise.all(
          data.classes.map(async (cls: { id: string; name: string; sections: Array<{ id: string; name: string }> }) => {
            const subjectsRes = await fetch(`/api/classes/${cls.id}/subjects`);
            const subjectsData = await subjectsRes.json();
            return {
              ...cls,
              subjects: subjectsData.subjects || [],
            };
          })
        );
        setClasses(classesWithSubjects);
      }
    } catch {
      console.error("Failed to fetch classes");
    }
  };

  useEffect(() => {
    fetchTeacher();
    fetchClasses();
  }, [id]);

  const handleToggleActive = async () => {
    if (!teacher) return;

    try {
      const response = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !teacher.isActive }),
      });

      if (response.ok) {
        toast.success(`Teacher ${teacher.isActive ? "deactivated" : "activated"} successfully`);
        fetchTeacher();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to update teacher");
      }
    } catch {
      toast.error("Failed to update teacher");
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/users/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Teacher deleted successfully");
        router.push("/admin/teachers");
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to delete teacher");
      }
    } catch {
      toast.error("Failed to delete teacher");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  // Add subject expertise (TeacherSubject)
  const handleAddSubject = async () => {
    if (!selectedClassId || !selectedSubjectId || !teacher?.teacherProfile) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/classes/${selectedClassId}/subjects/${selectedSubjectId}/teachers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherIds: [teacher.teacherProfile.id] }),
      });

      if (response.ok) {
        toast.success("Subject added successfully");
        fetchTeacher();
        setShowSubjectDialog(false);
        setSelectedClassId("");
        setSelectedSubjectId("");
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to add subject");
      }
    } catch {
      toast.error("Failed to add subject");
    } finally {
      setIsSaving(false);
    }
  };

  // Remove subject expertise
  const handleRemoveSubject = async (classId: string, subjectId: string) => {
    if (!teacher?.teacherProfile) return;

    try {
      const getRes = await fetch(`/api/classes/${classId}/subjects/${subjectId}/teachers`);
      const getData = await getRes.json();

      const updatedTeacherIds = getData.teachers
        .filter((t: { id: string }) => t.id !== teacher.teacherProfile!.id)
        .map((t: { id: string }) => t.id);

      const response = await fetch(`/api/classes/${classId}/subjects/${subjectId}/teachers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherIds: updatedTeacherIds }),
      });

      if (response.ok) {
        toast.success("Subject removed successfully");
        fetchTeacher();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to remove subject");
      }
    } catch {
      toast.error("Failed to remove subject");
    }
  };

  // Add class teacher assignment
  const handleAddClassTeacher = async () => {
    if (!selectedSectionId || !teacher?.teacherProfile) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/sections/${selectedSectionId}/class-teacher`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId: teacher.teacherProfile.id }),
      });

      if (response.ok) {
        toast.success("Class teacher assigned successfully");
        fetchTeacher();
        setShowClassTeacherDialog(false);
        setSelectedClassId("");
        setSelectedSectionId("");
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to assign class teacher");
      }
    } catch {
      toast.error("Failed to assign class teacher");
    } finally {
      setIsSaving(false);
    }
  };

  // Remove class teacher assignment
  const handleRemoveClassTeacher = async (sectionId: string) => {
    try {
      const response = await fetch(`/api/sections/${sectionId}/class-teacher`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Class teacher removed successfully");
        fetchTeacher();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to remove class teacher");
      }
    } catch {
      toast.error("Failed to remove class teacher");
    }
  };

  // Add section-subject assignment
  const handleAddSectionSubject = async () => {
    if (!selectedSectionId || !selectedSubjectId || !teacher?.teacherProfile) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/sections/${selectedSectionId}/subjects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId: selectedSubjectId,
          teacherId: teacher.teacherProfile.id,
        }),
      });

      if (response.ok) {
        toast.success("Section subject assigned successfully");
        fetchTeacher();
        setShowSectionSubjectDialog(false);
        setSelectedClassId("");
        setSelectedSectionId("");
        setSelectedSubjectId("");
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to assign section subject");
      }
    } catch {
      toast.error("Failed to assign section subject");
    } finally {
      setIsSaving(false);
    }
  };

  // Remove section-subject assignment
  const handleRemoveSectionSubject = async (sectionId: string, subjectId: string) => {
    try {
      const response = await fetch(`/api/sections/${sectionId}/subjects`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId }),
      });

      if (response.ok) {
        toast.success("Section subject removed successfully");
        fetchTeacher();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to remove section subject");
      }
    } catch {
      toast.error("Failed to remove section subject");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!teacher) {
    return null;
  }

  const selectedClass = classes.find((c) => c.id === selectedClassId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/admin/teachers")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <UserCog className="h-6 w-6" />
            Teacher Details
          </h1>
          <p className="text-muted-foreground">View and manage teacher information and assignments</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleToggleActive}>
            {teacher.isActive ? (
              <>
                <UserX className="mr-2 h-4 w-4" />
                Deactivate
              </>
            ) : (
              <>
                <UserCheck className="mr-2 h-4 w-4" />
                Activate
              </>
            )}
          </Button>
          <Link href={`/admin/teachers/${id}/edit`}>
            <Button variant="outline">
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </Link>
          <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Teacher Profile Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-6">
            <Avatar className="h-20 w-20">
              <AvatarImage src={teacher.avatar || undefined} />
              <AvatarFallback className="text-xl">
                {getInitials(`${teacher.firstName} ${teacher.lastName}`)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold">
                  {teacher.firstName} {teacher.lastName}
                </h2>
                <Badge className="bg-green-100 text-green-800">TEACHER</Badge>
                <Badge variant={teacher.isActive ? "default" : "secondary"}>
                  {teacher.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {teacher.email && (
                  <div className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    {teacher.email}
                  </div>
                )}
                {teacher.phone && (
                  <div className="flex items-center gap-1">
                    <Phone className="h-4 w-4" />
                    {teacher.phone}
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Joined {new Date(teacher.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                {teacher.teacherProfile.employeeId && (
                  <div>
                    <span className="text-muted-foreground">Employee ID: </span>
                    <span className="font-medium">{teacher.teacherProfile.employeeId}</span>
                  </div>
                )}
                {teacher.teacherProfile.qualification && (
                  <div>
                    <span className="text-muted-foreground">Qualification: </span>
                    <span className="font-medium">{teacher.teacherProfile.qualification}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assignment Tabs */}
      <Tabs defaultValue="subjects" className="space-y-4">
        <TabsList>
          <TabsTrigger value="subjects">Subject Expertise</TabsTrigger>
          <TabsTrigger value="class-teacher">Class Teacher</TabsTrigger>
          <TabsTrigger value="section-subjects">Section Subjects</TabsTrigger>
        </TabsList>

        {/* Subject Expertise */}
        <TabsContent value="subjects">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Subject Expertise
                </CardTitle>
                <CardDescription>
                  Subjects this teacher is qualified to teach (class-level assignment)
                </CardDescription>
              </div>
              <Button onClick={() => setShowSubjectDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Subject
              </Button>
            </CardHeader>
            <CardContent>
              {teacher.teacherProfile.subjectsTaught.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No subjects assigned yet. Click &quot;Add Subject&quot; to assign subjects.
                </p>
              ) : (
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {teacher.teacherProfile.subjectsTaught.map((ts) => (
                    <div
                      key={ts.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: ts.subject.color || "#6b7280" }}
                        />
                        <div>
                          <div className="font-medium">{ts.subject.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {ts.subject.class.name}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveSubject(ts.subject.class.id, ts.subject.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Class Teacher Assignments */}
        <TabsContent value="class-teacher">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  Class Teacher Assignments
                </CardTitle>
                <CardDescription>
                  Sections where this teacher is assigned as class teacher
                </CardDescription>
              </div>
              <Button onClick={() => setShowClassTeacherDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Assign as Class Teacher
              </Button>
            </CardHeader>
            <CardContent>
              {teacher.teacherProfile.classTeacherOf.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Not assigned as class teacher to any section.
                </p>
              ) : (
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {teacher.teacherProfile.classTeacherOf.map((ct) => (
                    <div
                      key={ct.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <div className="font-medium">
                          {ct.section.class.name} - {ct.section.name}
                        </div>
                        <div className="text-sm text-muted-foreground">Class Teacher</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveClassTeacher(ct.section.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Section Subject Assignments */}
        <TabsContent value="section-subjects">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Section Subject Assignments
                </CardTitle>
                <CardDescription>
                  Specific sections and subjects this teacher teaches
                </CardDescription>
              </div>
              <Button onClick={() => setShowSectionSubjectDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Assign Section Subject
              </Button>
            </CardHeader>
            <CardContent>
              {teacher.teacherProfile.sectionSubjects.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No section-subject assignments. Click &quot;Assign Section Subject&quot; to add.
                </p>
              ) : (
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {teacher.teacherProfile.sectionSubjects.map((ss) => (
                    <div
                      key={ss.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: ss.subject.color || "#6b7280" }}
                        />
                        <div>
                          <div className="font-medium">{ss.subject.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {ss.section.class.name} - {ss.section.name}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveSectionSubject(ss.section.id, ss.subject.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Subject Dialog */}
      <Dialog open={showSubjectDialog} onOpenChange={setShowSubjectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Subject Expertise</DialogTitle>
            <DialogDescription>
              Select a class and subject to add to this teacher&apos;s expertise.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Class</Label>
              <Select
                value={selectedClassId}
                onValueChange={(value) => {
                  setSelectedClassId(value);
                  setSelectedSubjectId("");
                }}
              >
                <SelectTrigger>
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
            </div>
            {selectedClass && (
              <div className="space-y-2">
                <Label>Subject</Label>
                <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedClass.subjects
                      .filter(
                        (s) =>
                          !teacher?.teacherProfile?.subjectsTaught.some(
                            (ts) => ts.subject.id === s.id
                          )
                      )
                      .map((subject) => (
                        <SelectItem key={subject.id} value={subject.id}>
                          {subject.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubjectDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddSubject}
              disabled={!selectedClassId || !selectedSubjectId || isSaving}
            >
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Add Subject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Class Teacher Dialog */}
      <Dialog open={showClassTeacherDialog} onOpenChange={setShowClassTeacherDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign as Class Teacher</DialogTitle>
            <DialogDescription>
              Select a section to assign this teacher as the class teacher.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Class</Label>
              <Select
                value={selectedClassId}
                onValueChange={(value) => {
                  setSelectedClassId(value);
                  setSelectedSectionId("");
                }}
              >
                <SelectTrigger>
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
            </div>
            {selectedClass && (
              <div className="space-y-2">
                <Label>Section</Label>
                <Select value={selectedSectionId} onValueChange={setSelectedSectionId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a section" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedClass.sections
                      .filter(
                        (s) =>
                          !teacher?.teacherProfile?.classTeacherOf.some(
                            (ct) => ct.section.id === s.id
                          )
                      )
                      .map((section) => (
                        <SelectItem key={section.id} value={section.id}>
                          {section.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClassTeacherDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddClassTeacher}
              disabled={!selectedSectionId || isSaving}
            >
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Section Subject Dialog */}
      <Dialog open={showSectionSubjectDialog} onOpenChange={setShowSectionSubjectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Section Subject</DialogTitle>
            <DialogDescription>
              Select a section and subject for this teacher to teach.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Class</Label>
              <Select
                value={selectedClassId}
                onValueChange={(value) => {
                  setSelectedClassId(value);
                  setSelectedSectionId("");
                  setSelectedSubjectId("");
                }}
              >
                <SelectTrigger>
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
            </div>
            {selectedClass && (
              <>
                <div className="space-y-2">
                  <Label>Section</Label>
                  <Select
                    value={selectedSectionId}
                    onValueChange={(value) => {
                      setSelectedSectionId(value);
                      setSelectedSubjectId("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a section" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedClass.sections.map((section) => (
                        <SelectItem key={section.id} value={section.id}>
                          {section.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedSectionId && (
                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedClass.subjects
                          .filter(
                            (s) =>
                              !teacher?.teacherProfile?.sectionSubjects.some(
                                (ss) =>
                                  ss.section.id === selectedSectionId && ss.subject.id === s.id
                              )
                          )
                          .map((subject) => (
                            <SelectItem key={subject.id} value={subject.id}>
                              {subject.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSectionSubjectDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddSectionSubject}
              disabled={!selectedSectionId || !selectedSubjectId || isSaving}
            >
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the teacher
              account for {teacher.firstName} {teacher.lastName} and all associated data.
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

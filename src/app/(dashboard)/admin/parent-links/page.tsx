"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Trash2,
  Users,
  Link2,
  Search,
  UserCheck,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Parent {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string;
  lastName: string;
  parentProfile: {
    id: string;
    occupation: string | null;
    relationship: string | null;
    children: {
      id: string;
      student: {
        id: string;
        user: {
          firstName: string;
          lastName: string;
        };
        section: {
          name: string;
          class: {
            name: string;
          };
        };
      };
    }[];
  } | null;
}

interface Student {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string;
  lastName: string;
  studentProfile: {
    id: string;
    rollNumber: string | null;
    section: {
      name: string;
      class: {
        name: string;
      };
    };
    parents: {
      id: string;
      parent: {
        id: string;
        user: {
          firstName: string;
          lastName: string;
        };
      };
    }[];
  } | null;
}

interface ParentStudentLink {
  id: string;
  parentId: string;
  studentId: string;
  parent: {
    id: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      phone: string | null;
    };
  };
  student: {
    id: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
    section: {
      name: string;
      class: {
        name: string;
      };
    };
  };
}

export default function ParentLinksPage() {
  const [links, setLinks] = useState<ParentStudentLink[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Form states
  const [deletingLink, setDeletingLink] = useState<ParentStudentLink | null>(null);
  const [selectedParent, setSelectedParent] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");

  // Search/filter states
  const [searchTerm, setSearchTerm] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [linksRes, parentsRes, studentsRes] = await Promise.all([
        fetch("/api/parent-students"),
        fetch("/api/parents?limit=1000&sortBy=name&sortOrder=asc"),
        fetch("/api/students?limit=1000&sortBy=name&sortOrder=asc"),
      ]);

      const [linksData, parentsData, studentsData] = await Promise.all([
        linksRes.json(),
        parentsRes.json(),
        studentsRes.json(),
      ]);

      if (linksRes.ok) setLinks(Array.isArray(linksData.links) ? linksData.links : []);
      if (parentsRes.ok) setParents(Array.isArray(parentsData.parents) ? parentsData.parents : []);
      if (studentsRes.ok) setStudents(Array.isArray(studentsData.students) ? studentsData.students : []);
    } catch {
      toast.error("Failed to fetch data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openDialog = () => {
    setSelectedParent("");
    setSelectedStudent("");
    setDialogOpen(true);
  };

  const openDeleteDialog = (link: ParentStudentLink) => {
    setDeletingLink(link);
    setDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedParent || !selectedStudent) {
      toast.error("Please select both a parent and a student");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/parent-students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentId: selectedParent,
          studentId: selectedStudent,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Parent linked to student successfully");
        setDialogOpen(false);
        fetchData();
      } else {
        toast.error(data.error || "Failed to create link");
      }
    } catch {
      toast.error("Failed to create link");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingLink) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/parent-students/${deletingLink.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Link removed successfully");
        setDeleteDialogOpen(false);
        setDeletingLink(null);
        fetchData();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to remove link");
      }
    } catch {
      toast.error("Failed to remove link");
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter links based on search
  const filteredLinks = links.filter((link) => {
    const searchLower = searchTerm.toLowerCase();
    const parentName = `${link.parent?.user?.firstName ?? ""} ${link.parent?.user?.lastName ?? ""}`.toLowerCase();
    const studentName = `${link.student?.user?.firstName ?? ""} ${link.student?.user?.lastName ?? ""}`.toLowerCase();
    const className = `${link.student?.section?.class?.name ?? ""} ${link.student?.section?.name ?? ""}`.toLowerCase();

    return (
      parentName.includes(searchLower) ||
      studentName.includes(searchLower) ||
      className.includes(searchLower)
    );
  });

  // Get students that are not yet linked to the selected parent
  const availableStudentsForParent = students.filter((student) => {
    if (!selectedParent) return true;
    return !student.studentProfile?.parents?.some((p) => p.parent.id === selectedParent);
  });

  const parentsWithProfiles = parents.filter((p) => !!p.parentProfile);
  const studentsWithProfiles = availableStudentsForParent.filter((s) => !!s.studentProfile);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Parent-Student Links</h1>
          <p className="text-muted-foreground">
            Manage relationships between parents and their children
          </p>
        </div>
        <Button onClick={openDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Link Parent to Student
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Links</CardTitle>
            <Link2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{links.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Parents</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{parents.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{students.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by parent, student, or class..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Links List */}
      {filteredLinks.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">
              {searchTerm ? "No matches found" : "No links yet"}
            </h3>
            <p className="text-muted-foreground">
              {searchTerm
                ? "Try a different search term"
                : "Get started by linking a parent to their child"}
            </p>
            {!searchTerm && (
              <Button className="mt-4" onClick={openDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Link Parent to Student
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredLinks.map((link) => (
            <Card key={link.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    {/* Parent Info */}
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <UserCheck className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {link.parent?.user?.firstName ?? "Unknown"}{" "}
                          {link.parent?.user?.lastName ?? "Parent"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {link.parent?.user?.email ?? ""}
                        </p>
                      </div>
                    </div>

                    {/* Link Icon */}
                    <div className="hidden md:flex items-center text-muted-foreground">
                      <Link2 className="h-4 w-4" />
                    </div>

                    {/* Student Info */}
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                        <GraduationCap className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {link.student?.user?.firstName ?? "Unknown"}{" "}
                          {link.student?.user?.lastName ?? "Student"}
                        </p>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">
                            {link.student?.section?.class?.name ?? "Class"} -{" "}
                            {link.student?.section?.name ?? "Section"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => openDeleteDialog(link)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Link Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Parent to Student</DialogTitle>
            <DialogDescription>
              Create a relationship between a parent and their child
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Parent *</Label>
              <Select value={selectedParent} onValueChange={setSelectedParent}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a parent" />
                </SelectTrigger>
                <SelectContent>
                  {parentsWithProfiles.map((parent) => (
                    <SelectItem key={parent.parentProfile!.id} value={parent.parentProfile!.id}>
                      {parent.firstName} {parent.lastName}
                      {parent.email ? ` (${parent.email})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {parents.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No parents found. Create parent users first.
                </p>
              )}
              {parents.length > 0 && parentsWithProfiles.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No valid parents found (missing parent profiles). Create parent users again or check your data.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Select Student *</Label>
              <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a student" />
                </SelectTrigger>
                <SelectContent>
                  {studentsWithProfiles.map((student) => (
                    <SelectItem key={student.studentProfile!.id} value={student.studentProfile!.id}>
                      {student.firstName} {student.lastName} (
                      {student.studentProfile?.section.class.name} - {student.studentProfile?.section.name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {students.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No students found. Create student users first.
                </p>
              )}
              {students.length > 0 && studentsWithProfiles.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No available students to link for this parent.
                </p>
              )}
              {selectedParent && availableStudentsForParent.length === 0 && students.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  This parent is already linked to all students.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !selectedParent || !selectedStudent}>
              {isSaving ? "Linking..." : "Link Parent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Link?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the relationship between{" "}
              <strong>
                {deletingLink?.parent?.user?.firstName ?? ""} {deletingLink?.parent?.user?.lastName ?? ""}
              </strong>{" "}
              and{" "}
              <strong>
                {deletingLink?.student?.user?.firstName ?? ""} {deletingLink?.student?.user?.lastName ?? ""}
              </strong>
              . This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? "Removing..." : "Remove Link"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  GraduationCap,
  Users2,
  Pencil,
  Loader2,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

interface Student {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string;
  lastName: string;
  avatar: string | null;
  isActive: boolean;
  createdAt: string;
  studentProfile: {
    id: string;
    rollNumber: string | null;
    dateOfBirth: string | null;
    section: {
      id: string;
      name: string;
      class: { id: string; name: string };
    };
    parents: Array<{
      parent: {
        id: string;
        occupation: string | null;
        relationship: string | null;
        user: {
          id: string;
          firstName: string;
          lastName: string;
          email: string | null;
          phone: string | null;
        };
      };
    }>;
  };
}

export default function StudentDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [student, setStudent] = useState<Student | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchStudent = async () => {
    try {
      const response = await fetch(`/api/users/${id}`);
      const data = await response.json();

      if (response.ok && data.user.role === "STUDENT") {
        setStudent(data.user);
      } else {
        toast.error("Student not found");
        router.push("/admin/students");
      }
    } catch {
      toast.error("Failed to fetch student");
      router.push("/admin/students");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStudent();
  }, [id]);

  const handleToggleActive = async () => {
    if (!student) return;

    try {
      const response = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !student.isActive }),
      });

      if (response.ok) {
        toast.success(`Student ${student.isActive ? "deactivated" : "activated"} successfully`);
        fetchStudent();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to update student");
      }
    } catch {
      toast.error("Failed to update student");
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/users/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Student deleted successfully");
        router.push("/admin/students");
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to delete student");
      }
    } catch {
      toast.error("Failed to delete student");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!student) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/admin/students")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <GraduationCap className="h-6 w-6" />
            Student Details
          </h1>
          <p className="text-muted-foreground">View and manage student information</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleToggleActive}>
            {student.isActive ? (
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
          <Link href={`/admin/students/${id}/edit`}>
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

      {/* Student Profile Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-6">
            <Avatar className="h-20 w-20">
              <AvatarImage src={student.avatar || undefined} />
              <AvatarFallback className="text-xl">
                {getInitials(`${student.firstName} ${student.lastName}`)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold">
                  {student.firstName} {student.lastName}
                </h2>
                <Badge className="bg-yellow-100 text-yellow-800">STUDENT</Badge>
                <Badge variant={student.isActive ? "default" : "secondary"}>
                  {student.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {student.email && (
                  <div className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    {student.email}
                  </div>
                )}
                {student.phone && (
                  <div className="flex items-center gap-1">
                    <Phone className="h-4 w-4" />
                    {student.phone}
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Joined {new Date(student.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Academic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Academic Information
          </CardTitle>
          <CardDescription>Class, section, and enrollment details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label className="text-muted-foreground">Class & Section</Label>
              <p className="font-medium">
                {student.studentProfile.section.class.name} - {student.studentProfile.section.name}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Roll Number</Label>
              <p className="font-medium">{student.studentProfile.rollNumber || "Not set"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Date of Birth</Label>
              <p className="font-medium">
                {student.studentProfile.dateOfBirth
                  ? new Date(student.studentProfile.dateOfBirth).toLocaleDateString()
                  : "Not set"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Parents/Guardians */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users2 className="h-5 w-5" />
            Parents/Guardians
          </CardTitle>
          <CardDescription>Linked parent accounts for this student</CardDescription>
        </CardHeader>
        <CardContent>
          {student.studentProfile.parents.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No parents/guardians linked to this student yet.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {student.studentProfile.parents.map((p) => (
                <div
                  key={p.parent.id}
                  className="flex items-center gap-4 p-4 border rounded-lg"
                >
                  <Avatar>
                    <AvatarFallback>
                      {getInitials(`${p.parent.user.firstName} ${p.parent.user.lastName}`)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="font-medium">
                      {p.parent.user.firstName} {p.parent.user.lastName}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {p.parent.relationship || "Guardian"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {p.parent.user.email || p.parent.user.phone}
                    </div>
                  </div>
                  <Link href={`/admin/parents/${p.parent.user.id}`}>
                    <Button variant="ghost" size="sm">
                      View
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the student
              account for {student.firstName} {student.lastName} and all associated data.
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

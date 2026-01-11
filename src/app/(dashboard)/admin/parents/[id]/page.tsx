"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  Users2,
  GraduationCap,
  Pencil,
  Plus,
  X,
  Loader2,
  Trash2,
  UserCheck,
  UserX,
  Briefcase,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

interface Parent {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string;
  lastName: string;
  avatar: string | null;
  isActive: boolean;
  createdAt: string;
  parentProfile: {
    id: string;
    occupation: string | null;
    relationship: string | null;
    children: Array<{
      student: {
        id: string;
        rollNumber: string | null;
        user: {
          id: string;
          firstName: string;
          lastName: string;
        };
        section: {
          id: string;
          name: string;
          class: { id: string; name: string };
        };
      };
    }>;
  };
}

interface AvailableStudent {
  id: string;
  user: {
    firstName: string;
    lastName: string;
  };
  section: {
    id: string;
    name: string;
    class: { id: string; name: string };
  };
}

export default function ParentDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [parent, setParent] = useState<Parent | null>(null);
  const [availableStudents, setAvailableStudents] = useState<AvailableStudent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Link children dialog
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [isLinking, setIsLinking] = useState(false);

  const fetchParent = async () => {
    try {
      const response = await fetch(`/api/users/${id}`);
      const data = await response.json();

      if (response.ok && data.user.role === "PARENT") {
        setParent(data.user);
      } else {
        toast.error("Parent not found");
        router.push("/admin/parents");
      }
    } catch {
      toast.error("Failed to fetch parent");
      router.push("/admin/parents");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAvailableStudents = async () => {
    try {
      const response = await fetch(`/api/parents/${id}/children`);
      const data = await response.json();

      if (response.ok) {
        setAvailableStudents(data.students);
      }
    } catch {
      console.error("Failed to fetch available students");
    }
  };

  useEffect(() => {
    fetchParent();
    fetchAvailableStudents();
  }, [id]);

  const handleToggleActive = async () => {
    if (!parent) return;

    try {
      const response = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !parent.isActive }),
      });

      if (response.ok) {
        toast.success(`Parent ${parent.isActive ? "deactivated" : "activated"} successfully`);
        fetchParent();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to update parent");
      }
    } catch {
      toast.error("Failed to update parent");
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/users/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Parent deleted successfully");
        router.push("/admin/parents");
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to delete parent");
      }
    } catch {
      toast.error("Failed to delete parent");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleLinkChild = async () => {
    if (!selectedStudentId) return;

    setIsLinking(true);
    try {
      const response = await fetch(`/api/parents/${id}/children`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds: [selectedStudentId] }),
      });

      if (response.ok) {
        toast.success("Child linked successfully");
        fetchParent();
        fetchAvailableStudents();
        setShowLinkDialog(false);
        setSelectedStudentId("");
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to link child");
      }
    } catch {
      toast.error("Failed to link child");
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlinkChild = async (studentId: string) => {
    try {
      const response = await fetch(`/api/parents/${id}/children`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      });

      if (response.ok) {
        toast.success("Child unlinked successfully");
        fetchParent();
        fetchAvailableStudents();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to unlink child");
      }
    } catch {
      toast.error("Failed to unlink child");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!parent) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/admin/parents")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users2 className="h-6 w-6" />
            Parent Details
          </h1>
          <p className="text-muted-foreground">View and manage parent information</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleToggleActive}>
            {parent.isActive ? (
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
          <Link href={`/admin/parents/${id}/edit`}>
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

      {/* Parent Profile Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-6">
            <Avatar className="h-20 w-20">
              <AvatarImage src={parent.avatar || undefined} />
              <AvatarFallback className="text-xl">
                {getInitials(`${parent.firstName} ${parent.lastName}`)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold">
                  {parent.firstName} {parent.lastName}
                </h2>
                <Badge className="bg-orange-100 text-orange-800">PARENT</Badge>
                <Badge variant={parent.isActive ? "default" : "secondary"}>
                  {parent.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {parent.email && (
                  <div className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    {parent.email}
                  </div>
                )}
                {parent.phone && (
                  <div className="flex items-center gap-1">
                    <Phone className="h-4 w-4" />
                    {parent.phone}
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Joined {new Date(parent.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Parent Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Parent Information
          </CardTitle>
          <CardDescription>Additional details about this parent</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-muted-foreground">Occupation</Label>
              <p className="font-medium">{parent.parentProfile.occupation || "Not set"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Relationship</Label>
              <p className="font-medium">{parent.parentProfile.relationship || "Not set"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Children */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Children
            </CardTitle>
            <CardDescription>Students linked to this parent</CardDescription>
          </div>
          <Button onClick={() => setShowLinkDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Link Child
          </Button>
        </CardHeader>
        <CardContent>
          {parent.parentProfile.children.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No children linked to this parent yet. Click &quot;Link Child&quot; to add.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {parent.parentProfile.children.map((c) => (
                <div
                  key={c.student.id}
                  className="flex items-center gap-4 p-4 border rounded-lg"
                >
                  <Avatar>
                    <AvatarFallback>
                      {getInitials(`${c.student.user.firstName} ${c.student.user.lastName}`)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="font-medium">
                      {c.student.user.firstName} {c.student.user.lastName}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {c.student.section.class.name} - {c.student.section.name}
                    </div>
                    {c.student.rollNumber && (
                      <div className="text-sm text-muted-foreground">
                        Roll: {c.student.rollNumber}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/admin/students/${c.student.user.id}`}>
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleUnlinkChild(c.student.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Link Child Dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Child</DialogTitle>
            <DialogDescription>
              Select a student to link as a child of this parent.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Student</Label>
              <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a student" />
                </SelectTrigger>
                <SelectContent>
                  {availableStudents.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      No students available to link
                    </div>
                  ) : (
                    availableStudents.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.user.firstName} {student.user.lastName} ({student.section.class.name} - {student.section.name})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleLinkChild}
              disabled={!selectedStudentId || isLinking}
            >
              {isLinking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Link Child
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
              This action cannot be undone. This will permanently delete the parent
              account for {parent.firstName} {parent.lastName} and all associated data.
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

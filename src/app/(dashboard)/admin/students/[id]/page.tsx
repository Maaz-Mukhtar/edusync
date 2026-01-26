"use client";

import { useState, useEffect, use, useCallback } from "react";
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
  UserPlus,
  Loader2,
  Trash2,
  UserCheck,
  UserX,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

interface ParentSearchResult {
  id: string; // user id
  email: string | null;
  phone: string | null;
  firstName: string;
  lastName: string;
  parentProfile: { id: string; relationship: string | null } | null;
}

export default function StudentDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [student, setStudent] = useState<Student | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Parent linking dialog
  const [showParentDialog, setShowParentDialog] = useState(false);
  const [parentTab, setParentTab] = useState<"link" | "create">("link");
  const [parentSearch, setParentSearch] = useState("");
  const [parentResults, setParentResults] = useState<ParentSearchResult[]>([]);
  const [selectedParentUserId, setSelectedParentUserId] = useState("");
  const [isParentSearching, setIsParentSearching] = useState(false);
  const [isParentSaving, setIsParentSaving] = useState(false);

  // Create + link form
  const [newParentFirstName, setNewParentFirstName] = useState("");
  const [newParentLastName, setNewParentLastName] = useState("");
  const [newParentEmail, setNewParentEmail] = useState("");
  const [newParentPhone, setNewParentPhone] = useState("");
  const [newParentPassword, setNewParentPassword] = useState("");
  const [newParentRelationship, setNewParentRelationship] = useState<string>("");
  const [newParentOccupation, setNewParentOccupation] = useState("");

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

  const fetchParentSearch = useCallback(
    async (search: string) => {
      setIsParentSearching(true);
      try {
        const params = new URLSearchParams({
          limit: "20",
          sortBy: "name",
          sortOrder: "asc",
        });
        if (search.trim()) params.set("search", search.trim());

        const response = await fetch(`/api/parents?${params.toString()}`);
        const data = await response.json();
        if (!response.ok) {
          toast.error(data.error || "Failed to fetch parents");
          setParentResults([]);
          return;
        }

        const results = (data.parents || []) as ParentSearchResult[];
        const linkedParentUserIds = new Set(
          student?.studentProfile.parents.map((p) => p.parent.user.id) || []
        );
        setParentResults(results.filter((p) => !linkedParentUserIds.has(p.id)));
      } catch {
        toast.error("Failed to fetch parents");
        setParentResults([]);
      } finally {
        setIsParentSearching(false);
      }
    },
    [student]
  );

  useEffect(() => {
    if (!showParentDialog) return;
    fetchParentSearch("");
  }, [showParentDialog, fetchParentSearch]);

  useEffect(() => {
    if (!showParentDialog) return;
    const handle = setTimeout(() => {
      fetchParentSearch(parentSearch);
    }, 250);
    return () => clearTimeout(handle);
  }, [parentSearch, showParentDialog, fetchParentSearch]);

  const resetParentDialog = () => {
    setParentTab("link");
    setParentSearch("");
    setParentResults([]);
    setSelectedParentUserId("");
    setNewParentFirstName("");
    setNewParentLastName("");
    setNewParentEmail("");
    setNewParentPhone("");
    setNewParentPassword("");
    setNewParentRelationship("");
    setNewParentOccupation("");
  };

  const openParentDialog = () => {
    resetParentDialog();
    setShowParentDialog(true);
  };

  const handleLinkExistingParent = async () => {
    if (!selectedParentUserId) return;
    setIsParentSaving(true);
    try {
      const response = await fetch(`/api/students/${id}/parents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "linkExisting", parentUserId: selectedParentUserId }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || "Failed to link parent");
        return;
      }
      toast.success("Parent linked successfully");
      setShowParentDialog(false);
      await fetchStudent();
    } catch {
      toast.error("Failed to link parent");
    } finally {
      setIsParentSaving(false);
    }
  };

  const handleCreateAndLinkParent = async () => {
    if (!newParentFirstName.trim() || !newParentLastName.trim()) {
      toast.error("Parent first and last name are required");
      return;
    }
    if (!newParentEmail.trim() && !newParentPhone.trim()) {
      toast.error("Either email or phone is required");
      return;
    }
    if (!newParentPassword || newParentPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setIsParentSaving(true);
    try {
      const response = await fetch(`/api/students/${id}/parents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createAndLink",
          parent: {
            firstName: newParentFirstName.trim(),
            lastName: newParentLastName.trim(),
            email: newParentEmail.trim() ? newParentEmail.trim() : null,
            phone: newParentPhone.trim() ? newParentPhone.trim() : null,
            password: newParentPassword,
            occupation: newParentOccupation.trim() ? newParentOccupation.trim() : null,
            relationship: newParentRelationship || null,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || "Failed to create/link parent");
        return;
      }
      toast.success(
        data.mode === "linkedExisting"
          ? "Existing parent linked"
          : "Parent created and linked"
      );
      setShowParentDialog(false);
      await fetchStudent();
    } catch {
      toast.error("Failed to create/link parent");
    } finally {
      setIsParentSaving(false);
    }
  };

  const handleUnlinkParent = async (parentUserId: string) => {
    if (!confirm("Unlink this parent from the student?")) return;
    try {
      const response = await fetch(`/api/students/${id}/parents`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentUserId }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || "Failed to unlink parent");
        return;
      }
      toast.success("Parent unlinked");
      await fetchStudent();
    } catch {
      toast.error("Failed to unlink parent");
    }
  };

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
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              <Users2 className="h-5 w-5" />
              Parents/Guardians
            </CardTitle>
            <CardDescription>Linked parent accounts for this student</CardDescription>
          </div>
          <Button onClick={openParentDialog}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add / Link
          </Button>
        </CardHeader>
        <CardContent>
          {student.studentProfile.parents.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-muted-foreground">
                No parents/guardians linked to this student yet.
              </p>
              <Button onClick={openParentDialog}>
                <UserPlus className="mr-2 h-4 w-4" />
                Add / Link Parent
              </Button>
            </div>
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
                  <div className="flex items-center gap-2">
                    <Link href={`/admin/parents/${p.parent.user.id}`}>
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUnlinkParent(p.parent.user.id)}
                    >
                      Unlink
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Parent Linking Dialog */}
      <Dialog
        open={showParentDialog}
        onOpenChange={(open) => {
          setShowParentDialog(open);
          if (!open) resetParentDialog();
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Link Parent</DialogTitle>
            <DialogDescription>
              Link an existing parent account, or create a new parent and link them to this student in one step.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={parentTab} onValueChange={(v) => setParentTab(v as "link" | "create")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="link">Link Existing</TabsTrigger>
              <TabsTrigger value="create">Create + Link</TabsTrigger>
            </TabsList>

            <TabsContent value="link">
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="parent-search">Search parents</Label>
                  <Input
                    id="parent-search"
                    value={parentSearch}
                    onChange={(e) => setParentSearch(e.target.value)}
                    placeholder="Search by name, email, or phone"
                    disabled={isParentSaving}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Select parent</Label>
                  <div className="max-h-64 overflow-auto rounded-md border">
                    {isParentSearching ? (
                      <div className="p-4 text-sm text-muted-foreground">Searching…</div>
                    ) : parentResults.length === 0 ? (
                      <div className="p-4 text-sm text-muted-foreground">
                        No available parents found.
                      </div>
                    ) : (
                      <div className="divide-y">
                        {parentResults.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className={`w-full px-4 py-3 text-left hover:bg-muted/50 ${
                              selectedParentUserId === p.id ? "bg-muted" : ""
                            }`}
                            onClick={() => setSelectedParentUserId(p.id)}
                            disabled={isParentSaving}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-medium truncate">
                                  {p.firstName} {p.lastName}
                                </div>
                                <div className="text-sm text-muted-foreground truncate">
                                  {p.email || p.phone || "—"}
                                </div>
                              </div>
                              <Badge variant="secondary">
                                {p.parentProfile?.relationship || "Parent"}
                              </Badge>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Only parents not already linked to this student are shown.
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="create">
              <div className="space-y-4 py-4">
                <p className="text-xs text-muted-foreground">
                  If a parent with the same email/phone already exists, we’ll link the existing parent instead of
                  creating a duplicate.
                </p>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="parent-first-name">First name *</Label>
                    <Input
                      id="parent-first-name"
                      value={newParentFirstName}
                      onChange={(e) => setNewParentFirstName(e.target.value)}
                      disabled={isParentSaving}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="parent-last-name">Last name *</Label>
                    <Input
                      id="parent-last-name"
                      value={newParentLastName}
                      onChange={(e) => setNewParentLastName(e.target.value)}
                      disabled={isParentSaving}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="parent-email">Email</Label>
                    <Input
                      id="parent-email"
                      value={newParentEmail}
                      onChange={(e) => setNewParentEmail(e.target.value)}
                      placeholder="Optional if phone provided"
                      disabled={isParentSaving}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="parent-phone">Phone</Label>
                    <Input
                      id="parent-phone"
                      value={newParentPhone}
                      onChange={(e) => setNewParentPhone(e.target.value)}
                      placeholder="Optional if email provided"
                      disabled={isParentSaving}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="parent-password">Password *</Label>
                  <Input
                    id="parent-password"
                    type="password"
                    value={newParentPassword}
                    onChange={(e) => setNewParentPassword(e.target.value)}
                    disabled={isParentSaving}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="parent-occupation">Occupation</Label>
                    <Input
                      id="parent-occupation"
                      value={newParentOccupation}
                      onChange={(e) => setNewParentOccupation(e.target.value)}
                      placeholder="e.g., Engineer, Doctor"
                      disabled={isParentSaving}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="parent-relationship">Relationship</Label>
                    <Select
                      value={newParentRelationship}
                      onValueChange={(value) => setNewParentRelationship(value)}
                      disabled={isParentSaving}
                    >
                      <SelectTrigger id="parent-relationship">
                        <SelectValue placeholder="Select relationship" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Father">Father</SelectItem>
                        <SelectItem value="Mother">Mother</SelectItem>
                        <SelectItem value="Guardian">Guardian</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowParentDialog(false)}
              disabled={isParentSaving}
            >
              Cancel
            </Button>
            {parentTab === "link" ? (
              <Button
                onClick={handleLinkExistingParent}
                disabled={!selectedParentUserId || isParentSaving}
              >
                {isParentSaving ? "Linking..." : "Link Parent"}
              </Button>
            ) : (
              <Button onClick={handleCreateAndLinkParent} disabled={isParentSaving}>
                {isParentSaving ? "Saving..." : "Create + Link"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

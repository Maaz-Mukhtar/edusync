"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import {
  MoreHorizontal,
  UserPlus,
  Pencil,
  Trash2,
  Eye,
  UserCheck,
  UserX,
  Upload,
  Users,
  ArrowUpDown,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { Input } from "@/components/ui/input";

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
    subjectsTaught: Array<{
      subject: {
        id: string;
        name: string;
        class: { id: string; name: string };
      };
    }>;
    classTeacherOf: Array<{
      section: {
        id: string;
        name: string;
        class: { id: string; name: string };
      };
    }>;
    sectionSubjects: Array<{
      section: {
        id: string;
        name: string;
        class: { id: string; name: string };
      };
      subject: { id: string; name: string };
    }>;
  } | null;
}

interface Class {
  id: string;
  name: string;
}

interface Subject {
  id: string;
  name: string;
  classId: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function TeachersPage() {
  const router = useRouter();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [classFilter, setClassFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [deleteTeacherId, setDeleteTeacherId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch classes for filter dropdown
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const response = await fetch("/api/classes");
        const data = await response.json();
        if (response.ok) {
          setClasses(data.classes || []);
        }
      } catch {
        console.error("Failed to fetch classes");
      }
    };
    fetchClasses();
  }, []);

  // Fetch subjects when class filter changes
  useEffect(() => {
    const fetchSubjects = async () => {
      if (classFilter === "all") {
        setSubjects([]);
        setSubjectFilter("all");
        return;
      }
      try {
        const response = await fetch(`/api/classes/${classFilter}/subjects`);
        const data = await response.json();
        if (response.ok) {
          setSubjects(data.subjects || []);
        }
      } catch {
        console.error("Failed to fetch subjects");
      }
    };
    fetchSubjects();
  }, [classFilter]);

  const fetchTeachers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sortBy,
        sortOrder,
      });
      if (classFilter !== "all") params.set("classId", classFilter);
      if (subjectFilter !== "all") params.set("subjectId", subjectFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search) params.set("search", search);

      const response = await fetch(`/api/teachers?${params}`);
      const data = await response.json();

      if (response.ok) {
        setTeachers(data.teachers);
        setPagination(data.pagination);
      } else {
        toast.error(data.error || "Failed to fetch teachers");
      }
    } catch {
      toast.error("Failed to fetch teachers");
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, classFilter, subjectFilter, statusFilter, sortBy, sortOrder, search]);

  useEffect(() => {
    fetchTeachers();
  }, [fetchTeachers]);

  const handleDelete = async () => {
    if (!deleteTeacherId) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/users/${deleteTeacherId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Teacher deleted successfully");
        fetchTeachers();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to delete teacher");
      }
    } catch {
      toast.error("Failed to delete teacher");
    } finally {
      setIsDeleting(false);
      setDeleteTeacherId(null);
    }
  };

  const handleToggleActive = async (teacher: Teacher) => {
    try {
      const response = await fetch(`/api/users/${teacher.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !teacher.isActive }),
      });

      if (response.ok) {
        toast.success(`Teacher ${teacher.isActive ? "deactivated" : "activated"} successfully`);
        fetchTeachers();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to update teacher");
      }
    } catch {
      toast.error("Failed to update teacher");
    }
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const columns: ColumnDef<Teacher>[] = [
    {
      accessorKey: "name",
      header: () => (
        <Button
          variant="ghost"
          onClick={() => handleSort("name")}
          className="h-8 p-0 font-semibold hover:bg-transparent"
        >
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const teacher = row.original;
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={teacher.avatar || undefined} />
              <AvatarFallback>
                {getInitials(`${teacher.firstName} ${teacher.lastName}`)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium">
                {teacher.firstName} {teacher.lastName}
              </div>
              <div className="text-sm text-muted-foreground">
                {teacher.email || teacher.phone}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "employeeId",
      header: () => (
        <Button
          variant="ghost"
          onClick={() => handleSort("employeeId")}
          className="h-8 p-0 font-semibold hover:bg-transparent"
        >
          Employee ID
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const teacher = row.original;
        return teacher.teacherProfile?.employeeId || <span className="text-muted-foreground">-</span>;
      },
    },
    {
      accessorKey: "subjects",
      header: "Subject Expertise",
      cell: ({ row }) => {
        const teacher = row.original;
        if (!teacher.teacherProfile?.subjectsTaught.length) {
          return <span className="text-muted-foreground">None</span>;
        }
        const subjects = teacher.teacherProfile.subjectsTaught.slice(0, 3);
        const remaining = teacher.teacherProfile.subjectsTaught.length - 3;
        return (
          <div className="flex flex-wrap gap-1">
            {subjects.map((ts) => (
              <Badge key={ts.subject.id} variant="secondary" className="text-xs">
                {ts.subject.name}
              </Badge>
            ))}
            {remaining > 0 && (
              <Badge variant="outline" className="text-xs">
                +{remaining} more
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "assignments",
      header: "Sections",
      cell: ({ row }) => {
        const teacher = row.original;
        if (!teacher.teacherProfile) return <span className="text-muted-foreground">-</span>;

        const classTeacherSections = teacher.teacherProfile.classTeacherOf.length;
        const subjectSections = teacher.teacherProfile.sectionSubjects.length;

        if (classTeacherSections === 0 && subjectSections === 0) {
          return <span className="text-muted-foreground">Not assigned</span>;
        }

        return (
          <div className="text-sm">
            {classTeacherSections > 0 && (
              <div className="text-green-600">Class Teacher: {classTeacherSections}</div>
            )}
            {subjectSections > 0 && (
              <div className="text-blue-600">Subject Teacher: {subjectSections}</div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => {
        const isActive = row.getValue("isActive") as boolean;
        return (
          <Badge variant={isActive ? "default" : "secondary"}>
            {isActive ? "Active" : "Inactive"}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const teacher = row.original;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => router.push(`/admin/teachers/${teacher.id}`)}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/admin/teachers/${teacher.id}/edit`)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleToggleActive(teacher)}>
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
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setDeleteTeacherId(teacher.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6" />
            Teachers
          </h1>
          <p className="text-muted-foreground">
            Manage teachers in your school
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/users/import?type=TEACHER">
            <Button variant="outline">
              <Upload className="mr-2 h-4 w-4" />
              Import CSV
            </Button>
          </Link>
          <Link href="/admin/teachers/new">
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Add Teacher
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Input
          placeholder="Search teachers..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPagination((prev) => ({ ...prev, page: 1 }));
          }}
          className="w-[250px]"
        />
        <Select
          value={classFilter}
          onValueChange={(value) => {
            setClassFilter(value);
            setSubjectFilter("all");
            setPagination((prev) => ({ ...prev, page: 1 }));
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by class" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            {classes.map((cls) => (
              <SelectItem key={cls.id} value={cls.id}>
                {cls.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {subjects.length > 0 && (
          <Select
            value={subjectFilter}
            onValueChange={(value) => {
              setSubjectFilter(value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by subject" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              {subjects.map((sub) => (
                <SelectItem key={sub.id} value={sub.id}>
                  {sub.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value);
            setPagination((prev) => ({ ...prev, page: 1 }));
          }}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={teachers}
        pagination={pagination}
        onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
        isLoading={isLoading}
      />

      <AlertDialog open={!!deleteTeacherId} onOpenChange={() => setDeleteTeacherId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the teacher
              and all associated data.
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

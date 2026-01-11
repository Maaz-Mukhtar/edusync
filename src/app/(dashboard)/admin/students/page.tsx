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
  GraduationCap,
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
        user: { firstName: string; lastName: string };
      };
    }>;
  } | null;
}

interface Class {
  id: string;
  name: string;
  sections: Array<{ id: string; name: string }>;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function StudentsPage() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [classFilter, setClassFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [deleteStudentId, setDeleteStudentId] = useState<string | null>(null);
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

  const fetchStudents = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sortBy,
        sortOrder,
      });
      if (classFilter !== "all") params.set("classId", classFilter);
      if (sectionFilter !== "all") params.set("sectionId", sectionFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search) params.set("search", search);

      const response = await fetch(`/api/students?${params}`);
      const data = await response.json();

      if (response.ok) {
        setStudents(data.students);
        setPagination(data.pagination);
      } else {
        toast.error(data.error || "Failed to fetch students");
      }
    } catch {
      toast.error("Failed to fetch students");
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, classFilter, sectionFilter, statusFilter, sortBy, sortOrder, search]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // Reset section filter when class changes
  useEffect(() => {
    setSectionFilter("all");
  }, [classFilter]);

  const handleDelete = async () => {
    if (!deleteStudentId) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/users/${deleteStudentId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Student deleted successfully");
        fetchStudents();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to delete student");
      }
    } catch {
      toast.error("Failed to delete student");
    } finally {
      setIsDeleting(false);
      setDeleteStudentId(null);
    }
  };

  const handleToggleActive = async (student: Student) => {
    try {
      const response = await fetch(`/api/users/${student.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !student.isActive }),
      });

      if (response.ok) {
        toast.success(`Student ${student.isActive ? "deactivated" : "activated"} successfully`);
        fetchStudents();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to update student");
      }
    } catch {
      toast.error("Failed to update student");
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

  const selectedClass = classes.find((c) => c.id === classFilter);

  const columns: ColumnDef<Student>[] = [
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
        const student = row.original;
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={student.avatar || undefined} />
              <AvatarFallback>
                {getInitials(`${student.firstName} ${student.lastName}`)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium">
                {student.firstName} {student.lastName}
              </div>
              <div className="text-sm text-muted-foreground">
                {student.email || student.phone}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "class",
      header: () => (
        <Button
          variant="ghost"
          onClick={() => handleSort("class")}
          className="h-8 p-0 font-semibold hover:bg-transparent"
        >
          Class / Section
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const student = row.original;
        if (!student.studentProfile) return <span className="text-muted-foreground">-</span>;
        return (
          <Badge variant="outline">
            {student.studentProfile.section.class.name} - {student.studentProfile.section.name}
          </Badge>
        );
      },
    },
    {
      accessorKey: "rollNumber",
      header: () => (
        <Button
          variant="ghost"
          onClick={() => handleSort("rollNumber")}
          className="h-8 p-0 font-semibold hover:bg-transparent"
        >
          Roll No
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const student = row.original;
        return student.studentProfile?.rollNumber || <span className="text-muted-foreground">-</span>;
      },
    },
    {
      accessorKey: "parents",
      header: "Parents",
      cell: ({ row }) => {
        const student = row.original;
        if (!student.studentProfile?.parents.length) {
          return <span className="text-muted-foreground">No parents linked</span>;
        }
        return (
          <div className="text-sm">
            {student.studentProfile.parents
              .map((p) => `${p.parent.user.firstName} ${p.parent.user.lastName}`)
              .join(", ")}
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
      accessorKey: "createdAt",
      header: () => (
        <Button
          variant="ghost"
          onClick={() => handleSort("createdAt")}
          className="h-8 p-0 font-semibold hover:bg-transparent"
        >
          Joined
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const date = new Date(row.getValue("createdAt") as string);
        return date.toLocaleDateString();
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const student = row.original;

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
              <DropdownMenuItem onClick={() => router.push(`/admin/students/${student.id}`)}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/admin/students/${student.id}/edit`)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleToggleActive(student)}>
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
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setDeleteStudentId(student.id)}
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
            <GraduationCap className="h-6 w-6" />
            Students
          </h1>
          <p className="text-muted-foreground">
            Manage students in your school
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/users/import?type=STUDENT">
            <Button variant="outline">
              <Upload className="mr-2 h-4 w-4" />
              Import CSV
            </Button>
          </Link>
          <Link href="/admin/students/new">
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Add Student
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Input
          placeholder="Search students..."
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
        {selectedClass && selectedClass.sections.length > 0 && (
          <Select
            value={sectionFilter}
            onValueChange={(value) => {
              setSectionFilter(value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by section" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sections</SelectItem>
              {selectedClass.sections.map((sec) => (
                <SelectItem key={sec.id} value={sec.id}>
                  {sec.name}
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
        data={students}
        pagination={pagination}
        onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
        isLoading={isLoading}
      />

      <AlertDialog open={!!deleteStudentId} onOpenChange={() => setDeleteStudentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the student
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

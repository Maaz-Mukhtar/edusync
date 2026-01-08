"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import {
  MoreHorizontal,
  Plus,
  UserPlus,
  Pencil,
  Trash2,
  Eye,
  UserCheck,
  UserX,
  Upload,
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

interface User {
  id: string;
  email: string | null;
  phone: string | null;
  role: string;
  firstName: string;
  lastName: string;
  avatar: string | null;
  isActive: boolean;
  createdAt: string;
  studentProfile?: {
    id: string;
    rollNumber: string | null;
    section: {
      id: string;
      name: string;
      class: { id: string; name: string };
    };
  };
  teacherProfile?: {
    id: string;
    employeeId: string | null;
    qualification: string | null;
  };
  parentProfile?: {
    id: string;
    occupation: string | null;
    children: Array<{
      student: {
        user: { firstName: string; lastName: string };
      };
    }>;
  };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const roleColors: Record<string, string> = {
  SUPER_ADMIN: "bg-purple-100 text-purple-800",
  ADMIN: "bg-blue-100 text-blue-800",
  TEACHER: "bg-green-100 text-green-800",
  STUDENT: "bg-yellow-100 text-yellow-800",
  PARENT: "bg-orange-100 text-orange-800",
};

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [roleFilter, setRoleFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      if (roleFilter !== "all") {
        params.set("role", roleFilter);
      }

      const response = await fetch(`/api/users?${params}`);
      const data = await response.json();

      if (response.ok) {
        setUsers(data.users);
        setPagination(data.pagination);
      } else {
        toast.error(data.error || "Failed to fetch users");
      }
    } catch {
      toast.error("Failed to fetch users");
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, roleFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleDelete = async () => {
    if (!deleteUserId) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/users/${deleteUserId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("User deleted successfully");
        fetchUsers();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to delete user");
      }
    } catch {
      toast.error("Failed to delete user");
    } finally {
      setIsDeleting(false);
      setDeleteUserId(null);
    }
  };

  const handleToggleActive = async (user: User) => {
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !user.isActive }),
      });

      if (response.ok) {
        toast.success(`User ${user.isActive ? "deactivated" : "activated"} successfully`);
        fetchUsers();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to update user");
      }
    } catch {
      toast.error("Failed to update user");
    }
  };

  const columns: ColumnDef<User>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => {
        const user = row.original;
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.avatar || undefined} />
              <AvatarFallback>
                {getInitials(`${user.firstName} ${user.lastName}`)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium">
                {user.firstName} {user.lastName}
              </div>
              <div className="text-sm text-muted-foreground">
                {user.email || user.phone}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => {
        const role = row.getValue("role") as string;
        return (
          <Badge variant="secondary" className={roleColors[role]}>
            {role.replace("_", " ")}
          </Badge>
        );
      },
    },
    {
      accessorKey: "details",
      header: "Details",
      cell: ({ row }) => {
        const user = row.original;
        if (user.studentProfile) {
          return (
            <div className="text-sm">
              <div>{user.studentProfile.section.class.name} - {user.studentProfile.section.name}</div>
              {user.studentProfile.rollNumber && (
                <div className="text-muted-foreground">Roll: {user.studentProfile.rollNumber}</div>
              )}
            </div>
          );
        }
        if (user.teacherProfile) {
          return (
            <div className="text-sm">
              {user.teacherProfile.employeeId && <div>ID: {user.teacherProfile.employeeId}</div>}
              {user.teacherProfile.qualification && (
                <div className="text-muted-foreground">{user.teacherProfile.qualification}</div>
              )}
            </div>
          );
        }
        if (user.parentProfile) {
          const childrenNames = user.parentProfile.children
            .map((c) => `${c.student.user.firstName} ${c.student.user.lastName}`)
            .join(", ");
          return (
            <div className="text-sm">
              {childrenNames ? (
                <div className="text-muted-foreground">Children: {childrenNames}</div>
              ) : (
                <div className="text-muted-foreground">No children linked</div>
              )}
            </div>
          );
        }
        return <span className="text-muted-foreground">-</span>;
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
        const user = row.original;

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
              <DropdownMenuItem onClick={() => router.push(`/admin/users/${user.id}`)}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/admin/users/${user.id}/edit`)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleToggleActive(user)}>
                {user.isActive ? (
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
                onClick={() => setDeleteUserId(user.id)}
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
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">
            Manage all users in your school
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/users/import">
            <Button variant="outline">
              <Upload className="mr-2 h-4 w-4" />
              Import CSV
            </Button>
          </Link>
          <Link href="/admin/users/new">
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Select value={roleFilter} onValueChange={(value) => {
          setRoleFilter(value);
          setPagination((prev) => ({ ...prev, page: 1 }));
        }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="ADMIN">Admins</SelectItem>
            <SelectItem value="TEACHER">Teachers</SelectItem>
            <SelectItem value="STUDENT">Students</SelectItem>
            <SelectItem value="PARENT">Parents</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={users}
        pagination={pagination}
        onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
        isLoading={isLoading}
      />

      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user
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

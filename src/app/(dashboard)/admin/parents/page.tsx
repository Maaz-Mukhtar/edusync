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
  Users2,
  ArrowUpDown,
  Link2,
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
        user: { firstName: string; lastName: string };
        section: {
          id: string;
          name: string;
          class: { id: string; name: string };
        };
      };
    }>;
  } | null;
}

interface Class {
  id: string;
  name: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function ParentsPage() {
  const router = useRouter();
  const [parents, setParents] = useState<Parent[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [classFilter, setClassFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [deleteParentId, setDeleteParentId] = useState<string | null>(null);
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

  const fetchParents = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sortBy,
        sortOrder,
      });
      if (classFilter !== "all") params.set("childClassId", classFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search) params.set("search", search);

      const response = await fetch(`/api/parents?${params}`);
      const data = await response.json();

      if (response.ok) {
        setParents(data.parents);
        setPagination(data.pagination);
      } else {
        toast.error(data.error || "Failed to fetch parents");
      }
    } catch {
      toast.error("Failed to fetch parents");
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, classFilter, statusFilter, sortBy, sortOrder, search]);

  useEffect(() => {
    fetchParents();
  }, [fetchParents]);

  const handleDelete = async () => {
    if (!deleteParentId) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/users/${deleteParentId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Parent deleted successfully");
        fetchParents();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to delete parent");
      }
    } catch {
      toast.error("Failed to delete parent");
    } finally {
      setIsDeleting(false);
      setDeleteParentId(null);
    }
  };

  const handleToggleActive = async (parent: Parent) => {
    try {
      const response = await fetch(`/api/users/${parent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !parent.isActive }),
      });

      if (response.ok) {
        toast.success(`Parent ${parent.isActive ? "deactivated" : "activated"} successfully`);
        fetchParents();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to update parent");
      }
    } catch {
      toast.error("Failed to update parent");
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

  const columns: ColumnDef<Parent>[] = [
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
        const parent = row.original;
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={parent.avatar || undefined} />
              <AvatarFallback>
                {getInitials(`${parent.firstName} ${parent.lastName}`)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium">
                {parent.firstName} {parent.lastName}
              </div>
              <div className="text-sm text-muted-foreground">
                {parent.email || parent.phone}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "children",
      header: "Children",
      cell: ({ row }) => {
        const parent = row.original;
        if (!parent.parentProfile?.children.length) {
          return <span className="text-muted-foreground">No children linked</span>;
        }
        return (
          <div className="space-y-1">
            {parent.parentProfile.children.map((c) => (
              <div key={c.student.id} className="flex items-center gap-2">
                <span className="text-sm">
                  {c.student.user.firstName} {c.student.user.lastName}
                </span>
                <Badge variant="outline" className="text-xs">
                  {c.student.section.class.name} - {c.student.section.name}
                </Badge>
              </div>
            ))}
          </div>
        );
      },
    },
    {
      accessorKey: "contact",
      header: "Contact",
      cell: ({ row }) => {
        const parent = row.original;
        return (
          <div className="text-sm">
            {parent.email && <div>{parent.email}</div>}
            {parent.phone && <div className="text-muted-foreground">{parent.phone}</div>}
          </div>
        );
      },
    },
    {
      accessorKey: "occupation",
      header: "Occupation",
      cell: ({ row }) => {
        const parent = row.original;
        return parent.parentProfile?.occupation || <span className="text-muted-foreground">-</span>;
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
        const parent = row.original;

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
              <DropdownMenuItem onClick={() => router.push(`/admin/parents/${parent.id}`)}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/admin/parents/${parent.id}/edit`)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/admin/parent-links?parentId=${parent.parentProfile?.id}`)}>
                <Link2 className="mr-2 h-4 w-4" />
                Manage Children
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleToggleActive(parent)}>
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
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setDeleteParentId(parent.id)}
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
            <Users2 className="h-6 w-6" />
            Parents
          </h1>
          <p className="text-muted-foreground">
            Manage parents in your school
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/users/import?type=PARENT">
            <Button variant="outline">
              <Upload className="mr-2 h-4 w-4" />
              Import CSV
            </Button>
          </Link>
          <Link href="/admin/parents/new">
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Add Parent
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Input
          placeholder="Search parents..."
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
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by child's class" />
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
        data={parents}
        pagination={pagination}
        onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
        isLoading={isLoading}
      />

      <AlertDialog open={!!deleteParentId} onOpenChange={() => setDeleteParentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the parent
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

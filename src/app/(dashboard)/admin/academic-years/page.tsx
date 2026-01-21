"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  CheckCircle,
  Calendar,
  Users,
  ArrowUpRight,
  Loader2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface AcademicYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  _count: {
    enrollments: number;
    terms: number;
  };
}

interface MigrationStatus {
  currentAcademicYear: { id: string; name: string } | null;
  totalStudents: number;
  enrolledStudents: number;
  needsMigration: boolean;
  studentsToMigrate: number;
}

export default function AcademicYearsPage() {
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState<AcademicYear | null>(null);
  const [saving, setSaving] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus | null>(null);
  const [migrating, setMigrating] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    startDate: "",
    endDate: "",
    isCurrent: false,
  });

  const fetchAcademicYears = async () => {
    try {
      const response = await fetch("/api/academic-years");
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setAcademicYears(data);
    } catch (error) {
      console.error("Error fetching academic years:", error);
      toast.error("Failed to load academic years");
    } finally {
      setLoading(false);
    }
  };

  const fetchMigrationStatus = async () => {
    try {
      const response = await fetch("/api/academic-years/migrate");
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setMigrationStatus(data);
    } catch (error) {
      console.error("Error fetching migration status:", error);
    }
  };

  const handleMigrate = async () => {
    setMigrating(true);
    try {
      const response = await fetch("/api/academic-years/migrate", {
        method: "POST",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to migrate");
      }
      const result = await response.json();
      toast.success(result.message);
      fetchMigrationStatus();
      fetchAcademicYears();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to migrate students");
    } finally {
      setMigrating(false);
    }
  };

  useEffect(() => {
    fetchAcademicYears();
    fetchMigrationStatus();
  }, []);

  const openCreateDialog = () => {
    setSelectedYear(null);
    setFormData({
      name: "",
      startDate: "",
      endDate: "",
      isCurrent: false,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (year: AcademicYear) => {
    setSelectedYear(year);
    setFormData({
      name: year.name,
      startDate: format(new Date(year.startDate), "yyyy-MM-dd"),
      endDate: format(new Date(year.endDate), "yyyy-MM-dd"),
      isCurrent: year.isCurrent,
    });
    setDialogOpen(true);
  };

  const openDeleteDialog = (year: AcademicYear) => {
    setSelectedYear(year);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const url = selectedYear
        ? `/api/academic-years/${selectedYear.id}`
        : "/api/academic-years";
      const method = selectedYear ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save");
      }

      toast.success(
        selectedYear
          ? "Academic year updated successfully"
          : "Academic year created successfully"
      );
      setDialogOpen(false);
      fetchAcademicYears();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save academic year");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedYear) return;

    try {
      const response = await fetch(`/api/academic-years/${selectedYear.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete");
      }

      toast.success("Academic year deleted successfully");
      setDeleteDialogOpen(false);
      setSelectedYear(null);
      fetchAcademicYears();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete academic year");
    }
  };

  const handleSetCurrent = async (year: AcademicYear) => {
    try {
      const response = await fetch(`/api/academic-years/${year.id}/set-current`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to set current");
      }

      toast.success(`"${year.name}" is now the current academic year`);
      fetchAcademicYears();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to set current academic year");
    }
  };

  const currentYear = academicYears.find((y) => y.isCurrent);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Academic Years</h1>
          <p className="text-muted-foreground">
            Manage academic years and student promotions
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Academic Year
        </Button>
      </div>

      {/* Migration Status Card */}
      {migrationStatus?.needsMigration && (
        <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-lg">Migration Required</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground">
                  {migrationStatus.studentsToMigrate} students need to be enrolled in the current academic year.
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  This will create enrollment records for existing students.
                </p>
              </div>
              <Button onClick={handleMigrate} disabled={migrating}>
                {migrating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Migrate Students
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Year Card */}
      {currentYear && (
        <Card className="border-primary">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">Current Academic Year</CardTitle>
              <Badge variant="default">Active</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{currentYear.name}</p>
                <p className="text-muted-foreground">
                  {format(new Date(currentYear.startDate), "MMM d, yyyy")} -{" "}
                  {format(new Date(currentYear.endDate), "MMM d, yyyy")}
                </p>
              </div>
              <div className="flex gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold">{currentYear._count.enrollments}</p>
                  <p className="text-sm text-muted-foreground">Enrollments</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{currentYear._count.terms}</p>
                  <p className="text-sm text-muted-foreground">Terms</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Academic Years Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Academic Years</CardTitle>
        </CardHeader>
        <CardContent>
          {academicYears.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No academic years yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first academic year to get started
              </p>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add Academic Year
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Enrollments</TableHead>
                  <TableHead>Terms</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[70px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {academicYears.map((year) => (
                  <TableRow key={year.id}>
                    <TableCell className="font-medium">{year.name}</TableCell>
                    <TableCell>
                      {format(new Date(year.startDate), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      {format(new Date(year.endDate), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {year._count.enrollments}
                      </div>
                    </TableCell>
                    <TableCell>{year._count.terms}</TableCell>
                    <TableCell>
                      {year.isCurrent ? (
                        <Badge variant="default">Current</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(year)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          {!year.isCurrent && (
                            <DropdownMenuItem onClick={() => handleSetCurrent(year)}>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Set as Current
                            </DropdownMenuItem>
                          )}
                          {year._count.enrollments > 0 && (
                            <DropdownMenuItem
                              onClick={() => {
                                // Navigate to promotion page
                                window.location.href = `/admin/academic-years/${year.id}/promote`;
                              }}
                            >
                              <ArrowUpRight className="h-4 w-4 mr-2" />
                              Promote Students
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => openDeleteDialog(year)}
                            className="text-destructive"
                            disabled={year._count.enrollments > 0}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedYear ? "Edit Academic Year" : "Create Academic Year"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., 2024-2025"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData({ ...formData, startDate: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) =>
                      setFormData({ ...formData, endDate: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isCurrent"
                  checked={formData.isCurrent}
                  onChange={(e) =>
                    setFormData({ ...formData, isCurrent: e.target.checked })
                  }
                  className="h-4 w-4"
                />
                <Label htmlFor="isCurrent" className="font-normal">
                  Set as current academic year
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {selectedYear ? "Save Changes" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Academic Year</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{selectedYear?.name}&quot;? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

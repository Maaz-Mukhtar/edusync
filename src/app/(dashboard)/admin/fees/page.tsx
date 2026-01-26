"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Plus,
  Pencil,
  Trash2,
  DollarSign,
  MoreHorizontal,
  FileText,
  Calendar,
  ArrowRight,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { toast } from "sonner";

interface Class {
  id: string;
  name: string;
}

interface FeeStructure {
  id: string;
  name: string;
  amount: number;
  frequency: "MONTHLY" | "QUARTERLY" | "ANNUAL";
  dueDay: number | null;
  classId: string | null;
  class: Class | null;
  _count: {
    invoices: number;
  };
}

const frequencyLabels = {
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  ANNUAL: "Annual",
};

const frequencyColors = {
  MONTHLY: "bg-blue-100 text-blue-800",
  QUARTERLY: "bg-purple-100 text-purple-800",
  ANNUAL: "bg-green-100 text-green-800",
};

export default function FeesPage() {
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Form states
  const [editingStructure, setEditingStructure] = useState<FeeStructure | null>(null);
  const [deletingStructure, setDeletingStructure] = useState<FeeStructure | null>(null);

  // Form data
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<"MONTHLY" | "QUARTERLY" | "ANNUAL">("MONTHLY");
  const [classId, setClassId] = useState("");
  const [dueDay, setDueDay] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [feesRes, classesRes] = await Promise.all([
        fetch("/api/fee-structures"),
        fetch("/api/classes"),
      ]);

      const [feesData, classesData] = await Promise.all([
        feesRes.json(),
        classesRes.json(),
      ]);

      if (feesRes.ok) setFeeStructures(feesData.feeStructures);
      if (classesRes.ok) setClasses(classesData.classes);
    } catch {
      toast.error("Failed to fetch data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openDialog = (structure?: FeeStructure) => {
    if (structure) {
      setEditingStructure(structure);
      setName(structure.name);
      setAmount(structure.amount.toString());
      setFrequency(structure.frequency);
      setClassId(structure.classId || "all");
      setDueDay(structure.dueDay?.toString() || "");
    } else {
      setEditingStructure(null);
      setName("");
      setAmount("");
      setFrequency("MONTHLY");
      setClassId("all");
      setDueDay("");
    }
    setDialogOpen(true);
  };

  const openDeleteDialog = (structure: FeeStructure) => {
    setDeletingStructure(structure);
    setDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Fee name is required");
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    const dueDayNum = dueDay ? parseInt(dueDay) : null;
    if (dueDayNum !== null && (dueDayNum < 1 || dueDayNum > 28)) {
      toast.error("Due day must be between 1 and 28");
      return;
    }

    setIsSaving(true);
    try {
      const url = editingStructure
        ? `/api/fee-structures/${editingStructure.id}`
        : "/api/fee-structures";
      const method = editingStructure ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          amount: amountNum,
          frequency,
          classId: classId === "all" ? null : classId,
          dueDay: dueDayNum,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(
          editingStructure
            ? "Fee structure updated successfully"
            : "Fee structure created successfully"
        );
        setDialogOpen(false);
        fetchData();
      } else {
        toast.error(data.error || "Failed to save fee structure");
      }
    } catch {
      toast.error("Failed to save fee structure");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingStructure) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/fee-structures/${deletingStructure.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Fee structure deleted successfully");
        setDeleteDialogOpen(false);
        setDeletingStructure(null);
        fetchData();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to delete fee structure");
      }
    } catch {
      toast.error("Failed to delete fee structure");
    } finally {
      setIsDeleting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: "PKR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

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
          <h1 className="text-2xl font-bold tracking-tight">Fee Management</h1>
          <p className="text-muted-foreground">
            Configure fee structures for your school
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/fees/invoices">
              <FileText className="mr-2 h-4 w-4" />
              View Invoices
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button onClick={() => openDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Add Fee Structure
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Structures</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{feeStructures.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {feeStructures.reduce((acc, s) => acc + s._count.invoices, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Classes with Fees</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(feeStructures.filter((s) => s.classId).map((s) => s.classId)).size}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fee Structures Grid */}
      {feeStructures.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <DollarSign className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No fee structures yet</h3>
            <p className="text-muted-foreground">
              Get started by creating your first fee structure
            </p>
            <Button className="mt-4" onClick={() => openDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Add Fee Structure
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {feeStructures.map((structure) => (
            <Card key={structure.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{structure.name}</CardTitle>
                      <CardDescription>
                        {structure.class ? structure.class.name : "All Classes"}
                      </CardDescription>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openDialog(structure)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => openDeleteDialog(structure)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div className="text-2xl font-bold text-primary">
                    {formatCurrency(structure.amount)}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={frequencyColors[structure.frequency]}>
                      {frequencyLabels[structure.frequency]}
                    </Badge>
                    {structure.dueDay && (
                      <Badge variant="outline">Due: {structure.dueDay}th</Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {structure._count.invoices} invoice
                    {structure._count.invoices !== 1 ? "s" : ""} generated
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Fee Structure Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingStructure ? "Edit Fee Structure" : "Add New Fee Structure"}
            </DialogTitle>
            <DialogDescription>
              {editingStructure
                ? "Update the fee structure details"
                : "Create a new fee structure for your school"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Fee Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Monthly Tuition, Transport Fee"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (PKR) *</Label>
              <Input
                id="amount"
                type="number"
                placeholder="e.g., 5000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Frequency *</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as typeof frequency)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                  <SelectItem value="ANNUAL">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Applicable Class</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select class (optional)" />
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
              <p className="text-xs text-muted-foreground">
                Leave as &quot;All Classes&quot; to apply to every class
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDay">Due Day (Optional)</Label>
              <Input
                id="dueDay"
                type="number"
                placeholder="e.g., 10"
                min={1}
                max={28}
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Day of the month when payment is due (1-28)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : editingStructure ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{deletingStructure?.name}&quot;. This action
              cannot be undone.
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

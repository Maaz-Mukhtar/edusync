"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  Search,
  Filter,
  Download,
  Eye,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

interface Class {
  id: string;
  name: string;
  sections: { id: string; name: string }[];
}

interface FeeStructure {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  classId: string | null;
}

interface Invoice {
  id: string;
  amount: number;
  dueDate: string;
  paidDate: string | null;
  status: "PENDING" | "PAID" | "OVERDUE";
  paymentMethod: string | null;
  transactionId: string | null;
  remarks: string | null;
  createdAt: string;
  student: {
    id: string;
    user: {
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
  feeStructure: {
    id: string;
    name: string;
  };
}

const statusConfig = {
  PENDING: {
    label: "Pending",
    color: "bg-yellow-100 text-yellow-800",
    icon: Clock,
  },
  PAID: {
    label: "Paid",
    color: "bg-green-100 text-green-800",
    icon: CheckCircle,
  },
  OVERDUE: {
    label: "Overdue",
    color: "bg-red-100 text-red-800",
    icon: AlertCircle,
  },
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Dialog states
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  // Selected invoice for viewing/payment
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Filter states
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Generate form states
  const [selectedFeeStructure, setSelectedFeeStructure] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [dueDate, setDueDate] = useState("");

  // Payment form states
  const [paymentMethod, setPaymentMethod] = useState("");
  const [transactionId, setTransactionId] = useState("");

  const [isGenerating, setIsGenerating] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [invoicesRes, classesRes, feesRes] = await Promise.all([
        fetch("/api/invoices"),
        fetch("/api/classes"),
        fetch("/api/fee-structures"),
      ]);

      const [invoicesData, classesData, feesData] = await Promise.all([
        invoicesRes.json(),
        classesRes.json(),
        feesRes.json(),
      ]);

      if (invoicesRes.ok) setInvoices(invoicesData.invoices);
      if (classesRes.ok) setClasses(classesData.classes);
      if (feesRes.ok) setFeeStructures(feesData.feeStructures);
    } catch {
      toast.error("Failed to fetch data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openGenerateDialog = () => {
    setSelectedFeeStructure("");
    setSelectedClass("");
    setSelectedSection("");
    setDueDate("");
    setGenerateDialogOpen(true);
  };

  const openViewDialog = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setViewDialogOpen(true);
  };

  const openPaymentDialog = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setPaymentMethod("");
    setTransactionId("");
    setPaymentDialogOpen(true);
  };

  const handleGenerate = async () => {
    if (!selectedFeeStructure || !dueDate) {
      toast.error("Please select a fee structure and due date");
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch("/api/invoices", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feeStructureId: selectedFeeStructure,
          dueDate,
          classId: selectedClass || undefined,
          sectionId: selectedSection || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message);
        if (data.skipped > 0) {
          toast.info(`${data.skipped} students already had invoices`);
        }
        setGenerateDialogOpen(false);
        fetchData();
      } else {
        toast.error(data.error || "Failed to generate invoices");
      }
    } catch {
      toast.error("Failed to generate invoices");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleMarkAsPaid = async () => {
    if (!selectedInvoice) return;

    setIsProcessingPayment(true);
    try {
      const response = await fetch(`/api/invoices/${selectedInvoice.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "PAID",
          paymentMethod: paymentMethod || null,
          transactionId: transactionId || null,
        }),
      });

      if (response.ok) {
        toast.success("Payment recorded successfully");
        setPaymentDialogOpen(false);
        setSelectedInvoice(null);
        fetchData();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to record payment");
      }
    } catch {
      toast.error("Failed to record payment");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: "PKR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-PK", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Filter invoices
  const filteredInvoices = invoices.filter((invoice) => {
    const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      `${invoice.student.user.firstName} ${invoice.student.user.lastName}`
        .toLowerCase()
        .includes(searchLower) ||
      invoice.feeStructure.name.toLowerCase().includes(searchLower) ||
      `${invoice.student.section.class.name} ${invoice.student.section.name}`
        .toLowerCase()
        .includes(searchLower);

    return matchesStatus && matchesSearch;
  });

  // Stats
  const pendingTotal = invoices
    .filter((i) => i.status === "PENDING")
    .reduce((sum, i) => sum + i.amount, 0);
  const paidTotal = invoices
    .filter((i) => i.status === "PAID")
    .reduce((sum, i) => sum + i.amount, 0);
  const overdueTotal = invoices
    .filter((i) => i.status === "OVERDUE")
    .reduce((sum, i) => sum + i.amount, 0);

  // Get sections for selected class
  const selectedClassObj = classes.find((c) => c.id === selectedClass);
  const availableSections = selectedClassObj?.sections || [];

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
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground">
            Generate and manage fee invoices
          </p>
        </div>
        <Button onClick={openGenerateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Generate Invoices
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invoices.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(pendingTotal)}</div>
            <p className="text-xs text-muted-foreground">
              {invoices.filter((i) => i.status === "PENDING").length} invoices
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Collected</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(paidTotal)}</div>
            <p className="text-xs text-muted-foreground">
              {invoices.filter((i) => i.status === "PAID").length} invoices
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(overdueTotal)}</div>
            <p className="text-xs text-muted-foreground">
              {invoices.filter((i) => i.status === "OVERDUE").length} invoices
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by student, fee, or class..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="PAID">Paid</SelectItem>
            <SelectItem value="OVERDUE">Overdue</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Invoices Table */}
      {filteredInvoices.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">
              {searchTerm || statusFilter !== "all" ? "No matches found" : "No invoices yet"}
            </h3>
            <p className="text-muted-foreground">
              {searchTerm || statusFilter !== "all"
                ? "Try adjusting your filters"
                : "Get started by generating invoices for students"}
            </p>
            {!searchTerm && statusFilter === "all" && (
              <Button className="mt-4" onClick={openGenerateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Generate Invoices
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Invoice List</CardTitle>
            <CardDescription>
              {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? "s" : ""} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Fee Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice) => {
                  const StatusIcon = statusConfig[invoice.status].icon;
                  return (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">
                        {invoice.student.user.firstName} {invoice.student.user.lastName}
                      </TableCell>
                      <TableCell>
                        {invoice.student.section.class.name} - {invoice.student.section.name}
                      </TableCell>
                      <TableCell>{invoice.feeStructure.name}</TableCell>
                      <TableCell>{formatCurrency(invoice.amount)}</TableCell>
                      <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                      <TableCell>
                        <Badge className={statusConfig[invoice.status].color}>
                          <StatusIcon className="mr-1 h-3 w-3" />
                          {statusConfig[invoice.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openViewDialog(invoice)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {invoice.status !== "PAID" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openPaymentDialog(invoice)}
                            >
                              <CheckCircle className="mr-1 h-4 w-4" />
                              Pay
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Generate Invoices Dialog */}
      <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Invoices</DialogTitle>
            <DialogDescription>
              Create invoices for students based on a fee structure
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Fee Structure *</Label>
              <Select value={selectedFeeStructure} onValueChange={setSelectedFeeStructure}>
                <SelectTrigger>
                  <SelectValue placeholder="Select fee structure" />
                </SelectTrigger>
                <SelectContent>
                  {feeStructures.map((fee) => (
                    <SelectItem key={fee.id} value={fee.id}>
                      {fee.name} - {formatCurrency(fee.amount)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Class (Optional)</Label>
              <Select value={selectedClass} onValueChange={(v) => {
                setSelectedClass(v);
                setSelectedSection("");
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="All classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Classes</SelectItem>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedClass && availableSections.length > 0 && (
              <div className="space-y-2">
                <Label>Section (Optional)</Label>
                <Select value={selectedSection} onValueChange={setSelectedSection}>
                  <SelectTrigger>
                    <SelectValue placeholder="All sections" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Sections</SelectItem>
                    {availableSections.map((section) => (
                      <SelectItem key={section.id} value={section.id}>
                        {section.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date *</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? "Generating..." : "Generate Invoices"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Invoice Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invoice Details</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Student</p>
                  <p className="font-medium">
                    {selectedInvoice.student.user.firstName}{" "}
                    {selectedInvoice.student.user.lastName}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Class</p>
                  <p className="font-medium">
                    {selectedInvoice.student.section.class.name} -{" "}
                    {selectedInvoice.student.section.name}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Fee Type</p>
                  <p className="font-medium">{selectedInvoice.feeStructure.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="font-medium text-lg">
                    {formatCurrency(selectedInvoice.amount)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Due Date</p>
                  <p className="font-medium">{formatDate(selectedInvoice.dueDate)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className={statusConfig[selectedInvoice.status].color}>
                    {statusConfig[selectedInvoice.status].label}
                  </Badge>
                </div>
                {selectedInvoice.paidDate && (
                  <div>
                    <p className="text-sm text-muted-foreground">Paid Date</p>
                    <p className="font-medium">{formatDate(selectedInvoice.paidDate)}</p>
                  </div>
                )}
                {selectedInvoice.paymentMethod && (
                  <div>
                    <p className="text-sm text-muted-foreground">Payment Method</p>
                    <p className="font-medium">{selectedInvoice.paymentMethod}</p>
                  </div>
                )}
                {selectedInvoice.transactionId && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Transaction ID</p>
                    <p className="font-medium">{selectedInvoice.transactionId}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Close
            </Button>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Mark this invoice as paid
            </DialogDescription>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4 py-4">
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm text-muted-foreground">Invoice Amount</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(selectedInvoice.amount)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedInvoice.student.user.firstName}{" "}
                  {selectedInvoice.student.user.lastName} -{" "}
                  {selectedInvoice.feeStructure.name}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Payment Method (Optional)</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="online">Online Payment</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="transactionId">Transaction ID (Optional)</Label>
                <Input
                  id="transactionId"
                  placeholder="e.g., TXN123456"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleMarkAsPaid} disabled={isProcessingPayment}>
              {isProcessingPayment ? "Processing..." : "Confirm Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

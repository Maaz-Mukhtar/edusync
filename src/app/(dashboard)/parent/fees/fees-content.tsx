"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DollarSign, AlertTriangle, CheckCircle2, Clock, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import type { FeesData } from "@/lib/data/parent";

interface FeesContentProps {
  data: FeesData;
}

const STATUS_CONFIG = {
  PENDING: {
    label: "Pending",
    icon: Clock,
    color: "text-yellow-600",
    bgColor: "bg-yellow-100",
    badgeVariant: "secondary" as const,
  },
  PAID: {
    label: "Paid",
    icon: CheckCircle2,
    color: "text-green-600",
    bgColor: "bg-green-100",
    badgeVariant: "default" as const,
  },
  OVERDUE: {
    label: "Overdue",
    icon: AlertTriangle,
    color: "text-red-600",
    bgColor: "bg-red-100",
    badgeVariant: "destructive" as const,
  },
  CANCELLED: {
    label: "Cancelled",
    icon: Clock,
    color: "text-gray-600",
    bgColor: "bg-gray-100",
    badgeVariant: "outline" as const,
  },
};

export default function FeesContent({ data }: FeesContentProps) {
  const [filterChild, setFilterChild] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { invoices, summary, byChild } = data;

  // Filter invoices
  const filteredInvoices = invoices.filter((inv) => {
    if (filterChild !== "all" && inv.studentId !== filterChild) return false;
    if (filterStatus !== "all" && inv.status !== filterStatus) return false;
    return true;
  });

  // Get unique children for filter
  const childrenOptions = byChild.map((c) => ({
    value: c.studentId,
    label: c.childName,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Fees & Payments</h1>
        <p className="text-muted-foreground">
          View and manage fee payments for all your children
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Clock className="h-4 w-4 text-yellow-600" />
              Pending Fees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {formatCurrency(summary.totalPending)}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary.pendingCount} invoice{summary.pendingCount !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              Overdue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(summary.totalOverdue)}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary.overdueCount} invoice{summary.overdueCount !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Total Paid
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(summary.totalPaid)}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary.paidCount} invoice{summary.paidCount !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* By Child Summary */}
      {byChild.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Fees by Child
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {byChild.map((child) => (
                <div
                  key={child.studentId}
                  className="p-4 rounded-lg border"
                >
                  <h4 className="font-medium mb-3">{child.childName}</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Pending</span>
                      <span className="font-medium text-yellow-600">
                        {formatCurrency(child.pending)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Overdue</span>
                      <span className="font-medium text-red-600">
                        {formatCurrency(child.overdue)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Paid</span>
                      <span className="font-medium text-green-600">
                        {formatCurrency(child.paid)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              All Invoices
            </CardTitle>
            <div className="flex gap-2">
              {childrenOptions.length > 1 && (
                <Select value={filterChild} onValueChange={setFilterChild}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Children" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Children</SelectItem>
                    {childrenOptions.map((child) => (
                      <SelectItem key={child.value} value={child.value}>
                        {child.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="OVERDUE">Overdue</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredInvoices.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Child</TableHead>
                  <TableHead>Fee Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Paid Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice) => {
                  const config = STATUS_CONFIG[invoice.status];
                  const StatusIcon = config.icon;
                  const isOverdue = invoice.status === "OVERDUE";

                  return (
                    <TableRow key={invoice.id} className={cn(isOverdue && "bg-red-50")}>
                      <TableCell className="font-medium">
                        {invoice.childName}
                      </TableCell>
                      <TableCell>{invoice.feeType}</TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(invoice.amount)}
                      </TableCell>
                      <TableCell>
                        <span className={cn(isOverdue && "text-red-600 font-medium")}>
                          {new Date(invoice.dueDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={config.badgeVariant} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {invoice.paidDate
                          ? new Date(invoice.paidDate).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No invoices found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

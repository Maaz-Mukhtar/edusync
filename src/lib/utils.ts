import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-PK", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString("en-PK", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 0,
  }).format(amount);
}

export function getInitials(firstName?: string | null, lastName?: string | null): string {
  const first = firstName?.charAt(0) || '';
  const last = lastName?.charAt(0) || '';
  return `${first}${last}`.toUpperCase() || '?';
}

export function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function getSubdomainFromHost(host: string): string | null {
  // Handle localhost with subdomain (e.g., cityschool.localhost:3000)
  if (host.includes("localhost")) {
    const parts = host.split(".");
    if (parts.length > 1 && parts[0] !== "www") {
      return parts[0];
    }
    return null;
  }

  // Handle production domain (e.g., cityschool.edusync.pk)
  const parts = host.split(".");
  if (parts.length >= 3 && parts[0] !== "www") {
    return parts[0];
  }

  return null;
}

export function getRoleDashboardPath(role: string): string {
  const rolePaths: Record<string, string> = {
    SUPER_ADMIN: "/admin",
    ADMIN: "/admin",
    TEACHER: "/teacher",
    STUDENT: "/student",
    PARENT: "/parent",
  };
  return rolePaths[role] || "/";
}

export function getRoleDisplayName(role: string): string {
  const roleNames: Record<string, string> = {
    SUPER_ADMIN: "Super Admin",
    ADMIN: "Administrator",
    TEACHER: "Teacher",
    STUDENT: "Student",
    PARENT: "Parent",
  };
  return roleNames[role] || role;
}

export function getAttendanceStatusColor(status: string): string {
  const colors: Record<string, string> = {
    PRESENT: "bg-green-100 text-green-800",
    ABSENT: "bg-red-100 text-red-800",
    LATE: "bg-yellow-100 text-yellow-800",
    EXCUSED: "bg-blue-100 text-blue-800",
  };
  return colors[status] || "bg-gray-100 text-gray-800";
}

export function getInvoiceStatusColor(status: string): string {
  const colors: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800",
    PAID: "bg-green-100 text-green-800",
    OVERDUE: "bg-red-100 text-red-800",
    CANCELLED: "bg-gray-100 text-gray-800",
  };
  return colors[status] || "bg-gray-100 text-gray-800";
}

export function calculatePercentage(
  obtained: number,
  total: number
): number {
  if (total === 0) return 0;
  return Math.round((obtained / total) * 100);
}

export function getGradeFromPercentage(percentage: number): string {
  if (percentage >= 90) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B";
  if (percentage >= 60) return "C";
  if (percentage >= 50) return "D";
  return "F";
}

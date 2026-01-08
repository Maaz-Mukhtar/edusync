"use client";

import { Sidebar } from "./sidebar";
import { Header } from "./header";
import type { UserRole } from "@prisma/client";

interface DashboardLayoutProps {
  children: React.ReactNode;
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role: UserRole;
    firstName?: string;
    lastName?: string;
  };
  schoolName?: string;
}

export function DashboardLayout({
  children,
  user,
  schoolName,
}: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar - Hidden on mobile */}
      <div className="hidden md:block">
        <Sidebar role={user.role} schoolName={schoolName} />
      </div>

      {/* Main Content */}
      <div className="md:pl-64">
        <Header user={user} schoolName={schoolName} />
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

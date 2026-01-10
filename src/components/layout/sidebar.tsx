"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  Calendar,
  CalendarCheck,
  ClipboardList,
  DollarSign,
  Bell,
  Settings,
  BarChart3,
  FileText,
  Clock,
  CheckSquare,
  MessageSquare,
  Brain,
  School,
  Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@prisma/client";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const adminNavItems: NavItem[] = [
  { title: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { title: "Users", href: "/admin/users", icon: Users },
  { title: "Classes", href: "/admin/classes", icon: School },
  { title: "Subjects", href: "/admin/subjects", icon: BookOpen },
  { title: "Parent Links", href: "/admin/parent-links", icon: Link2 },
  { title: "Fee Management", href: "/admin/fees", icon: DollarSign },
  { title: "Events", href: "/admin/events", icon: CalendarCheck },
  { title: "Announcements", href: "/admin/announcements", icon: Bell },
  { title: "Reports", href: "/admin/reports", icon: BarChart3 },
  { title: "Settings", href: "/admin/settings", icon: Settings },
];

const teacherNavItems: NavItem[] = [
  { title: "Dashboard", href: "/teacher", icon: LayoutDashboard },
  { title: "My Classes", href: "/teacher/classes", icon: School },
  { title: "Attendance", href: "/teacher/attendance", icon: CheckSquare },
  { title: "Gradebook", href: "/teacher/gradebook", icon: ClipboardList },
  { title: "Assessments", href: "/teacher/assessments", icon: FileText },
  { title: "Announcements", href: "/teacher/announcements", icon: Bell },
  { title: "Messages", href: "/teacher/messages", icon: MessageSquare },
  { title: "AI Insights", href: "/teacher/insights", icon: Brain },
];

const studentNavItems: NavItem[] = [
  { title: "Dashboard", href: "/student", icon: LayoutDashboard },
  { title: "Timetable", href: "/student/timetable", icon: Clock },
  { title: "Attendance", href: "/student/attendance", icon: CheckSquare },
  { title: "Grades", href: "/student/grades", icon: GraduationCap },
  { title: "Assignments", href: "/student/assignments", icon: FileText },
  { title: "Calendar", href: "/student/calendar", icon: Calendar },
  { title: "AI Study Help", href: "/student/ai-help", icon: Brain },
  { title: "Announcements", href: "/student/announcements", icon: Bell },
];

const parentNavItems: NavItem[] = [
  { title: "Dashboard", href: "/parent", icon: LayoutDashboard },
  { title: "Attendance", href: "/parent/attendance", icon: CheckSquare },
  { title: "Grades", href: "/parent/grades", icon: GraduationCap },
  { title: "Fees", href: "/parent/fees", icon: DollarSign },
  { title: "Events", href: "/parent/events", icon: CalendarCheck },
  { title: "Calendar", href: "/parent/calendar", icon: Calendar },
  { title: "Messages", href: "/parent/messages", icon: MessageSquare },
  { title: "Announcements", href: "/parent/announcements", icon: Bell },
  { title: "AI Insights", href: "/parent/insights", icon: Brain },
];

const navItemsByRole: Record<string, NavItem[]> = {
  SUPER_ADMIN: adminNavItems,
  ADMIN: adminNavItems,
  TEACHER: teacherNavItems,
  STUDENT: studentNavItems,
  PARENT: parentNavItems,
};

interface SidebarProps {
  role: UserRole;
  schoolName?: string;
}

export function Sidebar({ role, schoolName }: SidebarProps) {
  const pathname = usePathname();
  const navItems = navItemsByRole[role] || [];

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-card">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center border-b px-6">
          <Link href="/" className="flex items-center gap-2">
            <GraduationCap className="h-8 w-8 text-primary" />
            <div className="flex flex-col">
              <span className="font-bold text-lg">EduSync</span>
              {schoolName && (
                <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                  {schoolName}
                </span>
              )}
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href + "/"));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.title}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t p-4">
          <p className="text-xs text-muted-foreground text-center">
            EduSync v1.0
          </p>
        </div>
      </div>
    </aside>
  );
}

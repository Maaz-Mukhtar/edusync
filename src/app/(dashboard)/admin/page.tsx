import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  GraduationCap,
  School,
  DollarSign,
  BookOpen,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  UserPlus,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

async function getDashboardStats(schoolId: string) {
  const [
    totalStudents,
    totalTeachers,
    totalParents,
    totalClasses,
    totalSections,
    totalSubjects,
    pendingInvoices,
    paidInvoices,
    overdueInvoices,
    recentUsers,
    classStudentCounts,
  ] = await Promise.all([
    // Total students
    prisma.user.count({
      where: { schoolId, role: "STUDENT", isActive: true },
    }),
    // Total teachers
    prisma.user.count({
      where: { schoolId, role: "TEACHER", isActive: true },
    }),
    // Total parents
    prisma.user.count({
      where: { schoolId, role: "PARENT", isActive: true },
    }),
    // Total classes
    prisma.class.count({
      where: { schoolId },
    }),
    // Total sections
    prisma.section.count({
      where: { class: { schoolId } },
    }),
    // Total subjects
    prisma.subject.count({
      where: { schoolId },
    }),
    // Pending invoices
    prisma.feeInvoice.aggregate({
      where: {
        status: "PENDING",
        student: { user: { schoolId } },
      },
      _sum: { amount: true },
      _count: true,
    }),
    // Paid invoices
    prisma.feeInvoice.aggregate({
      where: {
        status: "PAID",
        student: { user: { schoolId } },
      },
      _sum: { amount: true },
      _count: true,
    }),
    // Overdue invoices
    prisma.feeInvoice.aggregate({
      where: {
        status: "OVERDUE",
        student: { user: { schoolId } },
      },
      _sum: { amount: true },
      _count: true,
    }),
    // Recent users (last 5)
    prisma.user.findMany({
      where: { schoolId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    // Students per class
    prisma.class.findMany({
      where: { schoolId },
      select: {
        id: true,
        name: true,
        sections: {
          select: {
            _count: {
              select: {
                students: true,
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  // Calculate students per class
  const studentsPerClass = classStudentCounts.map((cls) => ({
    id: cls.id,
    name: cls.name,
    studentCount: cls.sections.reduce(
      (sum, section) => sum + section._count.students,
      0
    ),
  }));

  return {
    totalStudents,
    totalTeachers,
    totalParents,
    totalClasses,
    totalSections,
    totalSubjects,
    fees: {
      pending: {
        count: pendingInvoices._count,
        amount: pendingInvoices._sum.amount || 0,
      },
      paid: {
        count: paidInvoices._count,
        amount: paidInvoices._sum.amount || 0,
      },
      overdue: {
        count: overdueInvoices._count,
        amount: overdueInvoices._sum.amount || 0,
      },
    },
    recentUsers,
    studentsPerClass,
  };
}

const roleColors: Record<string, string> = {
  ADMIN: "bg-purple-100 text-purple-800",
  TEACHER: "bg-blue-100 text-blue-800",
  STUDENT: "bg-green-100 text-green-800",
  PARENT: "bg-orange-100 text-orange-800",
};

export default async function AdminDashboard() {
  const session = await auth();
  if (!session?.user) return null;

  const stats = await getDashboardStats(session.user.schoolId);

  const statCards = [
    {
      title: "Total Students",
      value: stats.totalStudents.toString(),
      icon: GraduationCap,
      description: "Active students enrolled",
      color: "text-blue-600",
      bgColor: "bg-blue-100",
      href: "/admin/users?role=STUDENT",
    },
    {
      title: "Total Teachers",
      value: stats.totalTeachers.toString(),
      icon: Users,
      description: "Active teaching staff",
      color: "text-green-600",
      bgColor: "bg-green-100",
      href: "/admin/users?role=TEACHER",
    },
    {
      title: "Classes & Sections",
      value: `${stats.totalClasses} / ${stats.totalSections}`,
      icon: School,
      description: "Classes and sections",
      color: "text-purple-600",
      bgColor: "bg-purple-100",
      href: "/admin/classes",
    },
    {
      title: "Subjects",
      value: stats.totalSubjects.toString(),
      icon: BookOpen,
      description: "Total subjects",
      color: "text-indigo-600",
      bgColor: "bg-indigo-100",
      href: "/admin/subjects",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here&apos;s an overview of your school.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Link key={stat.title} href={stat.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`rounded-full p-2 ${stat.bgColor}`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Fee Collection Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-green-800">
              Collected Fees
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              {formatCurrency(stats.fees.paid.amount)}
            </div>
            <p className="text-xs text-green-600">
              {stats.fees.paid.count} invoices paid
            </p>
          </CardContent>
        </Card>
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-yellow-800">
              Pending Fees
            </CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-700">
              {formatCurrency(stats.fees.pending.amount)}
            </div>
            <p className="text-xs text-yellow-600">
              {stats.fees.pending.count} invoices pending
            </p>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-red-800">
              Overdue Fees
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">
              {formatCurrency(stats.fees.overdue.amount)}
            </div>
            <p className="text-xs text-red-600">
              {stats.fees.overdue.count} invoices overdue
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              href="/admin/users/new"
              className="block rounded-lg border p-3 hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-3">
                <UserPlus className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Add New User</p>
                  <p className="text-sm text-muted-foreground">
                    Register a student, teacher, or parent
                  </p>
                </div>
              </div>
            </Link>
            <Link
              href="/admin/users/import"
              className="block rounded-lg border p-3 hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Import Users</p>
                  <p className="text-sm text-muted-foreground">
                    Bulk import from CSV file
                  </p>
                </div>
              </div>
            </Link>
            <Link
              href="/admin/fees/invoices"
              className="block rounded-lg border p-3 hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Generate Invoices</p>
                  <p className="text-sm text-muted-foreground">
                    Create fee invoices for students
                  </p>
                </div>
              </div>
            </Link>
          </CardContent>
        </Card>

        {/* Recent Users */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Users</CardTitle>
            <CardDescription>Latest registered users</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.recentUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No users registered yet
              </p>
            ) : (
              <div className="space-y-3">
                {stats.recentUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    <Badge className={roleColors[user.role]}>
                      {user.role}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Students per Class */}
        <Card>
          <CardHeader>
            <CardTitle>Students per Class</CardTitle>
            <CardDescription>Class-wise distribution</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.studentsPerClass.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No classes created yet
              </p>
            ) : (
              <div className="space-y-3">
                {stats.studentsPerClass.map((cls) => {
                  const maxStudents = Math.max(
                    ...stats.studentsPerClass.map((c) => c.studentCount),
                    1
                  );
                  const percentage = (cls.studentCount / maxStudents) * 100;
                  return (
                    <div key={cls.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{cls.name}</span>
                        <span className="text-sm text-muted-foreground">
                          {cls.studentCount} students
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary Footer */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">
                Total Users: {stats.totalStudents + stats.totalTeachers + stats.totalParents}
              </span>
            </div>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <span>{stats.totalStudents} Students</span>
              <span>{stats.totalTeachers} Teachers</span>
              <span>{stats.totalParents} Parents</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

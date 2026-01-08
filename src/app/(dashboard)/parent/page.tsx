import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CheckSquare, DollarSign, Bell } from "lucide-react";
import { formatCurrency, calculatePercentage } from "@/lib/utils";

async function getParentStats(userId: string) {
  const parentProfile = await prisma.parentProfile.findUnique({
    where: { userId },
    include: {
      children: {
        include: {
          student: {
            include: {
              user: { select: { firstName: true, lastName: true } },
              section: { include: { class: true } },
              feeInvoices: { where: { status: "PENDING" } },
              attendances: {
                where: {
                  date: {
                    gte: new Date(
                      new Date().getFullYear(),
                      new Date().getMonth(),
                      1
                    ),
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!parentProfile) {
    return { children: [], totalPendingFees: 0 };
  }

  const children = parentProfile.children.map((child) => {
    const presentDays = child.student.attendances.filter(
      (a) => a.status === "PRESENT" || a.status === "LATE"
    ).length;
    const totalDays = child.student.attendances.length;

    return {
      id: child.student.id,
      name: `${child.student.user.firstName} ${child.student.user.lastName}`,
      class: `${child.student.section.class.name} - ${child.student.section.name}`,
      attendancePercentage: calculatePercentage(presentDays, totalDays),
      pendingFees: child.student.feeInvoices.reduce(
        (acc, inv) => acc + inv.amount,
        0
      ),
    };
  });

  const totalPendingFees = children.reduce((acc, c) => acc + c.pendingFees, 0);

  return { children, totalPendingFees };
}

export default async function ParentDashboard() {
  const session = await auth();
  if (!session?.user) return null;

  const stats = await getParentStats(session.user.id);

  const statCards = [
    {
      title: "Children",
      value: stats.children.length.toString(),
      icon: Users,
      description: "Enrolled children",
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Avg. Attendance",
      value:
        stats.children.length > 0
          ? `${Math.round(
              stats.children.reduce((acc, c) => acc + c.attendancePercentage, 0) /
                stats.children.length
            )}%`
          : "N/A",
      icon: CheckSquare,
      description: "This month",
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Pending Fees",
      value: formatCurrency(stats.totalPendingFees),
      icon: DollarSign,
      description: "Total outstanding",
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
    {
      title: "Notifications",
      value: "0",
      icon: Bell,
      description: "Unread messages",
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here&apos;s an overview of your children&apos;s progress.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
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
        ))}
      </div>

      {/* Children Cards */}
      {stats.children.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Your Children</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {stats.children.map((child) => (
              <Card key={child.id}>
                <CardHeader>
                  <CardTitle>{child.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Class</span>
                    <span className="font-medium">{child.class}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Attendance</span>
                    <span className="font-medium">
                      {child.attendancePercentage}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pending Fees</span>
                    <span className="font-medium">
                      {formatCurrency(child.pendingFees)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Content Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-8">
              No recent activity
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Announcements</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-8">
              No new announcements
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

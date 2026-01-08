import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, ClipboardList, CheckSquare, Clock } from "lucide-react";

async function getTeacherStats(userId: string) {
  const teacherProfile = await prisma.teacherProfile.findUnique({
    where: { userId },
    include: {
      sections: {
        include: {
          section: {
            include: {
              _count: { select: { students: true } },
              class: true,
            },
          },
        },
      },
    },
  });

  if (!teacherProfile) {
    return { totalStudents: 0, totalClasses: 0, sectionsCount: 0 };
  }

  const totalStudents = teacherProfile.sections.reduce(
    (acc, st) => acc + st.section._count.students,
    0
  );

  return {
    totalStudents,
    totalClasses: new Set(teacherProfile.sections.map((st) => st.section.classId))
      .size,
    sectionsCount: teacherProfile.sections.length,
  };
}

export default async function TeacherDashboard() {
  const session = await auth();
  if (!session?.user) return null;

  const stats = await getTeacherStats(session.user.id);

  const statCards = [
    {
      title: "My Students",
      value: stats.totalStudents.toString(),
      icon: Users,
      description: "Students in your classes",
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Classes",
      value: stats.totalClasses.toString(),
      icon: ClipboardList,
      description: "Classes you teach",
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Sections",
      value: stats.sectionsCount.toString(),
      icon: CheckSquare,
      description: "Total sections assigned",
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      title: "Today's Classes",
      value: "0",
      icon: Clock,
      description: "Scheduled for today",
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here&apos;s your teaching overview.
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

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <a
              href="/teacher/attendance"
              className="block rounded-lg border p-3 hover:bg-accent transition-colors"
            >
              <p className="font-medium">Mark Attendance</p>
              <p className="text-sm text-muted-foreground">
                Take attendance for your classes
              </p>
            </a>
            <a
              href="/teacher/gradebook"
              className="block rounded-lg border p-3 hover:bg-accent transition-colors"
            >
              <p className="font-medium">Enter Grades</p>
              <p className="text-sm text-muted-foreground">
                Update student grades
              </p>
            </a>
            <a
              href="/teacher/assessments/new"
              className="block rounded-lg border p-3 hover:bg-accent transition-colors"
            >
              <p className="font-medium">Create Assessment</p>
              <p className="text-sm text-muted-foreground">
                Add a new test or quiz
              </p>
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-8">
              No classes scheduled for today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-8">
              No pending tasks
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

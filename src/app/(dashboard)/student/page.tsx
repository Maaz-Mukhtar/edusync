import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, CheckSquare, GraduationCap, Calendar } from "lucide-react";
import { calculatePercentage } from "@/lib/utils";

async function getStudentStats(userId: string) {
  const studentProfile = await prisma.studentProfile.findUnique({
    where: { userId },
    include: {
      section: {
        include: {
          class: true,
        },
      },
      attendances: {
        where: {
          date: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      },
      results: {
        take: 5,
        orderBy: { assessment: { date: "desc" } },
        include: {
          assessment: {
            select: { title: true, totalMarks: true, subject: true },
          },
        },
      },
    },
  });

  if (!studentProfile) {
    return {
      className: "N/A",
      sectionName: "N/A",
      attendancePercentage: 0,
      recentGrades: [],
    };
  }

  const presentDays = studentProfile.attendances.filter(
    (a) => a.status === "PRESENT" || a.status === "LATE"
  ).length;
  const totalDays = studentProfile.attendances.length;

  return {
    className: studentProfile.section.class.name,
    sectionName: studentProfile.section.name,
    attendancePercentage: calculatePercentage(presentDays, totalDays),
    recentGrades: studentProfile.results,
  };
}

export default async function StudentDashboard() {
  const session = await auth();
  if (!session?.user) return null;

  const stats = await getStudentStats(session.user.id);

  const statCards = [
    {
      title: "Class",
      value: `${stats.className} - ${stats.sectionName}`,
      icon: BookOpen,
      description: "Your current class",
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Attendance",
      value: `${stats.attendancePercentage}%`,
      icon: CheckSquare,
      description: "This month",
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Assessments",
      value: stats.recentGrades.length.toString(),
      icon: GraduationCap,
      description: "Recent assessments",
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      title: "Upcoming",
      value: "0",
      icon: Calendar,
      description: "Events this week",
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here&apos;s your academic overview.
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

      {/* Content Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
            <CardTitle>Recent Grades</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentGrades.length > 0 ? (
              <div className="space-y-2">
                {stats.recentGrades.map((result) => (
                  <div
                    key={result.id}
                    className="flex justify-between items-center border-b pb-2"
                  >
                    <div>
                      <p className="font-medium text-sm">
                        {result.assessment.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {result.assessment.subject.name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">
                        {result.marksObtained}/{result.assessment.totalMarks}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {calculatePercentage(
                          result.marksObtained,
                          result.assessment.totalMarks
                        )}
                        %
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No recent grades
              </p>
            )}
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

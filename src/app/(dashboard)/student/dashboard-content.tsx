"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, CheckSquare, GraduationCap, Calendar, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudentDashboardData } from "@/lib/data/student";

interface DashboardContentProps {
  data: StudentDashboardData;
}

export default function DashboardContent({ data }: DashboardContentProps) {
  const { stats, todaySchedule, recentGrades, announcements } = data;

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
      color: stats.attendancePercentage >= 75 ? "text-green-600" : "text-red-600",
      bgColor: stats.attendancePercentage >= 75 ? "bg-green-100" : "bg-red-100",
    },
    {
      title: "Assessments",
      value: stats.totalAssessments.toString(),
      icon: GraduationCap,
      description: "Recent assessments",
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      title: "Upcoming",
      value: stats.upcomingEvents.toString(),
      icon: Calendar,
      description: "Events this week",
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
  ];

  const getGradeColor = (percentage: number) => {
    if (percentage >= 80) return "text-green-600 bg-green-50";
    if (percentage >= 60) return "text-blue-600 bg-blue-50";
    if (percentage >= 40) return "text-yellow-600 bg-yellow-50";
    return "text-red-600 bg-red-50";
  };

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
        {/* Today's Schedule */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Today&apos;s Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todaySchedule.length > 0 ? (
              <div className="space-y-3">
                {todaySchedule.map((slot) => (
                  <div
                    key={slot.id}
                    className="flex items-center justify-between border-b pb-2 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-1 h-10 rounded-full"
                        style={{ backgroundColor: slot.subjectColor || "#888" }}
                      />
                      <div>
                        <p className="font-medium text-sm">{slot.subject}</p>
                        <p className="text-xs text-muted-foreground">
                          {slot.startTime} - {slot.endTime}
                        </p>
                      </div>
                    </div>
                    {slot.room && (
                      <Badge variant="outline" className="text-xs">
                        {slot.room}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No classes scheduled for today
              </p>
            )}
          </CardContent>
        </Card>

        {/* Recent Grades */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Recent Grades
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentGrades.length > 0 ? (
              <div className="space-y-3">
                {recentGrades.map((grade) => (
                  <div
                    key={grade.id}
                    className="flex justify-between items-center border-b pb-2 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-1 h-10 rounded-full"
                        style={{ backgroundColor: grade.subjectColor || "#888" }}
                      />
                      <div>
                        <p className="font-medium text-sm">{grade.title}</p>
                        <p className="text-xs text-muted-foreground">{grade.subject}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={cn(
                          "font-bold text-sm px-2 py-0.5 rounded",
                          getGradeColor(grade.percentage)
                        )}
                      >
                        {grade.marksObtained}/{grade.totalMarks}
                      </p>
                      <p className="text-xs text-muted-foreground">{grade.percentage}%</p>
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

        {/* Announcements */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Announcements
            </CardTitle>
          </CardHeader>
          <CardContent>
            {announcements.length > 0 ? (
              <div className="space-y-3">
                {announcements.map((announcement) => (
                  <div
                    key={announcement.id}
                    className="border-b pb-2 last:border-0"
                  >
                    <p className="font-medium text-sm">{announcement.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {announcement.content}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(announcement.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No new announcements
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

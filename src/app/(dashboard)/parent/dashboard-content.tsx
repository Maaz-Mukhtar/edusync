"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, CheckSquare, DollarSign, Bell, GraduationCap, Calendar, CalendarCheck, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import type { ParentDashboardData } from "@/lib/data/parent";

interface DashboardContentProps {
  data: ParentDashboardData;
}

export default function DashboardContent({ data }: DashboardContentProps) {
  const { children, stats, announcements, pendingEvents } = data;

  const statCards = [
    {
      title: "Children",
      value: stats.totalChildren.toString(),
      icon: Users,
      description: "Enrolled children",
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Avg. Attendance",
      value: stats.totalChildren > 0 ? `${stats.avgAttendance}%` : "N/A",
      icon: CheckSquare,
      description: "This month",
      color: stats.avgAttendance >= 75 ? "text-green-600" : "text-red-600",
      bgColor: stats.avgAttendance >= 75 ? "bg-green-100" : "bg-red-100",
    },
    {
      title: "Pending Fees",
      value: formatCurrency(stats.totalPendingFees),
      icon: DollarSign,
      description: "Total outstanding",
      color: stats.totalPendingFees > 0 ? "text-orange-600" : "text-green-600",
      bgColor: stats.totalPendingFees > 0 ? "bg-orange-100" : "bg-green-100",
    },
    {
      title: "Notifications",
      value: stats.unreadNotifications.toString(),
      icon: Bell,
      description: "Unread messages",
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      title: "Event Approvals",
      value: stats.pendingEventApprovals.toString(),
      icon: CalendarCheck,
      description: "Pending responses",
      color: stats.pendingEventApprovals > 0 ? "text-amber-600" : "text-green-600",
      bgColor: stats.pendingEventApprovals > 0 ? "bg-amber-100" : "bg-green-100",
    },
  ];

  const getAttendanceColor = (percentage: number) => {
    if (percentage >= 90) return "text-green-600";
    if (percentage >= 75) return "text-yellow-600";
    return "text-red-600";
  };

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
          Welcome back! Here&apos;s an overview of your children&apos;s progress.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
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
      {children.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Your Children</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {children.map((child) => (
              <Card key={child.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between">
                    <span>{child.name}</span>
                    <Badge variant="outline">
                      {child.className} - {child.sectionName}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <CheckSquare className="h-4 w-4" />
                      Attendance
                    </span>
                    <span className={cn("font-medium", getAttendanceColor(child.attendancePercentage))}>
                      {child.attendancePercentage}%
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <DollarSign className="h-4 w-4" />
                      Pending Fees
                    </span>
                    <span className={cn("font-medium", child.pendingFees > 0 ? "text-orange-600" : "text-green-600")}>
                      {formatCurrency(child.pendingFees)}
                    </span>
                  </div>

                  {child.recentGrade && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <GraduationCap className="h-4 w-4" />
                        Latest Grade
                      </span>
                      <div className="text-right">
                        <span className={cn("font-medium px-2 py-0.5 rounded text-sm", getGradeColor(child.recentGrade.percentage))}>
                          {child.recentGrade.percentage}%
                        </span>
                        <p className="text-xs text-muted-foreground">{child.recentGrade.subject}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Link
                      href={`/parent/attendance?child=${child.studentId}`}
                      className="flex-1 text-center text-sm py-1.5 px-3 rounded-md bg-secondary hover:bg-secondary/80 transition-colors"
                    >
                      Attendance
                    </Link>
                    <Link
                      href={`/parent/grades?child=${child.studentId}`}
                      className="flex-1 text-center text-sm py-1.5 px-3 rounded-md bg-secondary hover:bg-secondary/80 transition-colors"
                    >
                      Grades
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Pending Event Approvals */}
      {pendingEvents.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <AlertTriangle className="h-5 w-5" />
              Action Required: Event Approvals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingEvents.map((event) => (
                <div
                  key={event.eventId}
                  className={cn(
                    "flex items-start justify-between p-3 rounded-lg border",
                    event.isUrgent ? "bg-red-50 border-red-200" : "bg-white border-gray-200"
                  )}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{event.eventTitle}</span>
                      <Badge variant="outline" className="text-xs">
                        {event.eventType}
                      </Badge>
                      {event.isUrgent && (
                        <Badge variant="destructive" className="text-xs">
                          Urgent
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      For: {event.childrenPending.join(", ")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Deadline: {new Date(event.deadline).toLocaleDateString()}
                    </p>
                  </div>
                  <Link
                    href="/parent/events"
                    className="text-sm px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    Respond
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Content Grid */}
      <div className="grid gap-4 md:grid-cols-2">
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
                  <div key={announcement.id} className="border-b pb-3 last:border-0">
                    <p className="font-medium text-sm">{announcement.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              href="/parent/fees"
              className="block w-full text-center py-2 px-4 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              View All Fees
            </Link>
            <Link
              href="/parent/attendance"
              className="block w-full text-center py-2 px-4 rounded-md bg-secondary hover:bg-secondary/80 transition-colors"
            >
              View Attendance
            </Link>
            <Link
              href="/parent/grades"
              className="block w-full text-center py-2 px-4 rounded-md bg-secondary hover:bg-secondary/80 transition-colors"
            >
              View Grades
            </Link>
            <Link
              href="/parent/events"
              className="block w-full text-center py-2 px-4 rounded-md bg-secondary hover:bg-secondary/80 transition-colors"
            >
              View Events
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

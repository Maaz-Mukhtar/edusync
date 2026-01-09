"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  BookOpen,
  CheckSquare,
  Clock,
  FileText,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import type { DashboardData } from "@/lib/data/teacher";

interface TeacherDashboardContentProps {
  data: DashboardData;
}

export function TeacherDashboardContent({ data }: TeacherDashboardContentProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Teacher Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here&apos;s your overview for today.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">My Classes</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.assignedSections}</div>
            <p className="text-xs text-muted-foreground">Assigned sections</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.totalStudents}</div>
            <p className="text-xs text-muted-foreground">Across all classes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Today&apos;s Classes</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.todayClasses}</div>
            <p className="text-xs text-muted-foreground">Scheduled for today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.stats.pendingAttendance + data.stats.assessmentsToGrade}
            </div>
            <p className="text-xs text-muted-foreground">
              {data.stats.pendingAttendance} attendance, {data.stats.assessmentsToGrade} grading
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Today's Schedule */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Today&apos;s Schedule
            </CardTitle>
            <CardDescription>Your classes for today</CardDescription>
          </CardHeader>
          <CardContent>
            {data.todaySchedule.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No classes scheduled for today
              </p>
            ) : (
              <div className="space-y-3">
                {data.todaySchedule.map((slot) => (
                  <div
                    key={slot.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-medium">
                        {slot.startTime} - {slot.endTime}
                      </div>
                      <div>
                        <div className="font-medium">{slot.section}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: slot.subjectColor || "#888" }}
                          />
                          {slot.subject}
                        </div>
                      </div>
                    </div>
                    {slot.room && (
                      <Badge variant="outline">Room {slot.room}</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Attendance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5" />
              Pending Attendance
            </CardTitle>
            <CardDescription>Classes awaiting attendance today</CardDescription>
          </CardHeader>
          <CardContent>
            {data.pendingAttendance.length === 0 ? (
              <div className="text-center py-4">
                <CheckSquare className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  All attendance marked for today!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.pendingAttendance.map((item) => (
                  <div
                    key={item.sectionId}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div>
                      <div className="font-medium">{item.section}</div>
                      <div className="text-sm text-muted-foreground">
                        {item.studentCount} students
                      </div>
                    </div>
                    <Link href={`/teacher/attendance?section=${item.sectionId}`}>
                      <Button size="sm">
                        Mark Now
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Assessments */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Recent Assessments
              </CardTitle>
              <CardDescription>Your latest tests and quizzes</CardDescription>
            </div>
            <Link href="/teacher/assessments">
              <Button variant="outline" size="sm">
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {data.recentAssessments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No assessments created yet
            </p>
          ) : (
            <div className="space-y-3">
              {data.recentAssessments.map((assessment) => (
                <div
                  key={assessment.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="font-medium">{assessment.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {assessment.section} • {assessment.subject}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{assessment.type}</Badge>
                    <div className="text-sm text-muted-foreground">
                      {assessment.gradedCount} graded
                    </div>
                    <Link href={`/teacher/assessments/${assessment.id}`}>
                      <Button size="sm" variant="ghost">
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

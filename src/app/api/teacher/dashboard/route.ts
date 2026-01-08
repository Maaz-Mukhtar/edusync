import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/teacher/dashboard - Get teacher dashboard stats
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "TEACHER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get teacher profile
    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!teacherProfile) {
      return NextResponse.json({ error: "Teacher profile not found" }, { status: 404 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay();

    // Run queries in parallel
    const [
      assignedSections,
      todaySchedule,
      pendingAttendance,
      recentAssessments,
      totalStudents,
    ] = await Promise.all([
      // Get assigned sections count
      prisma.sectionTeacher.count({
        where: { teacherId: teacherProfile.id },
      }),

      // Get today's schedule
      prisma.timetableSlot.findMany({
        where: {
          section: {
            teachers: {
              some: { teacherId: teacherProfile.id },
            },
          },
          dayOfWeek,
        },
        include: {
          section: {
            include: {
              class: true,
            },
          },
          subject: true,
        },
        orderBy: { startTime: "asc" },
      }),

      // Get sections without attendance today
      prisma.sectionTeacher.findMany({
        where: {
          teacherId: teacherProfile.id,
          section: {
            attendances: {
              none: {
                date: today,
              },
            },
          },
        },
        include: {
          section: {
            include: {
              class: true,
              _count: {
                select: { students: true },
              },
            },
          },
        },
      }),

      // Get recent assessments by this teacher
      prisma.assessment.findMany({
        where: { createdById: teacherProfile.id },
        include: {
          section: {
            include: {
              class: true,
              _count: {
                select: { students: true },
              },
            },
          },
          subject: true,
          _count: {
            select: { results: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),

      // Get total students across assigned sections
      prisma.studentProfile.count({
        where: {
          section: {
            teachers: {
              some: { teacherId: teacherProfile.id },
            },
          },
        },
      }),
    ]);

    // Calculate assessments needing grading
    const assessmentsNeedingGrading = recentAssessments.filter(
      (a) => a._count.results < (a.section._count?.students || 0)
    );

    return NextResponse.json({
      stats: {
        assignedSections,
        totalStudents,
        todayClasses: todaySchedule.length,
        pendingAttendance: pendingAttendance.length,
        assessmentsToGrade: assessmentsNeedingGrading.length,
      },
      todaySchedule: todaySchedule.map((slot) => ({
        id: slot.id,
        startTime: slot.startTime,
        endTime: slot.endTime,
        room: slot.room,
        section: `${slot.section.class.name} - ${slot.section.name}`,
        subject: slot.subject.name,
        subjectColor: slot.subject.color,
      })),
      pendingAttendance: pendingAttendance.map((st) => ({
        sectionId: st.section.id,
        section: `${st.section.class.name} - ${st.section.name}`,
        studentCount: st.section._count.students,
      })),
      recentAssessments: recentAssessments.map((a) => ({
        id: a.id,
        title: a.title,
        type: a.type,
        section: `${a.section.class.name} - ${a.section.name}`,
        subject: a.subject.name,
        date: a.date,
        gradedCount: a._count.results,
        totalMarks: a.totalMarks,
      })),
    });
  } catch (error) {
    console.error("Error fetching teacher dashboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}

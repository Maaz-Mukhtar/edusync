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

    // Get sections where teacher is class teacher
    const classTeacherSections = await prisma.sectionTeacher.findMany({
      where: { teacherId: teacherProfile.id },
      select: { sectionId: true },
    });

    // Get sections where teacher teaches subjects
    const subjectTeacherSections = await prisma.sectionSubjectTeacher.findMany({
      where: { teacherId: teacherProfile.id },
      select: { sectionId: true },
    });

    // Combine section IDs
    const allSectionIds = [...new Set([
      ...classTeacherSections.map(s => s.sectionId),
      ...subjectTeacherSections.map(s => s.sectionId),
    ])];

    // Run queries in parallel
    const [
      todaySchedule,
      pendingAttendanceSections,
      recentAssessments,
      totalStudents,
    ] = await Promise.all([
      // Get today's schedule for teacher's sections
      prisma.timetableSlot.findMany({
        where: {
          sectionId: { in: allSectionIds },
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
      prisma.section.findMany({
        where: {
          id: { in: allSectionIds },
          attendances: {
            none: {
              date: today,
            },
          },
        },
        include: {
          class: true,
          _count: {
            select: { students: true },
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
          sectionId: { in: allSectionIds },
        },
      }),
    ]);

    // Calculate assessments needing grading
    const assessmentsNeedingGrading = recentAssessments.filter(
      (a) => a._count.results < (a.section._count?.students || 0)
    );

    return NextResponse.json({
      stats: {
        assignedSections: allSectionIds.length,
        totalStudents,
        todayClasses: todaySchedule.length,
        pendingAttendance: pendingAttendanceSections.length,
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
      pendingAttendance: pendingAttendanceSections.map((section) => ({
        sectionId: section.id,
        section: `${section.class.name} - ${section.name}`,
        studentCount: section._count.students,
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

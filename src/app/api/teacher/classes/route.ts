import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/teacher/classes - Get teacher's assigned classes/sections
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

    // Get sections where teacher is class teacher
    const classTeacherSections = await prisma.sectionTeacher.findMany({
      where: { teacherId: teacherProfile.id },
      include: {
        section: {
          include: {
            class: true,
            students: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    avatar: true,
                  },
                },
              },
              orderBy: { rollNumber: "asc" },
            },
            _count: {
              select: { students: true },
            },
          },
        },
      },
    });

    // Get sections where teacher teaches subjects
    const subjectTeacherSections = await prisma.sectionSubjectTeacher.findMany({
      where: { teacherId: teacherProfile.id },
      include: {
        section: {
          include: {
            class: true,
            students: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    avatar: true,
                  },
                },
              },
              orderBy: { rollNumber: "asc" },
            },
            _count: {
              select: { students: true },
            },
          },
        },
      },
    });

    // Combine and deduplicate sections
    const allSections = new Map<string, { section: typeof classTeacherSections[0]["section"]; isClassTeacher: boolean }>();

    for (const ct of classTeacherSections) {
      allSections.set(ct.sectionId, { section: ct.section, isClassTeacher: true });
    }

    for (const st of subjectTeacherSections) {
      if (!allSections.has(st.sectionId)) {
        allSections.set(st.sectionId, { section: st.section, isClassTeacher: false });
      }
    }

    // Sort sections
    const sectionsArray = Array.from(allSections.values())
      .sort((a, b) => {
        const orderDiff = a.section.class.displayOrder - b.section.class.displayOrder;
        if (orderDiff !== 0) return orderDiff;
        return a.section.name.localeCompare(b.section.name);
      });

    // Get subjects taught by this teacher
    const subjectsTaught = await prisma.teacherSubject.findMany({
      where: { teacherId: teacherProfile.id },
      include: {
        subject: true,
      },
    });

    return NextResponse.json({
      sections: sectionsArray.map((item) => ({
        id: item.section.id,
        name: item.section.name,
        className: item.section.class.name,
        classId: item.section.class.id,
        isClassTeacher: item.isClassTeacher,
        capacity: item.section.capacity,
        studentCount: item.section._count.students,
        students: item.section.students.map((s) => ({
          id: s.id,
          rollNumber: s.rollNumber,
          userId: s.user.id,
          firstName: s.user.firstName,
          lastName: s.user.lastName,
          email: s.user.email,
          avatar: s.user.avatar,
        })),
      })),
      subjects: subjectsTaught.map((ts) => ({
        id: ts.subject.id,
        name: ts.subject.name,
        code: ts.subject.code,
        color: ts.subject.color,
      })),
    });
  } catch (error) {
    console.error("Error fetching teacher classes:", error);
    return NextResponse.json(
      { error: "Failed to fetch classes" },
      { status: 500 }
    );
  }
}

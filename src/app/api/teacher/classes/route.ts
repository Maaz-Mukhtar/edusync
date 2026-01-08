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

    // Get assigned sections with details
    const assignedSections = await prisma.sectionTeacher.findMany({
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
      orderBy: [
        { section: { class: { displayOrder: "asc" } } },
        { section: { name: "asc" } },
      ],
    });

    // Get subjects taught by this teacher
    const subjectsTaught = await prisma.teacherSubject.findMany({
      where: { teacherId: teacherProfile.id },
      include: {
        subject: true,
      },
    });

    return NextResponse.json({
      sections: assignedSections.map((st) => ({
        id: st.section.id,
        name: st.section.name,
        className: st.section.class.name,
        classId: st.section.class.id,
        isClassTeacher: st.isClassTeacher,
        capacity: st.section.capacity,
        studentCount: st.section._count.students,
        students: st.section.students.map((s) => ({
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

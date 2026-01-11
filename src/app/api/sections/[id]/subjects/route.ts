import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const assignTeacherSchema = z.object({
  subjectId: z.string().min(1),
  teacherId: z.string().min(1),
});

// GET /api/sections/[id]/subjects - Get all subjects and their assigned teachers for a section
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: sectionId } = await params;

    // Get section with class info
    const section = await prisma.section.findFirst({
      where: {
        id: sectionId,
        class: {
          schoolId: session.user.schoolId,
        },
      },
      include: {
        class: {
          include: {
            subjects: {
              include: {
                teachers: {
                  include: {
                    teacher: {
                      include: {
                        user: {
                          select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        subjectTeachers: {
          include: {
            subject: true,
            teacher: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
        classTeacher: {
          include: {
            teacher: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    // Build subject list with assigned teachers
    const subjectAssignments = section.class.subjects.map((subject) => {
      const assignment = section.subjectTeachers.find(
        (st) => st.subjectId === subject.id
      );

      // Get available teachers (those assigned to teach this subject at class level)
      const availableTeachers = subject.teachers.map((t) => ({
        id: t.teacherId,
        firstName: t.teacher.user.firstName,
        lastName: t.teacher.user.lastName,
      }));

      return {
        subjectId: subject.id,
        subjectName: subject.name,
        subjectCode: subject.code,
        subjectColor: subject.color,
        assignedTeacher: assignment
          ? {
              id: assignment.teacherId,
              firstName: assignment.teacher.user.firstName,
              lastName: assignment.teacher.user.lastName,
            }
          : null,
        availableTeachers,
      };
    });

    return NextResponse.json({
      section: {
        id: section.id,
        name: section.name,
        className: section.class.name,
        classTeacher: section.classTeacher
          ? {
              id: section.classTeacher.teacherId,
              firstName: section.classTeacher.teacher.user.firstName,
              lastName: section.classTeacher.teacher.user.lastName,
            }
          : null,
      },
      subjectAssignments,
    });
  } catch (error) {
    console.error("Error fetching section subjects:", error);
    return NextResponse.json(
      { error: "Failed to fetch section subjects" },
      { status: 500 }
    );
  }
}

// POST /api/sections/[id]/subjects - Assign a teacher to teach a subject in this section
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: sectionId } = await params;
    const body = await request.json();
    const { subjectId, teacherId } = assignTeacherSchema.parse(body);

    // Get section with class info
    const section = await prisma.section.findFirst({
      where: {
        id: sectionId,
        class: {
          schoolId: session.user.schoolId,
        },
      },
      include: {
        class: true,
      },
    });

    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    // Verify subject belongs to this class
    const subject = await prisma.subject.findFirst({
      where: {
        id: subjectId,
        classId: section.classId,
      },
    });

    if (!subject) {
      return NextResponse.json(
        { error: "Subject not found in this class" },
        { status: 404 }
      );
    }

    // Verify teacher is assigned to teach this subject (at class level)
    const teacherSubject = await prisma.teacherSubject.findUnique({
      where: {
        teacherId_subjectId: {
          teacherId,
          subjectId,
        },
      },
    });

    if (!teacherSubject) {
      return NextResponse.json(
        { error: "Teacher is not assigned to teach this subject" },
        { status: 400 }
      );
    }

    // Upsert the section subject teacher assignment
    const assignment = await prisma.sectionSubjectTeacher.upsert({
      where: {
        sectionId_subjectId: {
          sectionId,
          subjectId,
        },
      },
      update: {
        teacherId,
      },
      create: {
        sectionId,
        subjectId,
        teacherId,
      },
      include: {
        teacher: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        subject: true,
      },
    });

    return NextResponse.json({ assignment }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error assigning section subject teacher:", error);
    return NextResponse.json(
      { error: "Failed to assign teacher" },
      { status: 500 }
    );
  }
}

// DELETE /api/sections/[id]/subjects - Remove teacher assignment from a subject in this section
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: sectionId } = await params;
    const { searchParams } = new URL(request.url);
    const subjectId = searchParams.get("subjectId");

    if (!subjectId) {
      return NextResponse.json(
        { error: "subjectId is required" },
        { status: 400 }
      );
    }

    // Verify section belongs to user's school
    const section = await prisma.section.findFirst({
      where: {
        id: sectionId,
        class: {
          schoolId: session.user.schoolId,
        },
      },
    });

    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    // Delete the assignment
    await prisma.sectionSubjectTeacher.delete({
      where: {
        sectionId_subjectId: {
          sectionId,
          subjectId,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing section subject teacher:", error);
    return NextResponse.json(
      { error: "Failed to remove teacher" },
      { status: 500 }
    );
  }
}

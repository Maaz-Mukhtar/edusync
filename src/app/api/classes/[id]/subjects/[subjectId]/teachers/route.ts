import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const assignTeacherSchema = z.object({
  teacherId: z.string().min(1),
});

// GET /api/classes/[id]/subjects/[subjectId]/teachers - Get teachers assigned to a subject
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; subjectId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: classId, subjectId } = await params;

    // Verify subject exists and belongs to same school
    const subject = await prisma.subject.findFirst({
      where: {
        id: subjectId,
        classId,
        class: {
          schoolId: session.user.schoolId,
        },
      },
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
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!subject) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }

    const teachers = subject.teachers.map((ts) => ({
      id: ts.id,
      teacherId: ts.teacherId,
      teacher: {
        id: ts.teacher.id,
        userId: ts.teacher.userId,
        firstName: ts.teacher.user.firstName,
        lastName: ts.teacher.user.lastName,
        email: ts.teacher.user.email,
      },
    }));

    return NextResponse.json({ teachers });
  } catch (error) {
    console.error("Error fetching subject teachers:", error);
    return NextResponse.json(
      { error: "Failed to fetch teachers" },
      { status: 500 }
    );
  }
}

// POST /api/classes/[id]/subjects/[subjectId]/teachers - Assign a teacher to a subject
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; subjectId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: classId, subjectId } = await params;
    const body = await request.json();
    const { teacherId } = assignTeacherSchema.parse(body);

    // Verify subject exists and belongs to same school
    const subject = await prisma.subject.findFirst({
      where: {
        id: subjectId,
        classId,
        class: {
          schoolId: session.user.schoolId,
        },
      },
    });

    if (!subject) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }

    // Verify teacher exists and belongs to same school
    const teacher = await prisma.teacherProfile.findFirst({
      where: {
        id: teacherId,
        user: {
          schoolId: session.user.schoolId,
        },
      },
    });

    if (!teacher) {
      return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    }

    // Check if assignment already exists
    const existingAssignment = await prisma.teacherSubject.findUnique({
      where: {
        teacherId_subjectId: {
          teacherId,
          subjectId,
        },
      },
    });

    if (existingAssignment) {
      return NextResponse.json(
        { error: "Teacher is already assigned to this subject" },
        { status: 400 }
      );
    }

    const assignment = await prisma.teacherSubject.create({
      data: {
        teacherId,
        subjectId,
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
    console.error("Error assigning teacher:", error);
    return NextResponse.json(
      { error: "Failed to assign teacher" },
      { status: 500 }
    );
  }
}

// DELETE /api/classes/[id]/subjects/[subjectId]/teachers - Remove a teacher from a subject
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; subjectId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: classId, subjectId } = await params;
    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get("teacherId");

    if (!teacherId) {
      return NextResponse.json(
        { error: "teacherId is required" },
        { status: 400 }
      );
    }

    // Verify subject exists and belongs to same school
    const subject = await prisma.subject.findFirst({
      where: {
        id: subjectId,
        classId,
        class: {
          schoolId: session.user.schoolId,
        },
      },
    });

    if (!subject) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }

    // Delete the assignment
    await prisma.teacherSubject.delete({
      where: {
        teacherId_subjectId: {
          teacherId,
          subjectId,
        },
      },
    });

    // Also remove any section-level assignments for this teacher-subject combination
    await prisma.sectionSubjectTeacher.deleteMany({
      where: {
        teacherId,
        subjectId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing teacher:", error);
    return NextResponse.json(
      { error: "Failed to remove teacher" },
      { status: 500 }
    );
  }
}

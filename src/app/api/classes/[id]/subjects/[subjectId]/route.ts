import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const updateSubjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  code: z.string().max(20).optional().nullable(),
  color: z.string().max(20).optional().nullable(),
});

// GET /api/classes/[id]/subjects/[subjectId] - Get a single subject
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

    const subject = await prisma.subject.findFirst({
      where: {
        id: subjectId,
        classId,
        class: {
          schoolId: session.user.schoolId,
        },
      },
      include: {
        class: {
          select: {
            id: true,
            name: true,
          },
        },
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
        sectionTeachers: {
          include: {
            section: {
              select: {
                id: true,
                name: true,
              },
            },
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

    if (!subject) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }

    return NextResponse.json({
      subject: {
        id: subject.id,
        name: subject.name,
        code: subject.code,
        color: subject.color,
        class: subject.class,
        teachers: subject.teachers.map((t) => ({
          id: t.id,
          teacherId: t.teacherId,
          firstName: t.teacher.user.firstName,
          lastName: t.teacher.user.lastName,
          email: t.teacher.user.email,
        })),
        sectionTeachers: subject.sectionTeachers.map((st) => ({
          id: st.id,
          section: st.section,
          teacher: {
            id: st.teacherId,
            firstName: st.teacher.user.firstName,
            lastName: st.teacher.user.lastName,
          },
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching subject:", error);
    return NextResponse.json(
      { error: "Failed to fetch subject" },
      { status: 500 }
    );
  }
}

// PUT /api/classes/[id]/subjects/[subjectId] - Update a subject
export async function PUT(
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
    const data = updateSubjectSchema.parse(body);

    // Verify subject exists and belongs to same school
    const existingSubject = await prisma.subject.findFirst({
      where: {
        id: subjectId,
        classId,
        class: {
          schoolId: session.user.schoolId,
        },
      },
    });

    if (!existingSubject) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }

    // Check if new name conflicts with existing subject in same class
    if (data.name && data.name !== existingSubject.name) {
      const nameConflict = await prisma.subject.findUnique({
        where: {
          classId_name: {
            classId,
            name: data.name,
          },
        },
      });

      if (nameConflict) {
        return NextResponse.json(
          { error: "Subject with this name already exists in this class" },
          { status: 400 }
        );
      }
    }

    const subject = await prisma.subject.update({
      where: { id: subjectId },
      data: {
        name: data.name,
        code: data.code,
        color: data.color,
      },
    });

    return NextResponse.json({ subject });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error updating subject:", error);
    return NextResponse.json(
      { error: "Failed to update subject" },
      { status: 500 }
    );
  }
}

// DELETE /api/classes/[id]/subjects/[subjectId] - Delete a subject
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

    await prisma.subject.delete({
      where: { id: subjectId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting subject:", error);
    return NextResponse.json(
      { error: "Failed to delete subject" },
      { status: 500 }
    );
  }
}

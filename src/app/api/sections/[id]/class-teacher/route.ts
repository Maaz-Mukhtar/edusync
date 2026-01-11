import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const assignClassTeacherSchema = z.object({
  teacherId: z.string().min(1),
});

// GET /api/sections/[id]/class-teacher - Get class teacher for a section
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

    const section = await prisma.section.findFirst({
      where: {
        id: sectionId,
        class: {
          schoolId: session.user.schoolId,
        },
      },
      include: {
        classTeacher: {
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

    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    return NextResponse.json({
      classTeacher: section.classTeacher
        ? {
            id: section.classTeacher.id,
            teacherId: section.classTeacher.teacherId,
            teacher: {
              id: section.classTeacher.teacher.id,
              userId: section.classTeacher.teacher.userId,
              firstName: section.classTeacher.teacher.user.firstName,
              lastName: section.classTeacher.teacher.user.lastName,
              email: section.classTeacher.teacher.user.email,
            },
          }
        : null,
    });
  } catch (error) {
    console.error("Error fetching class teacher:", error);
    return NextResponse.json(
      { error: "Failed to fetch class teacher" },
      { status: 500 }
    );
  }
}

// POST /api/sections/[id]/class-teacher - Assign class teacher to a section
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
    const { teacherId } = assignClassTeacherSchema.parse(body);

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

    // Upsert class teacher (since sectionId is unique, this replaces any existing assignment)
    const assignment = await prisma.sectionTeacher.upsert({
      where: {
        sectionId,
      },
      update: {
        teacherId,
      },
      create: {
        sectionId,
        teacherId,
      },
      include: {
        teacher: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ classTeacher: assignment }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error assigning class teacher:", error);
    return NextResponse.json(
      { error: "Failed to assign class teacher" },
      { status: 500 }
    );
  }
}

// DELETE /api/sections/[id]/class-teacher - Remove class teacher from a section
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

    // Delete class teacher assignment
    await prisma.sectionTeacher.delete({
      where: {
        sectionId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing class teacher:", error);
    return NextResponse.json(
      { error: "Failed to remove class teacher" },
      { status: 500 }
    );
  }
}

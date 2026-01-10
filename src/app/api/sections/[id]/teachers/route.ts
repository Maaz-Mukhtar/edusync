import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const assignTeacherSchema = z.object({
  teacherId: z.string().min(1),
  isClassTeacher: z.boolean().optional().default(false),
});

// GET /api/sections/[id]/teachers - Get teachers assigned to a section
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check if section exists and belongs to same school
    const section = await prisma.section.findFirst({
      where: {
        id,
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

    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    const teachers = section.teachers.map((st) => ({
      id: st.id,
      teacherId: st.teacherId,
      isClassTeacher: st.isClassTeacher,
      teacher: {
        id: st.teacher.id,
        userId: st.teacher.userId,
        firstName: st.teacher.user.firstName,
        lastName: st.teacher.user.lastName,
        email: st.teacher.user.email,
      },
    }));

    return NextResponse.json({ teachers });
  } catch (error) {
    console.error("Error fetching section teachers:", error);
    return NextResponse.json(
      { error: "Failed to fetch teachers" },
      { status: 500 }
    );
  }
}

// POST /api/sections/[id]/teachers - Assign a teacher to a section
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

    const { id } = await params;
    const body = await request.json();
    const { teacherId, isClassTeacher } = assignTeacherSchema.parse(body);

    // Check if section exists and belongs to same school
    const section = await prisma.section.findFirst({
      where: {
        id,
        class: {
          schoolId: session.user.schoolId,
        },
      },
    });

    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    // Check if teacher exists and belongs to same school
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
    const existingAssignment = await prisma.sectionTeacher.findUnique({
      where: {
        sectionId_teacherId: {
          sectionId: id,
          teacherId,
        },
      },
    });

    if (existingAssignment) {
      return NextResponse.json(
        { error: "Teacher is already assigned to this section" },
        { status: 400 }
      );
    }

    // If setting as class teacher, remove existing class teacher first
    if (isClassTeacher) {
      await prisma.sectionTeacher.updateMany({
        where: {
          sectionId: id,
          isClassTeacher: true,
        },
        data: {
          isClassTeacher: false,
        },
      });
    }

    const assignment = await prisma.sectionTeacher.create({
      data: {
        sectionId: id,
        teacherId,
        isClassTeacher,
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

// DELETE /api/sections/[id]/teachers - Remove a teacher from a section
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

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get("teacherId");

    if (!teacherId) {
      return NextResponse.json(
        { error: "teacherId is required" },
        { status: 400 }
      );
    }

    // Check if section exists and belongs to same school
    const section = await prisma.section.findFirst({
      where: {
        id,
        class: {
          schoolId: session.user.schoolId,
        },
      },
    });

    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    // Delete the assignment
    await prisma.sectionTeacher.delete({
      where: {
        sectionId_teacherId: {
          sectionId: id,
          teacherId,
        },
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

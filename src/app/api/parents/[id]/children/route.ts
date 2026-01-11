import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const linkChildrenSchema = z.object({
  studentIds: z.array(z.string()),
});

// GET /api/parents/[id]/children - Get available students to link
export async function GET(
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

    // Get the parent profile
    const parent = await prisma.user.findFirst({
      where: {
        id,
        schoolId: session.user.schoolId,
        role: "PARENT",
      },
      include: {
        parentProfile: {
          include: {
            children: {
              select: { studentId: true },
            },
          },
        },
      },
    });

    if (!parent || !parent.parentProfile) {
      return NextResponse.json({ error: "Parent not found" }, { status: 404 });
    }

    const linkedStudentIds = parent.parentProfile.children.map((c) => c.studentId);

    // Get all students that can be linked
    const availableStudents = await prisma.studentProfile.findMany({
      where: {
        id: { notIn: linkedStudentIds },
        user: { schoolId: session.user.schoolId },
      },
      include: {
        user: {
          select: { firstName: true, lastName: true },
        },
        section: {
          include: {
            class: true,
          },
        },
      },
      orderBy: [
        { section: { class: { name: "asc" } } },
        { section: { name: "asc" } },
        { user: { firstName: "asc" } },
      ],
    });

    return NextResponse.json({ students: availableStudents });
  } catch (error) {
    console.error("Error fetching available students:", error);
    return NextResponse.json(
      { error: "Failed to fetch students" },
      { status: 500 }
    );
  }
}

// POST /api/parents/[id]/children - Link children to parent
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
    const { studentIds } = linkChildrenSchema.parse(body);

    // Get the parent profile
    const parent = await prisma.user.findFirst({
      where: {
        id,
        schoolId: session.user.schoolId,
        role: "PARENT",
      },
      include: {
        parentProfile: true,
      },
    });

    if (!parent || !parent.parentProfile) {
      return NextResponse.json({ error: "Parent not found" }, { status: 404 });
    }

    // Verify all students exist and belong to the same school
    const students = await prisma.studentProfile.findMany({
      where: {
        id: { in: studentIds },
        user: { schoolId: session.user.schoolId },
      },
    });

    if (students.length !== studentIds.length) {
      return NextResponse.json(
        { error: "Some students were not found" },
        { status: 400 }
      );
    }

    // Create the parent-student relationships
    await prisma.parentStudent.createMany({
      data: studentIds.map((studentId) => ({
        parentId: parent.parentProfile!.id,
        studentId,
      })),
      skipDuplicates: true,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error linking children:", error);
    return NextResponse.json(
      { error: "Failed to link children" },
      { status: 500 }
    );
  }
}

// DELETE /api/parents/[id]/children - Unlink a child from parent
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
    const body = await request.json();
    const { studentId } = body;

    if (!studentId) {
      return NextResponse.json(
        { error: "Student ID is required" },
        { status: 400 }
      );
    }

    // Get the parent profile
    const parent = await prisma.user.findFirst({
      where: {
        id,
        schoolId: session.user.schoolId,
        role: "PARENT",
      },
      include: {
        parentProfile: true,
      },
    });

    if (!parent || !parent.parentProfile) {
      return NextResponse.json({ error: "Parent not found" }, { status: 404 });
    }

    // Delete the parent-student relationship
    await prisma.parentStudent.deleteMany({
      where: {
        parentId: parent.parentProfile.id,
        studentId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error unlinking child:", error);
    return NextResponse.json(
      { error: "Failed to unlink child" },
      { status: 500 }
    );
  }
}

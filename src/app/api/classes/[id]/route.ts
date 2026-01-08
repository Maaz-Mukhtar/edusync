import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const updateClassSchema = z.object({
  name: z.string().min(1).optional(),
  displayOrder: z.number().optional(),
});

// GET /api/classes/[id] - Get a single class
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

    const classData = await prisma.class.findFirst({
      where: {
        id,
        schoolId: session.user.schoolId,
      },
      include: {
        sections: {
          include: {
            _count: {
              select: {
                students: true,
                teachers: true,
              },
            },
          },
          orderBy: { name: "asc" },
        },
      },
    });

    if (!classData) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    return NextResponse.json({ class: classData });
  } catch (error) {
    console.error("Error fetching class:", error);
    return NextResponse.json(
      { error: "Failed to fetch class" },
      { status: 500 }
    );
  }
}

// PUT /api/classes/[id] - Update a class
export async function PUT(
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
    const validatedData = updateClassSchema.parse(body);

    // Check if class exists and belongs to same school
    const existingClass = await prisma.class.findFirst({
      where: {
        id,
        schoolId: session.user.schoolId,
      },
    });

    if (!existingClass) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    // Check for duplicate name
    if (validatedData.name && validatedData.name !== existingClass.name) {
      const duplicate = await prisma.class.findFirst({
        where: {
          id: { not: id },
          schoolId: session.user.schoolId,
          name: validatedData.name,
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: "A class with this name already exists" },
          { status: 400 }
        );
      }
    }

    const updatedClass = await prisma.class.update({
      where: { id },
      data: validatedData,
      include: {
        sections: true,
      },
    });

    return NextResponse.json({ class: updatedClass });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error updating class:", error);
    return NextResponse.json(
      { error: "Failed to update class" },
      { status: 500 }
    );
  }
}

// DELETE /api/classes/[id] - Delete a class
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

    // Check if class exists and belongs to same school
    const existingClass = await prisma.class.findFirst({
      where: {
        id,
        schoolId: session.user.schoolId,
      },
      include: {
        sections: {
          include: {
            _count: {
              select: { students: true },
            },
          },
        },
      },
    });

    if (!existingClass) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    // Check if any section has students
    const hasStudents = existingClass.sections.some(
      (section) => section._count.students > 0
    );

    if (hasStudents) {
      return NextResponse.json(
        { error: "Cannot delete class with students. Remove students first." },
        { status: 400 }
      );
    }

    // Delete class (cascades to sections)
    await prisma.class.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting class:", error);
    return NextResponse.json(
      { error: "Failed to delete class" },
      { status: 500 }
    );
  }
}

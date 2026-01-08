import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const updateSectionSchema = z.object({
  name: z.string().min(1).optional(),
  capacity: z.number().optional().nullable(),
});

// PUT /api/sections/[id] - Update a section
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
    const validatedData = updateSectionSchema.parse(body);

    // Check if section exists and belongs to same school
    const existingSection = await prisma.section.findFirst({
      where: {
        id,
        class: {
          schoolId: session.user.schoolId,
        },
      },
    });

    if (!existingSection) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    // Check for duplicate name in same class
    if (validatedData.name && validatedData.name !== existingSection.name) {
      const duplicate = await prisma.section.findFirst({
        where: {
          id: { not: id },
          classId: existingSection.classId,
          name: validatedData.name,
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: "A section with this name already exists in this class" },
          { status: 400 }
        );
      }
    }

    const section = await prisma.section.update({
      where: { id },
      data: validatedData,
    });

    return NextResponse.json({ section });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error updating section:", error);
    return NextResponse.json(
      { error: "Failed to update section" },
      { status: 500 }
    );
  }
}

// DELETE /api/sections/[id] - Delete a section
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

    // Check if section exists and belongs to same school
    const existingSection = await prisma.section.findFirst({
      where: {
        id,
        class: {
          schoolId: session.user.schoolId,
        },
      },
      include: {
        _count: {
          select: { students: true },
        },
      },
    });

    if (!existingSection) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    // Check if section has students
    if (existingSection._count.students > 0) {
      return NextResponse.json(
        { error: "Cannot delete section with students. Move or remove students first." },
        { status: 400 }
      );
    }

    await prisma.section.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting section:", error);
    return NextResponse.json(
      { error: "Failed to delete section" },
      { status: 500 }
    );
  }
}

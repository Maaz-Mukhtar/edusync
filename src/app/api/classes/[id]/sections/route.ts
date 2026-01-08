import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const createSectionSchema = z.object({
  name: z.string().min(1, "Name is required"),
  capacity: z.number().optional(),
});

// POST /api/classes/[id]/sections - Create a new section in a class
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

    const { id: classId } = await params;
    const body = await request.json();
    const validatedData = createSectionSchema.parse(body);

    // Check if class exists and belongs to same school
    const existingClass = await prisma.class.findFirst({
      where: {
        id: classId,
        schoolId: session.user.schoolId,
      },
    });

    if (!existingClass) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    // Check for existing section with same name
    const existingSection = await prisma.section.findFirst({
      where: {
        classId,
        name: validatedData.name,
      },
    });

    if (existingSection) {
      return NextResponse.json(
        { error: "A section with this name already exists in this class" },
        { status: 400 }
      );
    }

    const section = await prisma.section.create({
      data: {
        classId,
        name: validatedData.name,
        capacity: validatedData.capacity,
      },
    });

    return NextResponse.json({ section }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error creating section:", error);
    return NextResponse.json(
      { error: "Failed to create section" },
      { status: 500 }
    );
  }
}

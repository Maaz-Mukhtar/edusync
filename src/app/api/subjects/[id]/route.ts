import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const updateSubjectSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
});

// GET /api/subjects/[id] - Get a single subject
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

    const subject = await prisma.subject.findFirst({
      where: {
        id,
        schoolId: session.user.schoolId,
      },
      include: {
        teachers: {
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
        },
        _count: {
          select: {
            assessments: true,
          },
        },
      },
    });

    if (!subject) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }

    return NextResponse.json({ subject });
  } catch (error) {
    console.error("Error fetching subject:", error);
    return NextResponse.json(
      { error: "Failed to fetch subject" },
      { status: 500 }
    );
  }
}

// PUT /api/subjects/[id] - Update a subject
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
    const validatedData = updateSubjectSchema.parse(body);

    // Check if subject exists and belongs to same school
    const existingSubject = await prisma.subject.findFirst({
      where: {
        id,
        schoolId: session.user.schoolId,
      },
    });

    if (!existingSubject) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }

    // Check for duplicate name
    if (validatedData.name && validatedData.name !== existingSubject.name) {
      const duplicate = await prisma.subject.findFirst({
        where: {
          id: { not: id },
          schoolId: session.user.schoolId,
          name: validatedData.name,
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: "A subject with this name already exists" },
          { status: 400 }
        );
      }
    }

    const subject = await prisma.subject.update({
      where: { id },
      data: validatedData,
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

// DELETE /api/subjects/[id] - Delete a subject
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

    // Check if subject exists and belongs to same school
    const existingSubject = await prisma.subject.findFirst({
      where: {
        id,
        schoolId: session.user.schoolId,
      },
      include: {
        _count: {
          select: {
            assessments: true,
          },
        },
      },
    });

    if (!existingSubject) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }

    // Check if subject has assessments
    if (existingSubject._count.assessments > 0) {
      return NextResponse.json(
        { error: "Cannot delete subject with existing assessments" },
        { status: 400 }
      );
    }

    await prisma.subject.delete({
      where: { id },
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

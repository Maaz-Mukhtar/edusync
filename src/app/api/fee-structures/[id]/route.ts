import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const updateFeeStructureSchema = z.object({
  name: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  frequency: z.enum(["MONTHLY", "QUARTERLY", "ANNUAL"]).optional(),
  classId: z.string().optional().nullable(),
  dueDay: z.number().min(1).max(28).optional().nullable(),
});

// GET /api/fee-structures/[id] - Get a single fee structure
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

    const feeStructure = await prisma.feeStructure.findFirst({
      where: {
        id,
        schoolId: session.user.schoolId,
      },
      include: {
        class: true,
        _count: {
          select: {
            invoices: true,
          },
        },
      },
    });

    if (!feeStructure) {
      return NextResponse.json({ error: "Fee structure not found" }, { status: 404 });
    }

    return NextResponse.json({ feeStructure });
  } catch (error) {
    console.error("Error fetching fee structure:", error);
    return NextResponse.json(
      { error: "Failed to fetch fee structure" },
      { status: 500 }
    );
  }
}

// PUT /api/fee-structures/[id] - Update a fee structure
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
    const validatedData = updateFeeStructureSchema.parse(body);

    // Check if fee structure exists and belongs to same school
    const existingStructure = await prisma.feeStructure.findFirst({
      where: {
        id,
        schoolId: session.user.schoolId,
      },
    });

    if (!existingStructure) {
      return NextResponse.json({ error: "Fee structure not found" }, { status: 404 });
    }

    // If classId is provided, verify it exists
    if (validatedData.classId) {
      const classExists = await prisma.class.findFirst({
        where: {
          id: validatedData.classId,
          schoolId: session.user.schoolId,
        },
      });

      if (!classExists) {
        return NextResponse.json({ error: "Class not found" }, { status: 404 });
      }
    }

    const feeStructure = await prisma.feeStructure.update({
      where: { id },
      data: validatedData,
      include: {
        class: true,
      },
    });

    return NextResponse.json({ feeStructure });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error updating fee structure:", error);
    return NextResponse.json(
      { error: "Failed to update fee structure" },
      { status: 500 }
    );
  }
}

// DELETE /api/fee-structures/[id] - Delete a fee structure
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

    // Check if fee structure exists and belongs to same school
    const existingStructure = await prisma.feeStructure.findFirst({
      where: {
        id,
        schoolId: session.user.schoolId,
      },
      include: {
        _count: {
          select: {
            invoices: true,
          },
        },
      },
    });

    if (!existingStructure) {
      return NextResponse.json({ error: "Fee structure not found" }, { status: 404 });
    }

    // Check if fee structure has invoices
    if (existingStructure._count.invoices > 0) {
      return NextResponse.json(
        { error: "Cannot delete fee structure with existing invoices" },
        { status: 400 }
      );
    }

    await prisma.feeStructure.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting fee structure:", error);
    return NextResponse.json(
      { error: "Failed to delete fee structure" },
      { status: 500 }
    );
  }
}

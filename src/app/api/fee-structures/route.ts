import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const createFeeStructureSchema = z.object({
  name: z.string().min(1, "Name is required"),
  amount: z.number().positive("Amount must be positive"),
  frequency: z.enum(["MONTHLY", "QUARTERLY", "ANNUAL"]),
  classId: z.string().optional().nullable(),
  dueDay: z.number().min(1).max(28).optional().nullable(),
});

// GET /api/fee-structures - List all fee structures
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const feeStructures = await prisma.feeStructure.findMany({
      where: {
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
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ feeStructures });
  } catch (error) {
    console.error("Error fetching fee structures:", error);
    return NextResponse.json(
      { error: "Failed to fetch fee structures" },
      { status: 500 }
    );
  }
}

// POST /api/fee-structures - Create a new fee structure
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createFeeStructureSchema.parse(body);

    // If classId is provided, verify it exists and belongs to same school
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

    const feeStructure = await prisma.feeStructure.create({
      data: {
        schoolId: session.user.schoolId,
        name: validatedData.name,
        amount: validatedData.amount,
        frequency: validatedData.frequency,
        classId: validatedData.classId || null,
        dueDay: validatedData.dueDay || null,
      },
      include: {
        class: true,
      },
    });

    return NextResponse.json({ feeStructure }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error creating fee structure:", error);
    return NextResponse.json(
      { error: "Failed to create fee structure" },
      { status: 500 }
    );
  }
}

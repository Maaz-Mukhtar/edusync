import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const updateInvoiceSchema = z.object({
  status: z.enum(["PENDING", "PAID", "OVERDUE"]).optional(),
  paidDate: z.string().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
  transactionId: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
});

// GET /api/invoices/[id] - Get a single invoice
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

    const invoice = await prisma.feeInvoice.findFirst({
      where: {
        id,
        student: {
          user: {
            schoolId: session.user.schoolId,
          },
        },
      },
      include: {
        student: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            section: {
              include: {
                class: true,
              },
            },
          },
        },
        feeStructure: true,
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    return NextResponse.json({ invoice });
  } catch (error) {
    console.error("Error fetching invoice:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoice" },
      { status: 500 }
    );
  }
}

// PUT /api/invoices/[id] - Update an invoice (mark as paid, etc.)
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
    const validatedData = updateInvoiceSchema.parse(body);

    // Check if invoice exists and belongs to same school
    const existingInvoice = await prisma.feeInvoice.findFirst({
      where: {
        id,
        student: {
          user: {
            schoolId: session.user.schoolId,
          },
        },
      },
    });

    if (!existingInvoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // If marking as paid, set the paid date
    const { paidDate: paidDateStr, ...restData } = validatedData;
    const updateData: {
      status?: "PENDING" | "PAID" | "OVERDUE";
      paidDate?: Date | null;
      paymentMethod?: string | null;
      transactionId?: string | null;
      remarks?: string | null;
    } = { ...restData };

    if (validatedData.status === "PAID" && !paidDateStr) {
      updateData.paidDate = new Date();
    } else if (paidDateStr) {
      updateData.paidDate = new Date(paidDateStr);
    }

    const invoice = await prisma.feeInvoice.update({
      where: { id },
      data: updateData,
      include: {
        student: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        feeStructure: true,
      },
    });

    return NextResponse.json({ invoice });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error updating invoice:", error);
    return NextResponse.json(
      { error: "Failed to update invoice" },
      { status: 500 }
    );
  }
}

// DELETE /api/invoices/[id] - Delete an invoice
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

    // Check if invoice exists and belongs to same school
    const existingInvoice = await prisma.feeInvoice.findFirst({
      where: {
        id,
        student: {
          user: {
            schoolId: session.user.schoolId,
          },
        },
      },
    });

    if (!existingInvoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    await prisma.feeInvoice.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting invoice:", error);
    return NextResponse.json(
      { error: "Failed to delete invoice" },
      { status: 500 }
    );
  }
}

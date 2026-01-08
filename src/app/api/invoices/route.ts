import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const createInvoiceSchema = z.object({
  studentId: z.string().min(1, "Student ID is required"),
  feeStructureId: z.string().min(1, "Fee structure ID is required"),
  amount: z.number().positive("Amount must be positive"),
  dueDate: z.string().min(1, "Due date is required"),
  remarks: z.string().optional().nullable(),
});

const bulkCreateInvoiceSchema = z.object({
  feeStructureId: z.string().min(1, "Fee structure ID is required"),
  dueDate: z.string().min(1, "Due date is required"),
  classId: z.string().optional(),
  sectionId: z.string().optional(),
});

// GET /api/invoices - List all invoices
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const studentId = searchParams.get("studentId");

    const invoices = await prisma.feeInvoice.findMany({
      where: {
        ...(status ? { status: status as "PENDING" | "PAID" | "OVERDUE" } : {}),
        ...(studentId ? { studentId } : {}),
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
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ invoices });
  } catch (error) {
    console.error("Error fetching invoices:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoices" },
      { status: 500 }
    );
  }
}

// POST /api/invoices - Create a single invoice
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
    const validatedData = createInvoiceSchema.parse(body);

    // Verify student exists and belongs to same school
    const student = await prisma.studentProfile.findFirst({
      where: {
        id: validatedData.studentId,
        user: {
          schoolId: session.user.schoolId,
        },
      },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    // Verify fee structure exists and belongs to same school
    const feeStructure = await prisma.feeStructure.findFirst({
      where: {
        id: validatedData.feeStructureId,
        schoolId: session.user.schoolId,
      },
    });

    if (!feeStructure) {
      return NextResponse.json({ error: "Fee structure not found" }, { status: 404 });
    }

    const invoice = await prisma.feeInvoice.create({
      data: {
        studentId: validatedData.studentId,
        feeStructureId: validatedData.feeStructureId,
        amount: validatedData.amount,
        dueDate: new Date(validatedData.dueDate),
        remarks: validatedData.remarks || null,
      },
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

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error creating invoice:", error);
    return NextResponse.json(
      { error: "Failed to create invoice" },
      { status: 500 }
    );
  }
}

// PUT /api/invoices/bulk - Generate invoices for multiple students
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = bulkCreateInvoiceSchema.parse(body);

    // Verify fee structure exists and belongs to same school
    const feeStructure = await prisma.feeStructure.findFirst({
      where: {
        id: validatedData.feeStructureId,
        schoolId: session.user.schoolId,
      },
    });

    if (!feeStructure) {
      return NextResponse.json({ error: "Fee structure not found" }, { status: 404 });
    }

    // Build student filter
    interface StudentFilter {
      user: { schoolId: string };
      sectionId?: string;
      section?: { classId: string };
    }

    const studentFilter: StudentFilter = {
      user: {
        schoolId: session.user.schoolId,
      },
    };

    if (validatedData.sectionId) {
      studentFilter.sectionId = validatedData.sectionId;
    } else if (validatedData.classId) {
      studentFilter.section = { classId: validatedData.classId };
    } else if (feeStructure.classId) {
      studentFilter.section = { classId: feeStructure.classId };
    }

    // Get all students matching the filter
    const students = await prisma.studentProfile.findMany({
      where: studentFilter,
      select: { id: true },
    });

    if (students.length === 0) {
      return NextResponse.json(
        { error: "No students found matching the criteria" },
        { status: 400 }
      );
    }

    // Check for existing invoices in the same period to avoid duplicates
    const dueDate = new Date(validatedData.dueDate);
    const startOfMonth = new Date(dueDate.getFullYear(), dueDate.getMonth(), 1);
    const endOfMonth = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0);

    const existingInvoices = await prisma.feeInvoice.findMany({
      where: {
        feeStructureId: validatedData.feeStructureId,
        studentId: { in: students.map((s) => s.id) },
        dueDate: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      select: { studentId: true },
    });

    const existingStudentIds = new Set(existingInvoices.map((i) => i.studentId));
    const newStudentIds = students.filter((s) => !existingStudentIds.has(s.id));

    if (newStudentIds.length === 0) {
      return NextResponse.json(
        { error: "Invoices already exist for all selected students in this period" },
        { status: 400 }
      );
    }

    // Create invoices for all students
    const invoices = await prisma.feeInvoice.createMany({
      data: newStudentIds.map((student) => ({
        studentId: student.id,
        feeStructureId: validatedData.feeStructureId,
        amount: feeStructure.amount,
        dueDate: new Date(validatedData.dueDate),
      })),
    });

    return NextResponse.json({
      message: `Successfully created ${invoices.count} invoices`,
      count: invoices.count,
      skipped: existingStudentIds.size,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error generating invoices:", error);
    return NextResponse.json(
      { error: "Failed to generate invoices" },
      { status: 500 }
    );
  }
}

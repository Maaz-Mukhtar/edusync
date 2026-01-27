import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { revalidateTag } from "next/cache";

// GET /api/academic-years/[id] - Get a specific academic year
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

    const academicYear = await prisma.academicYear.findFirst({
      where: {
        id,
        schoolId: session.user.schoolId,
      },
      include: {
        terms: {
          orderBy: { startDate: "asc" },
        },
        _count: {
          select: {
            enrollments: true,
          },
        },
      },
    });

    if (!academicYear) {
      return NextResponse.json(
        { error: "Academic year not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(academicYear);
  } catch (error) {
    console.error("Error fetching academic year:", error);
    return NextResponse.json(
      { error: "Failed to fetch academic year" },
      { status: 500 }
    );
  }
}

const updateAcademicYearSchema = z.object({
  name: z.string().min(1).optional(),
  startDate: z.string().transform((str) => new Date(str)).optional(),
  endDate: z.string().transform((str) => new Date(str)).optional(),
  isCurrent: z.boolean().optional(),
});

// PUT /api/academic-years/[id] - Update an academic year
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

    // Verify academic year exists and belongs to school
    const existing = await prisma.academicYear.findFirst({
      where: {
        id,
        schoolId: session.user.schoolId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Academic year not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const data = updateAcademicYearSchema.parse(body);

    // Validate dates if both are provided
    const startDate = data.startDate || existing.startDate;
    const endDate = data.endDate || existing.endDate;

    if (endDate <= startDate) {
      return NextResponse.json(
        { error: "End date must be after start date" },
        { status: 400 }
      );
    }

    // Check for overlapping academic years (excluding current one)
    const overlapping = await prisma.academicYear.findFirst({
      where: {
        schoolId: session.user.schoolId,
        id: { not: id },
        OR: [
          {
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
        ],
      },
    });

    if (overlapping) {
      return NextResponse.json(
        { error: `Dates overlap with existing academic year: ${overlapping.name}` },
        { status: 400 }
      );
    }

    // If setting as current, unset other current years
    if (data.isCurrent) {
      await prisma.academicYear.updateMany({
        where: {
          schoolId: session.user.schoolId,
          id: { not: id },
          isCurrent: true,
        },
        data: {
          isCurrent: false,
        },
      });
    }

    const academicYear = await prisma.academicYear.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.startDate && { startDate: data.startDate }),
        ...(data.endDate && { endDate: data.endDate }),
        ...(data.isCurrent !== undefined && { isCurrent: data.isCurrent }),
      },
    });

    if (data.isCurrent !== undefined) {
      revalidateTag("teacher-timetable", "max");
      revalidateTag("student-timetable", "max");
      revalidateTag("teacher-dashboard", "max");
      revalidateTag("student-dashboard", "max");
    }

    return NextResponse.json(academicYear);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error updating academic year:", error);
    return NextResponse.json(
      { error: "Failed to update academic year" },
      { status: 500 }
    );
  }
}

// DELETE /api/academic-years/[id] - Delete an academic year
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

    // Verify academic year exists and belongs to school
    const existing = await prisma.academicYear.findFirst({
      where: {
        id,
        schoolId: session.user.schoolId,
      },
      include: {
        _count: {
          select: {
            enrollments: true,
            terms: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Academic year not found" },
        { status: 404 }
      );
    }

    // Check if there are enrollments
    if (existing._count.enrollments > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${existing._count.enrollments} student enrollments exist for this academic year` },
        { status: 400 }
      );
    }

    await prisma.academicYear.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting academic year:", error);
    return NextResponse.json(
      { error: "Failed to delete academic year" },
      { status: 500 }
    );
  }
}

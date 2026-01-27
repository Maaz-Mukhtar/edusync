import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { revalidateTag } from "next/cache";

// GET /api/academic-years - Get all academic years for the school
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const academicYears = await prisma.academicYear.findMany({
      where: {
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
      orderBy: {
        startDate: "desc",
      },
    });

    return NextResponse.json(academicYears);
  } catch (error) {
    console.error("Error fetching academic years:", error);
    return NextResponse.json(
      { error: "Failed to fetch academic years" },
      { status: 500 }
    );
  }
}

const createAcademicYearSchema = z.object({
  name: z.string().min(1, "Name is required"),
  startDate: z.string().transform((str) => new Date(str)),
  endDate: z.string().transform((str) => new Date(str)),
  isCurrent: z.boolean().optional().default(false),
});

// POST /api/academic-years - Create a new academic year
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
    const data = createAcademicYearSchema.parse(body);

    // Validate dates
    if (data.endDate <= data.startDate) {
      return NextResponse.json(
        { error: "End date must be after start date" },
        { status: 400 }
      );
    }

    // Check for overlapping academic years
    const overlapping = await prisma.academicYear.findFirst({
      where: {
        schoolId: session.user.schoolId,
        OR: [
          {
            startDate: { lte: data.endDate },
            endDate: { gte: data.startDate },
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

    // If this is set as current, unset other current years
    if (data.isCurrent) {
      await prisma.academicYear.updateMany({
        where: {
          schoolId: session.user.schoolId,
          isCurrent: true,
        },
        data: {
          isCurrent: false,
        },
      });
    }

    const academicYear = await prisma.academicYear.create({
      data: {
        schoolId: session.user.schoolId,
        name: data.name,
        startDate: data.startDate,
        endDate: data.endDate,
        isCurrent: data.isCurrent,
      },
    });

    if (data.isCurrent) {
      revalidateTag("teacher-timetable", "max");
      revalidateTag("student-timetable", "max");
      revalidateTag("teacher-dashboard", "max");
      revalidateTag("student-dashboard", "max");
    }

    return NextResponse.json(academicYear, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error creating academic year:", error);
    return NextResponse.json(
      { error: "Failed to create academic year" },
      { status: 500 }
    );
  }
}

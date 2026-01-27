import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { revalidateTag } from "next/cache";

// POST /api/academic-years/[id]/set-current - Set an academic year as current
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

    // Use transaction to update both
    await prisma.$transaction([
      // Unset all current years for this school
      prisma.academicYear.updateMany({
        where: {
          schoolId: session.user.schoolId,
          isCurrent: true,
        },
        data: {
          isCurrent: false,
        },
      }),
      // Set this one as current
      prisma.academicYear.update({
        where: { id },
        data: { isCurrent: true },
      }),
    ]);

    // Current year affects term resolution used by dashboards/timetables.
    revalidateTag("teacher-timetable", "max");
    revalidateTag("student-timetable", "max");
    revalidateTag("teacher-dashboard", "max");
    revalidateTag("student-dashboard", "max");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error setting current academic year:", error);
    return NextResponse.json(
      { error: "Failed to set current academic year" },
      { status: 500 }
    );
  }
}

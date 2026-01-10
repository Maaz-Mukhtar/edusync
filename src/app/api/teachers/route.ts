import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/teachers - List all teachers in the school
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const teachers = await prisma.teacherProfile.findMany({
      where: {
        user: {
          schoolId: session.user.schoolId,
          isActive: true,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        user: {
          firstName: "asc",
        },
      },
    });

    return NextResponse.json({
      teachers: teachers.map((t) => ({
        id: t.id,
        userId: t.userId,
        employeeId: t.employeeId,
        firstName: t.user.firstName,
        lastName: t.user.lastName,
        email: t.user.email,
      })),
    });
  } catch (error) {
    console.error("Error fetching teachers:", error);
    return NextResponse.json(
      { error: "Failed to fetch teachers" },
      { status: 500 }
    );
  }
}

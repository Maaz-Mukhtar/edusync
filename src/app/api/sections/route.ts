import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/sections - List all sections
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");

    const where: Record<string, unknown> = {};

    if (classId) {
      where.classId = classId;
    } else {
      // Filter by school through class
      where.class = {
        schoolId: session.user.schoolId,
      };
    }

    const sections = await prisma.section.findMany({
      where,
      include: {
        class: {
          select: {
            id: true,
            name: true,
            displayOrder: true,
          },
        },
        _count: {
          select: {
            students: true,
          },
        },
      },
      orderBy: [
        { class: { displayOrder: "asc" } },
        { name: "asc" },
      ],
    });

    return NextResponse.json({ sections });
  } catch (error) {
    console.error("Error fetching sections:", error);
    return NextResponse.json(
      { error: "Failed to fetch sections" },
      { status: 500 }
    );
  }
}

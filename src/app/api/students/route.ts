import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/students - List all students
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const students = await prisma.studentProfile.findMany({
      where: {
        user: {
          schoolId: session.user.schoolId,
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
        section: {
          include: {
            class: true,
          },
        },
        parents: {
          include: {
            parent: {
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
      },
      orderBy: [
        {
          section: {
            class: {
              name: "asc",
            },
          },
        },
        {
          user: {
            firstName: "asc",
          },
        },
      ],
    });

    return NextResponse.json({ students });
  } catch (error) {
    console.error("Error fetching students:", error);
    return NextResponse.json(
      { error: "Failed to fetch students" },
      { status: 500 }
    );
  }
}

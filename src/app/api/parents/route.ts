import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/parents - List all parents
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parents = await prisma.parentProfile.findMany({
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
            phone: true,
          },
        },
        children: {
          include: {
            student: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
                section: {
                  include: {
                    class: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        user: {
          firstName: "asc",
        },
      },
    });

    return NextResponse.json({ parents });
  } catch (error) {
    console.error("Error fetching parents:", error);
    return NextResponse.json(
      { error: "Failed to fetch parents" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const createLinkSchema = z.object({
  parentId: z.string().min(1, "Parent ID is required"),
  studentId: z.string().min(1, "Student ID is required"),
});

// GET /api/parent-students - List all parent-student links
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const parentId = searchParams.get("parentId");
    const studentId = searchParams.get("studentId");

    const links = await prisma.parentStudent.findMany({
      where: {
        ...(parentId ? { parentId } : {}),
        ...(studentId ? { studentId } : {}),
        parent: {
          user: {
            schoolId: session.user.schoolId,
          },
        },
      },
      include: {
        parent: {
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
          },
        },
        student: {
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
          },
        },
      },
      orderBy: {
        parent: {
          user: {
            firstName: "asc",
          },
        },
      },
    });

    return NextResponse.json({ links });
  } catch (error) {
    console.error("Error fetching parent-student links:", error);
    return NextResponse.json(
      { error: "Failed to fetch parent-student links" },
      { status: 500 }
    );
  }
}

// POST /api/parent-students - Create a new parent-student link
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
    const validatedData = createLinkSchema.parse(body);

    // Verify parent exists and belongs to same school
    const parent = await prisma.parentProfile.findFirst({
      where: {
        id: validatedData.parentId,
        user: {
          schoolId: session.user.schoolId,
        },
      },
    });

    if (!parent) {
      return NextResponse.json({ error: "Parent not found" }, { status: 404 });
    }

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

    // Check if link already exists
    const existingLink = await prisma.parentStudent.findFirst({
      where: {
        parentId: validatedData.parentId,
        studentId: validatedData.studentId,
      },
    });

    if (existingLink) {
      return NextResponse.json(
        { error: "This parent is already linked to this student" },
        { status: 400 }
      );
    }

    const link = await prisma.parentStudent.create({
      data: {
        parentId: validatedData.parentId,
        studentId: validatedData.studentId,
      },
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
      },
    });

    return NextResponse.json({ link }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error creating parent-student link:", error);
    return NextResponse.json(
      { error: "Failed to create parent-student link" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const createClassSchema = z.object({
  name: z.string().min(1, "Name is required"),
  displayOrder: z.number().optional(),
  sections: z.array(z.object({
    name: z.string().min(1),
    capacity: z.number().optional(),
  })).optional(),
});

// GET /api/classes - List all classes
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const classes = await prisma.class.findMany({
      where: {
        schoolId: session.user.schoolId,
      },
      include: {
        sections: {
          include: {
            _count: {
              select: {
                students: true,
                teachers: true,
              },
            },
          },
          orderBy: { name: "asc" },
        },
        _count: {
          select: {
            sections: true,
          },
        },
      },
      orderBy: { displayOrder: "asc" },
    });

    return NextResponse.json({ classes });
  } catch (error) {
    console.error("Error fetching classes:", error);
    return NextResponse.json(
      { error: "Failed to fetch classes" },
      { status: 500 }
    );
  }
}

// POST /api/classes - Create a new class
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
    const validatedData = createClassSchema.parse(body);

    // Check for existing class with same name
    const existingClass = await prisma.class.findFirst({
      where: {
        schoolId: session.user.schoolId,
        name: validatedData.name,
      },
    });

    if (existingClass) {
      return NextResponse.json(
        { error: "A class with this name already exists" },
        { status: 400 }
      );
    }

    // Get the highest display order
    const lastClass = await prisma.class.findFirst({
      where: { schoolId: session.user.schoolId },
      orderBy: { displayOrder: "desc" },
    });

    const newClass = await prisma.class.create({
      data: {
        schoolId: session.user.schoolId,
        name: validatedData.name,
        displayOrder: validatedData.displayOrder ?? (lastClass?.displayOrder ?? 0) + 1,
        ...(validatedData.sections && validatedData.sections.length > 0
          ? {
              sections: {
                create: validatedData.sections.map((section) => ({
                  name: section.name,
                  capacity: section.capacity,
                })),
              },
            }
          : {}),
      },
      include: {
        sections: true,
      },
    });

    return NextResponse.json({ class: newClass }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error creating class:", error);
    return NextResponse.json(
      { error: "Failed to create class" },
      { status: 500 }
    );
  }
}

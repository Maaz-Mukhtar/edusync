import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const createSubjectSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
});

// GET /api/subjects - List all subjects
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const subjects = await prisma.subject.findMany({
      where: {
        schoolId: session.user.schoolId,
      },
      include: {
        _count: {
          select: {
            teachers: true,
            assessments: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ subjects });
  } catch (error) {
    console.error("Error fetching subjects:", error);
    return NextResponse.json(
      { error: "Failed to fetch subjects" },
      { status: 500 }
    );
  }
}

// POST /api/subjects - Create a new subject
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
    const validatedData = createSubjectSchema.parse(body);

    // Check for existing subject with same name
    const existingSubject = await prisma.subject.findFirst({
      where: {
        schoolId: session.user.schoolId,
        name: validatedData.name,
      },
    });

    if (existingSubject) {
      return NextResponse.json(
        { error: "A subject with this name already exists" },
        { status: 400 }
      );
    }

    const subject = await prisma.subject.create({
      data: {
        schoolId: session.user.schoolId,
        name: validatedData.name,
        code: validatedData.code,
        color: validatedData.color,
      },
    });

    return NextResponse.json({ subject }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error creating subject:", error);
    return NextResponse.json(
      { error: "Failed to create subject" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const createSubjectSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().max(20).optional(),
  color: z.string().max(20).optional(),
});

// GET /api/classes/[id]/subjects - List subjects in a class
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: classId } = await params;

    // Verify class exists and belongs to same school
    const classRecord = await prisma.class.findFirst({
      where: {
        id: classId,
        schoolId: session.user.schoolId,
      },
    });

    if (!classRecord) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    const subjects = await prisma.subject.findMany({
      where: {
        classId,
      },
      include: {
        teachers: {
          include: {
            teacher: {
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
            },
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json({
      subjects: subjects.map((s) => ({
        id: s.id,
        name: s.name,
        code: s.code,
        color: s.color,
        classId: s.classId,
        teachers: s.teachers.map((t) => ({
          id: t.id,
          teacherId: t.teacherId,
          firstName: t.teacher.user.firstName,
          lastName: t.teacher.user.lastName,
          email: t.teacher.user.email,
        })),
      })),
    });
  } catch (error) {
    console.error("Error fetching class subjects:", error);
    return NextResponse.json(
      { error: "Failed to fetch subjects" },
      { status: 500 }
    );
  }
}

// POST /api/classes/[id]/subjects - Create a subject in a class
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

    const { id: classId } = await params;
    const body = await request.json();
    const data = createSubjectSchema.parse(body);

    // Verify class exists and belongs to same school
    const classRecord = await prisma.class.findFirst({
      where: {
        id: classId,
        schoolId: session.user.schoolId,
      },
    });

    if (!classRecord) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    // Check if subject with same name exists in this class
    const existingSubject = await prisma.subject.findUnique({
      where: {
        classId_name: {
          classId,
          name: data.name,
        },
      },
    });

    if (existingSubject) {
      return NextResponse.json(
        { error: "Subject with this name already exists in this class" },
        { status: 400 }
      );
    }

    const subject = await prisma.subject.create({
      data: {
        classId,
        name: data.name,
        code: data.code,
        color: data.color,
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

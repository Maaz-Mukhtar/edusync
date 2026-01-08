import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const createAssessmentSchema = z.object({
  sectionId: z.string().min(1, "Section is required"),
  subjectId: z.string().min(1, "Subject is required"),
  title: z.string().min(1, "Title is required"),
  type: z.enum(["TEST", "QUIZ", "ASSIGNMENT", "EXAM"]),
  totalMarks: z.number().positive("Total marks must be positive"),
  date: z.string().min(1, "Date is required"),
  description: z.string().optional(),
  topics: z.array(z.string()).optional(),
});

// GET /api/teacher/assessments - Get teacher's assessments
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "TEACHER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!teacherProfile) {
      return NextResponse.json({ error: "Teacher profile not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const sectionId = searchParams.get("sectionId");
    const subjectId = searchParams.get("subjectId");
    const type = searchParams.get("type");

    const assessments = await prisma.assessment.findMany({
      where: {
        createdById: teacherProfile.id,
        ...(sectionId && { sectionId }),
        ...(subjectId && { subjectId }),
        ...(type && { type: type as "TEST" | "QUIZ" | "ASSIGNMENT" | "EXAM" }),
      },
      include: {
        section: {
          include: { class: true },
        },
        subject: true,
        _count: {
          select: { results: true },
        },
      },
      orderBy: { date: "desc" },
    });

    // Get student count for each section
    const sectionIds = [...new Set(assessments.map((a) => a.sectionId))];
    const studentCounts = await prisma.studentProfile.groupBy({
      by: ["sectionId"],
      where: { sectionId: { in: sectionIds } },
      _count: true,
    });

    const countMap = new Map(studentCounts.map((sc) => [sc.sectionId, sc._count]));

    return NextResponse.json({
      assessments: assessments.map((a) => ({
        id: a.id,
        title: a.title,
        type: a.type,
        totalMarks: a.totalMarks,
        date: a.date,
        description: a.description,
        topics: a.topics,
        section: {
          id: a.section.id,
          name: `${a.section.class.name} - ${a.section.name}`,
        },
        subject: {
          id: a.subject.id,
          name: a.subject.name,
          color: a.subject.color,
        },
        gradedCount: a._count.results,
        totalStudents: countMap.get(a.sectionId) || 0,
        createdAt: a.createdAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching assessments:", error);
    return NextResponse.json(
      { error: "Failed to fetch assessments" },
      { status: 500 }
    );
  }
}

// POST /api/teacher/assessments - Create assessment
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "TEACHER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!teacherProfile) {
      return NextResponse.json({ error: "Teacher profile not found" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = createAssessmentSchema.parse(body);

    // Verify teacher has access to this section
    const hasAccess = await prisma.sectionTeacher.findFirst({
      where: {
        teacherId: teacherProfile.id,
        sectionId: validatedData.sectionId,
      },
    });

    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied to this section" }, { status: 403 });
    }

    // Verify subject exists
    const subject = await prisma.subject.findFirst({
      where: {
        id: validatedData.subjectId,
        school: {
          users: {
            some: { id: session.user.id },
          },
        },
      },
    });

    if (!subject) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }

    const assessment = await prisma.assessment.create({
      data: {
        sectionId: validatedData.sectionId,
        subjectId: validatedData.subjectId,
        createdById: teacherProfile.id,
        title: validatedData.title,
        type: validatedData.type,
        totalMarks: validatedData.totalMarks,
        date: new Date(validatedData.date),
        description: validatedData.description || null,
        topics: validatedData.topics || [],
      },
      include: {
        section: {
          include: { class: true },
        },
        subject: true,
      },
    });

    return NextResponse.json({ assessment }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error creating assessment:", error);
    return NextResponse.json(
      { error: "Failed to create assessment" },
      { status: 500 }
    );
  }
}

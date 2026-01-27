import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createOnlineTestSchema } from "@/lib/validations/online-tests";
import { z } from "zod";
import { revalidateTeachers } from "@/lib/cache-revalidate";

// GET /api/teacher/online-tests - Get teacher's online tests
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
    const status = searchParams.get("status");
    const sectionId = searchParams.get("sectionId");

    const onlineTests = await prisma.onlineTest.findMany({
      where: {
        assessment: {
          createdById: teacherProfile.id,
          ...(sectionId && { sectionId }),
        },
        ...(status && { status: status as "DRAFT" | "PUBLISHED" | "CLOSED" }),
      },
      include: {
        assessment: {
          include: {
            section: {
              include: { class: true },
            },
            subject: true,
            questions: {
              select: { id: true, marks: true },
            },
          },
        },
        _count: {
          select: { attempts: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      onlineTests: onlineTests.map((test) => ({
        id: test.id,
        status: test.status,
        timeLimitMins: test.timeLimitMins,
        shuffleQuestions: test.shuffleQuestions,
        showResults: test.showResults,
        passingScore: test.passingScore,
        startTime: test.startTime,
        endTime: test.endTime,
        createdAt: test.createdAt,
        assessment: {
          id: test.assessment.id,
          title: test.assessment.title,
          type: test.assessment.type,
          totalMarks: test.assessment.totalMarks,
          date: test.assessment.date,
        },
        section: {
          id: test.assessment.section.id,
          name: `${test.assessment.section.class.name} - ${test.assessment.section.name}`,
        },
        subject: {
          id: test.assessment.subject.id,
          name: test.assessment.subject.name,
          color: test.assessment.subject.color,
        },
        questionCount: test.assessment.questions.length,
        totalQuestionMarks: test.assessment.questions.reduce((sum, q) => sum + q.marks, 0),
        attemptCount: test._count.attempts,
      })),
    });
  } catch (error) {
    console.error("Error fetching online tests:", error);
    return NextResponse.json(
      { error: "Failed to fetch online tests" },
      { status: 500 }
    );
  }
}

// POST /api/teacher/online-tests - Create online test from assessment
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
    const validatedData = createOnlineTestSchema.parse(body);

    // Verify assessment exists and belongs to teacher
    const assessment = await prisma.assessment.findFirst({
      where: {
        id: validatedData.assessmentId,
        createdById: teacherProfile.id,
      },
      include: {
        onlineTest: true,
      },
    });

    if (!assessment) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    // Check if online test already exists for this assessment
    if (assessment.onlineTest) {
      return NextResponse.json(
        { error: "Online test already exists for this assessment" },
        { status: 400 }
      );
    }

    const onlineTest = await prisma.onlineTest.create({
      data: {
        assessmentId: validatedData.assessmentId,
        timeLimitMins: validatedData.timeLimitMins,
        instructions: validatedData.instructions,
        shuffleQuestions: validatedData.shuffleQuestions,
        showResults: validatedData.showResults,
        passingScore: validatedData.passingScore,
        startTime: validatedData.startTime ? new Date(validatedData.startTime) : null,
        endTime: validatedData.endTime ? new Date(validatedData.endTime) : null,
      },
      include: {
        assessment: {
          include: {
            section: {
              include: { class: true },
            },
            subject: true,
          },
        },
      },
    });

    revalidateTeachers([teacherProfile.id]);

    return NextResponse.json({ onlineTest }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error creating online test:", error);
    return NextResponse.json(
      { error: "Failed to create online test" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createQuestionSchema } from "@/lib/validations/online-tests";
import { z } from "zod";

// GET /api/teacher/online-tests/[testId]/questions - Get questions for a test
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
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

    const { testId } = await params;

    // Verify test exists and belongs to teacher
    const onlineTest = await prisma.onlineTest.findFirst({
      where: {
        id: testId,
        assessment: {
          createdById: teacherProfile.id,
        },
      },
      select: { id: true, assessmentId: true, assessment: { select: { subjectId: true } } },
    });

    if (!onlineTest) {
      return NextResponse.json({ error: "Online test not found" }, { status: 404 });
    }

    const questions = await prisma.question.findMany({
      where: { assessmentId: onlineTest.assessmentId },
      include: {
        options: {
          orderBy: { orderIndex: "asc" },
        },
      },
      orderBy: { orderIndex: "asc" },
    });

    return NextResponse.json({
      questions: questions.map((q) => ({
        id: q.id,
        type: q.type,
        questionText: q.questionText,
        topicId: q.topicId,
        marks: q.marks,
        orderIndex: q.orderIndex,
        explanation: q.explanation,
        options: q.options.map((opt) => ({
          id: opt.id,
          optionText: opt.optionText,
          isCorrect: opt.isCorrect,
          orderIndex: opt.orderIndex,
        })),
      })),
    });
  } catch (error) {
    console.error("Error fetching questions:", error);
    return NextResponse.json(
      { error: "Failed to fetch questions" },
      { status: 500 }
    );
  }
}

// POST /api/teacher/online-tests/[testId]/questions - Add question to test
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
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

    const { testId } = await params;

    // Verify test exists and belongs to teacher
    const onlineTest = await prisma.onlineTest.findFirst({
      where: {
        id: testId,
        assessment: {
          createdById: teacherProfile.id,
        },
      },
      select: { id: true, assessmentId: true, status: true, assessment: { select: { subjectId: true } } },
    });

    if (!onlineTest) {
      return NextResponse.json({ error: "Online test not found" }, { status: 404 });
    }

    // Warn if test is published
    if (onlineTest.status === "PUBLISHED") {
      return NextResponse.json(
        { error: "Cannot add questions to a published test" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = createQuestionSchema.parse(body);

    if (validatedData.topicId) {
      const topic = await prisma.subjectTopic.findFirst({
        where: { id: validatedData.topicId, subjectId: onlineTest.assessment.subjectId, status: "ACTIVE" },
        select: { id: true },
      });
      if (!topic) {
        return NextResponse.json({ error: "Invalid topicId for this subject" }, { status: 400 });
      }
    }

    // Get the highest order index for this test
    const maxOrderQuestion = await prisma.question.findFirst({
      where: { assessmentId: onlineTest.assessmentId },
      orderBy: { orderIndex: "desc" },
    });
    const nextOrderIndex = validatedData.orderIndex ?? (maxOrderQuestion ? maxOrderQuestion.orderIndex + 1 : 0);

    // Create question with options if MCQ
    const question = await prisma.question.create({
      data: {
        assessmentId: onlineTest.assessmentId,
        type: validatedData.type,
        questionText: validatedData.questionText,
        topicId: validatedData.topicId ?? null,
        marks: validatedData.marks,
        orderIndex: nextOrderIndex,
        explanation: validatedData.explanation || null,
        ...(validatedData.type === "MCQ" && {
          options: {
            create: validatedData.options.map((opt, index) => ({
              optionText: opt.optionText,
              isCorrect: opt.isCorrect,
              orderIndex: opt.orderIndex ?? index,
            })),
          },
        }),
      },
      include: {
        options: {
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    return NextResponse.json({
      question: {
        id: question.id,
        type: question.type,
        questionText: question.questionText,
        topicId: question.topicId,
        marks: question.marks,
        orderIndex: question.orderIndex,
        explanation: question.explanation,
        options: question.options.map((opt) => ({
          id: opt.id,
          optionText: opt.optionText,
          isCorrect: opt.isCorrect,
          orderIndex: opt.orderIndex,
        })),
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error creating question:", error);
    return NextResponse.json(
      { error: "Failed to create question" },
      { status: 500 }
    );
  }
}

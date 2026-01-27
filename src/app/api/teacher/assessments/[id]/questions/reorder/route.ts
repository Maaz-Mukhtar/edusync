import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { reorderQuestionsSchema } from "@/lib/validations/online-tests";
import { z } from "zod";

// PUT /api/teacher/assessments/[id]/questions/reorder - Reorder questions
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id: assessmentId } = await params;

    // Verify assessment exists and belongs to teacher
    const assessment = await prisma.assessment.findFirst({
      where: {
        id: assessmentId,
        createdById: teacherProfile.id,
      },
      include: {
        onlineTest: true,
      },
    });

    if (!assessment) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    // Warn if online test is published
    if (assessment.onlineTest?.status === "PUBLISHED") {
      return NextResponse.json(
        { error: "Cannot reorder questions in an assessment with a published online test" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = reorderQuestionsSchema.parse(body);

    // Verify all questions belong to this assessment
    const questionIds = validatedData.questions.map((q) => q.id);
    const existingQuestions = await prisma.question.findMany({
      where: {
        id: { in: questionIds },
        assessmentId,
      },
    });

    if (existingQuestions.length !== questionIds.length) {
      return NextResponse.json(
        { error: "Some questions do not belong to this assessment" },
        { status: 400 }
      );
    }

    // Update order indexes
    await prisma.$transaction(
      validatedData.questions.map((q) =>
        prisma.question.update({
          where: { id: q.id },
          data: { orderIndex: q.orderIndex },
        })
      )
    );

    // Fetch updated questions
    const updatedQuestions = await prisma.question.findMany({
      where: { assessmentId },
      include: {
        options: {
          orderBy: { orderIndex: "asc" },
        },
      },
      orderBy: { orderIndex: "asc" },
    });

    return NextResponse.json({
      questions: updatedQuestions.map((q) => ({
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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error reordering questions:", error);
    return NextResponse.json(
      { error: "Failed to reorder questions" },
      { status: 500 }
    );
  }
}

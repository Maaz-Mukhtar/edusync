import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { updateQuestionSchema } from "@/lib/validations/online-tests";
import { z } from "zod";

// GET /api/teacher/assessments/[id]/questions/[questionId] - Get single question
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> }
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

    const { id: assessmentId, questionId } = await params;

    // Verify assessment exists and belongs to teacher
    const assessment = await prisma.assessment.findFirst({
      where: {
        id: assessmentId,
        createdById: teacherProfile.id,
      },
      select: { id: true, subjectId: true },
    });

    if (!assessment) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    const question = await prisma.question.findFirst({
      where: {
        id: questionId,
        assessmentId,
      },
      include: {
        options: {
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

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
    });
  } catch (error) {
    console.error("Error fetching question:", error);
    return NextResponse.json(
      { error: "Failed to fetch question" },
      { status: 500 }
    );
  }
}

// PUT /api/teacher/assessments/[id]/questions/[questionId] - Update question
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> }
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

    const { id: assessmentId, questionId } = await params;

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
        { error: "Cannot edit questions in an assessment with a published online test" },
        { status: 400 }
      );
    }

    // Verify question exists
    const existingQuestion = await prisma.question.findFirst({
      where: {
        id: questionId,
        assessmentId,
      },
      include: { options: true },
    });

    if (!existingQuestion) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = updateQuestionSchema.parse(body);

    if (validatedData.topicId) {
      const topic = await prisma.subjectTopic.findFirst({
        where: { id: validatedData.topicId, subjectId: assessment.subjectId, status: "ACTIVE" },
        select: { id: true },
      });
      if (!topic) {
        return NextResponse.json({ error: "Invalid topicId for this subject" }, { status: 400 });
      }
    }

    // Update question
    await prisma.$transaction(async (tx) => {
      // Update the question itself
      await tx.question.update({
        where: { id: questionId },
        data: {
          ...(validatedData.questionText && { questionText: validatedData.questionText }),
          ...(validatedData.topicId !== undefined && { topicId: validatedData.topicId }),
          ...(validatedData.marks && { marks: validatedData.marks }),
          ...(validatedData.orderIndex !== undefined && { orderIndex: validatedData.orderIndex }),
          ...(validatedData.explanation !== undefined && { explanation: validatedData.explanation }),
        },
      });

      // If options are provided and question is MCQ, update them
      if (validatedData.options && existingQuestion.type === "MCQ") {
        // Delete existing options
        await tx.questionOption.deleteMany({
          where: { questionId },
        });

        // Create new options
        await tx.questionOption.createMany({
          data: validatedData.options.map((opt, index) => ({
            questionId,
            optionText: opt.optionText,
            isCorrect: opt.isCorrect,
            orderIndex: opt.orderIndex ?? index,
          })),
        });
      }
    });

    // Fetch the updated question with options
    const questionWithOptions = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        options: {
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    return NextResponse.json({
      question: {
        id: questionWithOptions!.id,
        type: questionWithOptions!.type,
        questionText: questionWithOptions!.questionText,
        topicId: questionWithOptions!.topicId,
        marks: questionWithOptions!.marks,
        orderIndex: questionWithOptions!.orderIndex,
        explanation: questionWithOptions!.explanation,
        options: questionWithOptions!.options.map((opt) => ({
          id: opt.id,
          optionText: opt.optionText,
          isCorrect: opt.isCorrect,
          orderIndex: opt.orderIndex,
        })),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error updating question:", error);
    return NextResponse.json(
      { error: "Failed to update question" },
      { status: 500 }
    );
  }
}

// DELETE /api/teacher/assessments/[id]/questions/[questionId] - Delete question
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> }
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

    const { id: assessmentId, questionId } = await params;

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
        { error: "Cannot delete questions from an assessment with a published online test" },
        { status: 400 }
      );
    }

    // Verify question exists
    const existingQuestion = await prisma.question.findFirst({
      where: {
        id: questionId,
        assessmentId,
      },
    });

    if (!existingQuestion) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    // Delete question (options will cascade delete)
    await prisma.question.delete({
      where: { id: questionId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting question:", error);
    return NextResponse.json(
      { error: "Failed to delete question" },
      { status: 500 }
    );
  }
}

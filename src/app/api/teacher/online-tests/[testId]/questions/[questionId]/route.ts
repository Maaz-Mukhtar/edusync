import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { updateQuestionSchema } from "@/lib/validations/online-tests";
import { z } from "zod";

// GET /api/teacher/online-tests/[testId]/questions/[questionId] - Get single question
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ testId: string; questionId: string }> }
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

    const { testId, questionId } = await params;

    // Verify test exists and belongs to teacher
    const onlineTest = await prisma.onlineTest.findFirst({
      where: {
        id: testId,
        assessment: {
          createdById: teacherProfile.id,
        },
      },
    });

    if (!onlineTest) {
      return NextResponse.json({ error: "Online test not found" }, { status: 404 });
    }

    const question = await prisma.question.findFirst({
      where: {
        id: questionId,
        assessmentId: onlineTest.assessmentId,
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

// PUT /api/teacher/online-tests/[testId]/questions/[questionId] - Update question
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ testId: string; questionId: string }> }
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

    const { testId, questionId } = await params;

    // Verify test exists and belongs to teacher
    const onlineTest = await prisma.onlineTest.findFirst({
      where: {
        id: testId,
        assessment: {
          createdById: teacherProfile.id,
        },
      },
    });

    if (!onlineTest) {
      return NextResponse.json({ error: "Online test not found" }, { status: 404 });
    }

    // Warn if test is published
    if (onlineTest.status === "PUBLISHED") {
      return NextResponse.json(
        { error: "Cannot edit questions in a published test" },
        { status: 400 }
      );
    }

    // Verify question exists
    const existingQuestion = await prisma.question.findFirst({
      where: {
        id: questionId,
        assessmentId: onlineTest.assessmentId,
      },
      include: { options: true },
    });

    if (!existingQuestion) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = updateQuestionSchema.parse(body);

    // Update question
    const updatedQuestion = await prisma.$transaction(async (tx) => {
      // Update the question itself
      const question = await tx.question.update({
        where: { id: questionId },
        data: {
          ...(validatedData.questionText && { questionText: validatedData.questionText }),
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

      return question;
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

// DELETE /api/teacher/online-tests/[testId]/questions/[questionId] - Delete question
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ testId: string; questionId: string }> }
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

    const { testId, questionId } = await params;

    // Verify test exists and belongs to teacher
    const onlineTest = await prisma.onlineTest.findFirst({
      where: {
        id: testId,
        assessment: {
          createdById: teacherProfile.id,
        },
      },
    });

    if (!onlineTest) {
      return NextResponse.json({ error: "Online test not found" }, { status: 404 });
    }

    // Warn if test is published
    if (onlineTest.status === "PUBLISHED") {
      return NextResponse.json(
        { error: "Cannot delete questions from a published test" },
        { status: 400 }
      );
    }

    // Verify question exists
    const existingQuestion = await prisma.question.findFirst({
      where: {
        id: questionId,
        assessmentId: onlineTest.assessmentId,
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

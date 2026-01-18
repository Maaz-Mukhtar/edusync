import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { saveAnswerSchema } from "@/lib/validations/online-tests";
import { z } from "zod";

// POST /api/student/tests/[testId]/attempt/answer - Save an answer
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "STUDENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!studentProfile) {
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
    }

    const { testId } = await params;

    // Find the student's active attempt
    const attempt = await prisma.testAttempt.findFirst({
      where: {
        onlineTestId: testId,
        studentId: studentProfile.id,
        status: "IN_PROGRESS",
      },
      include: {
        onlineTest: {
          include: {
            assessment: true,
          },
        },
      },
    });

    if (!attempt) {
      return NextResponse.json(
        { error: "No active attempt found" },
        { status: 404 }
      );
    }

    // Check if time has expired
    if (attempt.onlineTest.timeLimitMins) {
      const startTime = new Date(attempt.startedAt).getTime();
      const limitMs = attempt.onlineTest.timeLimitMins * 60 * 1000;
      const now = Date.now();

      if (now > startTime + limitMs) {
        return NextResponse.json(
          { error: "Time has expired" },
          { status: 400 }
        );
      }
    }

    const body = await request.json();
    const validatedData = saveAnswerSchema.parse(body);

    // Verify the question belongs to this test's assessment
    const question = await prisma.question.findFirst({
      where: {
        id: validatedData.questionId,
        assessmentId: attempt.onlineTest.assessmentId,
      },
      include: {
        options: true,
      },
    });

    if (!question) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      );
    }

    // Validate MCQ answer
    if (question.type === "MCQ" && validatedData.selectedOptionId) {
      const validOption = question.options.find(
        (o) => o.id === validatedData.selectedOptionId
      );
      if (!validOption) {
        return NextResponse.json(
          { error: "Invalid option selected" },
          { status: 400 }
        );
      }
    }

    // Update the answer
    const answer = await prisma.studentAnswer.upsert({
      where: {
        attemptId_questionId: {
          attemptId: attempt.id,
          questionId: validatedData.questionId,
        },
      },
      update: {
        answerText: validatedData.answerText || null,
        selectedOptionId: validatedData.selectedOptionId || null,
      },
      create: {
        attemptId: attempt.id,
        questionId: validatedData.questionId,
        answerText: validatedData.answerText || null,
        selectedOptionId: validatedData.selectedOptionId || null,
      },
    });

    return NextResponse.json({
      answer: {
        id: answer.id,
        questionId: answer.questionId,
        answerText: answer.answerText,
        selectedOptionId: answer.selectedOptionId,
      },
      message: "Answer saved",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error saving answer:", error);
    return NextResponse.json(
      { error: "Failed to save answer" },
      { status: 500 }
    );
  }
}

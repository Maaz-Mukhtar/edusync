import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// POST /api/student/tests/[testId]/start - Start a test attempt
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

    // Find the test
    const test = await prisma.onlineTest.findFirst({
      where: {
        id: testId,
        status: "PUBLISHED",
        assessment: {
          sectionId: studentProfile.sectionId,
        },
      },
      include: {
        assessment: {
          include: {
            questions: {
              select: { id: true },
              orderBy: { orderIndex: "asc" },
            },
          },
        },
        attempts: {
          where: {
            studentId: studentProfile.id,
          },
        },
      },
    });

    if (!test) {
      return NextResponse.json({ error: "Test not found" }, { status: 404 });
    }

    // Check if test is within time window
    const now = new Date();
    if (test.startTime && new Date(test.startTime) > now) {
      return NextResponse.json(
        { error: "Test has not started yet" },
        { status: 400 }
      );
    }

    if (test.endTime && new Date(test.endTime) < now) {
      return NextResponse.json(
        { error: "Test has expired" },
        { status: 400 }
      );
    }

    // Check if student already has an attempt
    const existingAttempt = test.attempts[0];
    if (existingAttempt) {
      if (existingAttempt.status === "SUBMITTED" || existingAttempt.status === "GRADED") {
        return NextResponse.json(
          { error: "You have already completed this test" },
          { status: 400 }
        );
      }

      // Return existing in-progress attempt
      if (existingAttempt.status === "IN_PROGRESS") {
        return NextResponse.json({
          attempt: {
            id: existingAttempt.id,
            status: existingAttempt.status,
            startedAt: existingAttempt.startedAt,
          },
          message: "Resuming existing attempt",
          isResume: true,
        });
      }
    }

    // Create new attempt
    const attempt = await prisma.testAttempt.create({
      data: {
        onlineTestId: testId,
        studentId: studentProfile.id,
        status: "IN_PROGRESS",
        startedAt: now,
      },
    });

    // Create empty answer slots for each question (questions are now on assessment)
    const questionIds = test.assessment.questions.map((q) => q.id);
    await prisma.studentAnswer.createMany({
      data: questionIds.map((questionId) => ({
        attemptId: attempt.id,
        questionId,
      })),
    });

    return NextResponse.json({
      attempt: {
        id: attempt.id,
        status: attempt.status,
        startedAt: attempt.startedAt,
      },
      message: "Test started successfully",
      isResume: false,
    });
  } catch (error) {
    console.error("Error starting test:", error);
    return NextResponse.json(
      { error: "Failed to start test" },
      { status: 500 }
    );
  }
}

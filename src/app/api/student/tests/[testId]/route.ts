import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/student/tests/[testId] - Get test info (without answers)
export async function GET(
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
            section: {
              include: { class: true },
            },
            subject: true,
            _count: {
              select: { questions: true },
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

    const now = new Date();
    const attempt = test.attempts[0];
    const hasAttempt = !!attempt;
    const isCompleted = attempt?.status === "SUBMITTED" || attempt?.status === "GRADED";
    const isInProgress = attempt?.status === "IN_PROGRESS";
    const isExpired = test.endTime && new Date(test.endTime) < now;
    const canStart = !hasAttempt && !isExpired;
    const canResume = isInProgress && !isExpired;

    // Calculate total marks from questions (now on assessment)
    const totalMarks = await prisma.question.aggregate({
      where: { assessmentId: test.assessment.id },
      _sum: { marks: true },
    });

    return NextResponse.json({
      test: {
        id: test.id,
        status: test.status,
        timeLimitMins: test.timeLimitMins,
        instructions: test.instructions,
        questionCount: test.assessment._count.questions,
        totalMarks: totalMarks._sum.marks || 0,
        passingScore: test.passingScore,
        showResults: test.showResults,
        shuffleQuestions: test.shuffleQuestions,
        startTime: test.startTime,
        endTime: test.endTime,
        isExpired,
        assessment: {
          id: test.assessment.id,
          title: test.assessment.title,
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
      },
      attempt: attempt
        ? {
            id: attempt.id,
            status: attempt.status,
            startedAt: attempt.startedAt,
            submittedAt: attempt.submittedAt,
            totalScore: attempt.totalScore,
            maxScore: attempt.maxScore,
            percentage: attempt.percentage,
            isPassed: attempt.isPassed,
          }
        : null,
      canStart,
      canResume,
      isCompleted,
    });
  } catch (error) {
    console.error("Error fetching test:", error);
    return NextResponse.json(
      { error: "Failed to fetch test" },
      { status: 500 }
    );
  }
}

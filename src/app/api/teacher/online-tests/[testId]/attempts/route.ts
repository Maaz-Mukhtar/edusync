import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/teacher/online-tests/[testId]/attempts - List all attempts for a test
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

    if (!onlineTest) {
      return NextResponse.json({ error: "Online test not found" }, { status: 404 });
    }

    // Get query params for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    // Build where clause
    const whereClause: {
      onlineTestId: string;
      status?: "IN_PROGRESS" | "SUBMITTED" | "GRADED";
    } = {
      onlineTestId: testId,
    };

    if (status && ["IN_PROGRESS", "SUBMITTED", "GRADED"].includes(status)) {
      whereClause.status = status as "IN_PROGRESS" | "SUBMITTED" | "GRADED";
    }

    // Get all attempts for this test
    const attempts = await prisma.testAttempt.findMany({
      where: whereClause,
      include: {
        student: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        answers: {
          include: {
            question: true,
          },
        },
      },
      orderBy: { startedAt: "desc" },
    });

    // Calculate grading progress for each attempt
    const attemptsWithProgress = attempts.map((attempt) => {
      const totalQuestions = attempt.answers.length;
      const gradedAnswers = attempt.answers.filter((a) => a.marksAwarded !== null).length;
      const shortAnswerQuestions = attempt.answers.filter(
        (a) => a.question.type === "SHORT_ANSWER"
      ).length;
      const gradedShortAnswers = attempt.answers.filter(
        (a) => a.question.type === "SHORT_ANSWER" && a.marksAwarded !== null
      ).length;

      return {
        id: attempt.id,
        status: attempt.status,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        timeTakenSecs: attempt.timeTakenSecs,
        totalScore: attempt.totalScore,
        maxScore: attempt.maxScore,
        percentage: attempt.percentage,
        isPassed: attempt.isPassed,
        student: {
          id: attempt.student.id,
          name: `${attempt.student.user.firstName} ${attempt.student.user.lastName}`,
          email: attempt.student.user.email,
        },
        gradingProgress: {
          total: totalQuestions,
          graded: gradedAnswers,
          shortAnswerTotal: shortAnswerQuestions,
          shortAnswerGraded: gradedShortAnswers,
          needsGrading: shortAnswerQuestions > gradedShortAnswers,
        },
      };
    });

    // Calculate summary stats
    const stats = {
      totalAttempts: attempts.length,
      inProgress: attempts.filter((a) => a.status === "IN_PROGRESS").length,
      submitted: attempts.filter((a) => a.status === "SUBMITTED").length,
      graded: attempts.filter((a) => a.status === "GRADED").length,
      needsGrading: attemptsWithProgress.filter((a) => a.gradingProgress.needsGrading).length,
      averageScore: attempts.filter((a) => a.percentage !== null).length > 0
        ? attempts
            .filter((a) => a.percentage !== null)
            .reduce((sum, a) => sum + (a.percentage || 0), 0) /
          attempts.filter((a) => a.percentage !== null).length
        : null,
      passRate: attempts.filter((a) => a.isPassed !== null).length > 0
        ? (attempts.filter((a) => a.isPassed === true).length /
            attempts.filter((a) => a.isPassed !== null).length) *
          100
        : null,
    };

    return NextResponse.json({
      test: {
        id: onlineTest.id,
        status: onlineTest.status,
        assessment: {
          id: onlineTest.assessment.id,
          title: onlineTest.assessment.title,
        },
        section: {
          id: onlineTest.assessment.section.id,
          name: `${onlineTest.assessment.section.class.name} - ${onlineTest.assessment.section.name}`,
        },
        subject: {
          id: onlineTest.assessment.subject.id,
          name: onlineTest.assessment.subject.name,
        },
      },
      attempts: attemptsWithProgress,
      stats,
    });
  } catch (error) {
    console.error("Error fetching attempts:", error);
    return NextResponse.json(
      { error: "Failed to fetch attempts" },
      { status: 500 }
    );
  }
}

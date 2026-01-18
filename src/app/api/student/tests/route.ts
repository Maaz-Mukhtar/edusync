import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/student/tests - List available tests for the student
export async function GET(request: NextRequest) {
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

    // Get query params for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // available, completed, all

    const now = new Date();

    // Find all published tests for the student's section
    const tests = await prisma.onlineTest.findMany({
      where: {
        status: "PUBLISHED",
        assessment: {
          sectionId: studentProfile.sectionId,
        },
        // Check time window
        OR: [
          { startTime: null },
          { startTime: { lte: now } },
        ],
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
          select: {
            id: true,
            status: true,
            totalScore: true,
            maxScore: true,
            percentage: true,
            isPassed: true,
            submittedAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Transform tests with attempt info
    const testsWithStatus = tests.map((test) => {
      const attempt = test.attempts[0];
      const hasAttempt = !!attempt;
      const isCompleted = attempt?.status === "SUBMITTED" || attempt?.status === "GRADED";
      const isInProgress = attempt?.status === "IN_PROGRESS";
      const isExpired = test.endTime && new Date(test.endTime) < now;
      const canStart = !hasAttempt && !isExpired;
      const canResume = isInProgress && !isExpired;

      return {
        id: test.id,
        status: test.status,
        timeLimitMins: test.timeLimitMins,
        questionCount: test.assessment._count.questions,
        passingScore: test.passingScore,
        showResults: test.showResults,
        startTime: test.startTime,
        endTime: test.endTime,
        isExpired,
        assessment: {
          id: test.assessment.id,
          title: test.assessment.title,
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
        attempt: attempt
          ? {
              id: attempt.id,
              status: attempt.status,
              totalScore: attempt.totalScore,
              maxScore: attempt.maxScore,
              percentage: attempt.percentage,
              isPassed: attempt.isPassed,
              submittedAt: attempt.submittedAt,
            }
          : null,
        canStart,
        canResume,
        isCompleted,
      };
    });

    // Filter based on status param
    let filteredTests = testsWithStatus;
    if (status === "available") {
      filteredTests = testsWithStatus.filter((t) => t.canStart || t.canResume);
    } else if (status === "completed") {
      filteredTests = testsWithStatus.filter((t) => t.isCompleted);
    }

    return NextResponse.json({
      tests: filteredTests,
      stats: {
        total: testsWithStatus.length,
        available: testsWithStatus.filter((t) => t.canStart).length,
        inProgress: testsWithStatus.filter((t) => t.canResume).length,
        completed: testsWithStatus.filter((t) => t.isCompleted).length,
      },
    });
  } catch (error) {
    console.error("Error fetching tests:", error);
    return NextResponse.json(
      { error: "Failed to fetch tests" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/student/tests/[testId]/attempt - Get current attempt with questions
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

    // Find the student's attempt
    const attempt = await prisma.testAttempt.findFirst({
      where: {
        onlineTestId: testId,
        studentId: studentProfile.id,
        status: "IN_PROGRESS",
      },
      include: {
        onlineTest: {
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
        },
        answers: {
          select: {
            id: true,
            questionId: true,
            answerText: true,
            selectedOptionId: true,
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

    // Verify test is still published
    if (attempt.onlineTest.status !== "PUBLISHED") {
      return NextResponse.json(
        { error: "Test is no longer available" },
        { status: 400 }
      );
    }

    // Get questions from Assessment (without correct answers!)
    let questions = await prisma.question.findMany({
      where: { assessmentId: attempt.onlineTest.assessment.id },
      include: {
        options: {
          select: {
            id: true,
            optionText: true,
            orderIndex: true,
            // NOTE: We don't include isCorrect here!
          },
          orderBy: { orderIndex: "asc" },
        },
      },
      orderBy: { orderIndex: "asc" },
    });

    // Shuffle questions if enabled
    if (attempt.onlineTest.shuffleQuestions) {
      // Use attempt ID as seed for consistent shuffle per student
      const seed = attempt.id.split("").reduce((a, b) => a + b.charCodeAt(0), 0);
      questions = shuffleArray(questions, seed);
    }

    // Calculate time remaining
    let timeRemainingMs: number | null = null;
    if (attempt.onlineTest.timeLimitMins) {
      const startTime = new Date(attempt.startedAt).getTime();
      const limitMs = attempt.onlineTest.timeLimitMins * 60 * 1000;
      const now = Date.now();
      timeRemainingMs = Math.max(0, startTime + limitMs - now);
    }

    // Check if time has expired
    const isExpired = timeRemainingMs !== null && timeRemainingMs <= 0;
    if (isExpired) {
      // Auto-submit the test
      await autoSubmitAttempt(attempt.id);

      return NextResponse.json(
        { error: "Time has expired. Your test has been auto-submitted." },
        { status: 400 }
      );
    }

    // Build answers map
    const answersMap: Record<string, { answerText: string | null; selectedOptionId: string | null }> = {};
    attempt.answers.forEach((a) => {
      answersMap[a.questionId] = {
        answerText: a.answerText,
        selectedOptionId: a.selectedOptionId,
      };
    });

    return NextResponse.json({
      attempt: {
        id: attempt.id,
        status: attempt.status,
        startedAt: attempt.startedAt,
      },
      test: {
        id: attempt.onlineTest.id,
        timeLimitMins: attempt.onlineTest.timeLimitMins,
        instructions: attempt.onlineTest.instructions,
        assessment: {
          id: attempt.onlineTest.assessment.id,
          title: attempt.onlineTest.assessment.title,
        },
        section: {
          id: attempt.onlineTest.assessment.section.id,
          name: `${attempt.onlineTest.assessment.section.class.name} - ${attempt.onlineTest.assessment.section.name}`,
        },
        subject: {
          id: attempt.onlineTest.assessment.subject.id,
          name: attempt.onlineTest.assessment.subject.name,
          color: attempt.onlineTest.assessment.subject.color,
        },
      },
      questions: questions.map((q, index) => ({
        id: q.id,
        type: q.type,
        questionText: q.questionText,
        marks: q.marks,
        displayNumber: index + 1,
        options: q.options.map((opt) => ({
          id: opt.id,
          optionText: opt.optionText,
        })),
        currentAnswer: answersMap[q.id] || { answerText: null, selectedOptionId: null },
      })),
      timeRemainingMs,
      questionCount: questions.length,
      answeredCount: attempt.answers.filter(
        (a) => a.answerText || a.selectedOptionId
      ).length,
    });
  } catch (error) {
    console.error("Error fetching attempt:", error);
    return NextResponse.json(
      { error: "Failed to fetch attempt" },
      { status: 500 }
    );
  }
}

// Seeded shuffle function for consistent results
function shuffleArray<T>(array: T[], seed: number): T[] {
  const result = [...array];
  let currentIndex = result.length;

  // Simple seeded random number generator
  const random = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  while (currentIndex !== 0) {
    const randomIndex = Math.floor(random() * currentIndex);
    currentIndex--;
    [result[currentIndex], result[randomIndex]] = [
      result[randomIndex],
      result[currentIndex],
    ];
  }

  return result;
}

// Auto-submit function
async function autoSubmitAttempt(attemptId: string) {
  const attempt = await prisma.testAttempt.findUnique({
    where: { id: attemptId },
    include: {
      onlineTest: true,
      answers: {
        include: {
          question: {
            include: { options: true },
          },
        },
      },
    },
  });

  if (!attempt || attempt.status !== "IN_PROGRESS") return;

  // Grade MCQ questions
  let totalScore = 0;
  let maxScore = 0;

  for (const answer of attempt.answers) {
    maxScore += answer.question.marks;

    if (answer.question.type === "MCQ" && answer.selectedOptionId) {
      const selectedOption = answer.question.options.find(
        (o) => o.id === answer.selectedOptionId
      );
      const isCorrect = selectedOption?.isCorrect || false;
      const marksAwarded = isCorrect ? answer.question.marks : 0;

      await prisma.studentAnswer.update({
        where: { id: answer.id },
        data: {
          isCorrect,
          marksAwarded,
          gradedAt: new Date(),
        },
      });

      totalScore += marksAwarded;
    }
  }

  // Calculate results
  const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
  const isPassed =
    attempt.onlineTest.passingScore !== null
      ? percentage >= attempt.onlineTest.passingScore
      : null;

  // Check if all questions are graded (MCQs only)
  const hasShortAnswers = attempt.answers.some(
    (a) => a.question.type === "SHORT_ANSWER"
  );

  // Update attempt
  await prisma.testAttempt.update({
    where: { id: attemptId },
    data: {
      status: hasShortAnswers ? "SUBMITTED" : "GRADED",
      submittedAt: new Date(),
      timeTakenSecs: Math.floor(
        (Date.now() - new Date(attempt.startedAt).getTime()) / 1000
      ),
      totalScore,
      maxScore,
      percentage,
      isPassed,
    },
  });
}

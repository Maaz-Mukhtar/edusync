import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/student/tests/[testId]/result - View test results
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

    // Find the student's completed attempt
    const attempt = await prisma.testAttempt.findFirst({
      where: {
        onlineTestId: testId,
        studentId: studentProfile.id,
        status: { in: ["SUBMITTED", "GRADED"] },
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
          include: {
            question: {
              include: {
                options: {
                  orderBy: { orderIndex: "asc" },
                },
              },
            },
          },
        },
      },
    });

    if (!attempt) {
      return NextResponse.json(
        { error: "No completed attempt found" },
        { status: 404 }
      );
    }

    // Check if results should be shown
    if (!attempt.onlineTest.showResults) {
      return NextResponse.json({
        attempt: {
          id: attempt.id,
          status: attempt.status,
          submittedAt: attempt.submittedAt,
          totalScore: attempt.totalScore,
          maxScore: attempt.maxScore,
          percentage: attempt.percentage,
          isPassed: attempt.isPassed,
        },
        test: {
          id: attempt.onlineTest.id,
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
          },
        },
        showDetailedResults: false,
        message: "Detailed results are not available for this test.",
      });
    }

    // Build detailed results
    const questionsWithResults = attempt.answers
      .map((answer) => {
        const question = answer.question;
        const selectedOption = question.options.find(
          (o) => o.id === answer.selectedOptionId
        );
        const correctOption = question.options.find((o) => o.isCorrect);

        return {
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
            })),
          },
          answer: {
            answerText: answer.answerText,
            selectedOptionId: answer.selectedOptionId,
            selectedOptionText: selectedOption?.optionText || null,
            isCorrect: answer.isCorrect,
            marksAwarded: answer.marksAwarded,
            feedback: answer.feedback,
          },
          correctAnswer:
            question.type === "MCQ"
              ? {
                  optionId: correctOption?.id,
                  optionText: correctOption?.optionText,
                }
              : null,
        };
      })
      .sort((a, b) => a.question.orderIndex - b.question.orderIndex);

    // Calculate summary stats
    const totalQuestions = questionsWithResults.length;
    const correctAnswers = questionsWithResults.filter(
      (q) => q.answer.isCorrect === true
    ).length;
    const incorrectAnswers = questionsWithResults.filter(
      (q) => q.answer.isCorrect === false
    ).length;
    const pendingGrading = questionsWithResults.filter(
      (q) => q.answer.marksAwarded === null
    ).length;

    return NextResponse.json({
      attempt: {
        id: attempt.id,
        status: attempt.status,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        timeTakenSecs: attempt.timeTakenSecs,
        totalScore: attempt.totalScore,
        maxScore: attempt.maxScore,
        percentage: attempt.percentage,
        isPassed: attempt.isPassed,
      },
      test: {
        id: attempt.onlineTest.id,
        passingScore: attempt.onlineTest.passingScore,
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
      questionsWithResults,
      summary: {
        totalQuestions,
        correctAnswers,
        incorrectAnswers,
        pendingGrading,
      },
      showDetailedResults: true,
    });
  } catch (error) {
    console.error("Error fetching results:", error);
    return NextResponse.json(
      { error: "Failed to fetch results" },
      { status: 500 }
    );
  }
}

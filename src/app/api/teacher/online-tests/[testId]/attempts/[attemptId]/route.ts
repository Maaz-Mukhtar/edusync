import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/teacher/online-tests/[testId]/attempts/[attemptId] - Get single attempt with all answers
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ testId: string; attemptId: string }> }
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

    const { testId, attemptId } = await params;

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
            questions: {
              include: {
                options: {
                  orderBy: { orderIndex: "asc" },
                },
              },
              orderBy: { orderIndex: "asc" },
            },
          },
        },
      },
    });

    if (!onlineTest) {
      return NextResponse.json({ error: "Online test not found" }, { status: 404 });
    }

    // Get the attempt
    const attempt = await prisma.testAttempt.findFirst({
      where: {
        id: attemptId,
        onlineTestId: testId,
      },
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
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }

    // Build question-answer pairs for review
    const questionsWithAnswers = onlineTest.assessment.questions.map((question) => {
      const answer = attempt.answers.find((a) => a.questionId === question.id);
      const selectedOption = question.options.find(
        (opt) => opt.id === answer?.selectedOptionId
      );

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
            orderIndex: opt.orderIndex,
          })),
        },
        answer: answer
          ? {
              id: answer.id,
              answerText: answer.answerText,
              selectedOptionId: answer.selectedOptionId,
              selectedOptionText: selectedOption?.optionText || null,
              isCorrect: answer.isCorrect,
              marksAwarded: answer.marksAwarded,
              feedback: answer.feedback,
              gradedAt: answer.gradedAt,
            }
          : null,
      };
    });

    // Calculate grading summary
    const totalQuestions = onlineTest.assessment.questions.length;
    const answeredQuestions = attempt.answers.length;
    const gradedAnswers = attempt.answers.filter((a) => a.marksAwarded !== null).length;
    const shortAnswerQuestions = onlineTest.assessment.questions.filter(
      (q) => q.type === "SHORT_ANSWER"
    ).length;
    const gradedShortAnswers = attempt.answers.filter(
      (a) =>
        a.question.type === "SHORT_ANSWER" && a.marksAwarded !== null
    ).length;
    const mcqQuestions = onlineTest.assessment.questions.filter((q) => q.type === "MCQ").length;

    return NextResponse.json({
      test: {
        id: onlineTest.id,
        status: onlineTest.status,
        timeLimitMins: onlineTest.timeLimitMins,
        passingScore: onlineTest.passingScore,
        assessment: {
          id: onlineTest.assessment.id,
          title: onlineTest.assessment.title,
          totalMarks: onlineTest.assessment.totalMarks,
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
        student: {
          id: attempt.student.id,
          name: `${attempt.student.user.firstName} ${attempt.student.user.lastName}`,
          email: attempt.student.user.email,
        },
      },
      questionsWithAnswers,
      gradingSummary: {
        totalQuestions,
        answeredQuestions,
        gradedAnswers,
        mcqQuestions,
        shortAnswerQuestions,
        shortAnswerGraded: gradedShortAnswers,
        needsGrading: shortAnswerQuestions > gradedShortAnswers,
        allGraded: gradedAnswers === answeredQuestions,
      },
    });
  } catch (error) {
    console.error("Error fetching attempt:", error);
    return NextResponse.json(
      { error: "Failed to fetch attempt" },
      { status: 500 }
    );
  }
}

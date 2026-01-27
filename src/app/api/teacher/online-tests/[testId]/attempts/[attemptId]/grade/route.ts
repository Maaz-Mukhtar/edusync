import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { gradeAnswerSchema } from "@/lib/validations/online-tests";
import { z } from "zod";
import { revalidateParentsForStudents, revalidateStudents, revalidateTeachers } from "@/lib/cache-revalidate";
import { computeTopicScoresV1 } from "@/lib/analytics/topic-scores";

// PATCH /api/teacher/online-tests/[testId]/attempts/[attemptId]/grade - Grade answers
export async function PATCH(
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
    });

    if (!onlineTest) {
      return NextResponse.json({ error: "Online test not found" }, { status: 404 });
    }

    // Verify attempt exists
    const attempt = await prisma.testAttempt.findFirst({
      where: {
        id: attemptId,
        onlineTestId: testId,
      },
    });

    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }

    // Can only grade submitted or graded attempts
    if (attempt.status === "IN_PROGRESS") {
      return NextResponse.json(
        { error: "Cannot grade an in-progress attempt" },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Support grading multiple answers at once
    const gradesSchema = z.object({
      grades: z.array(gradeAnswerSchema),
    });

    const validatedData = gradesSchema.parse(body);

    // Verify all answers belong to this attempt
    const answerIds = validatedData.grades.map((g) => g.answerId);
    const existingAnswers = await prisma.studentAnswer.findMany({
      where: {
        id: { in: answerIds },
        attemptId,
      },
      include: {
        question: true,
      },
    });

    if (existingAnswers.length !== answerIds.length) {
      return NextResponse.json(
        { error: "Some answers do not belong to this attempt" },
        { status: 400 }
      );
    }

    // Validate marks don't exceed question marks
    for (const grade of validatedData.grades) {
      const answer = existingAnswers.find((a) => a.id === grade.answerId);
      if (answer && grade.marksAwarded > answer.question.marks) {
        return NextResponse.json(
          {
            error: `Marks awarded (${grade.marksAwarded}) exceeds question marks (${answer.question.marks}) for question "${answer.question.questionText.substring(0, 50)}..."`
          },
          { status: 400 }
        );
      }
    }

    // Update answers with grades
    await prisma.$transaction(
      validatedData.grades.map((grade) =>
        prisma.studentAnswer.update({
          where: { id: grade.answerId },
          data: {
            marksAwarded: grade.marksAwarded,
            isCorrect: grade.marksAwarded > 0,
            feedback: grade.feedback || null,
            gradedAt: new Date(),
            gradedBy: teacherProfile.id,
          },
        })
      )
    );

    // Recalculate attempt totals
    const allAnswers = await prisma.studentAnswer.findMany({
      where: { attemptId },
      include: { question: true },
    });

    const allGraded = allAnswers.every((a) => a.marksAwarded !== null);
    const totalScore = allAnswers.reduce((sum, a) => sum + (a.marksAwarded || 0), 0);
    const maxScore = allAnswers.reduce((sum, a) => sum + a.question.marks, 0);
    const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
    const isPassed = onlineTest.passingScore !== null
      ? percentage >= onlineTest.passingScore
      : null;

    // Update attempt
    const updatedAttempt = await prisma.testAttempt.update({
      where: { id: attemptId },
      data: {
        status: allGraded ? "GRADED" : "SUBMITTED",
        totalScore,
        maxScore,
        percentage,
        isPassed,
      },
      include: {
        student: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    // If fully graded, sync with AssessmentResult for gradebook
    if (allGraded) {
      const marksByQuestionId = new Map<string, number>();
      const topicIds = new Set<string>();
      for (const a of allAnswers) {
        marksByQuestionId.set(a.questionId, a.marksAwarded ?? 0);
        if (a.question.topicId) topicIds.add(a.question.topicId);
      }

      const topicNameById = new Map<string, string>();
      if (topicIds.size > 0) {
        const topics = await prisma.subjectTopic.findMany({
          where: { id: { in: Array.from(topicIds) } },
          select: { id: true, name: true },
        });
        for (const t of topics) topicNameById.set(t.id, t.name);
      }

      const topicScores = computeTopicScoresV1({
        questions: allAnswers.map((a) => ({
          id: a.questionId,
          marks: a.question.marks,
          topicId: a.question.topicId ?? null,
          topicName: a.question.topicId ? topicNameById.get(a.question.topicId) : null,
        })),
        marksByQuestionId,
      });

      await prisma.assessmentResult.upsert({
        where: {
          assessmentId_studentId: {
            assessmentId: onlineTest.assessmentId,
            studentId: attempt.studentId,
          },
        },
        update: {
          marksObtained: totalScore,
          remarks: `Online test completed. Score: ${totalScore}/${maxScore} (${percentage.toFixed(1)}%)`,
          topicScores,
        },
        create: {
          assessmentId: onlineTest.assessmentId,
          studentId: attempt.studentId,
          marksObtained: totalScore,
          remarks: `Online test completed. Score: ${totalScore}/${maxScore} (${percentage.toFixed(1)}%)`,
          topicScores,
        },
      });
    }

    revalidateTeachers([teacherProfile.id]);
    revalidateStudents([attempt.studentId]);
    await revalidateParentsForStudents([attempt.studentId]);

    return NextResponse.json({
      attempt: {
        id: updatedAttempt.id,
        status: updatedAttempt.status,
        totalScore: updatedAttempt.totalScore,
        maxScore: updatedAttempt.maxScore,
        percentage: updatedAttempt.percentage,
        isPassed: updatedAttempt.isPassed,
        student: {
          id: updatedAttempt.student.id,
          name: `${updatedAttempt.student.user.firstName} ${updatedAttempt.student.user.lastName}`,
        },
      },
      gradedCount: validatedData.grades.length,
      allGraded,
      message: allGraded
        ? "All answers graded. Results synced to gradebook."
        : `${validatedData.grades.length} answer(s) graded.`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error grading answers:", error);
    return NextResponse.json(
      { error: "Failed to grade answers" },
      { status: 500 }
    );
  }
}

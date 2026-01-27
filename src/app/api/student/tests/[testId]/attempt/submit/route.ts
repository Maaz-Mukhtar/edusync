import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { revalidateParentsForStudents, revalidateStudents, revalidateTeachers } from "@/lib/cache-revalidate";

// POST /api/student/tests/[testId]/attempt/submit - Submit the test
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

    if (!attempt) {
      return NextResponse.json(
        { error: "No active attempt found" },
        { status: 404 }
      );
    }

    // Grade MCQ questions automatically
    let totalScore = 0;
    let maxScore = 0;
    let hasShortAnswers = false;

    for (const answer of attempt.answers) {
      maxScore += answer.question.marks;

      if (answer.question.type === "MCQ") {
        if (answer.selectedOptionId) {
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
        } else {
          // No answer selected - mark as incorrect
          await prisma.studentAnswer.update({
            where: { id: answer.id },
            data: {
              isCorrect: false,
              marksAwarded: 0,
              gradedAt: new Date(),
            },
          });
        }
      } else {
        // Short answer - needs manual grading
        hasShortAnswers = true;
      }
    }

    // Calculate results
    const submittedAt = new Date();
    const timeTakenSecs = Math.floor(
      (submittedAt.getTime() - new Date(attempt.startedAt).getTime()) / 1000
    );
    const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
    const isPassed =
      attempt.onlineTest.passingScore !== null
        ? percentage >= attempt.onlineTest.passingScore
        : null;

    // Update attempt
    const updatedAttempt = await prisma.testAttempt.update({
      where: { id: attempt.id },
      data: {
        status: hasShortAnswers ? "SUBMITTED" : "GRADED",
        submittedAt,
        timeTakenSecs,
        totalScore,
        maxScore,
        percentage,
        isPassed,
      },
    });

    // If fully graded (no short answers), sync with AssessmentResult
    if (!hasShortAnswers) {
      await prisma.assessmentResult.upsert({
        where: {
          assessmentId_studentId: {
            assessmentId: attempt.onlineTest.assessmentId,
            studentId: studentProfile.id,
          },
        },
        update: {
          marksObtained: totalScore,
          remarks: `Online test completed. Score: ${totalScore}/${maxScore} (${percentage.toFixed(1)}%)`,
        },
        create: {
          assessmentId: attempt.onlineTest.assessmentId,
          studentId: studentProfile.id,
          marksObtained: totalScore,
          remarks: `Online test completed. Score: ${totalScore}/${maxScore} (${percentage.toFixed(1)}%)`,
        },
      });

      const assessment = await prisma.assessment.findUnique({
        where: { id: attempt.onlineTest.assessmentId },
        select: { createdById: true },
      });
      if (assessment?.createdById) {
        revalidateTeachers([assessment.createdById]);
      }
    }

    revalidateStudents([studentProfile.id]);
    await revalidateParentsForStudents([studentProfile.id]);

    return NextResponse.json({
      attempt: {
        id: updatedAttempt.id,
        status: updatedAttempt.status,
        submittedAt: updatedAttempt.submittedAt,
        timeTakenSecs: updatedAttempt.timeTakenSecs,
        totalScore: updatedAttempt.totalScore,
        maxScore: updatedAttempt.maxScore,
        percentage: updatedAttempt.percentage,
        isPassed: updatedAttempt.isPassed,
      },
      message: hasShortAnswers
        ? "Test submitted. Some questions require manual grading."
        : "Test submitted and graded.",
      showResults: attempt.onlineTest.showResults,
    });
  } catch (error) {
    console.error("Error submitting test:", error);
    return NextResponse.json(
      { error: "Failed to submit test" },
      { status: 500 }
    );
  }
}

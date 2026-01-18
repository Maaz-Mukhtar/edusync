import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// POST /api/teacher/online-tests/[testId]/publish - Publish a test
export async function POST(
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
            questions: true,
          },
        },
      },
    });

    if (!onlineTest) {
      return NextResponse.json({ error: "Online test not found" }, { status: 404 });
    }

    // Check if test is already published
    if (onlineTest.status === "PUBLISHED") {
      return NextResponse.json(
        { error: "Test is already published" },
        { status: 400 }
      );
    }

    // Check if test is closed
    if (onlineTest.status === "CLOSED") {
      return NextResponse.json(
        { error: "Cannot publish a closed test" },
        { status: 400 }
      );
    }

    // Validate test has at least one question (questions are now on Assessment)
    if (onlineTest.assessment.questions.length === 0) {
      return NextResponse.json(
        { error: "Cannot publish a test with no questions" },
        { status: 400 }
      );
    }

    // Calculate total marks from questions
    const totalQuestionMarks = onlineTest.assessment.questions.reduce((sum, q) => sum + q.marks, 0);

    // Update assessment total marks to match questions if they don't match
    if (totalQuestionMarks !== onlineTest.assessment.totalMarks) {
      await prisma.assessment.update({
        where: { id: onlineTest.assessment.id },
        data: { totalMarks: totalQuestionMarks },
      });
    }

    // Publish the test
    const updatedTest = await prisma.onlineTest.update({
      where: { id: testId },
      data: { status: "PUBLISHED" },
      include: {
        assessment: {
          include: {
            section: {
              include: { class: true },
            },
            subject: true,
            questions: {
              select: { id: true, marks: true },
            },
          },
        },
      },
    });

    return NextResponse.json({
      onlineTest: {
        id: updatedTest.id,
        status: updatedTest.status,
        assessment: {
          id: updatedTest.assessment.id,
          title: updatedTest.assessment.title,
          totalMarks: totalQuestionMarks,
        },
        section: {
          id: updatedTest.assessment.section.id,
          name: `${updatedTest.assessment.section.class.name} - ${updatedTest.assessment.section.name}`,
        },
        subject: {
          id: updatedTest.assessment.subject.id,
          name: updatedTest.assessment.subject.name,
        },
        questionCount: updatedTest.assessment.questions.length,
        totalQuestionMarks,
      },
      message: "Test published successfully",
    });
  } catch (error) {
    console.error("Error publishing test:", error);
    return NextResponse.json(
      { error: "Failed to publish test" },
      { status: 500 }
    );
  }
}

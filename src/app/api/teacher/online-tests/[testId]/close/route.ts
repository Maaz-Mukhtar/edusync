import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// POST /api/teacher/online-tests/[testId]/close - Close a test
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
        _count: {
          select: { attempts: true },
        },
      },
    });

    if (!onlineTest) {
      return NextResponse.json({ error: "Online test not found" }, { status: 404 });
    }

    // Check if test is a draft
    if (onlineTest.status === "DRAFT") {
      return NextResponse.json(
        { error: "Cannot close a draft test. Publish it first." },
        { status: 400 }
      );
    }

    // Check if test is already closed
    if (onlineTest.status === "CLOSED") {
      return NextResponse.json(
        { error: "Test is already closed" },
        { status: 400 }
      );
    }

    // Auto-submit any in-progress attempts
    const inProgressAttempts = await prisma.testAttempt.findMany({
      where: {
        onlineTestId: testId,
        status: "IN_PROGRESS",
      },
    });

    if (inProgressAttempts.length > 0) {
      // Submit all in-progress attempts
      await prisma.testAttempt.updateMany({
        where: {
          onlineTestId: testId,
          status: "IN_PROGRESS",
        },
        data: {
          status: "SUBMITTED",
          submittedAt: new Date(),
        },
      });
    }

    // Close the test
    const updatedTest = await prisma.onlineTest.update({
      where: { id: testId },
      data: { status: "CLOSED" },
      include: {
        assessment: {
          include: {
            section: {
              include: { class: true },
            },
            subject: true,
          },
        },
        _count: {
          select: { attempts: true },
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
        },
        section: {
          id: updatedTest.assessment.section.id,
          name: `${updatedTest.assessment.section.class.name} - ${updatedTest.assessment.section.name}`,
        },
        subject: {
          id: updatedTest.assessment.subject.id,
          name: updatedTest.assessment.subject.name,
        },
        attemptCount: updatedTest._count.attempts,
      },
      message: "Test closed successfully",
      autoSubmittedCount: inProgressAttempts.length,
    });
  } catch (error) {
    console.error("Error closing test:", error);
    return NextResponse.json(
      { error: "Failed to close test" },
      { status: 500 }
    );
  }
}

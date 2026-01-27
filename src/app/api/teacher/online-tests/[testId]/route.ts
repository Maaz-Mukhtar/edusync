import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { updateOnlineTestSchema } from "@/lib/validations/online-tests";
import { z } from "zod";
import { revalidateTeachers } from "@/lib/cache-revalidate";

// GET /api/teacher/online-tests/[testId] - Get online test details
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
        _count: {
          select: { attempts: true },
        },
      },
    });

    if (!onlineTest) {
      return NextResponse.json({ error: "Online test not found" }, { status: 404 });
    }

    return NextResponse.json({
      onlineTest: {
        id: onlineTest.id,
        status: onlineTest.status,
        timeLimitMins: onlineTest.timeLimitMins,
        instructions: onlineTest.instructions,
        shuffleQuestions: onlineTest.shuffleQuestions,
        showResults: onlineTest.showResults,
        passingScore: onlineTest.passingScore,
        startTime: onlineTest.startTime,
        endTime: onlineTest.endTime,
        createdAt: onlineTest.createdAt,
        updatedAt: onlineTest.updatedAt,
        assessment: {
          id: onlineTest.assessment.id,
          title: onlineTest.assessment.title,
          type: onlineTest.assessment.type,
          totalMarks: onlineTest.assessment.totalMarks,
          date: onlineTest.assessment.date,
          description: onlineTest.assessment.description,
        },
        section: {
          id: onlineTest.assessment.section.id,
          name: `${onlineTest.assessment.section.class.name} - ${onlineTest.assessment.section.name}`,
        },
        subject: {
          id: onlineTest.assessment.subject.id,
          name: onlineTest.assessment.subject.name,
          color: onlineTest.assessment.subject.color,
        },
        questions: onlineTest.assessment.questions.map((q) => ({
          id: q.id,
          type: q.type,
          questionText: q.questionText,
          marks: q.marks,
          orderIndex: q.orderIndex,
          explanation: q.explanation,
          options: q.options.map((opt) => ({
            id: opt.id,
            optionText: opt.optionText,
            isCorrect: opt.isCorrect,
            orderIndex: opt.orderIndex,
          })),
        })),
        totalQuestionMarks: onlineTest.assessment.questions.reduce((sum, q) => sum + q.marks, 0),
        attemptCount: onlineTest._count.attempts,
      },
    });
  } catch (error) {
    console.error("Error fetching online test:", error);
    return NextResponse.json(
      { error: "Failed to fetch online test" },
      { status: 500 }
    );
  }
}

// PUT /api/teacher/online-tests/[testId] - Update online test settings
export async function PUT(
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
    const existingTest = await prisma.onlineTest.findFirst({
      where: {
        id: testId,
        assessment: {
          createdById: teacherProfile.id,
        },
      },
    });

    if (!existingTest) {
      return NextResponse.json({ error: "Online test not found" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = updateOnlineTestSchema.parse(body);

    const updatedTest = await prisma.onlineTest.update({
      where: { id: testId },
      data: {
        ...(validatedData.timeLimitMins !== undefined && {
          timeLimitMins: validatedData.timeLimitMins,
        }),
        ...(validatedData.instructions !== undefined && {
          instructions: validatedData.instructions,
        }),
        ...(validatedData.shuffleQuestions !== undefined && {
          shuffleQuestions: validatedData.shuffleQuestions,
        }),
        ...(validatedData.showResults !== undefined && {
          showResults: validatedData.showResults,
        }),
        ...(validatedData.passingScore !== undefined && {
          passingScore: validatedData.passingScore,
        }),
        ...(validatedData.startTime !== undefined && {
          startTime: validatedData.startTime ? new Date(validatedData.startTime) : null,
        }),
        ...(validatedData.endTime !== undefined && {
          endTime: validatedData.endTime ? new Date(validatedData.endTime) : null,
        }),
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

    revalidateTeachers([teacherProfile.id]);

    return NextResponse.json({ onlineTest: updatedTest });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error updating online test:", error);
    return NextResponse.json(
      { error: "Failed to update online test" },
      { status: 500 }
    );
  }
}

// DELETE /api/teacher/online-tests/[testId] - Delete online test
export async function DELETE(
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
    const existingTest = await prisma.onlineTest.findFirst({
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

    if (!existingTest) {
      return NextResponse.json({ error: "Online test not found" }, { status: 404 });
    }

    // Warn if there are attempts
    if (existingTest._count.attempts > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete test with existing attempts",
          attemptCount: existingTest._count.attempts
        },
        { status: 400 }
      );
    }

    await prisma.onlineTest.delete({
      where: { id: testId },
    });

    revalidateTeachers([teacherProfile.id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting online test:", error);
    return NextResponse.json(
      { error: "Failed to delete online test" },
      { status: 500 }
    );
  }
}

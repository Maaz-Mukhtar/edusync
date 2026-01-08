import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const updateAssessmentSchema = z.object({
  title: z.string().min(1).optional(),
  totalMarks: z.number().positive().optional(),
  date: z.string().optional(),
  description: z.string().optional().nullable(),
  topics: z.array(z.string()).optional(),
});

const recordResultsSchema = z.object({
  results: z.array(
    z.object({
      studentId: z.string(),
      marksObtained: z.number().min(0),
      grade: z.string().optional(),
      remarks: z.string().optional(),
    })
  ),
});

// GET /api/teacher/assessments/[id] - Get assessment with results
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;

    const assessment = await prisma.assessment.findFirst({
      where: {
        id,
        createdById: teacherProfile.id,
      },
      include: {
        section: {
          include: {
            class: true,
            students: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
              orderBy: { rollNumber: "asc" },
            },
          },
        },
        subject: true,
        results: true,
      },
    });

    if (!assessment) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    // Map results to students
    const resultsMap = new Map(
      assessment.results.map((r) => [r.studentId, r])
    );

    return NextResponse.json({
      assessment: {
        id: assessment.id,
        title: assessment.title,
        type: assessment.type,
        totalMarks: assessment.totalMarks,
        date: assessment.date,
        description: assessment.description,
        topics: assessment.topics,
        section: {
          id: assessment.section.id,
          name: `${assessment.section.class.name} - ${assessment.section.name}`,
        },
        subject: {
          id: assessment.subject.id,
          name: assessment.subject.name,
          color: assessment.subject.color,
        },
        students: assessment.section.students.map((s) => {
          const result = resultsMap.get(s.id);
          return {
            studentId: s.id,
            rollNumber: s.rollNumber,
            studentName: `${s.user.firstName} ${s.user.lastName}`,
            marksObtained: result?.marksObtained ?? null,
            grade: result?.grade ?? null,
            remarks: result?.remarks ?? null,
            percentage: result
              ? ((result.marksObtained / assessment.totalMarks) * 100).toFixed(1)
              : null,
          };
        }),
      },
    });
  } catch (error) {
    console.error("Error fetching assessment:", error);
    return NextResponse.json(
      { error: "Failed to fetch assessment" },
      { status: 500 }
    );
  }
}

// PUT /api/teacher/assessments/[id] - Update assessment
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;
    const body = await request.json();
    const validatedData = updateAssessmentSchema.parse(body);

    // Verify assessment belongs to this teacher
    const existingAssessment = await prisma.assessment.findFirst({
      where: {
        id,
        createdById: teacherProfile.id,
      },
    });

    if (!existingAssessment) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    const assessment = await prisma.assessment.update({
      where: { id },
      data: {
        ...(validatedData.title && { title: validatedData.title }),
        ...(validatedData.totalMarks && { totalMarks: validatedData.totalMarks }),
        ...(validatedData.date && { date: new Date(validatedData.date) }),
        ...(validatedData.description !== undefined && { description: validatedData.description }),
        ...(validatedData.topics && { topics: validatedData.topics }),
      },
      include: {
        section: {
          include: { class: true },
        },
        subject: true,
      },
    });

    return NextResponse.json({ assessment });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error updating assessment:", error);
    return NextResponse.json(
      { error: "Failed to update assessment" },
      { status: 500 }
    );
  }
}

// DELETE /api/teacher/assessments/[id] - Delete assessment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;

    // Verify assessment belongs to this teacher
    const existingAssessment = await prisma.assessment.findFirst({
      where: {
        id,
        createdById: teacherProfile.id,
      },
    });

    if (!existingAssessment) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    await prisma.assessment.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting assessment:", error);
    return NextResponse.json(
      { error: "Failed to delete assessment" },
      { status: 500 }
    );
  }
}

// PATCH /api/teacher/assessments/[id] - Record results
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;
    const body = await request.json();
    const validatedData = recordResultsSchema.parse(body);

    // Verify assessment belongs to this teacher
    const existingAssessment = await prisma.assessment.findFirst({
      where: {
        id,
        createdById: teacherProfile.id,
      },
    });

    if (!existingAssessment) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    // Validate marks don't exceed total
    for (const result of validatedData.results) {
      if (result.marksObtained > existingAssessment.totalMarks) {
        return NextResponse.json(
          { error: `Marks cannot exceed ${existingAssessment.totalMarks}` },
          { status: 400 }
        );
      }
    }

    // Upsert results
    await prisma.$transaction(
      validatedData.results.map((result) =>
        prisma.assessmentResult.upsert({
          where: {
            assessmentId_studentId: {
              assessmentId: id,
              studentId: result.studentId,
            },
          },
          update: {
            marksObtained: result.marksObtained,
            grade: result.grade || null,
            remarks: result.remarks || null,
          },
          create: {
            assessmentId: id,
            studentId: result.studentId,
            marksObtained: result.marksObtained,
            grade: result.grade || null,
            remarks: result.remarks || null,
          },
        })
      )
    );

    return NextResponse.json({
      message: `Results recorded for ${validatedData.results.length} students`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error recording results:", error);
    return NextResponse.json(
      { error: "Failed to record results" },
      { status: 500 }
    );
  }
}

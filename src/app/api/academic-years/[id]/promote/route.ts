import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

// GET /api/academic-years/[id]/promote - Get promotion preview
// Shows current enrollments and suggested mappings to target year
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: sourceYearId } = await params;
    const { searchParams } = new URL(request.url);
    const targetYearId = searchParams.get("targetYearId");

    // Get source academic year
    const sourceYear = await prisma.academicYear.findFirst({
      where: {
        id: sourceYearId,
        schoolId: session.user.schoolId,
      },
    });

    if (!sourceYear) {
      return NextResponse.json(
        { error: "Source academic year not found" },
        { status: 404 }
      );
    }

    // Get all classes for the school (ordered by displayOrder for promotion logic)
    const classes = await prisma.class.findMany({
      where: { schoolId: session.user.schoolId },
      include: {
        sections: {
          orderBy: { name: "asc" },
        },
      },
      orderBy: { displayOrder: "asc" },
    });

    // Get active enrollments for source year grouped by section
    const enrollments = await prisma.studentEnrollment.findMany({
      where: {
        academicYearId: sourceYearId,
        status: "ACTIVE",
      },
      include: {
        student: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        section: {
          include: {
            class: true,
          },
        },
      },
    });

    // Build class-section structure with enrollment counts
    const classData = classes.map((cls, index) => {
      const isLastClass = index === classes.length - 1;
      const nextClass = isLastClass ? null : classes[index + 1];

      return {
        id: cls.id,
        name: cls.name,
        displayOrder: cls.displayOrder,
        isLastClass,
        sections: cls.sections.map((section) => {
          const sectionEnrollments = enrollments.filter(
            (e) => e.sectionId === section.id
          );

          // Find matching section in next class (same name)
          const suggestedTargetSection = nextClass
            ? nextClass.sections.find((s) => s.name === section.name)
            : null;

          return {
            id: section.id,
            name: section.name,
            studentCount: sectionEnrollments.length,
            students: sectionEnrollments.map((e) => ({
              enrollmentId: e.id,
              studentId: e.studentId,
              firstName: e.student.user.firstName,
              lastName: e.student.user.lastName,
              rollNumber: e.rollNumber,
            })),
            suggestedTargetSectionId: suggestedTargetSection?.id || null,
            suggestedTargetSectionName: suggestedTargetSection
              ? `${nextClass?.name} - ${suggestedTargetSection.name}`
              : isLastClass
              ? "Graduate"
              : null,
          };
        }),
      };
    });

    // Get available target years (years after source year)
    const availableTargetYears = await prisma.academicYear.findMany({
      where: {
        schoolId: session.user.schoolId,
        startDate: { gt: sourceYear.startDate },
      },
      orderBy: { startDate: "asc" },
    });

    // If target year specified, validate it exists
    let targetYear = null;
    if (targetYearId) {
      targetYear = availableTargetYears.find((y) => y.id === targetYearId);
      if (!targetYear) {
        return NextResponse.json(
          { error: "Target academic year not found" },
          { status: 404 }
        );
      }
    }

    return NextResponse.json({
      sourceYear: {
        id: sourceYear.id,
        name: sourceYear.name,
        startDate: sourceYear.startDate,
        endDate: sourceYear.endDate,
      },
      targetYear: targetYear
        ? {
            id: targetYear.id,
            name: targetYear.name,
          }
        : null,
      availableTargetYears: availableTargetYears.map((y) => ({
        id: y.id,
        name: y.name,
      })),
      classes: classData,
      totalEnrollments: enrollments.length,
    });
  } catch (error) {
    console.error("Error getting promotion preview:", error);
    return NextResponse.json(
      { error: "Failed to get promotion preview" },
      { status: 500 }
    );
  }
}

const promoteSchema = z.object({
  targetYearId: z.string().min(1, "Target year is required"),
  mappings: z.array(
    z.object({
      sourceSectionId: z.string(),
      targetSectionId: z.string().nullable(), // null = graduate
      excludeStudentIds: z.array(z.string()).optional(), // Students to skip (retained/left)
    })
  ),
});

// POST /api/academic-years/[id]/promote - Execute promotion
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: sourceYearId } = await params;
    const body = await request.json();
    const { targetYearId, mappings } = promoteSchema.parse(body);

    // Validate source year
    const sourceYear = await prisma.academicYear.findFirst({
      where: {
        id: sourceYearId,
        schoolId: session.user.schoolId,
      },
    });

    if (!sourceYear) {
      return NextResponse.json(
        { error: "Source academic year not found" },
        { status: 404 }
      );
    }

    // Validate target year
    const targetYear = await prisma.academicYear.findFirst({
      where: {
        id: targetYearId,
        schoolId: session.user.schoolId,
      },
    });

    if (!targetYear) {
      return NextResponse.json(
        { error: "Target academic year not found" },
        { status: 404 }
      );
    }

    // Execute promotion in transaction
    const result = await prisma.$transaction(async (tx) => {
      let promoted = 0;
      let graduated = 0;
      let skipped = 0;

      for (const mapping of mappings) {
        const { sourceSectionId, targetSectionId, excludeStudentIds = [] } = mapping;

        // Get active enrollments for this section
        const enrollments = await tx.studentEnrollment.findMany({
          where: {
            academicYearId: sourceYearId,
            sectionId: sourceSectionId,
            status: "ACTIVE",
            studentId: { notIn: excludeStudentIds },
          },
        });

        for (const enrollment of enrollments) {
          if (targetSectionId) {
            // Promote to next grade
            // Mark old enrollment as PROMOTED
            await tx.studentEnrollment.update({
              where: { id: enrollment.id },
              data: { status: "PROMOTED" },
            });

            // Create new enrollment
            await tx.studentEnrollment.create({
              data: {
                studentId: enrollment.studentId,
                academicYearId: targetYearId,
                sectionId: targetSectionId,
                rollNumber: enrollment.rollNumber, // Keep same roll number
                status: "ACTIVE",
                promotedFromId: enrollment.id,
              },
            });

            // Update student's current section
            await tx.studentProfile.update({
              where: { id: enrollment.studentId },
              data: { sectionId: targetSectionId },
            });

            promoted++;
          } else {
            // Graduate (no target section)
            await tx.studentEnrollment.update({
              where: { id: enrollment.id },
              data: { status: "GRADUATED" },
            });

            // Keep student in the system but mark as graduated
            // Student profile remains with their last section for historical reference

            graduated++;
          }
        }

        // Handle excluded students (skip for now, admin will handle manually)
        skipped += excludeStudentIds.length;
      }

      return { promoted, graduated, skipped };
    });

    return NextResponse.json({
      success: true,
      message: `Promotion complete: ${result.promoted} promoted, ${result.graduated} graduated, ${result.skipped} skipped`,
      ...result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error executing promotion:", error);
    return NextResponse.json(
      { error: "Failed to execute promotion" },
      { status: 500 }
    );
  }
}

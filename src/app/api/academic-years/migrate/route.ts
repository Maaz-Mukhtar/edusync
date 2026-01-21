import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// POST /api/academic-years/migrate - Migrate existing students to enrollment system
// This creates enrollments for all students in their current sections for the current academic year
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const schoolId = session.user.schoolId;

    // Get or create current academic year
    let currentYear = await prisma.academicYear.findFirst({
      where: {
        schoolId,
        isCurrent: true,
      },
    });

    if (!currentYear) {
      // Create a default academic year if none exists
      const now = new Date();
      const startMonth = 8; // August (typical school year start)
      const startYear = now.getMonth() >= startMonth ? now.getFullYear() : now.getFullYear() - 1;
      const endYear = startYear + 1;

      currentYear = await prisma.academicYear.create({
        data: {
          schoolId,
          name: `${startYear}-${endYear}`,
          startDate: new Date(startYear, startMonth - 1, 1), // August 1
          endDate: new Date(endYear, 5, 30), // June 30
          isCurrent: true,
        },
      });
    }

    // Get all students who don't have an enrollment for the current year
    const studentsWithoutEnrollment = await prisma.studentProfile.findMany({
      where: {
        user: {
          schoolId,
          isActive: true,
        },
        enrollments: {
          none: {
            academicYearId: currentYear.id,
          },
        },
      },
      select: {
        id: true,
        sectionId: true,
        rollNumber: true,
      },
    });

    if (studentsWithoutEnrollment.length === 0) {
      return NextResponse.json({
        success: true,
        message: "All students already have enrollments for the current academic year",
        migrated: 0,
        academicYear: currentYear.name,
      });
    }

    // Create enrollments for all students
    const enrollments = await prisma.studentEnrollment.createMany({
      data: studentsWithoutEnrollment.map((student) => ({
        studentId: student.id,
        academicYearId: currentYear.id,
        sectionId: student.sectionId,
        rollNumber: student.rollNumber,
        status: "ACTIVE",
      })),
      skipDuplicates: true,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully migrated ${enrollments.count} students to enrollment system`,
      migrated: enrollments.count,
      academicYear: currentYear.name,
    });
  } catch (error) {
    console.error("Error migrating students:", error);
    return NextResponse.json(
      { error: "Failed to migrate students" },
      { status: 500 }
    );
  }
}

// GET /api/academic-years/migrate - Check migration status
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const schoolId = session.user.schoolId;

    // Get current academic year
    const currentYear = await prisma.academicYear.findFirst({
      where: {
        schoolId,
        isCurrent: true,
      },
    });

    // Count total active students
    const totalStudents = await prisma.studentProfile.count({
      where: {
        user: {
          schoolId,
          isActive: true,
        },
      },
    });

    // Count students with enrollments
    const enrolledStudents = currentYear
      ? await prisma.studentEnrollment.count({
          where: {
            academicYearId: currentYear.id,
            status: "ACTIVE",
          },
        })
      : 0;

    return NextResponse.json({
      currentAcademicYear: currentYear
        ? {
            id: currentYear.id,
            name: currentYear.name,
          }
        : null,
      totalStudents,
      enrolledStudents,
      needsMigration: totalStudents > enrolledStudents,
      studentsToMigrate: totalStudents - enrolledStudents,
    });
  } catch (error) {
    console.error("Error checking migration status:", error);
    return NextResponse.json(
      { error: "Failed to check migration status" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

// GET /api/assignments?classId=xxx - Get assignment matrix for a class
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");

    if (!classId) {
      return NextResponse.json(
        { error: "classId is required" },
        { status: 400 }
      );
    }

    // Verify class belongs to user's school
    const classRecord = await prisma.class.findFirst({
      where: {
        id: classId,
        schoolId: session.user.schoolId,
      },
      include: {
        sections: {
          orderBy: { name: "asc" },
        },
        subjects: {
          orderBy: { name: "asc" },
          include: {
            teachers: {
              include: {
                teacher: {
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
              },
            },
          },
        },
      },
    });

    if (!classRecord) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    // Get all section-subject-teacher assignments for this class
    const sectionAssignments = await prisma.sectionSubjectTeacher.findMany({
      where: {
        section: {
          classId,
        },
      },
      include: {
        teacher: {
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
      },
    });

    // Build the matrix data
    const sections = classRecord.sections.map((s) => ({
      id: s.id,
      name: s.name,
    }));

    const subjects = classRecord.subjects.map((subject) => {
      // Available teachers for this subject (class-level assignment)
      const availableTeachers = subject.teachers.map((t) => ({
        id: t.teacher.id,
        firstName: t.teacher.user.firstName,
        lastName: t.teacher.user.lastName,
      }));

      // Current assignments per section
      const sectionTeachers: Record<string, { id: string; firstName: string; lastName: string } | null> = {};

      for (const section of classRecord.sections) {
        const assignment = sectionAssignments.find(
          (a) => a.sectionId === section.id && a.subjectId === subject.id
        );

        sectionTeachers[section.id] = assignment
          ? {
              id: assignment.teacher.id,
              firstName: assignment.teacher.user.firstName,
              lastName: assignment.teacher.user.lastName,
            }
          : null;
      }

      return {
        id: subject.id,
        name: subject.name,
        code: subject.code,
        color: subject.color,
        availableTeachers,
        sectionTeachers,
      };
    });

    // Get all teachers for the school (for adding new teachers to subjects)
    const allTeachers = await prisma.teacherProfile.findMany({
      where: {
        user: {
          schoolId: session.user.schoolId,
          isActive: true,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        user: {
          firstName: "asc",
        },
      },
    });

    return NextResponse.json({
      class: {
        id: classRecord.id,
        name: classRecord.name,
      },
      sections,
      subjects,
      allTeachers: allTeachers.map((t) => ({
        id: t.id,
        firstName: t.user.firstName,
        lastName: t.user.lastName,
      })),
    });
  } catch (error) {
    console.error("Error fetching assignments:", error);
    return NextResponse.json(
      { error: "Failed to fetch assignments" },
      { status: 500 }
    );
  }
}

const updateAssignmentsSchema = z.object({
  classId: z.string().min(1),
  assignments: z.array(
    z.object({
      subjectId: z.string().min(1),
      sectionId: z.string().min(1),
      teacherId: z.string().nullable(), // null means remove assignment
    })
  ),
  // Teachers to add to subjects at class level (TeacherSubject)
  addTeachersToSubjects: z.array(
    z.object({
      subjectId: z.string().min(1),
      teacherId: z.string().min(1),
    })
  ).optional(),
  // Teachers to remove from subjects at class level
  removeTeachersFromSubjects: z.array(
    z.object({
      subjectId: z.string().min(1),
      teacherId: z.string().min(1),
    })
  ).optional(),
});

// PUT /api/assignments - Bulk update assignments
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { classId, assignments, addTeachersToSubjects, removeTeachersFromSubjects } =
      updateAssignmentsSchema.parse(body);

    // Verify class belongs to user's school
    const classRecord = await prisma.class.findFirst({
      where: {
        id: classId,
        schoolId: session.user.schoolId,
      },
    });

    if (!classRecord) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    // Process in a transaction
    await prisma.$transaction(async (tx) => {
      // 1. Add teachers to subjects at class level
      if (addTeachersToSubjects && addTeachersToSubjects.length > 0) {
        for (const { subjectId, teacherId } of addTeachersToSubjects) {
          await tx.teacherSubject.upsert({
            where: {
              teacherId_subjectId: { teacherId, subjectId },
            },
            create: { teacherId, subjectId },
            update: {},
          });
        }
      }

      // 2. Update section-level assignments
      for (const { subjectId, sectionId, teacherId } of assignments) {
        if (teacherId) {
          // Upsert assignment
          await tx.sectionSubjectTeacher.upsert({
            where: {
              sectionId_subjectId: { sectionId, subjectId },
            },
            create: { sectionId, subjectId, teacherId },
            update: { teacherId },
          });
        } else {
          // Remove assignment
          await tx.sectionSubjectTeacher.deleteMany({
            where: { sectionId, subjectId },
          });
        }
      }

      // 3. Remove teachers from subjects at class level
      if (removeTeachersFromSubjects && removeTeachersFromSubjects.length > 0) {
        for (const { subjectId, teacherId } of removeTeachersFromSubjects) {
          // First remove all section-level assignments for this teacher-subject
          await tx.sectionSubjectTeacher.deleteMany({
            where: { subjectId, teacherId },
          });

          // Then remove class-level assignment
          await tx.teacherSubject.deleteMany({
            where: { teacherId, subjectId },
          });
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error updating assignments:", error);
    return NextResponse.json(
      { error: "Failed to update assignments" },
      { status: 500 }
    );
  }
}

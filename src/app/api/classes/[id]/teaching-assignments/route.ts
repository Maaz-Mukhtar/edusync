import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const bulkAssignmentsSchema = z.object({
  assignments: z
    .array(
      z.object({
        sectionId: z.string().min(1),
        subjectId: z.string().min(1),
        teacherId: z.string().min(1).nullable(),
      })
    )
    .min(1),
});

// GET /api/classes/[id]/teaching-assignments
export async function GET(
  _request: NextRequest,
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

    const { id: classId } = await params;

    const classRecord = await prisma.class.findFirst({
      where: { id: classId, schoolId: session.user.schoolId },
      select: {
        id: true,
        name: true,
        sections: { select: { id: true, name: true }, orderBy: { name: "asc" } },
        subjects: { select: { id: true, name: true, code: true, color: true }, orderBy: { name: "asc" } },
      },
    });

    if (!classRecord) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    const [teachers, assignments] = await Promise.all([
      prisma.teacherProfile.findMany({
        where: { user: { schoolId: session.user.schoolId } },
        select: {
          id: true,
          user: { select: { firstName: true, lastName: true } },
        },
        orderBy: [{ user: { firstName: "asc" } }, { user: { lastName: "asc" } }],
      }),
      prisma.sectionSubjectTeacher.findMany({
        where: { section: { classId } },
        select: { sectionId: true, subjectId: true, teacherId: true },
      }),
    ]);

    return NextResponse.json({
      class: { id: classRecord.id, name: classRecord.name },
      sections: classRecord.sections,
      subjects: classRecord.subjects,
      teachers: teachers.map((t) => ({
        id: t.id,
        firstName: t.user.firstName,
        lastName: t.user.lastName,
      })),
      assignments,
    });
  } catch (error) {
    console.error("Error fetching teaching assignments:", error);
    return NextResponse.json(
      { error: "Failed to fetch teaching assignments" },
      { status: 500 }
    );
  }
}

// PUT /api/classes/[id]/teaching-assignments
export async function PUT(
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

    const { id: classId } = await params;
    const body = await request.json();
    const data = bulkAssignmentsSchema.parse(body);

    const classRecord = await prisma.class.findFirst({
      where: { id: classId, schoolId: session.user.schoolId },
      select: {
        id: true,
        sections: { select: { id: true } },
        subjects: { select: { id: true } },
      },
    });

    if (!classRecord) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    const sectionIds = new Set(classRecord.sections.map((s) => s.id));
    const subjectIds = new Set(classRecord.subjects.map((s) => s.id));

    for (const a of data.assignments) {
      if (!sectionIds.has(a.sectionId)) {
        return NextResponse.json(
          { error: "Invalid sectionId for this class" },
          { status: 400 }
        );
      }
      if (!subjectIds.has(a.subjectId)) {
        return NextResponse.json(
          { error: "Invalid subjectId for this class" },
          { status: 400 }
        );
      }
    }

    const teacherIds = Array.from(
      new Set(data.assignments.map((a) => a.teacherId).filter((t): t is string => !!t))
    );

    if (teacherIds.length > 0) {
      const teachers = await prisma.teacherProfile.findMany({
        where: {
          id: { in: teacherIds },
          user: { schoolId: session.user.schoolId },
        },
        select: { id: true },
      });

      if (teachers.length !== teacherIds.length) {
        return NextResponse.json({ error: "One or more teachers not found" }, { status: 404 });
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const a of data.assignments) {
        if (!a.teacherId) {
          await tx.sectionSubjectTeacher.deleteMany({
            where: { sectionId: a.sectionId, subjectId: a.subjectId },
          });
          continue;
        }

        await tx.teacherSubject.upsert({
          where: {
            teacherId_subjectId: {
              teacherId: a.teacherId,
              subjectId: a.subjectId,
            },
          },
          update: {},
          create: {
            teacherId: a.teacherId,
            subjectId: a.subjectId,
          },
        });

        await tx.sectionSubjectTeacher.upsert({
          where: {
            sectionId_subjectId: {
              sectionId: a.sectionId,
              subjectId: a.subjectId,
            },
          },
          update: { teacherId: a.teacherId },
          create: {
            sectionId: a.sectionId,
            subjectId: a.subjectId,
            teacherId: a.teacherId,
          },
        });
      }
    });

    return NextResponse.json({ success: true, processed: data.assignments.length });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error updating teaching assignments:", error);
    return NextResponse.json(
      { error: "Failed to update teaching assignments" },
      { status: 500 }
    );
  }
}


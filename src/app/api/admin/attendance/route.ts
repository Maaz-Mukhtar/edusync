import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { parseDateInputValue, toDateInputValue } from "@/lib/date";

const saveAttendanceSchema = z.object({
  sectionId: z.string().min(1),
  date: z.string().min(1),
  records: z.array(
    z.object({
      studentId: z.string().min(1),
      status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
      remarks: z.string().optional(),
    })
  ),
});

function normalizeDate(dateStr: string) {
  return parseDateInputValue(dateStr);
}

// GET /api/admin/attendance
// - With sectionId + date: return per-student records for that section/date
// - With date (optional): return all sections with marking status for that date
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const sectionId = searchParams.get("sectionId");
    const dateParam = searchParams.get("date");
    const classId = searchParams.get("classId");

    const date = normalizeDate(dateParam || toDateInputValue(new Date()));
    if (!date) return NextResponse.json({ error: "Invalid date format" }, { status: 400 });

    if (sectionId) {
      const section = await prisma.section.findFirst({
        where: {
          id: sectionId,
          class: { schoolId: session.user.schoolId },
        },
        select: { id: true },
      });
      if (!section) {
        return NextResponse.json({ error: "Section not found" }, { status: 404 });
      }

      const [attendance, students] = await Promise.all([
        prisma.attendance.findMany({
          where: { sectionId, date },
          select: { studentId: true, status: true, remarks: true },
        }),
        prisma.studentProfile.findMany({
          where: { sectionId },
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
          orderBy: { rollNumber: "asc" },
        }),
      ]);

      const map = new Map(attendance.map((a) => [a.studentId, a]));

      return NextResponse.json({
        date,
        isMarked: attendance.length > 0,
        records: students.map((s) => {
          const record = map.get(s.id);
          return {
            studentId: s.id,
            rollNumber: s.rollNumber,
            studentName: `${s.user.firstName} ${s.user.lastName}`,
            status: record?.status || null,
            remarks: record?.remarks || null,
          };
        }),
      });
    }

    const sections = await prisma.section.findMany({
      where: {
        class: {
          schoolId: session.user.schoolId,
          ...(classId ? { id: classId } : {}),
        },
      },
      include: {
        class: true,
        _count: { select: { students: true } },
        classTeacher: {
          include: {
            teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
          },
        },
        attendances: {
          where: { date },
          select: { status: true },
        },
      },
      orderBy: [{ class: { displayOrder: "asc" } }, { name: "asc" }],
    });

    return NextResponse.json({
      date,
      sections: sections.map((s) => {
        const summary = s.attendances.reduce(
          (acc, a) => {
            acc.total += 1;
            acc[a.status] += 1;
            return acc;
          },
          { total: 0, PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 } as Record<
            "total" | "PRESENT" | "ABSENT" | "LATE" | "EXCUSED",
            number
          >
        );

        const teacherUser = s.classTeacher?.teacher.user;
        return {
          id: s.id,
          name: `${s.class.name} - ${s.name}`,
          classId: s.classId,
          className: s.class.name,
          studentCount: s._count.students,
          isMarked: summary.total > 0,
          summary: {
            totalMarked: summary.total,
            present: summary.PRESENT,
            absent: summary.ABSENT,
            late: summary.LATE,
            excused: summary.EXCUSED,
          },
          classTeacher: teacherUser
            ? { name: `${teacherUser.firstName} ${teacherUser.lastName}` }
            : null,
        };
      }),
    });
  } catch (error) {
    console.error("Error fetching admin attendance:", error);
    return NextResponse.json({ error: "Failed to fetch attendance" }, { status: 500 });
  }
}

// POST /api/admin/attendance - admin override mark attendance
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validated = saveAttendanceSchema.parse(body);

    const date = normalizeDate(validated.date);
    if (!date) return NextResponse.json({ error: "Invalid date format" }, { status: 400 });

    const section = await prisma.section.findFirst({
      where: { id: validated.sectionId, class: { schoolId: session.user.schoolId } },
      select: { id: true },
    });
    if (!section) return NextResponse.json({ error: "Section not found" }, { status: 404 });

    const students = await prisma.studentProfile.findMany({
      where: { sectionId: validated.sectionId },
      select: { id: true },
    });
    const studentIds = new Set(students.map((s) => s.id));

    const records = validated.records.filter((r) => studentIds.has(r.studentId));
    if (records.length === 0) {
      return NextResponse.json({ error: "No valid student records provided" }, { status: 400 });
    }

    // Ensure uniqueness: one attendance per student per date (regardless of section)
    await prisma.attendance.deleteMany({
      where: {
        studentId: { in: records.map((r) => r.studentId) },
        date,
      },
    });

    const created = await prisma.attendance.createMany({
      data: records.map((r) => ({
        studentId: r.studentId,
        sectionId: validated.sectionId,
        date,
        status: r.status,
        remarks: r.remarks || null,
        markedBy: null,
      })),
    });

    return NextResponse.json({
      message: `Attendance saved for ${created.count} students`,
      count: created.count,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error saving admin attendance:", error);
    return NextResponse.json({ error: "Failed to save attendance" }, { status: 500 });
  }
}

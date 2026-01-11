import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const markAttendanceSchema = z.object({
  sectionId: z.string().min(1, "Section is required"),
  date: z.string().min(1, "Date is required"),
  records: z.array(
    z.object({
      studentId: z.string(),
      status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
      remarks: z.string().optional(),
    })
  ),
});

// GET /api/teacher/attendance - Get attendance records
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const sectionId = searchParams.get("sectionId");
    const date = searchParams.get("date");
    const month = searchParams.get("month"); // YYYY-MM format

    // Verify teacher has access to this section
    if (sectionId) {
      const hasAccess = await prisma.sectionTeacher.findFirst({
        where: {
          teacherId: teacherProfile.id,
          sectionId,
        },
      });

      if (!hasAccess) {
        return NextResponse.json({ error: "Access denied to this section" }, { status: 403 });
      }
    }

    // If specific date, get attendance for that date
    if (sectionId && date) {
      const attendanceDate = new Date(date);
      attendanceDate.setHours(0, 0, 0, 0);

      const attendance = await prisma.attendance.findMany({
        where: {
          sectionId,
          date: attendanceDate,
        },
        include: {
          student: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
        orderBy: { student: { rollNumber: "asc" } },
      });

      // Get all students in section
      const students = await prisma.studentProfile.findMany({
        where: { sectionId },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { rollNumber: "asc" },
      });

      // Map attendance to students
      const attendanceMap = new Map(
        attendance.map((a) => [a.studentId, a])
      );

      return NextResponse.json({
        date: attendanceDate,
        isMarked: attendance.length > 0,
        records: students.map((s) => {
          const record = attendanceMap.get(s.id);
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

    // If month specified, get attendance summary for that month
    if (sectionId && month) {
      const [year, monthNum] = month.split("-").map(Number);
      const startDate = new Date(year, monthNum - 1, 1);
      const endDate = new Date(year, monthNum, 0);

      const attendance = await prisma.attendance.findMany({
        where: {
          sectionId,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          student: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      });

      // Group by student
      const studentStats = new Map<
        string,
        {
          studentId: string;
          rollNumber: string | null;
          studentName: string;
          present: number;
          absent: number;
          late: number;
          excused: number;
        }
      >();

      // Get all students
      const students = await prisma.studentProfile.findMany({
        where: { sectionId },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { rollNumber: "asc" },
      });

      // Initialize stats for all students
      for (const s of students) {
        studentStats.set(s.id, {
          studentId: s.id,
          rollNumber: s.rollNumber,
          studentName: `${s.user.firstName} ${s.user.lastName}`,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
        });
      }

      // Aggregate attendance
      for (const record of attendance) {
        const stats = studentStats.get(record.studentId);
        if (stats) {
          switch (record.status) {
            case "PRESENT":
              stats.present++;
              break;
            case "ABSENT":
              stats.absent++;
              break;
            case "LATE":
              stats.late++;
              break;
            case "EXCUSED":
              stats.excused++;
              break;
          }
        }
      }

      return NextResponse.json({
        month,
        summary: Array.from(studentStats.values()),
      });
    }

    // Default: return teacher's sections with today's attendance status
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get sections where teacher is class teacher
    const classTeacherSections = await prisma.sectionTeacher.findMany({
      where: { teacherId: teacherProfile.id },
      include: {
        section: {
          include: {
            class: true,
            _count: {
              select: { students: true },
            },
            attendances: {
              where: { date: today },
              select: { id: true },
            },
          },
        },
      },
    });

    // Get sections where teacher teaches subjects
    const subjectTeacherSections = await prisma.sectionSubjectTeacher.findMany({
      where: { teacherId: teacherProfile.id },
      include: {
        section: {
          include: {
            class: true,
            _count: {
              select: { students: true },
            },
            attendances: {
              where: { date: today },
              select: { id: true },
            },
          },
        },
      },
    });

    // Combine and deduplicate sections
    const classTeacherSectionIds = new Set(classTeacherSections.map(ct => ct.sectionId));
    const allSections = new Map<string, { section: typeof classTeacherSections[0]["section"]; isClassTeacher: boolean }>();

    for (const ct of classTeacherSections) {
      allSections.set(ct.sectionId, { section: ct.section, isClassTeacher: true });
    }

    for (const st of subjectTeacherSections) {
      if (!allSections.has(st.sectionId)) {
        allSections.set(st.sectionId, { section: st.section, isClassTeacher: false });
      }
    }

    // Sort and format sections
    const sectionsArray = Array.from(allSections.values())
      .sort((a, b) => {
        const orderDiff = a.section.class.displayOrder - b.section.class.displayOrder;
        if (orderDiff !== 0) return orderDiff;
        return a.section.name.localeCompare(b.section.name);
      });

    return NextResponse.json({
      sections: sectionsArray.map((item) => ({
        id: item.section.id,
        name: `${item.section.class.name} - ${item.section.name}`,
        studentCount: item.section._count.students,
        isMarkedToday: item.section.attendances.length > 0,
        isClassTeacher: item.isClassTeacher,
      })),
    });
  } catch (error) {
    console.error("Error fetching attendance:", error);
    return NextResponse.json(
      { error: "Failed to fetch attendance" },
      { status: 500 }
    );
  }
}

// POST /api/teacher/attendance - Mark attendance
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const validatedData = markAttendanceSchema.parse(body);

    // Verify teacher has access to this section
    const hasAccess = await prisma.sectionTeacher.findFirst({
      where: {
        teacherId: teacherProfile.id,
        sectionId: validatedData.sectionId,
      },
    });

    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied to this section" }, { status: 403 });
    }

    const attendanceDate = new Date(validatedData.date);
    attendanceDate.setHours(0, 0, 0, 0);

    // Delete existing attendance for this date and section (to allow updates)
    await prisma.attendance.deleteMany({
      where: {
        sectionId: validatedData.sectionId,
        date: attendanceDate,
      },
    });

    // Create attendance records
    const attendanceRecords = await prisma.attendance.createMany({
      data: validatedData.records.map((record) => ({
        studentId: record.studentId,
        sectionId: validatedData.sectionId,
        date: attendanceDate,
        status: record.status,
        remarks: record.remarks || null,
        markedBy: teacherProfile.id,
      })),
    });

    return NextResponse.json({
      message: `Attendance marked for ${attendanceRecords.count} students`,
      count: attendanceRecords.count,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error marking attendance:", error);
    return NextResponse.json(
      { error: "Failed to mark attendance" },
      { status: 500 }
    );
  }
}

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export interface AdminAttendanceSection {
  id: string;
  name: string;
  studentCount: number;
  isMarkedToday: boolean;
  classTeacherName: string | null;
}

export interface AdminAttendanceRecord {
  studentId: string;
  rollNumber: string | null;
  studentName: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | null;
  remarks: string | null;
}

export interface AdminAttendanceRecordData {
  date: Date;
  isMarked: boolean;
  records: AdminAttendanceRecord[];
}

export interface AdminAttendanceData {
  sections: AdminAttendanceSection[];
  initialSectionId: string | null;
  initialDate: string;
  initialRecords: AdminAttendanceRecordData | null;
}

async function getAdminSchoolId() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) throw new Error("Forbidden");
  return session.user.schoolId;
}

export async function getAdminAttendanceData(): Promise<AdminAttendanceData> {
  const schoolId = await getAdminSchoolId();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];

  const sections = await prisma.section.findMany({
    where: { class: { schoolId } },
    include: {
      class: true,
      _count: { select: { students: true } },
      attendances: { where: { date: today }, select: { id: true } },
      classTeacher: {
        include: {
          teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
      },
    },
    orderBy: [{ class: { displayOrder: "asc" } }, { name: "asc" }],
  });

  const formattedSections: AdminAttendanceSection[] = sections.map((s) => {
    const teacherUser = s.classTeacher?.teacher.user;
    return {
      id: s.id,
      name: `${s.class.name} - ${s.name}`,
      studentCount: s._count.students,
      isMarkedToday: s.attendances.length > 0,
      classTeacherName: teacherUser ? `${teacherUser.firstName} ${teacherUser.lastName}` : null,
    };
  });

  const initialSectionId = formattedSections[0]?.id || null;
  let initialRecords: AdminAttendanceRecordData | null = null;

  if (initialSectionId) {
    const [attendance, students] = await Promise.all([
      prisma.attendance.findMany({
        where: { sectionId: initialSectionId, date: today },
        select: { studentId: true, status: true, remarks: true },
      }),
      prisma.studentProfile.findMany({
        where: { sectionId: initialSectionId },
        include: { user: { select: { firstName: true, lastName: true } } },
        orderBy: { rollNumber: "asc" },
      }),
    ]);

    const map = new Map(attendance.map((a) => [a.studentId, a]));

    initialRecords = {
      date: today,
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
    };
  }

  return {
    sections: formattedSections,
    initialSectionId,
    initialDate: todayStr,
    initialRecords,
  };
}


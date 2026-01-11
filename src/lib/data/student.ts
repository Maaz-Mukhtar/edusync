import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { unstable_cache } from "next/cache";

// Cache configuration
const CACHE_REVALIDATE_SECONDS = 60;

// ============================================
// STUDENT PROFILE
// ============================================

export async function getStudentProfile() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "STUDENT") {
    redirect("/");
  }

  const studentProfile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      section: {
        include: {
          class: true,
        },
      },
    },
  });

  if (!studentProfile) {
    throw new Error("Student profile not found");
  }

  return studentProfile;
}

// ============================================
// DASHBOARD DATA
// ============================================

export interface StudentDashboardData {
  stats: {
    className: string;
    sectionName: string;
    attendancePercentage: number;
    totalAssessments: number;
    upcomingEvents: number;
  };
  todaySchedule: {
    id: string;
    startTime: string;
    endTime: string;
    room: string | null;
    subject: string;
    subjectColor: string | null;
  }[];
  recentGrades: {
    id: string;
    title: string;
    subject: string;
    subjectColor: string | null;
    marksObtained: number;
    totalMarks: number;
    percentage: number;
    date: Date;
  }[];
  announcements: {
    id: string;
    title: string;
    content: string;
    createdAt: Date;
  }[];
}

// Internal function to fetch dashboard data (cacheable)
async function fetchDashboardDataInternal(
  studentId: string,
  sectionId: string
): Promise<StudentDashboardData> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  // Run all queries in parallel
  const [
    sectionInfo,
    attendances,
    todaySchedule,
    recentResults,
    announcements,
  ] = await Promise.all([
    // Get section and class info
    prisma.section.findUnique({
      where: { id: sectionId },
      include: {
        class: true,
      },
    }),

    // Get attendance for current month
    prisma.attendance.findMany({
      where: {
        studentId,
        date: { gte: monthStart },
      },
      select: { status: true },
    }),

    // Get today's schedule
    prisma.timetableSlot.findMany({
      where: {
        sectionId,
        dayOfWeek,
      },
      include: {
        subject: true,
      },
      orderBy: { startTime: "asc" },
    }),

    // Get recent assessment results
    prisma.assessmentResult.findMany({
      where: { studentId },
      include: {
        assessment: {
          include: {
            subject: true,
          },
        },
      },
      orderBy: { assessment: { date: "desc" } },
      take: 5,
    }),

    // Get recent announcements for the school
    prisma.announcement.findMany({
      where: {
        OR: [
          { audience: { has: "ALL" } },
          { audience: { has: "STUDENTS" } },
        ],
        publishAt: { lte: new Date() },
      },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
  ]);

  // Calculate attendance percentage
  const presentDays = attendances.filter(
    (a) => a.status === "PRESENT" || a.status === "LATE"
  ).length;
  const totalDays = attendances.length;
  const attendancePercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

  return {
    stats: {
      className: sectionInfo?.class.name || "N/A",
      sectionName: sectionInfo?.name || "N/A",
      attendancePercentage,
      totalAssessments: recentResults.length,
      upcomingEvents: 0, // TODO: Add events query when events module is ready
    },
    todaySchedule: todaySchedule.map((slot) => ({
      id: slot.id,
      startTime: slot.startTime,
      endTime: slot.endTime,
      room: slot.room,
      subject: slot.subject.name,
      subjectColor: slot.subject.color,
    })),
    recentGrades: recentResults.map((r) => ({
      id: r.id,
      title: r.assessment.title,
      subject: r.assessment.subject.name,
      subjectColor: r.assessment.subject.color,
      marksObtained: r.marksObtained,
      totalMarks: r.assessment.totalMarks,
      percentage: Math.round((r.marksObtained / r.assessment.totalMarks) * 100),
      date: r.assessment.date,
    })),
    announcements: announcements.map((a) => ({
      id: a.id,
      title: a.title,
      content: a.content || "",
      createdAt: a.createdAt,
    })),
  };
}

// Cached version of dashboard data fetch
const getCachedDashboardData = (studentId: string, sectionId: string) =>
  unstable_cache(
    () => fetchDashboardDataInternal(studentId, sectionId),
    [`student-dashboard-${studentId}`],
    {
      revalidate: CACHE_REVALIDATE_SECONDS,
      tags: [`student-${studentId}`, "student-dashboard"],
    }
  )();

// Public function to get dashboard data
export async function getStudentDashboardData(): Promise<StudentDashboardData> {
  const studentProfile = await getStudentProfile();
  return getCachedDashboardData(studentProfile.id, studentProfile.sectionId);
}

// ============================================
// TIMETABLE DATA
// ============================================

export interface TimetableSlot {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string | null;
  subject: {
    id: string;
    name: string;
    code: string | null;
    color: string | null;
  };
  teacher: {
    id: string;
    name: string;
  } | null;
}

export interface TimetableData {
  className: string;
  sectionName: string;
  slots: TimetableSlot[];
}

// Internal function to fetch timetable data (cacheable)
async function fetchTimetableDataInternal(sectionId: string): Promise<TimetableData> {
  const [section, slots] = await Promise.all([
    prisma.section.findUnique({
      where: { id: sectionId },
      include: { class: true },
    }),
    prisma.timetableSlot.findMany({
      where: { sectionId },
      include: {
        subject: true,
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    }),
  ]);

  // Get teacher info for slots that have a teacherId
  const teacherIds = [...new Set(slots.filter(s => s.teacherId).map(s => s.teacherId as string))];
  const teachers = teacherIds.length > 0
    ? await prisma.teacherProfile.findMany({
        where: { id: { in: teacherIds } },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      })
    : [];

  const teacherMap = new Map(teachers.map(t => [t.id, t]));

  return {
    className: section?.class.name || "N/A",
    sectionName: section?.name || "N/A",
    slots: slots.map((slot) => {
      const teacher = slot.teacherId ? teacherMap.get(slot.teacherId) : null;
      return {
        id: slot.id,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        room: slot.room,
        subject: {
          id: slot.subject.id,
          name: slot.subject.name,
          code: slot.subject.code,
          color: slot.subject.color,
        },
        teacher: teacher
          ? {
              id: teacher.id,
              name: `${teacher.user.firstName} ${teacher.user.lastName}`,
            }
          : null,
      };
    }),
  };
}

// Cached version of timetable data fetch
const getCachedTimetableData = (sectionId: string) =>
  unstable_cache(
    () => fetchTimetableDataInternal(sectionId),
    [`student-timetable-${sectionId}`],
    {
      revalidate: 300, // 5 minutes - timetable changes rarely
      tags: [`section-${sectionId}`, "student-timetable"],
    }
  )();

// Public function to get timetable data
export async function getStudentTimetableData(): Promise<TimetableData> {
  const studentProfile = await getStudentProfile();
  return getCachedTimetableData(studentProfile.sectionId);
}

// ============================================
// ATTENDANCE HISTORY DATA
// ============================================

export interface AttendanceRecord {
  id: string;
  date: Date;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
  remarks: string | null;
}

export interface AttendanceHistoryData {
  className: string;
  sectionName: string;
  records: AttendanceRecord[];
  stats: {
    totalDays: number;
    presentDays: number;
    absentDays: number;
    lateDays: number;
    excusedDays: number;
    percentage: number;
  };
  monthlyStats: {
    month: string;
    year: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    total: number;
    percentage: number;
  }[];
}

// Internal function to fetch attendance history data (cacheable)
async function fetchAttendanceHistoryInternal(
  studentId: string,
  sectionId: string
): Promise<AttendanceHistoryData> {
  const [section, attendances] = await Promise.all([
    prisma.section.findUnique({
      where: { id: sectionId },
      include: { class: true },
    }),
    prisma.attendance.findMany({
      where: { studentId },
      orderBy: { date: "desc" },
    }),
  ]);

  // Calculate overall stats
  const presentDays = attendances.filter((a) => a.status === "PRESENT").length;
  const absentDays = attendances.filter((a) => a.status === "ABSENT").length;
  const lateDays = attendances.filter((a) => a.status === "LATE").length;
  const excusedDays = attendances.filter((a) => a.status === "EXCUSED").length;
  const totalDays = attendances.length;
  const percentage = totalDays > 0 ? Math.round(((presentDays + lateDays) / totalDays) * 100) : 0;

  // Calculate monthly stats
  const monthlyMap = new Map<string, {
    present: number;
    absent: number;
    late: number;
    excused: number;
    total: number;
  }>();

  for (const attendance of attendances) {
    const date = new Date(attendance.date);
    const key = `${date.getFullYear()}-${date.getMonth()}`;

    if (!monthlyMap.has(key)) {
      monthlyMap.set(key, { present: 0, absent: 0, late: 0, excused: 0, total: 0 });
    }

    const stats = monthlyMap.get(key)!;
    stats.total++;

    switch (attendance.status) {
      case "PRESENT": stats.present++; break;
      case "ABSENT": stats.absent++; break;
      case "LATE": stats.late++; break;
      case "EXCUSED": stats.excused++; break;
    }
  }

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthlyStats = Array.from(monthlyMap.entries())
    .map(([key, stats]) => {
      const [year, month] = key.split("-").map(Number);
      return {
        month: monthNames[month],
        year,
        ...stats,
        percentage: stats.total > 0 ? Math.round(((stats.present + stats.late) / stats.total) * 100) : 0,
      };
    })
    .sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return monthNames.indexOf(b.month) - monthNames.indexOf(a.month);
    })
    .slice(0, 6); // Last 6 months

  return {
    className: section?.class.name || "N/A",
    sectionName: section?.name || "N/A",
    records: attendances.map((a) => ({
      id: a.id,
      date: a.date,
      status: a.status as "PRESENT" | "ABSENT" | "LATE" | "EXCUSED",
      remarks: a.remarks,
    })),
    stats: {
      totalDays,
      presentDays,
      absentDays,
      lateDays,
      excusedDays,
      percentage,
    },
    monthlyStats,
  };
}

// Cached version of attendance history fetch
const getCachedAttendanceHistory = (studentId: string, sectionId: string) =>
  unstable_cache(
    () => fetchAttendanceHistoryInternal(studentId, sectionId),
    [`student-attendance-${studentId}`],
    {
      revalidate: 30, // Short cache for attendance
      tags: [`student-${studentId}`, "student-attendance"],
    }
  )();

// Public function to get attendance history
export async function getStudentAttendanceData(): Promise<AttendanceHistoryData> {
  const studentProfile = await getStudentProfile();
  return getCachedAttendanceHistory(studentProfile.id, studentProfile.sectionId);
}

// ============================================
// GRADES DATA
// ============================================

export interface GradeResult {
  id: string;
  assessmentId: string;
  title: string;
  type: string;
  subject: {
    id: string;
    name: string;
    color: string | null;
  };
  marksObtained: number;
  totalMarks: number;
  percentage: number;
  grade: string | null;
  date: Date;
  remarks: string | null;
}

export interface GradesData {
  className: string;
  sectionName: string;
  results: GradeResult[];
  subjectWiseStats: {
    subjectId: string;
    subjectName: string;
    subjectColor: string | null;
    totalAssessments: number;
    averagePercentage: number;
    highestScore: number;
    lowestScore: number;
  }[];
  overallStats: {
    totalAssessments: number;
    averagePercentage: number;
    highestPercentage: number;
    lowestPercentage: number;
  };
}

// Internal function to fetch grades data (cacheable)
async function fetchGradesDataInternal(
  studentId: string,
  sectionId: string
): Promise<GradesData> {
  const [section, results] = await Promise.all([
    prisma.section.findUnique({
      where: { id: sectionId },
      include: { class: true },
    }),
    prisma.assessmentResult.findMany({
      where: { studentId },
      include: {
        assessment: {
          include: {
            subject: true,
          },
        },
      },
      orderBy: { assessment: { date: "desc" } },
    }),
  ]);

  // Calculate percentages for each result
  const resultsWithPercentage = results.map((r) => ({
    ...r,
    percentage: Math.round((r.marksObtained / r.assessment.totalMarks) * 100),
  }));

  // Calculate subject-wise stats
  const subjectMap = new Map<string, {
    subjectName: string;
    subjectColor: string | null;
    percentages: number[];
  }>();

  for (const r of resultsWithPercentage) {
    const subjectId = r.assessment.subject.id;
    if (!subjectMap.has(subjectId)) {
      subjectMap.set(subjectId, {
        subjectName: r.assessment.subject.name,
        subjectColor: r.assessment.subject.color,
        percentages: [],
      });
    }
    subjectMap.get(subjectId)!.percentages.push(r.percentage);
  }

  const subjectWiseStats = Array.from(subjectMap.entries()).map(([subjectId, data]) => ({
    subjectId,
    subjectName: data.subjectName,
    subjectColor: data.subjectColor,
    totalAssessments: data.percentages.length,
    averagePercentage: Math.round(data.percentages.reduce((a, b) => a + b, 0) / data.percentages.length),
    highestScore: Math.max(...data.percentages),
    lowestScore: Math.min(...data.percentages),
  }));

  // Calculate overall stats
  const allPercentages = resultsWithPercentage.map((r) => r.percentage);
  const overallStats = {
    totalAssessments: results.length,
    averagePercentage: allPercentages.length > 0
      ? Math.round(allPercentages.reduce((a, b) => a + b, 0) / allPercentages.length)
      : 0,
    highestPercentage: allPercentages.length > 0 ? Math.max(...allPercentages) : 0,
    lowestPercentage: allPercentages.length > 0 ? Math.min(...allPercentages) : 0,
  };

  return {
    className: section?.class.name || "N/A",
    sectionName: section?.name || "N/A",
    results: resultsWithPercentage.map((r) => ({
      id: r.id,
      assessmentId: r.assessmentId,
      title: r.assessment.title,
      type: r.assessment.type,
      subject: {
        id: r.assessment.subject.id,
        name: r.assessment.subject.name,
        color: r.assessment.subject.color,
      },
      marksObtained: r.marksObtained,
      totalMarks: r.assessment.totalMarks,
      percentage: r.percentage,
      grade: r.grade,
      date: r.assessment.date,
      remarks: r.remarks,
    })),
    subjectWiseStats,
    overallStats,
  };
}

// Cached version of grades data fetch
const getCachedGradesData = (studentId: string, sectionId: string) =>
  unstable_cache(
    () => fetchGradesDataInternal(studentId, sectionId),
    [`student-grades-${studentId}`],
    {
      revalidate: CACHE_REVALIDATE_SECONDS,
      tags: [`student-${studentId}`, "student-grades"],
    }
  )();

// Public function to get grades data
export async function getStudentGradesData(): Promise<GradesData> {
  const studentProfile = await getStudentProfile();
  return getCachedGradesData(studentProfile.id, studentProfile.sectionId);
}

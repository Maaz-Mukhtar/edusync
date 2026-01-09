import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { unstable_cache } from "next/cache";

// Cache configuration
const CACHE_REVALIDATE_SECONDS = 60; // Revalidate every 60 seconds

// Dashboard data types
export interface DashboardData {
  stats: {
    assignedSections: number;
    totalStudents: number;
    todayClasses: number;
    pendingAttendance: number;
    assessmentsToGrade: number;
  };
  todaySchedule: {
    id: string;
    startTime: string;
    endTime: string;
    room: string | null;
    section: string;
    subject: string;
    subjectColor: string | null;
  }[];
  pendingAttendance: {
    sectionId: string;
    section: string;
    studentCount: number;
  }[];
  recentAssessments: {
    id: string;
    title: string;
    type: string;
    section: string;
    subject: string;
    date: Date;
    gradedCount: number;
    totalMarks: number;
  }[];
}

// Get teacher profile (with auth check)
export async function getTeacherProfile() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "TEACHER") {
    redirect("/");
  }

  const teacherProfile = await prisma.teacherProfile.findUnique({
    where: { userId: session.user.id },
  });

  if (!teacherProfile) {
    throw new Error("Teacher profile not found");
  }

  return teacherProfile;
}

// Internal function to fetch dashboard data (cacheable)
async function fetchDashboardDataInternal(teacherId: string): Promise<DashboardData> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay();

  // Run queries in parallel
  const [
    assignedSections,
    todaySchedule,
    pendingAttendance,
    recentAssessments,
    totalStudents,
  ] = await Promise.all([
    // Get assigned sections count
    prisma.sectionTeacher.count({
      where: { teacherId },
    }),

    // Get today's schedule
    prisma.timetableSlot.findMany({
      where: {
        section: {
          teachers: {
            some: { teacherId },
          },
        },
        dayOfWeek,
      },
      include: {
        section: {
          include: {
            class: true,
          },
        },
        subject: true,
      },
      orderBy: { startTime: "asc" },
    }),

    // Get sections without attendance today
    prisma.sectionTeacher.findMany({
      where: {
        teacherId,
        section: {
          attendances: {
            none: {
              date: today,
            },
          },
        },
      },
      include: {
        section: {
          include: {
            class: true,
            _count: {
              select: { students: true },
            },
          },
        },
      },
    }),

    // Get recent assessments by this teacher
    prisma.assessment.findMany({
      where: { createdById: teacherId },
      include: {
        section: {
          include: {
            class: true,
            _count: {
              select: { students: true },
            },
          },
        },
        subject: true,
        _count: {
          select: { results: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),

    // Get total students across assigned sections
    prisma.studentProfile.count({
      where: {
        section: {
          teachers: {
            some: { teacherId },
          },
        },
      },
    }),
  ]);

  // Calculate assessments needing grading
  const assessmentsNeedingGrading = recentAssessments.filter(
    (a) => a._count.results < (a.section._count?.students || 0)
  );

  return {
    stats: {
      assignedSections,
      totalStudents,
      todayClasses: todaySchedule.length,
      pendingAttendance: pendingAttendance.length,
      assessmentsToGrade: assessmentsNeedingGrading.length,
    },
    todaySchedule: todaySchedule.map((slot) => ({
      id: slot.id,
      startTime: slot.startTime,
      endTime: slot.endTime,
      room: slot.room,
      section: `${slot.section.class.name} - ${slot.section.name}`,
      subject: slot.subject.name,
      subjectColor: slot.subject.color,
    })),
    pendingAttendance: pendingAttendance.map((st) => ({
      sectionId: st.section.id,
      section: `${st.section.class.name} - ${st.section.name}`,
      studentCount: st.section._count.students,
    })),
    recentAssessments: recentAssessments.map((a) => ({
      id: a.id,
      title: a.title,
      type: a.type,
      section: `${a.section.class.name} - ${a.section.name}`,
      subject: a.subject.name,
      date: a.date,
      gradedCount: a._count.results,
      totalMarks: a.totalMarks,
    })),
  };
}

// Cached version of dashboard data fetch
const getCachedDashboardData = (teacherId: string) =>
  unstable_cache(
    () => fetchDashboardDataInternal(teacherId),
    [`teacher-dashboard-${teacherId}`],
    {
      revalidate: CACHE_REVALIDATE_SECONDS,
      tags: [`teacher-${teacherId}`, "teacher-dashboard"],
    }
  )();

// Public function to get dashboard data
export async function getTeacherDashboardData(): Promise<DashboardData> {
  const teacherProfile = await getTeacherProfile();
  return getCachedDashboardData(teacherProfile.id);
}

// Classes data types
export interface ClassesData {
  sections: {
    id: string;
    name: string;
    className: string;
    classId: string;
    isClassTeacher: boolean;
    capacity: number | null;
    studentCount: number;
    students: {
      id: string;
      rollNumber: string | null;
      userId: string;
      firstName: string;
      lastName: string;
      email: string | null;
      avatar: string | null;
    }[];
  }[];
  subjects: {
    id: string;
    name: string;
    code: string | null;
    color: string | null;
  }[];
}

// Internal function to fetch classes data (cacheable)
async function fetchClassesDataInternal(teacherId: string): Promise<ClassesData> {
  const [sectionTeachers, subjects] = await Promise.all([
    prisma.sectionTeacher.findMany({
      where: { teacherId },
      include: {
        section: {
          include: {
            class: true,
            students: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    avatar: true,
                  },
                },
              },
              orderBy: { rollNumber: "asc" },
            },
            _count: {
              select: { students: true },
            },
          },
        },
      },
    }),
    prisma.subject.findMany({
      where: {
        teachers: {
          some: { teacherId },
        },
      },
      distinct: ["id"],
    }),
  ]);

  return {
    sections: sectionTeachers.map((st) => ({
      id: st.section.id,
      name: st.section.name,
      className: st.section.class.name,
      classId: st.section.classId,
      isClassTeacher: st.isClassTeacher,
      capacity: st.section.capacity,
      studentCount: st.section._count.students,
      students: st.section.students.map((s) => ({
        id: s.id,
        rollNumber: s.rollNumber,
        userId: s.user.id,
        firstName: s.user.firstName,
        lastName: s.user.lastName,
        email: s.user.email,
        avatar: s.user.avatar,
      })),
    })),
    subjects: subjects.map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      color: s.color,
    })),
  };
}

// Cached version of classes data fetch
const getCachedClassesData = (teacherId: string) =>
  unstable_cache(
    () => fetchClassesDataInternal(teacherId),
    [`teacher-classes-${teacherId}`],
    {
      revalidate: CACHE_REVALIDATE_SECONDS,
      tags: [`teacher-${teacherId}`, "teacher-classes"],
    }
  )();

// Public function to get classes data
export async function getTeacherClassesData(): Promise<ClassesData> {
  const teacherProfile = await getTeacherProfile();
  return getCachedClassesData(teacherProfile.id);
}

// ============================================
// ATTENDANCE DATA
// ============================================

export interface AttendanceSection {
  id: string;
  name: string;
  studentCount: number;
  isMarkedToday: boolean;
  isClassTeacher: boolean;
}

export interface AttendanceRecord {
  studentId: string;
  rollNumber: string | null;
  studentName: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | null;
  remarks: string | null;
}

export interface AttendanceData {
  sections: AttendanceSection[];
  initialSectionId: string | null;
  initialDate: string;
  initialRecords: {
    date: Date;
    isMarked: boolean;
    records: AttendanceRecord[];
  } | null;
}

// Internal function to fetch attendance data (cacheable)
async function fetchAttendanceDataInternal(teacherId: string): Promise<AttendanceData> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];

  // Get sections with parallel query for initial section's attendance
  const sections = await prisma.sectionTeacher.findMany({
    where: { teacherId },
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
    orderBy: [
      { section: { class: { displayOrder: "asc" } } },
      { section: { name: "asc" } },
    ],
  });

  const formattedSections = sections.map((st) => ({
    id: st.section.id,
    name: `${st.section.class.name} - ${st.section.name}`,
    studentCount: st.section._count.students,
    isMarkedToday: st.section.attendances.length > 0,
    isClassTeacher: st.isClassTeacher,
  }));

  // If we have sections, fetch initial records for the first section in parallel
  let initialRecords = null;
  const firstSectionId = formattedSections[0]?.id || null;

  if (firstSectionId) {
    const [attendance, students] = await Promise.all([
      prisma.attendance.findMany({
        where: {
          sectionId: firstSectionId,
          date: today,
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
      }),
      prisma.studentProfile.findMany({
        where: { sectionId: firstSectionId },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { rollNumber: "asc" },
      }),
    ]);

    const attendanceMap = new Map(
      attendance.map((a) => [a.studentId, a])
    );

    initialRecords = {
      date: today,
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
    };
  }

  return {
    sections: formattedSections,
    initialSectionId: firstSectionId,
    initialDate: todayStr,
    initialRecords,
  };
}

// Cached version of attendance data fetch
const getCachedAttendanceData = (teacherId: string) =>
  unstable_cache(
    () => fetchAttendanceDataInternal(teacherId),
    [`teacher-attendance-${teacherId}`],
    {
      revalidate: 30, // Short cache for attendance (30 seconds)
      tags: [`teacher-${teacherId}`, "teacher-attendance"],
    }
  )();

// Public function to get attendance data
export async function getTeacherAttendanceData(): Promise<AttendanceData> {
  const teacherProfile = await getTeacherProfile();
  return getCachedAttendanceData(teacherProfile.id);
}

// ============================================
// GRADEBOOK DATA
// ============================================

export interface GradebookSection {
  id: string;
  name: string;
  className: string;
}

export interface GradebookSubject {
  id: string;
  name: string;
  color: string | null;
}

export interface GradebookAssessment {
  id: string;
  title: string;
  type: string;
  totalMarks: number;
  date: Date;
  subject: {
    id: string;
    name: string;
    color: string | null;
  };
}

export interface StudentGrade {
  studentId: string;
  rollNumber: string | null;
  studentName: string;
  results: Record<string, { marksObtained: number; percentage: number; grade: string | null } | null>;
  average: string | null;
  totalObtained: number;
  totalMax: number;
}

export interface GradebookStats {
  totalStudents: number;
  totalAssessments: number;
  averageScore: number;
  highestAverage: number;
  lowestAverage: number;
}

export interface GradebookData {
  sections: GradebookSection[];
  subjects: GradebookSubject[];
  initialSectionId: string | null;
  initialGradebook: {
    section: { id: string; name: string };
    assessments: GradebookAssessment[];
    gradebook: StudentGrade[];
    stats: GradebookStats;
  } | null;
}

// Internal function to fetch gradebook data (cacheable)
async function fetchGradebookDataInternal(teacherId: string): Promise<GradebookData> {
  // Fetch sections and subjects in parallel
  const [sectionTeachers, subjects] = await Promise.all([
    prisma.sectionTeacher.findMany({
      where: { teacherId },
      include: {
        section: {
          include: {
            class: true,
          },
        },
      },
      orderBy: [
        { section: { class: { displayOrder: "asc" } } },
        { section: { name: "asc" } },
      ],
    }),
    prisma.subject.findMany({
      where: {
        teachers: {
          some: { teacherId },
        },
      },
      distinct: ["id"],
    }),
  ]);

  const formattedSections = sectionTeachers.map((st) => ({
    id: st.section.id,
    name: st.section.name,
    className: st.section.class.name,
  }));

  const formattedSubjects = subjects.map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color,
  }));

  // Fetch initial gradebook for first section in parallel
  let initialGradebook = null;
  const firstSection = sectionTeachers[0]?.section;

  if (firstSection) {
    const [section, assessments] = await Promise.all([
      prisma.section.findUnique({
        where: { id: firstSection.id },
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
      }),
      prisma.assessment.findMany({
        where: { sectionId: firstSection.id },
        include: {
          subject: true,
          results: true,
        },
        orderBy: { date: "desc" },
      }),
    ]);

    if (section) {
      // Build gradebook matrix
      const gradebook = section.students.map((student) => {
        const studentResults: Record<string, { marksObtained: number; percentage: number; grade: string | null } | null> = {};
        let totalMarksObtained = 0;
        let totalMaxMarks = 0;

        for (const assessment of assessments) {
          const result = assessment.results.find((r) => r.studentId === student.id);
          if (result) {
            studentResults[assessment.id] = {
              marksObtained: result.marksObtained,
              percentage: (result.marksObtained / assessment.totalMarks) * 100,
              grade: result.grade,
            };
            totalMarksObtained += result.marksObtained;
            totalMaxMarks += assessment.totalMarks;
          } else {
            studentResults[assessment.id] = null;
          }
        }

        return {
          studentId: student.id,
          rollNumber: student.rollNumber,
          studentName: `${student.user.firstName} ${student.user.lastName}`,
          results: studentResults,
          average: totalMaxMarks > 0 ? ((totalMarksObtained / totalMaxMarks) * 100).toFixed(1) : null,
          totalObtained: totalMarksObtained,
          totalMax: totalMaxMarks,
        };
      });

      // Calculate stats
      const validAverages = gradebook
        .filter((s) => s.average !== null)
        .map((s) => parseFloat(s.average!));

      const stats: GradebookStats = {
        totalStudents: section.students.length,
        totalAssessments: assessments.length,
        averageScore: validAverages.length > 0
          ? parseFloat((validAverages.reduce((a, b) => a + b, 0) / validAverages.length).toFixed(1))
          : 0,
        highestAverage: validAverages.length > 0 ? Math.max(...validAverages) : 0,
        lowestAverage: validAverages.length > 0 ? Math.min(...validAverages) : 100,
      };

      initialGradebook = {
        section: {
          id: section.id,
          name: `${section.class.name} - ${section.name}`,
        },
        assessments: assessments.map((a) => ({
          id: a.id,
          title: a.title,
          type: a.type,
          totalMarks: a.totalMarks,
          date: a.date,
          subject: {
            id: a.subject.id,
            name: a.subject.name,
            color: a.subject.color,
          },
        })),
        gradebook,
        stats,
      };
    }
  }

  return {
    sections: formattedSections,
    subjects: formattedSubjects,
    initialSectionId: firstSection?.id || null,
    initialGradebook,
  };
}

// Cached version of gradebook data fetch
const getCachedGradebookData = (teacherId: string) =>
  unstable_cache(
    () => fetchGradebookDataInternal(teacherId),
    [`teacher-gradebook-${teacherId}`],
    {
      revalidate: CACHE_REVALIDATE_SECONDS,
      tags: [`teacher-${teacherId}`, "teacher-gradebook"],
    }
  )();

// Public function to get gradebook data
export async function getTeacherGradebookData(): Promise<GradebookData> {
  const teacherProfile = await getTeacherProfile();
  return getCachedGradebookData(teacherProfile.id);
}

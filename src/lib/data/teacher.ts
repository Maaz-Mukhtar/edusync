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

  // Get sections where teacher is class teacher
  const classTeacherSections = await prisma.sectionTeacher.findMany({
    where: { teacherId },
    select: { sectionId: true },
  });

  // Get sections where teacher teaches subjects
  const subjectTeacherSections = await prisma.sectionSubjectTeacher.findMany({
    where: { teacherId },
    select: { sectionId: true },
  });

  // Combine section IDs
  const allSectionIds = [...new Set([
    ...classTeacherSections.map(s => s.sectionId),
    ...subjectTeacherSections.map(s => s.sectionId),
  ])];

  // Run queries in parallel
  const [
    todaySchedule,
    pendingAttendanceSections,
    recentAssessments,
    totalStudents,
  ] = await Promise.all([
    // Get today's schedule for teacher's sections
    prisma.timetableSlot.findMany({
      where: {
        sectionId: { in: allSectionIds },
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
    prisma.section.findMany({
      where: {
        id: { in: allSectionIds },
        attendances: {
          none: {
            date: today,
          },
        },
      },
      include: {
        class: true,
        _count: {
          select: { students: true },
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
        sectionId: { in: allSectionIds },
      },
    }),
  ]);

  // Calculate assessments needing grading
  const assessmentsNeedingGrading = recentAssessments.filter(
    (a) => a._count.results < (a.section._count?.students || 0)
  );

  return {
    stats: {
      assignedSections: allSectionIds.length,
      totalStudents,
      todayClasses: todaySchedule.length,
      pendingAttendance: pendingAttendanceSections.length,
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
    pendingAttendance: pendingAttendanceSections.map((section) => ({
      sectionId: section.id,
      section: `${section.class.name} - ${section.name}`,
      studentCount: section._count.students,
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
  // Get sections where teacher is class teacher
  const classTeacherSections = await prisma.sectionTeacher.findMany({
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
  });

  // Get sections where teacher teaches subjects
  const subjectTeacherSections = await prisma.sectionSubjectTeacher.findMany({
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
  });

  // Combine and deduplicate sections
  const allSections = new Map<string, { section: typeof classTeacherSections[0]["section"]; isClassTeacher: boolean }>();

  for (const ct of classTeacherSections) {
    allSections.set(ct.sectionId, { section: ct.section, isClassTeacher: true });
  }

  for (const st of subjectTeacherSections) {
    if (!allSections.has(st.sectionId)) {
      allSections.set(st.sectionId, { section: st.section, isClassTeacher: false });
    }
  }

  // Sort sections
  const sectionsArray = Array.from(allSections.values())
    .sort((a, b) => {
      const orderDiff = a.section.class.displayOrder - b.section.class.displayOrder;
      if (orderDiff !== 0) return orderDiff;
      return a.section.name.localeCompare(b.section.name);
    });

  // Get subjects taught by this teacher
  const subjects = await prisma.teacherSubject.findMany({
    where: { teacherId },
    include: {
      subject: true,
    },
  });

  return {
    sections: sectionsArray.map((item) => ({
      id: item.section.id,
      name: item.section.name,
      className: item.section.class.name,
      classId: item.section.classId,
      isClassTeacher: item.isClassTeacher,
      capacity: item.section.capacity,
      studentCount: item.section._count.students,
      students: item.section.students.map((s) => ({
        id: s.id,
        rollNumber: s.rollNumber,
        userId: s.user.id,
        firstName: s.user.firstName,
        lastName: s.user.lastName,
        email: s.user.email,
        avatar: s.user.avatar,
      })),
    })),
    subjects: subjects.map((ts) => ({
      id: ts.subject.id,
      name: ts.subject.name,
      code: ts.subject.code,
      color: ts.subject.color,
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

  // Get sections where teacher is class teacher
  const classTeacherSections = await prisma.sectionTeacher.findMany({
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
  });

  // Get sections where teacher teaches subjects
  const subjectTeacherSections = await prisma.sectionSubjectTeacher.findMany({
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
  });

  // Combine and deduplicate sections
  const allSections = new Map<string, { section: typeof classTeacherSections[0]["section"]; isClassTeacher: boolean }>();

  for (const ct of classTeacherSections) {
    allSections.set(ct.sectionId, { section: ct.section, isClassTeacher: true });
  }

  for (const st of subjectTeacherSections) {
    if (!allSections.has(st.sectionId)) {
      allSections.set(st.sectionId, { section: st.section, isClassTeacher: false });
    }
  }

  // Sort sections
  const sectionsArray = Array.from(allSections.values())
    .sort((a, b) => {
      const orderDiff = a.section.class.displayOrder - b.section.class.displayOrder;
      if (orderDiff !== 0) return orderDiff;
      return a.section.name.localeCompare(b.section.name);
    });

  const formattedSections = sectionsArray.map((item) => ({
    id: item.section.id,
    name: `${item.section.class.name} - ${item.section.name}`,
    studentCount: item.section._count.students,
    isMarkedToday: item.section.attendances.length > 0,
    isClassTeacher: item.isClassTeacher,
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
  // Get sections where teacher is class teacher
  const classTeacherSections = await prisma.sectionTeacher.findMany({
    where: { teacherId },
    include: {
      section: {
        include: {
          class: true,
        },
      },
    },
  });

  // Get sections where teacher teaches subjects
  const subjectTeacherSections = await prisma.sectionSubjectTeacher.findMany({
    where: { teacherId },
    include: {
      section: {
        include: {
          class: true,
        },
      },
    },
  });

  // Combine sections
  const allSections = new Map<string, { section: typeof classTeacherSections[0]["section"] }>();

  for (const ct of classTeacherSections) {
    allSections.set(ct.sectionId, { section: ct.section });
  }

  for (const st of subjectTeacherSections) {
    if (!allSections.has(st.sectionId)) {
      allSections.set(st.sectionId, { section: st.section });
    }
  }

  // Sort sections
  const sectionsArray = Array.from(allSections.values())
    .sort((a, b) => {
      const orderDiff = a.section.class.displayOrder - b.section.class.displayOrder;
      if (orderDiff !== 0) return orderDiff;
      return a.section.name.localeCompare(b.section.name);
    });

  // Get subjects taught by this teacher
  const subjects = await prisma.teacherSubject.findMany({
    where: { teacherId },
    include: {
      subject: true,
    },
  });

  const formattedSections = sectionsArray.map((item) => ({
    id: item.section.id,
    name: item.section.name,
    className: item.section.class.name,
  }));

  const formattedSubjects = subjects.map((ts) => ({
    id: ts.subject.id,
    name: ts.subject.name,
    color: ts.subject.color,
  }));

  // Fetch initial gradebook for first section in parallel
  let initialGradebook = null;
  const firstSection = sectionsArray[0]?.section;

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

// ============================================
// ASSESSMENTS DATA
// ============================================

export type AssessmentType = "TEST" | "QUIZ" | "ASSIGNMENT" | "EXAM";

export interface AssessmentItem {
  id: string;
  title: string;
  type: AssessmentType;
  totalMarks: number;
  date: Date;
  description: string | null;
  topics: string[];
  section: {
    id: string;
    name: string;
  };
  subject: {
    id: string;
    name: string;
    color: string | null;
  };
  gradedCount: number;
  totalStudents: number;
  createdAt: Date;
}

export interface AssessmentSection {
  id: string;
  name: string;
  className: string;
}

export interface AssessmentSubject {
  id: string;
  name: string;
  color: string | null;
}

export interface AssessmentsData {
  assessments: AssessmentItem[];
  sections: AssessmentSection[];
  subjects: AssessmentSubject[];
}

// Internal function to fetch assessments data (cacheable)
async function fetchAssessmentsDataInternal(teacherId: string): Promise<AssessmentsData> {
  // Get sections where teacher is class teacher
  const classTeacherSections = await prisma.sectionTeacher.findMany({
    where: { teacherId },
    include: {
      section: {
        include: { class: true },
      },
    },
  });

  // Get sections where teacher teaches subjects
  const subjectTeacherSections = await prisma.sectionSubjectTeacher.findMany({
    where: { teacherId },
    include: {
      section: {
        include: { class: true },
      },
    },
  });

  // Combine sections
  const allSections = new Map<string, typeof classTeacherSections[0]["section"]>();

  for (const ct of classTeacherSections) {
    allSections.set(ct.sectionId, ct.section);
  }

  for (const st of subjectTeacherSections) {
    if (!allSections.has(st.sectionId)) {
      allSections.set(st.sectionId, st.section);
    }
  }

  // Sort sections
  const sectionsArray = Array.from(allSections.values())
    .sort((a, b) => {
      const orderDiff = a.class.displayOrder - b.class.displayOrder;
      if (orderDiff !== 0) return orderDiff;
      return a.name.localeCompare(b.name);
    });

  // Fetch all data in parallel
  const [assessments, subjects, studentCounts] = await Promise.all([
    // Get assessments
    prisma.assessment.findMany({
      where: { createdById: teacherId },
      include: {
        section: {
          include: { class: true },
        },
        subject: true,
        _count: {
          select: { results: true },
        },
      },
      orderBy: { date: "desc" },
    }),
    // Get subjects
    prisma.teacherSubject.findMany({
      where: { teacherId },
      include: {
        subject: true,
      },
    }),
    // Get student counts per section
    prisma.studentProfile.groupBy({
      by: ["sectionId"],
      _count: true,
    }),
  ]);

  const countMap = new Map(studentCounts.map((sc) => [sc.sectionId, sc._count]));

  return {
    assessments: assessments.map((a) => ({
      id: a.id,
      title: a.title,
      type: a.type as AssessmentType,
      totalMarks: a.totalMarks,
      date: a.date,
      description: a.description,
      topics: a.topics,
      section: {
        id: a.section.id,
        name: `${a.section.class.name} - ${a.section.name}`,
      },
      subject: {
        id: a.subject.id,
        name: a.subject.name,
        color: a.subject.color,
      },
      gradedCount: a._count.results,
      totalStudents: countMap.get(a.sectionId) || 0,
      createdAt: a.createdAt,
    })),
    sections: sectionsArray.map((section) => ({
      id: section.id,
      name: section.name,
      className: section.class.name,
    })),
    subjects: subjects.map((ts) => ({
      id: ts.subject.id,
      name: ts.subject.name,
      color: ts.subject.color,
    })),
  };
}

// Cached version of assessments data fetch
const getCachedAssessmentsData = (teacherId: string) =>
  unstable_cache(
    () => fetchAssessmentsDataInternal(teacherId),
    [`teacher-assessments-${teacherId}`],
    {
      revalidate: CACHE_REVALIDATE_SECONDS,
      tags: [`teacher-${teacherId}`, "teacher-assessments"],
    }
  )();

// Public function to get assessments data
export async function getTeacherAssessmentsData(): Promise<AssessmentsData> {
  const teacherProfile = await getTeacherProfile();
  return getCachedAssessmentsData(teacherProfile.id);
}

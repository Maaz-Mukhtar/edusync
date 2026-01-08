import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";

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

// Fetch dashboard data
export async function getTeacherDashboardData(): Promise<DashboardData> {
  const teacherProfile = await getTeacherProfile();

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
      where: { teacherId: teacherProfile.id },
    }),

    // Get today's schedule
    prisma.timetableSlot.findMany({
      where: {
        section: {
          teachers: {
            some: { teacherId: teacherProfile.id },
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
        teacherId: teacherProfile.id,
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
      where: { createdById: teacherProfile.id },
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
            some: { teacherId: teacherProfile.id },
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

// Fetch teacher classes data
export async function getTeacherClassesData(): Promise<ClassesData> {
  const teacherProfile = await getTeacherProfile();

  const [sectionTeachers, subjects] = await Promise.all([
    prisma.sectionTeacher.findMany({
      where: { teacherId: teacherProfile.id },
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
          some: { teacherId: teacherProfile.id },
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

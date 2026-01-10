import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { unstable_cache } from "next/cache";

// Cache configuration
const CACHE_REVALIDATE_SECONDS = 60;

// ============================================
// PARENT PROFILE
// ============================================

export interface ChildInfo {
  id: string;
  studentId: string;
  name: string;
  className: string;
  sectionName: string;
  sectionId: string;
  rollNumber: string | null;
  avatar: string | null;
}

export async function getParentProfile() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "PARENT") {
    redirect("/");
  }

  const parentProfile = await prisma.parentProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      children: {
        include: {
          student: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  avatar: true,
                },
              },
              section: {
                include: {
                  class: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!parentProfile) {
    throw new Error("Parent profile not found");
  }

  const children: ChildInfo[] = parentProfile.children.map((c) => ({
    id: c.id,
    studentId: c.student.id,
    name: `${c.student.user.firstName} ${c.student.user.lastName}`,
    className: c.student.section.class.name,
    sectionName: c.student.section.name,
    sectionId: c.student.section.id,
    rollNumber: c.student.rollNumber,
    avatar: c.student.user.avatar,
  }));

  return {
    ...parentProfile,
    childrenInfo: children,
  };
}

// ============================================
// DASHBOARD DATA
// ============================================

export interface ChildDashboardInfo {
  id: string;
  studentId: string;
  name: string;
  className: string;
  sectionName: string;
  attendancePercentage: number;
  pendingFees: number;
  recentGrade: {
    title: string;
    subject: string;
    percentage: number;
  } | null;
}

export interface PendingEventApproval {
  eventId: string;
  eventTitle: string;
  eventType: string;
  deadline: Date;
  childrenPending: string[];
  isUrgent: boolean;
}

export interface ParentDashboardData {
  children: ChildDashboardInfo[];
  stats: {
    totalChildren: number;
    avgAttendance: number;
    totalPendingFees: number;
    unreadNotifications: number;
    pendingEventApprovals: number;
  };
  announcements: {
    id: string;
    title: string;
    content: string;
    createdAt: Date;
  }[];
  pendingEvents: PendingEventApproval[];
}

// Internal function to fetch dashboard data (cacheable)
async function fetchDashboardDataInternal(parentId: string): Promise<ParentDashboardData> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  // First, get the list of children (lightweight query)
  const parentChildren = await prisma.parentStudent.findMany({
    where: { parentId },
    select: { studentId: true },
  });

  const studentIds = parentChildren.map((c) => c.studentId);

  if (studentIds.length === 0) {
    return {
      children: [],
      stats: {
        totalChildren: 0,
        avgAttendance: 0,
        totalPendingFees: 0,
        unreadNotifications: 0,
        pendingEventApprovals: 0,
      },
      announcements: [],
      pendingEvents: [],
    };
  }

  const now = new Date();

  // Run all queries in parallel (6 separate queries like teacher portal)
  const [
    students,
    attendances,
    pendingFees,
    recentResults,
    announcements,
    eventApprovals,
  ] = await Promise.all([
    // 1. Get student profiles with user and section info
    prisma.studentProfile.findMany({
      where: { id: { in: studentIds } },
      include: {
        user: { select: { firstName: true, lastName: true } },
        section: { include: { class: true } },
      },
    }),

    // 2. Get attendance for current month (grouped by student)
    prisma.attendance.findMany({
      where: {
        studentId: { in: studentIds },
        date: { gte: monthStart },
      },
      select: { studentId: true, status: true },
    }),

    // 3. Get pending fee totals per student
    prisma.feeInvoice.groupBy({
      by: ["studentId"],
      where: {
        studentId: { in: studentIds },
        status: "PENDING",
      },
      _sum: { amount: true },
    }),

    // 4. Get most recent result per student
    prisma.assessmentResult.findMany({
      where: { studentId: { in: studentIds } },
      orderBy: { assessment: { date: "desc" } },
      include: {
        assessment: {
          include: { subject: { select: { name: true } } },
        },
      },
      distinct: ["studentId"],
    }),

    // 5. Get announcements
    prisma.announcement.findMany({
      where: {
        OR: [
          { audience: { has: "ALL" } },
          { audience: { has: "PARENTS" } },
        ],
        publishAt: { lte: new Date() },
      },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),

    // 6. Get pending event approvals
    prisma.eventApproval.findMany({
      where: {
        parentId,
        status: "PENDING",
        event: {
          deadline: { gte: now },
          startDate: { gte: now },
        },
      },
      include: {
        event: { select: { id: true, title: true, type: true, deadline: true } },
        student: {
          include: { user: { select: { firstName: true } } },
        },
      },
      orderBy: { event: { deadline: "asc" } },
    }),
  ]);

  // Build lookup maps for O(1) access
  const attendanceByStudent = new Map<string, { present: number; total: number }>();
  for (const a of attendances) {
    if (!attendanceByStudent.has(a.studentId)) {
      attendanceByStudent.set(a.studentId, { present: 0, total: 0 });
    }
    const stats = attendanceByStudent.get(a.studentId)!;
    stats.total++;
    if (a.status === "PRESENT" || a.status === "LATE") {
      stats.present++;
    }
  }

  const feesByStudent = new Map(
    pendingFees.map((f) => [f.studentId, f._sum.amount || 0])
  );

  const resultsByStudent = new Map(
    recentResults.map((r) => [r.studentId, r])
  );

  // Process children data
  const children: ChildDashboardInfo[] = students.map((student) => {
    const attStats = attendanceByStudent.get(student.id);
    const attendancePercentage = attStats && attStats.total > 0
      ? Math.round((attStats.present / attStats.total) * 100)
      : 0;

    const studentPendingFees = feesByStudent.get(student.id) || 0;

    const recentResult = resultsByStudent.get(student.id);
    const recentGrade = recentResult
      ? {
          title: recentResult.assessment.title,
          subject: recentResult.assessment.subject.name,
          percentage: Math.round(
            (recentResult.marksObtained / recentResult.assessment.totalMarks) * 100
          ),
        }
      : null;

    // Find the parentStudent record to get the id
    const parentStudent = parentChildren.find((c) => c.studentId === student.id);

    return {
      id: parentStudent?.studentId || student.id,
      studentId: student.id,
      name: `${student.user.firstName} ${student.user.lastName}`,
      className: student.section.class.name,
      sectionName: student.section.name,
      attendancePercentage,
      pendingFees: studentPendingFees,
      recentGrade,
    };
  });

  // Calculate aggregate stats
  const totalPendingFees = children.reduce((acc, c) => acc + c.pendingFees, 0);
  const avgAttendance =
    children.length > 0
      ? Math.round(children.reduce((acc, c) => acc + c.attendancePercentage, 0) / children.length)
      : 0;

  // Process pending event approvals - group by event
  const eventMap = new Map<string, PendingEventApproval>();
  for (const approval of eventApprovals) {
    const eventId = approval.eventId;
    if (!eventMap.has(eventId)) {
      const daysUntilDeadline = Math.ceil(
        (approval.event.deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      eventMap.set(eventId, {
        eventId,
        eventTitle: approval.event.title,
        eventType: approval.event.type,
        deadline: approval.event.deadline,
        childrenPending: [],
        isUrgent: daysUntilDeadline <= 2,
      });
    }
    eventMap.get(eventId)!.childrenPending.push(approval.student.user.firstName);
  }

  const pendingEvents = Array.from(eventMap.values());

  return {
    children,
    stats: {
      totalChildren: children.length,
      avgAttendance,
      totalPendingFees,
      unreadNotifications: 0,
      pendingEventApprovals: eventApprovals.length,
    },
    announcements: announcements.map((a) => ({
      id: a.id,
      title: a.title,
      content: a.content || "",
      createdAt: a.createdAt,
    })),
    pendingEvents,
  };
}

// Cached version of dashboard data fetch
const getCachedDashboardData = (parentId: string) =>
  unstable_cache(
    () => fetchDashboardDataInternal(parentId),
    [`parent-dashboard-${parentId}`],
    {
      revalidate: CACHE_REVALIDATE_SECONDS,
      tags: [`parent-${parentId}`, "parent-dashboard"],
    }
  )();

// Public function to get dashboard data
export async function getParentDashboardData(): Promise<ParentDashboardData> {
  const parentProfile = await getParentProfile();
  return getCachedDashboardData(parentProfile.id);
}

// ============================================
// CHILD ATTENDANCE DATA
// ============================================

export interface ChildAttendanceData {
  child: {
    name: string;
    className: string;
    sectionName: string;
  };
  records: {
    id: string;
    date: Date;
    status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
    remarks: string | null;
  }[];
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

// Internal function to fetch child attendance data
async function fetchChildAttendanceInternal(
  studentId: string
): Promise<ChildAttendanceData> {
  const [student, attendances] = await Promise.all([
    prisma.studentProfile.findUnique({
      where: { id: studentId },
      include: {
        user: { select: { firstName: true, lastName: true } },
        section: { include: { class: true } },
      },
    }),
    prisma.attendance.findMany({
      where: { studentId },
      orderBy: { date: "desc" },
    }),
  ]);

  if (!student) {
    throw new Error("Student not found");
  }

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
    .slice(0, 6);

  return {
    child: {
      name: `${student.user.firstName} ${student.user.lastName}`,
      className: student.section.class.name,
      sectionName: student.section.name,
    },
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

// Cached version
const getCachedChildAttendance = (studentId: string) =>
  unstable_cache(
    () => fetchChildAttendanceInternal(studentId),
    [`parent-child-attendance-${studentId}`],
    {
      revalidate: 30,
      tags: [`student-${studentId}`, "parent-attendance"],
    }
  )();

// Public function - validates parent has access to this child
export async function getChildAttendanceData(studentId: string): Promise<ChildAttendanceData> {
  const parentProfile = await getParentProfile();

  // Verify this child belongs to the parent
  const isParentChild = parentProfile.childrenInfo.some((c) => c.studentId === studentId);
  if (!isParentChild) {
    throw new Error("Access denied");
  }

  return getCachedChildAttendance(studentId);
}

// ============================================
// CHILD GRADES DATA
// ============================================

export interface ChildGradesData {
  child: {
    name: string;
    className: string;
    sectionName: string;
  };
  results: {
    id: string;
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
  }[];
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

// Internal function to fetch child grades data
async function fetchChildGradesInternal(studentId: string): Promise<ChildGradesData> {
  const [student, results] = await Promise.all([
    prisma.studentProfile.findUnique({
      where: { id: studentId },
      include: {
        user: { select: { firstName: true, lastName: true } },
        section: { include: { class: true } },
      },
    }),
    prisma.assessmentResult.findMany({
      where: { studentId },
      include: {
        assessment: {
          include: { subject: true },
        },
      },
      orderBy: { assessment: { date: "desc" } },
    }),
  ]);

  if (!student) {
    throw new Error("Student not found");
  }

  // Calculate percentages
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
    child: {
      name: `${student.user.firstName} ${student.user.lastName}`,
      className: student.section.class.name,
      sectionName: student.section.name,
    },
    results: resultsWithPercentage.map((r) => ({
      id: r.id,
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

// Cached version
const getCachedChildGrades = (studentId: string) =>
  unstable_cache(
    () => fetchChildGradesInternal(studentId),
    [`parent-child-grades-${studentId}`],
    {
      revalidate: CACHE_REVALIDATE_SECONDS,
      tags: [`student-${studentId}`, "parent-grades"],
    }
  )();

// Public function
export async function getChildGradesData(studentId: string): Promise<ChildGradesData> {
  const parentProfile = await getParentProfile();

  const isParentChild = parentProfile.childrenInfo.some((c) => c.studentId === studentId);
  if (!isParentChild) {
    throw new Error("Access denied");
  }

  return getCachedChildGrades(studentId);
}

// ============================================
// FEES DATA
// ============================================

export interface FeeInvoice {
  id: string;
  childName: string;
  studentId: string;
  feeType: string;
  amount: number;
  dueDate: Date;
  paidDate: Date | null;
  status: "PENDING" | "PAID" | "OVERDUE" | "CANCELLED";
  paymentMethod: string | null;
  transactionId: string | null;
  remarks: string | null;
}

export interface FeesData {
  invoices: FeeInvoice[];
  summary: {
    totalPending: number;
    totalPaid: number;
    totalOverdue: number;
    pendingCount: number;
    paidCount: number;
    overdueCount: number;
  };
  byChild: {
    studentId: string;
    childName: string;
    pending: number;
    paid: number;
    overdue: number;
  }[];
}

// Internal function to fetch fees data
async function fetchFeesDataInternal(parentId: string): Promise<FeesData> {
  // First get children list (lightweight query)
  const parentChildren = await prisma.parentStudent.findMany({
    where: { parentId },
    select: { studentId: true },
  });

  const studentIds = parentChildren.map((c) => c.studentId);

  if (studentIds.length === 0) {
    return {
      invoices: [],
      summary: {
        totalPending: 0,
        totalPaid: 0,
        totalOverdue: 0,
        pendingCount: 0,
        paidCount: 0,
        overdueCount: 0,
      },
      byChild: [],
    };
  }

  // Run queries in parallel
  const [students, feeInvoices] = await Promise.all([
    // Get student names
    prisma.studentProfile.findMany({
      where: { id: { in: studentIds } },
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
    }),

    // Get all fee invoices
    prisma.feeInvoice.findMany({
      where: { studentId: { in: studentIds } },
      include: {
        feeStructure: { select: { name: true } },
      },
      orderBy: { dueDate: "desc" },
    }),
  ]);

  // Build student name lookup
  const studentNames = new Map(
    students.map((s) => [s.id, `${s.user.firstName} ${s.user.lastName}`])
  );

  const today = new Date();
  const invoices: FeeInvoice[] = [];
  const byChildMap = new Map<string, {
    childName: string;
    pending: number;
    paid: number;
    overdue: number;
  }>();

  // Initialize byChildMap for all children
  for (const studentId of studentIds) {
    byChildMap.set(studentId, {
      childName: studentNames.get(studentId) || "Unknown",
      pending: 0,
      paid: 0,
      overdue: 0,
    });
  }

  for (const invoice of feeInvoices) {
    const childName = studentNames.get(invoice.studentId) || "Unknown";
    const isOverdue = invoice.status === "PENDING" && new Date(invoice.dueDate) < today;
    const status = isOverdue ? "OVERDUE" : invoice.status;

    invoices.push({
      id: invoice.id,
      childName,
      studentId: invoice.studentId,
      feeType: invoice.feeStructure.name,
      amount: invoice.amount,
      dueDate: invoice.dueDate,
      paidDate: invoice.paidDate,
      status: status as "PENDING" | "PAID" | "OVERDUE" | "CANCELLED",
      paymentMethod: invoice.paymentMethod,
      transactionId: invoice.transactionId,
      remarks: invoice.remarks,
    });

    const childStats = byChildMap.get(invoice.studentId);
    if (childStats) {
      if (status === "PAID") {
        childStats.paid += invoice.amount;
      } else if (status === "OVERDUE") {
        childStats.overdue += invoice.amount;
      } else if (status === "PENDING") {
        childStats.pending += invoice.amount;
      }
    }
  }

  // Calculate summary
  const pendingInvoices = invoices.filter((i) => i.status === "PENDING");
  const paidInvoices = invoices.filter((i) => i.status === "PAID");
  const overdueInvoices = invoices.filter((i) => i.status === "OVERDUE");

  return {
    invoices,
    summary: {
      totalPending: pendingInvoices.reduce((acc, i) => acc + i.amount, 0),
      totalPaid: paidInvoices.reduce((acc, i) => acc + i.amount, 0),
      totalOverdue: overdueInvoices.reduce((acc, i) => acc + i.amount, 0),
      pendingCount: pendingInvoices.length,
      paidCount: paidInvoices.length,
      overdueCount: overdueInvoices.length,
    },
    byChild: Array.from(byChildMap.entries()).map(([studentId, stats]) => ({
      studentId,
      ...stats,
    })),
  };
}

// Cached version
const getCachedFeesData = (parentId: string) =>
  unstable_cache(
    () => fetchFeesDataInternal(parentId),
    [`parent-fees-${parentId}`],
    {
      revalidate: CACHE_REVALIDATE_SECONDS,
      tags: [`parent-${parentId}`, "parent-fees"],
    }
  )();

// Public function
export async function getParentFeesData(): Promise<FeesData> {
  const parentProfile = await getParentProfile();
  return getCachedFeesData(parentProfile.id);
}

// ============================================
// HELPER: Get children list (for child switcher)
// ============================================

export async function getParentChildren(): Promise<ChildInfo[]> {
  const parentProfile = await getParentProfile();
  return parentProfile.childrenInfo;
}

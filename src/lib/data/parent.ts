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

export interface ParentDashboardData {
  children: ChildDashboardInfo[];
  stats: {
    totalChildren: number;
    avgAttendance: number;
    totalPendingFees: number;
    unreadNotifications: number;
  };
  announcements: {
    id: string;
    title: string;
    content: string;
    createdAt: Date;
  }[];
}

// Internal function to fetch dashboard data (cacheable)
async function fetchDashboardDataInternal(parentId: string): Promise<ParentDashboardData> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  // Fetch parent with children data in parallel with announcements
  const [parentData, announcements] = await Promise.all([
    prisma.parentProfile.findUnique({
      where: { id: parentId },
      include: {
        children: {
          include: {
            student: {
              include: {
                user: {
                  select: { firstName: true, lastName: true },
                },
                section: {
                  include: { class: true },
                },
                attendances: {
                  where: { date: { gte: monthStart } },
                  select: { status: true },
                },
                feeInvoices: {
                  where: { status: "PENDING" },
                  select: { amount: true },
                },
                results: {
                  take: 1,
                  orderBy: { assessment: { date: "desc" } },
                  include: {
                    assessment: {
                      include: { subject: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
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
  ]);

  if (!parentData) {
    return {
      children: [],
      stats: {
        totalChildren: 0,
        avgAttendance: 0,
        totalPendingFees: 0,
        unreadNotifications: 0,
      },
      announcements: [],
    };
  }

  // Process children data
  const children: ChildDashboardInfo[] = parentData.children.map((c) => {
    const presentDays = c.student.attendances.filter(
      (a) => a.status === "PRESENT" || a.status === "LATE"
    ).length;
    const totalDays = c.student.attendances.length;
    const attendancePercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

    const pendingFees = c.student.feeInvoices.reduce((acc, inv) => acc + inv.amount, 0);

    const recentResult = c.student.results[0];
    const recentGrade = recentResult
      ? {
          title: recentResult.assessment.title,
          subject: recentResult.assessment.subject.name,
          percentage: Math.round(
            (recentResult.marksObtained / recentResult.assessment.totalMarks) * 100
          ),
        }
      : null;

    return {
      id: c.id,
      studentId: c.student.id,
      name: `${c.student.user.firstName} ${c.student.user.lastName}`,
      className: c.student.section.class.name,
      sectionName: c.student.section.name,
      attendancePercentage,
      pendingFees,
      recentGrade,
    };
  });

  // Calculate aggregate stats
  const totalPendingFees = children.reduce((acc, c) => acc + c.pendingFees, 0);
  const avgAttendance =
    children.length > 0
      ? Math.round(children.reduce((acc, c) => acc + c.attendancePercentage, 0) / children.length)
      : 0;

  return {
    children,
    stats: {
      totalChildren: children.length,
      avgAttendance,
      totalPendingFees,
      unreadNotifications: 0,
    },
    announcements: announcements.map((a) => ({
      id: a.id,
      title: a.title,
      content: a.content || "",
      createdAt: a.createdAt,
    })),
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
  const parentData = await prisma.parentProfile.findUnique({
    where: { id: parentId },
    include: {
      children: {
        include: {
          student: {
            include: {
              user: { select: { firstName: true, lastName: true } },
              feeInvoices: {
                include: {
                  feeStructure: true,
                },
                orderBy: { dueDate: "desc" },
              },
            },
          },
        },
      },
    },
  });

  if (!parentData) {
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

  const today = new Date();
  const invoices: FeeInvoice[] = [];
  const byChildMap = new Map<string, {
    childName: string;
    pending: number;
    paid: number;
    overdue: number;
  }>();

  for (const child of parentData.children) {
    const childName = `${child.student.user.firstName} ${child.student.user.lastName}`;

    if (!byChildMap.has(child.student.id)) {
      byChildMap.set(child.student.id, {
        childName,
        pending: 0,
        paid: 0,
        overdue: 0,
      });
    }

    const childStats = byChildMap.get(child.student.id)!;

    for (const invoice of child.student.feeInvoices) {
      const isOverdue = invoice.status === "PENDING" && new Date(invoice.dueDate) < today;
      const status = isOverdue ? "OVERDUE" : invoice.status;

      invoices.push({
        id: invoice.id,
        childName,
        studentId: child.student.id,
        feeType: invoice.feeStructure.name,
        amount: invoice.amount,
        dueDate: invoice.dueDate,
        paidDate: invoice.paidDate,
        status: status as "PENDING" | "PAID" | "OVERDUE" | "CANCELLED",
        paymentMethod: invoice.paymentMethod,
        transactionId: invoice.transactionId,
        remarks: invoice.remarks,
      });

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

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/dashboard/admin - Get admin dashboard statistics
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const schoolId = session.user.schoolId;

    // Get counts in parallel
    const [
      totalStudents,
      totalTeachers,
      totalParents,
      totalClasses,
      totalSections,
      totalSubjects,
      pendingInvoices,
      paidInvoices,
      overdueInvoices,
      recentUsers,
      classStudentCounts,
    ] = await Promise.all([
      // Total students
      prisma.user.count({
        where: { schoolId, role: "STUDENT" },
      }),
      // Total teachers
      prisma.user.count({
        where: { schoolId, role: "TEACHER" },
      }),
      // Total parents
      prisma.user.count({
        where: { schoolId, role: "PARENT" },
      }),
      // Total classes
      prisma.class.count({
        where: { schoolId },
      }),
      // Total sections
      prisma.section.count({
        where: { class: { schoolId } },
      }),
      // Total subjects
      prisma.subject.count({
        where: { schoolId },
      }),
      // Pending invoices sum
      prisma.feeInvoice.aggregate({
        where: {
          status: "PENDING",
          student: { user: { schoolId } },
        },
        _sum: { amount: true },
        _count: true,
      }),
      // Paid invoices sum
      prisma.feeInvoice.aggregate({
        where: {
          status: "PAID",
          student: { user: { schoolId } },
        },
        _sum: { amount: true },
        _count: true,
      }),
      // Overdue invoices sum
      prisma.feeInvoice.aggregate({
        where: {
          status: "OVERDUE",
          student: { user: { schoolId } },
        },
        _sum: { amount: true },
        _count: true,
      }),
      // Recent users (last 5)
      prisma.user.findMany({
        where: { schoolId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      // Students per class
      prisma.class.findMany({
        where: { schoolId },
        select: {
          id: true,
          name: true,
          sections: {
            select: {
              _count: {
                select: {
                  students: true,
                },
              },
            },
          },
        },
        orderBy: { name: "asc" },
      }),
    ]);

    // Calculate students per class
    const studentsPerClass = classStudentCounts.map((cls) => ({
      id: cls.id,
      name: cls.name,
      studentCount: cls.sections.reduce(
        (sum, section) => sum + section._count.students,
        0
      ),
    }));

    // Calculate fee stats
    const feeStats = {
      pending: {
        count: pendingInvoices._count,
        amount: pendingInvoices._sum.amount || 0,
      },
      paid: {
        count: paidInvoices._count,
        amount: paidInvoices._sum.amount || 0,
      },
      overdue: {
        count: overdueInvoices._count,
        amount: overdueInvoices._sum.amount || 0,
      },
      total: {
        count:
          pendingInvoices._count + paidInvoices._count + overdueInvoices._count,
        amount:
          (pendingInvoices._sum.amount || 0) +
          (paidInvoices._sum.amount || 0) +
          (overdueInvoices._sum.amount || 0),
      },
    };

    return NextResponse.json({
      stats: {
        users: {
          students: totalStudents,
          teachers: totalTeachers,
          parents: totalParents,
          total: totalStudents + totalTeachers + totalParents,
        },
        classes: {
          total: totalClasses,
          sections: totalSections,
        },
        subjects: totalSubjects,
        fees: feeStats,
      },
      recentUsers,
      studentsPerClass,
    });
  } catch (error) {
    console.error("Error fetching admin dashboard stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard statistics" },
      { status: 500 }
    );
  }
}

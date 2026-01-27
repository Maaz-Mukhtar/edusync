import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getTeacherAnalyticsAccess } from "@/app/api/analytics/_utils";
import { resolveAnalyticsPeriodOrError } from "@/lib/analytics/resolve-period";

// GET /api/analytics/attendance/sections/[sectionId]
// Admin: full section attendance analytics
// Teacher: only sections they teach (class teacher OR section-subject assignment)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sectionId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN", "TEACHER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { sectionId } = await params;
    const { searchParams } = new URL(request.url);

    const schoolId = session.user.schoolId;
    const resolved = await resolveAnalyticsPeriodOrError(schoolId, searchParams);
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: 400 });
    const range = resolved.period;

    const from = new Date(range.from);
    const to = new Date(range.to);
    to.setHours(23, 59, 59, 999);

    if (session.user.role === "TEACHER") {
      const access = await getTeacherAnalyticsAccess(session.user.id, schoolId);
      if (!access) {
        return NextResponse.json({ error: "Teacher profile not found" }, { status: 404 });
      }
      if (!access.allowedSectionIds.includes(sectionId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const section = await prisma.section.findFirst({
      where: {
        id: sectionId,
        class: { schoolId },
      },
      select: {
        id: true,
        name: true,
        class: { select: { id: true, name: true } },
        _count: { select: { students: true } },
      },
    });

    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    const overall = await prisma.$queryRaw<
      Array<{
        totalMarked: number;
        presentCount: number;
        absentCount: number;
        lateCount: number;
        excusedCount: number;
      }>
    >(Prisma.sql`
      SELECT
        COUNT(*)::int AS "totalMarked",
        SUM(CASE WHEN status = 'PRESENT' THEN 1 ELSE 0 END)::int AS "presentCount",
        SUM(CASE WHEN status = 'ABSENT' THEN 1 ELSE 0 END)::int AS "absentCount",
        SUM(CASE WHEN status = 'LATE' THEN 1 ELSE 0 END)::int AS "lateCount",
        SUM(CASE WHEN status = 'EXCUSED' THEN 1 ELSE 0 END)::int AS "excusedCount"
      FROM "Attendance"
      WHERE "sectionId" = ${sectionId}
        AND date >= ${from} AND date <= ${to}
    `);

    const studentStats = await prisma.$queryRaw<
      Array<{
        studentProfileId: string;
        studentUserId: string;
        firstName: string;
        lastName: string;
        rollNumber: string | null;
        totalMarked: number;
        presentCount: number;
        absentCount: number;
        lateCount: number;
        excusedCount: number;
      }>
    >(Prisma.sql`
      SELECT
        sp.id AS "studentProfileId",
        u.id AS "studentUserId",
        u."firstName" AS "firstName",
        u."lastName" AS "lastName",
        sp."rollNumber" AS "rollNumber",
        COUNT(att.id)::int AS "totalMarked",
        SUM(CASE WHEN att.status = 'PRESENT' THEN 1 ELSE 0 END)::int AS "presentCount",
        SUM(CASE WHEN att.status = 'ABSENT' THEN 1 ELSE 0 END)::int AS "absentCount",
        SUM(CASE WHEN att.status = 'LATE' THEN 1 ELSE 0 END)::int AS "lateCount",
        SUM(CASE WHEN att.status = 'EXCUSED' THEN 1 ELSE 0 END)::int AS "excusedCount"
      FROM "StudentProfile" sp
      INNER JOIN "User" u ON u.id = sp."userId"
      LEFT JOIN "Attendance" att
        ON att."studentId" = sp.id
        AND att.date >= ${from} AND att.date <= ${to}
      WHERE sp."sectionId" = ${sectionId}
        AND u."schoolId" = ${schoolId}
      GROUP BY sp.id, u.id
      ORDER BY sp."rollNumber" ASC NULLS LAST, u."firstName" ASC, u."lastName" ASC
    `);

    return NextResponse.json({
      filters: {
        academicYearId: range.academicYearId,
        termId: range.termId,
        from: from.toISOString(),
        to: to.toISOString(),
      },
      section: {
        id: section.id,
        name: section.name,
        class: section.class,
        studentCount: section._count.students,
      },
      overall: overall[0] ?? {
        totalMarked: 0,
        presentCount: 0,
        absentCount: 0,
        lateCount: 0,
        excusedCount: 0,
      },
      studentStats,
    });
  } catch (error) {
    console.error("Error fetching section attendance analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch attendance analytics" },
      { status: 500 }
    );
  }
}

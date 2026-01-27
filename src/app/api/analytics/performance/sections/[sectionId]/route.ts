import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getTeacherAnalyticsAccess } from "@/app/api/analytics/_utils";
import { resolveAnalyticsPeriodOrError } from "@/lib/analytics/resolve-period";

// GET /api/analytics/performance/sections/[sectionId]
// Admin: full section analytics
// Teacher:
//  - if class teacher of section: full section analytics
//  - else: analytics limited to subjects they teach in that section
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
    const { from, to } = range;

    let allowedSubjectIds: string[] | null = null;
    if (session.user.role === "TEACHER") {
      const access = await getTeacherAnalyticsAccess(session.user.id, schoolId);
      if (!access) {
        return NextResponse.json({ error: "Teacher profile not found" }, { status: 404 });
      }

      if (!access.allowedSectionIds.includes(sectionId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const isClassTeacher = access.classTeacherSectionIds.has(sectionId);
      if (!isClassTeacher) {
        const subjectSet = access.subjectIdsBySection.get(sectionId);
        const subjectIds = subjectSet ? Array.from(subjectSet) : [];
        if (subjectIds.length === 0) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        allowedSubjectIds = subjectIds;
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

    const subjectFilterSql =
      allowedSubjectIds && allowedSubjectIds.length > 0
        ? Prisma.sql`AND a."subjectId" IN (${Prisma.join(allowedSubjectIds)})`
        : Prisma.empty;

    const subjectStats = await prisma.$queryRaw<
      Array<{
        subjectId: string;
        subjectName: string;
        assessmentCount: number;
        resultCount: number;
        avgPercent: number | null;
      }>
    >(Prisma.sql`
      SELECT
        sub.id AS "subjectId",
        sub.name AS "subjectName",
        COUNT(DISTINCT a.id)::int AS "assessmentCount",
        COUNT(ar.id)::int AS "resultCount",
        AVG((ar."marksObtained" / NULLIF(a."totalMarks", 0)) * 100) AS "avgPercent"
      FROM "Assessment" a
      INNER JOIN "Subject" sub ON sub.id = a."subjectId"
      LEFT JOIN "AssessmentResult" ar ON ar."assessmentId" = a.id
      WHERE a."sectionId" = ${sectionId}
        AND a."date" >= ${from}
        AND a."date" <= ${to}
        ${subjectFilterSql}
      GROUP BY sub.id
      ORDER BY sub.name ASC
    `);

    const studentStats = await prisma.$queryRaw<
      Array<{
        studentProfileId: string;
        studentUserId: string;
        firstName: string;
        lastName: string;
        rollNumber: string | null;
        resultCount: number;
        avgPercent: number | null;
      }>
    >(Prisma.sql`
      SELECT
        sp.id AS "studentProfileId",
        u.id AS "studentUserId",
        u."firstName" AS "firstName",
        u."lastName" AS "lastName",
        sp."rollNumber" AS "rollNumber",
        COUNT(ar.id)::int AS "resultCount",
        AVG((ar."marksObtained" / NULLIF(a."totalMarks", 0)) * 100) AS "avgPercent"
      FROM "StudentProfile" sp
      INNER JOIN "User" u ON u.id = sp."userId"
      LEFT JOIN "Assessment" a
        ON a."sectionId" = sp."sectionId"
        AND a."date" >= ${from}
        AND a."date" <= ${to}
        ${subjectFilterSql}
      LEFT JOIN "AssessmentResult" ar
        ON ar."assessmentId" = a.id
        AND ar."studentId" = sp.id
      WHERE sp."sectionId" = ${sectionId}
        AND u."schoolId" = ${schoolId}
      GROUP BY sp.id, u.id
      ORDER BY sp."rollNumber" ASC NULLS LAST, u."firstName" ASC, u."lastName" ASC
    `);

    const overall = await prisma.$queryRaw<
      Array<{
        assessmentCount: number;
        resultCount: number;
        avgPercent: number | null;
      }>
    >(Prisma.sql`
      SELECT
        COUNT(DISTINCT a.id)::int AS "assessmentCount",
        COUNT(ar.id)::int AS "resultCount",
        AVG((ar."marksObtained" / NULLIF(a."totalMarks", 0)) * 100) AS "avgPercent"
      FROM "Assessment" a
      LEFT JOIN "AssessmentResult" ar ON ar."assessmentId" = a.id
      WHERE a."sectionId" = ${sectionId}
        AND a."date" >= ${from}
        AND a."date" <= ${to}
        ${subjectFilterSql}
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
      overall: overall[0] ?? { assessmentCount: 0, resultCount: 0, avgPercent: null },
      subjectStats,
      studentStats,
    });
  } catch (error) {
    console.error("Error fetching performance section detail analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch performance analytics" },
      { status: 500 }
    );
  }
}

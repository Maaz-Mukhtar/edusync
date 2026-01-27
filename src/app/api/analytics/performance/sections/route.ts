import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getTeacherAnalyticsAccess } from "@/app/api/analytics/_utils";
import { resolveAnalyticsPeriodOrError } from "@/lib/analytics/resolve-period";

// GET /api/analytics/performance/sections
// Admin: all sections in school
// Teacher: only sections they teach (class teacher OR section-subject assignment)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN", "TEACHER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");

    const schoolId = session.user.schoolId;

    const resolved = await resolveAnalyticsPeriodOrError(schoolId, searchParams);
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: 400 });
    const range = resolved.period;
    const { from, to } = range;

    let allowedSectionIds: string[] | null = null;
    if (session.user.role === "TEACHER") {
      const access = await getTeacherAnalyticsAccess(session.user.id, schoolId);
      if (!access) {
        return NextResponse.json({ error: "Teacher profile not found" }, { status: 404 });
      }
      allowedSectionIds = access.allowedSectionIds;
    }

    const sectionFilterSql =
      allowedSectionIds && allowedSectionIds.length > 0
        ? Prisma.sql`AND s.id IN (${Prisma.join(allowedSectionIds)})`
        : allowedSectionIds
          ? Prisma.sql`AND 1 = 0`
          : Prisma.empty;

    const classFilterSql = classId ? Prisma.sql`AND c.id = ${classId}` : Prisma.empty;

    const rows = await prisma.$queryRaw<
      Array<{
        sectionId: string;
        sectionName: string;
        classId: string;
        className: string;
        studentCount: number;
        assessmentCount: number;
        resultCount: number;
        avgPercent: number | null;
        medianPercent: number | null;
        bucketBelow50: number;
        bucket50to69: number;
        bucket70to84: number;
        bucket85plus: number;
      }>
    >(Prisma.sql`
      SELECT
        s.id AS "sectionId",
        s.name AS "sectionName",
        c.id AS "classId",
        c.name AS "className",
        (
          SELECT COUNT(*)::int
          FROM "StudentProfile" sp
          WHERE sp."sectionId" = s.id
        ) AS "studentCount",
        COALESCE(stats."assessmentCount", 0)::int AS "assessmentCount",
        COALESCE(stats."resultCount", 0)::int AS "resultCount",
        stats."avgPercent" AS "avgPercent",
        stats."medianPercent" AS "medianPercent",
        COALESCE(stats."bucketBelow50", 0)::int AS "bucketBelow50",
        COALESCE(stats."bucket50to69", 0)::int AS "bucket50to69",
        COALESCE(stats."bucket70to84", 0)::int AS "bucket70to84",
        COALESCE(stats."bucket85plus", 0)::int AS "bucket85plus"
      FROM "Section" s
      INNER JOIN "Class" c ON c.id = s."classId"
      LEFT JOIN LATERAL (
        SELECT
          COUNT(DISTINCT a.id)::int AS "assessmentCount",
          COUNT(ar.id)::int AS "resultCount",
          AVG((ar."marksObtained" / NULLIF(a."totalMarks", 0)) * 100) AS "avgPercent",
          percentile_cont(0.5) WITHIN GROUP (
            ORDER BY (ar."marksObtained" / NULLIF(a."totalMarks", 0)) * 100
          ) AS "medianPercent",
          SUM(
            CASE WHEN ((ar."marksObtained" / NULLIF(a."totalMarks", 0)) * 100) < 50 THEN 1 ELSE 0 END
          )::int AS "bucketBelow50",
          SUM(
            CASE
              WHEN ((ar."marksObtained" / NULLIF(a."totalMarks", 0)) * 100) >= 50
                AND ((ar."marksObtained" / NULLIF(a."totalMarks", 0)) * 100) < 70
              THEN 1 ELSE 0
            END
          )::int AS "bucket50to69",
          SUM(
            CASE
              WHEN ((ar."marksObtained" / NULLIF(a."totalMarks", 0)) * 100) >= 70
                AND ((ar."marksObtained" / NULLIF(a."totalMarks", 0)) * 100) < 85
              THEN 1 ELSE 0
            END
          )::int AS "bucket70to84",
          SUM(
            CASE WHEN ((ar."marksObtained" / NULLIF(a."totalMarks", 0)) * 100) >= 85 THEN 1 ELSE 0 END
          )::int AS "bucket85plus"
        FROM "Assessment" a
        INNER JOIN "AssessmentResult" ar ON ar."assessmentId" = a.id
        WHERE a."sectionId" = s.id
          AND a."date" >= ${from}
          AND a."date" <= ${to}
      ) stats ON TRUE
      WHERE c."schoolId" = ${schoolId}
      ${classFilterSql}
      ${sectionFilterSql}
      ORDER BY c.name ASC, s.name ASC
    `);

    const classes = Array.from(
      new Map(rows.map((r) => [r.classId, { id: r.classId, name: r.className }])).values()
    );

    return NextResponse.json({
      filters: {
        classId: classId ?? null,
        academicYearId: range.academicYearId,
        termId: range.termId,
        from: from.toISOString(),
        to: to.toISOString(),
      },
      classes,
      sections: rows,
    });
  } catch (error) {
    console.error("Error fetching performance section analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch performance analytics" },
      { status: 500 }
    );
  }
}

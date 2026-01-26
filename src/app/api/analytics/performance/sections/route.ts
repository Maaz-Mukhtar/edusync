import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getTeacherAnalyticsAccess, resolveAcademicRangeOrFallback } from "@/app/api/analytics/_utils";

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

    const range = await resolveAcademicRangeOrFallback(schoolId, searchParams);
    if (!range) {
      return NextResponse.json({ error: "Invalid academic year/term" }, { status: 400 });
    }
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
        (
          SELECT COUNT(*)::int
          FROM "Assessment" a
          WHERE a."sectionId" = s.id
            AND a."date" >= ${from}
            AND a."date" <= ${to}
        ) AS "assessmentCount",
        (
          SELECT COUNT(ar.id)::int
          FROM "Assessment" a
          INNER JOIN "AssessmentResult" ar ON ar."assessmentId" = a.id
          WHERE a."sectionId" = s.id
            AND a."date" >= ${from}
            AND a."date" <= ${to}
        ) AS "resultCount",
        (
          SELECT AVG((ar."marksObtained" / NULLIF(a."totalMarks", 0)) * 100)
          FROM "Assessment" a
          INNER JOIN "AssessmentResult" ar ON ar."assessmentId" = a.id
          WHERE a."sectionId" = s.id
            AND a."date" >= ${from}
            AND a."date" <= ${to}
        ) AS "avgPercent"
      FROM "Section" s
      INNER JOIN "Class" c ON c.id = s."classId"
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

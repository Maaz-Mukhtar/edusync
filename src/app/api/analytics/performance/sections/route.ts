import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

async function resolveAcademicRangeOrFallback(
  schoolId: string,
  searchParams: URLSearchParams
) {
  const academicYearId = searchParams.get("academicYearId");
  const termId = searchParams.get("termId");

  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  // Prefer academic year / term selection.
  if (academicYearId) {
    const year = await prisma.academicYear.findFirst({
      where: { id: academicYearId, schoolId },
      select: { id: true, startDate: true, endDate: true },
    });
    if (!year) return null;

    if (termId && termId !== "all") {
      const term = await prisma.term.findFirst({
        where: { id: termId, academicYearId: year.id },
        select: { id: true, startDate: true, endDate: true },
      });
      if (!term) return null;
      return { academicYearId: year.id, termId: term.id, from: term.startDate, to: term.endDate };
    }

    return { academicYearId: year.id, termId: "all", from: year.startDate, to: year.endDate };
  }

  const currentYear = await prisma.academicYear.findFirst({
    where: { schoolId, isCurrent: true },
    select: { id: true, startDate: true, endDate: true },
  });
  if (currentYear) {
    if (termId && termId !== "all") {
      const term = await prisma.term.findFirst({
        where: { id: termId, academicYearId: currentYear.id },
        select: { id: true, startDate: true, endDate: true },
      });
      if (term) {
        return { academicYearId: currentYear.id, termId: term.id, from: term.startDate, to: term.endDate };
      }
    }
    return { academicYearId: currentYear.id, termId: "all", from: currentYear.startDate, to: currentYear.endDate };
  }

  // Legacy fallback: from/to or last 30 days
  const now = new Date();
  const defaultTo = new Date(now);
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 30);

  const from = fromParam ? new Date(fromParam) : defaultFrom;
  const to = toParam ? new Date(toParam) : defaultTo;

  return {
    academicYearId: null,
    termId: null,
    from: Number.isFinite(from.getTime()) ? from : defaultFrom,
    to: Number.isFinite(to.getTime()) ? to : defaultTo,
  };
}

async function getTeacherAccessOrThrow(userId: string, schoolId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, schoolId, role: "TEACHER" },
    select: {
      teacherProfile: {
        select: {
          id: true,
          classTeacherOf: { select: { sectionId: true } },
          sectionSubjects: { select: { sectionId: true, subjectId: true } },
        },
      },
    },
  });

  if (!user?.teacherProfile) return null;

  const classTeacherSectionIds = new Set(
    user.teacherProfile.classTeacherOf.map((s) => s.sectionId)
  );
  const subjectSectionIds = new Set(
    user.teacherProfile.sectionSubjects.map((s) => s.sectionId)
  );
  const allowedSectionIds = Array.from(
    new Set([...classTeacherSectionIds, ...subjectSectionIds])
  );

  return {
    teacherProfileId: user.teacherProfile.id,
    allowedSectionIds,
    classTeacherSectionIds,
  };
}

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
      const access = await getTeacherAccessOrThrow(session.user.id, schoolId);
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

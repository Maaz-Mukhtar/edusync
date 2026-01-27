import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { resolveAnalyticsPeriodOrError } from "@/lib/analytics/resolve-period";

// GET /api/analytics/performance/students/[studentUserId]
//
// Phase 1:
// - Student: only self (`me` or own user id)
//
// Later tickets may extend access (parent/teacher/admin).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentUserId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (session.user.role !== "STUDENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { studentUserId } = await params;
    const targetUserId = studentUserId === "me" ? session.user.id : studentUserId;
    if (targetUserId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const resolved = await resolveAnalyticsPeriodOrError(session.user.schoolId, searchParams);
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: 400 });
    const range = resolved.period;
    const { from, to } = range;

    const student = await prisma.studentProfile.findFirst({
      where: { userId: targetUserId, user: { schoolId: session.user.schoolId } },
      select: {
        id: true,
        user: { select: { id: true, firstName: true, lastName: true } },
        section: { select: { id: true, name: true, class: { select: { id: true, name: true } } } },
      },
    });
    if (!student) return NextResponse.json({ error: "Student profile not found" }, { status: 404 });

    const overall = await prisma.$queryRaw<
      Array<{
        resultCount: number;
        assessmentCount: number;
        avgPercent: number | null;
        medianPercent: number | null;
      }>
    >(Prisma.sql`
      SELECT
        COUNT(ar.id)::int AS "resultCount",
        COUNT(DISTINCT a.id)::int AS "assessmentCount",
        AVG((ar."marksObtained" / NULLIF(a."totalMarks", 0)) * 100) AS "avgPercent",
        percentile_cont(0.5) WITHIN GROUP (
          ORDER BY (ar."marksObtained" / NULLIF(a."totalMarks", 0)) * 100
        ) AS "medianPercent"
      FROM "AssessmentResult" ar
      INNER JOIN "Assessment" a ON a.id = ar."assessmentId"
      WHERE ar."studentId" = ${student.id}
        AND a."date" >= ${from}
        AND a."date" <= ${to}
    `);

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
      FROM "AssessmentResult" ar
      INNER JOIN "Assessment" a ON a.id = ar."assessmentId"
      INNER JOIN "Subject" sub ON sub.id = a."subjectId"
      WHERE ar."studentId" = ${student.id}
        AND a."date" >= ${from}
        AND a."date" <= ${to}
      GROUP BY sub.id
      ORDER BY sub.name ASC
    `);

    const typeStats = await prisma.$queryRaw<
      Array<{
        type: string;
        assessmentCount: number;
        resultCount: number;
        avgPercent: number | null;
      }>
    >(Prisma.sql`
      SELECT
        a."type"::text AS "type",
        COUNT(DISTINCT a.id)::int AS "assessmentCount",
        COUNT(ar.id)::int AS "resultCount",
        AVG((ar."marksObtained" / NULLIF(a."totalMarks", 0)) * 100) AS "avgPercent"
      FROM "AssessmentResult" ar
      INNER JOIN "Assessment" a ON a.id = ar."assessmentId"
      WHERE ar."studentId" = ${student.id}
        AND a."date" >= ${from}
        AND a."date" <= ${to}
      GROUP BY a."type"
      ORDER BY a."type" ASC
    `);

    const subjectTrends = await prisma.$queryRaw<
      Array<{
        subjectId: string;
        subjectName: string;
        bucket: Date;
        resultCount: number;
        avgPercent: number | null;
      }>
    >(Prisma.sql`
      SELECT
        sub.id AS "subjectId",
        sub.name AS "subjectName",
        date_trunc('month', a."date")::date AS "bucket",
        COUNT(ar.id)::int AS "resultCount",
        AVG((ar."marksObtained" / NULLIF(a."totalMarks", 0)) * 100) AS "avgPercent"
      FROM "AssessmentResult" ar
      INNER JOIN "Assessment" a ON a.id = ar."assessmentId"
      INNER JOIN "Subject" sub ON sub.id = a."subjectId"
      WHERE ar."studentId" = ${student.id}
        AND a."date" >= ${from}
        AND a."date" <= ${to}
      GROUP BY sub.id, sub.name, date_trunc('month', a."date")::date
      ORDER BY date_trunc('month', a."date")::date ASC, sub.name ASC
    `);

    const evidence = await prisma.$queryRaw<
      Array<{
        assessmentId: string;
        title: string;
        type: string;
        date: Date;
        subjectId: string;
        subjectName: string;
        totalMarks: number;
        marksObtained: number;
        percent: number | null;
      }>
    >(Prisma.sql`
      SELECT
        a.id AS "assessmentId",
        a.title AS "title",
        a."type"::text AS "type",
        a."date"::date AS "date",
        sub.id AS "subjectId",
        sub.name AS "subjectName",
        a."totalMarks" AS "totalMarks",
        ar."marksObtained" AS "marksObtained",
        ((ar."marksObtained" / NULLIF(a."totalMarks", 0)) * 100) AS "percent"
      FROM "AssessmentResult" ar
      INNER JOIN "Assessment" a ON a.id = ar."assessmentId"
      INNER JOIN "Subject" sub ON sub.id = a."subjectId"
      WHERE ar."studentId" = ${student.id}
        AND a."date" >= ${from}
        AND a."date" <= ${to}
      ORDER BY a."date" DESC, a."createdAt" DESC
    `);

    return NextResponse.json({
      filters: {
        academicYearId: range.academicYearId,
        termId: range.termId,
        from: from.toISOString(),
        to: to.toISOString(),
      },
      student: {
        userId: student.user.id,
        firstName: student.user.firstName,
        lastName: student.user.lastName,
        section: {
          id: student.section.id,
          name: student.section.name,
          class: student.section.class,
        },
      },
      overall: overall[0] ?? { assessmentCount: 0, resultCount: 0, avgPercent: null, medianPercent: null },
      subjectStats,
      typeStats,
      subjectTrends: subjectTrends.map((t) => ({ ...t, bucket: t.bucket.toISOString() })),
      evidence: evidence.map((e) => ({ ...e, date: e.date.toISOString() })),
    });
  } catch (error) {
    console.error("Error fetching student performance analytics:", error);
    return NextResponse.json({ error: "Failed to fetch student analytics" }, { status: 500 });
  }
}


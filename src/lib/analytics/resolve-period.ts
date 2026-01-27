import prisma from "@/lib/prisma";
import { parseAnalyticsPeriodSearchParams, type AnalyticsPeriodFilters } from "@/lib/analytics/filters";

export type ResolvedAnalyticsPeriod = AnalyticsPeriodFilters & {
  from: Date;
  to: Date;
};

export type ResolveAnalyticsPeriodResult =
  | { ok: true; period: ResolvedAnalyticsPeriod }
  | { ok: false; error: string };

/**
 * Contract:
 * - `academicYearId` should be provided by clients; if omitted, we fallback to the school's current academic year.
 * - `termId` omitted (or `"all"`) means "all terms" (entire academic year range).
 */
export async function resolveAnalyticsPeriodOrError(
  schoolId: string,
  searchParams: URLSearchParams
): Promise<ResolveAnalyticsPeriodResult> {
  const parsed = parseAnalyticsPeriodSearchParams(searchParams);

  const yearId = parsed.academicYearId
    ? parsed.academicYearId
    : (
        await prisma.academicYear.findFirst({
          where: { schoolId, isCurrent: true },
          select: { id: true },
        })
      )?.id ?? null;

  if (!yearId) {
    return { ok: false, error: "academicYearId is required (no current academic year is set)" };
  }

  const year = await prisma.academicYear.findFirst({
    where: { id: yearId, schoolId },
    select: { id: true, startDate: true, endDate: true },
  });
  if (!year) {
    return { ok: false, error: "Invalid academicYearId" };
  }

  if (parsed.termId) {
    const term = await prisma.term.findFirst({
      where: { id: parsed.termId, academicYearId: year.id },
      select: { id: true, startDate: true, endDate: true },
    });
    if (!term) return { ok: false, error: "Invalid termId for this academic year" };
    return {
      ok: true,
      period: {
        academicYearId: year.id,
        termId: term.id,
        from: term.startDate,
        to: term.endDate,
      },
    };
  }

  return {
    ok: true,
    period: {
      academicYearId: year.id,
      termId: null,
      from: year.startDate,
      to: year.endDate,
    },
  };
}


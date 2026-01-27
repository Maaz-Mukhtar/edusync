import { z } from "zod";

export type AnalyticsPeriodFilters = {
  academicYearId: string | null;
  termId: string | null;
};

export const analyticsPeriodSchema = z
  .object({
    academicYearId: z.string().min(1).optional().nullable(),
    termId: z.string().optional().nullable(),
  })
  .transform((raw) => {
    const academicYearId = raw.academicYearId?.trim() ? raw.academicYearId.trim() : null;
    const normalizedTerm = raw.termId?.trim() ? raw.termId.trim() : null;
    const termId = !normalizedTerm || normalizedTerm === "all" ? null : normalizedTerm;
    return { academicYearId, termId };
  });

export function parseAnalyticsPeriodFilters(input: unknown): AnalyticsPeriodFilters {
  return analyticsPeriodSchema.parse(input);
}

export function parseAnalyticsPeriodSearchParams(searchParams: URLSearchParams): AnalyticsPeriodFilters {
  return parseAnalyticsPeriodFilters({
    academicYearId: searchParams.get("academicYearId"),
    termId: searchParams.get("termId"),
  });
}


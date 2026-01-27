import prisma from "@/lib/prisma";

export type CurrentTermResult = {
  academicYearId: string;
  academicYearName: string;
  termId: string;
  termName: string;
};

export async function getCurrentTermForSchool(schoolId: string): Promise<CurrentTermResult | null> {
  const academicYear = await prisma.academicYear.findFirst({
    where: { schoolId, isCurrent: true },
    include: { terms: { orderBy: { startDate: "asc" } } },
  });
  if (!academicYear || academicYear.terms.length === 0) return null;

  const now = new Date();
  const matching =
    academicYear.terms.find((t) => t.startDate <= now && now <= t.endDate) ?? academicYear.terms[0];

  return {
    academicYearId: academicYear.id,
    academicYearName: academicYear.name,
    termId: matching.id,
    termName: matching.name,
  };
}


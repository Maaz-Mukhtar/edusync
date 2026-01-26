import prisma from "@/lib/prisma";

export async function resolveAcademicRangeOrFallback(
  schoolId: string,
  searchParams: URLSearchParams
) {
  const academicYearId = searchParams.get("academicYearId");
  const termId = searchParams.get("termId");

  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

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
      return {
        academicYearId: year.id,
        termId: term.id,
        from: term.startDate,
        to: term.endDate,
      };
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
        return {
          academicYearId: currentYear.id,
          termId: term.id,
          from: term.startDate,
          to: term.endDate,
        };
      }
    }

    return {
      academicYearId: currentYear.id,
      termId: "all",
      from: currentYear.startDate,
      to: currentYear.endDate,
    };
  }

  const now = new Date();
  const defaultTo = new Date(now);
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 30);

  const from = fromParam ? new Date(fromParam) : defaultFrom;
  const to = toParam ? new Date(toParam) : defaultTo;

  return {
    academicYearId: null as string | null,
    termId: null as string | null,
    from: Number.isFinite(from.getTime()) ? from : defaultFrom,
    to: Number.isFinite(to.getTime()) ? to : defaultTo,
  };
}

export async function getTeacherAnalyticsAccess(userId: string, schoolId: string) {
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

  const subjectIdsBySection = new Map<string, Set<string>>();
  for (const ss of user.teacherProfile.sectionSubjects) {
    const set = subjectIdsBySection.get(ss.sectionId) ?? new Set<string>();
    set.add(ss.subjectId);
    subjectIdsBySection.set(ss.sectionId, set);
  }

  const allowedSectionIds = Array.from(
    new Set([
      ...classTeacherSectionIds,
      ...Array.from(subjectIdsBySection.keys()),
    ])
  );

  return {
    teacherProfileId: user.teacherProfile.id,
    allowedSectionIds,
    classTeacherSectionIds,
    subjectIdsBySection,
  };
}


import prisma from "@/lib/prisma";
import { resolveAnalyticsPeriodOrError } from "@/lib/analytics/resolve-period";

export async function resolveAcademicRangeOrFallback(
  schoolId: string,
  searchParams: URLSearchParams
) {
  const resolved = await resolveAnalyticsPeriodOrError(schoolId, searchParams);
  return resolved.ok ? resolved.period : null;
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

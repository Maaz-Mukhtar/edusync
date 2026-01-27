import "server-only";

import { revalidateTag } from "next/cache";
import prisma from "@/lib/prisma";

function uniq(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function revalidateStudents(studentIds: string[]) {
  for (const id of uniq(studentIds)) {
    revalidateTag(`student-${id}`, "max");
  }
}

export function revalidateTeachers(teacherIds: string[]) {
  for (const id of uniq(teacherIds)) {
    revalidateTag(`teacher-${id}`, "max");
  }
}

export function revalidateSections(sectionIds: string[]) {
  for (const id of uniq(sectionIds)) {
    revalidateTag(`section-${id}`, "max");
  }
}

export function revalidateParents(parentProfileIds: string[]) {
  for (const id of uniq(parentProfileIds)) {
    revalidateTag(`parent-${id}`, "max");
  }
}

export async function revalidateParentsForStudents(studentIds: string[]) {
  const uniqueStudentIds = uniq(studentIds);
  if (uniqueStudentIds.length === 0) return;

  const links = await prisma.parentStudent.findMany({
    where: { studentId: { in: uniqueStudentIds } },
    select: { parentId: true },
  });

  revalidateParents(links.map((l) => l.parentId));
}


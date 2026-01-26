import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getCurrentTermForSchool } from "@/lib/data/current-term";

export interface AdminTimetableAcademicYear {
  id: string;
  name: string;
  isCurrent: boolean;
  terms: {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
  }[];
}

export interface AdminTimetableClass {
  id: string;
  name: string;
  displayOrder: number;
}

export interface AdminTimetableBootstrapData {
  academicYears: AdminTimetableAcademicYear[];
  classes: AdminTimetableClass[];
  defaultAcademicYearId: string | null;
  defaultTermId: string | null;
}

export async function getAdminTimetableBootstrapData(): Promise<AdminTimetableBootstrapData> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) redirect("/");

  const schoolId = session.user.schoolId;

  const academicYears = await prisma.academicYear.findMany({
    where: { schoolId },
    include: { terms: { orderBy: { startDate: "asc" } } },
    orderBy: { startDate: "desc" },
  });

  const classes = await prisma.class.findMany({
    where: { schoolId },
    select: { id: true, name: true, displayOrder: true },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  });

  const current = await getCurrentTermForSchool(schoolId);

  return {
    academicYears: academicYears.map((y) => ({
      id: y.id,
      name: y.name,
      isCurrent: y.isCurrent,
      terms: y.terms.map((t) => ({
        id: t.id,
        name: t.name,
        startDate: t.startDate,
        endDate: t.endDate,
      })),
    })),
    classes,
    defaultAcademicYearId: current?.academicYearId ?? academicYears.find((y) => y.isCurrent)?.id ?? academicYears[0]?.id ?? null,
    defaultTermId: current?.termId ?? academicYears.find((y) => y.isCurrent)?.terms?.[0]?.id ?? academicYears[0]?.terms?.[0]?.id ?? null,
  };
}


import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { addMinutesToTime, parseTimeToMinutes, rangesOverlap } from "@/lib/time";
import { revalidateSections, revalidateStudents, revalidateTeachers } from "@/lib/cache-revalidate";

const DAYS = [
  { dayOfWeek: 1, label: "Monday" },
  { dayOfWeek: 2, label: "Tuesday" },
  { dayOfWeek: 3, label: "Wednesday" },
  { dayOfWeek: 4, label: "Thursday" },
  { dayOfWeek: 5, label: "Friday" },
];

function requireAdminRole(role: string) {
  return ["SUPER_ADMIN", "ADMIN"].includes(role);
}

async function getAdminSchoolId() {
  const session = await auth();
  if (!session?.user) return null;
  if (!requireAdminRole(session.user.role)) return null;
  return session.user.schoolId;
}

function normalizeScheduleName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

async function ensureUniqueScheduleName(schoolId: string, baseName: string): Promise<string> {
  const normalized = normalizeScheduleName(baseName);
  let candidate = normalized;
  let counter = 2;
  while (true) {
    const exists = await prisma.bellSchedule.findFirst({
      where: { schoolId, name: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
    candidate = `${normalized} (${counter})`;
    counter += 1;
  }
}

function buildScheduleSlots(input: {
  startTime: string;
  periodCount: number;
  periodMinutes: number;
  breakAfterPeriod: number;
  breakMinutes: number;
}) {
  const start = parseTimeToMinutes(input.startTime);
  if (start === null) throw new Error("Invalid start time");
  if (input.periodCount < 1 || input.periodCount > 12) throw new Error("Invalid period count");
  if (input.periodMinutes < 15 || input.periodMinutes > 180) throw new Error("Invalid period minutes");
  if (input.breakAfterPeriod < 0 || input.breakAfterPeriod > input.periodCount) {
    throw new Error("Invalid break placement");
  }
  if (input.breakAfterPeriod > 0 && (input.breakMinutes < 5 || input.breakMinutes > 180)) {
    throw new Error("Invalid break minutes");
  }

  const slotsByDay: Array<
    Array<{
      type: "PERIOD" | "BREAK";
      order: number;
      label: string;
      startTime: string;
      endTime: string;
      periodNumber: number | null;
    }>
  > = [];

  for (let dayIndex = 0; dayIndex < DAYS.length; dayIndex++) {
    const slots: Array<{
      type: "PERIOD" | "BREAK";
      order: number;
      label: string;
      startTime: string;
      endTime: string;
      periodNumber: number | null;
    }> = [];

    let current = input.startTime;
    let order = 1;
    for (let p = 1; p <= input.periodCount; p++) {
      const end = addMinutesToTime(current, input.periodMinutes);
      slots.push({
        type: "PERIOD",
        order,
        label: `Period ${p}`,
        startTime: current,
        endTime: end,
        periodNumber: p,
      });
      order += 1;
      current = end;

      if (input.breakAfterPeriod > 0 && p === input.breakAfterPeriod) {
        const breakEnd = addMinutesToTime(current, input.breakMinutes);
        slots.push({
          type: "BREAK",
          order,
          label: "Break",
          startTime: current,
          endTime: breakEnd,
          periodNumber: null,
        });
        order += 1;
        current = breakEnd;
      }
    }

    slotsByDay.push(slots);
  }

  return slotsByDay;
}

const scheduleInputSchema = z.object({
  name: z.string().min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  periodCount: z.number().int().min(1).max(12),
  periodMinutes: z.number().int().min(15).max(180),
  breakAfterPeriod: z.number().int().min(0).max(12),
  breakMinutes: z.number().int().min(0).max(180),
});

const saveDraftSchema = z.object({
  classId: z.string().min(1),
  termId: z.string().min(1),
  entries: z.array(
    z.object({
      sectionId: z.string().min(1),
      dayOfWeek: z.number().int().min(1).max(5),
      periodNumber: z.number().int().min(1).max(12),
      subjectId: z.string().min(1),
      room: z.string().optional(),
    })
  ),
});

function groupSlotsByTeacherDay(
  slots: Array<{
    teacherId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    context: string;
  }>
) {
  const map = new Map<string, Array<(typeof slots)[number]>>();
  for (const slot of slots) {
    const key = `${slot.teacherId}:${slot.dayOfWeek}`;
    const list = map.get(key) ?? [];
    list.push(slot);
    map.set(key, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => (parseTimeToMinutes(a.startTime) ?? 0) - (parseTimeToMinutes(b.startTime) ?? 0));
  }
  return map;
}

export async function GET(request: NextRequest) {
  try {
    const schoolId = await getAdminSchoolId();
    if (!schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");
    const termId = searchParams.get("termId");
    if (!classId || !termId) {
      return NextResponse.json({ error: "Missing classId or termId" }, { status: 400 });
    }

    const cls = await prisma.class.findFirst({
      where: { id: classId, schoolId },
      include: {
        sections: { orderBy: { name: "asc" } },
        subjects: { orderBy: { name: "asc" } },
      },
    });
    if (!cls) return NextResponse.json({ error: "Class not found" }, { status: 404 });

    const term = await prisma.term.findFirst({
      where: { id: termId, academicYear: { schoolId } },
      select: { id: true, name: true, startDate: true, endDate: true },
    });
    if (!term) return NextResponse.json({ error: "Term not found" }, { status: 404 });

    const [draft, published] = await Promise.all([
      prisma.timetable.findFirst({
        where: { classId, termId, status: "DRAFT" },
        include: { bellSchedule: { include: { slots: true } }, slots: true },
      }),
      prisma.timetable.findFirst({
        where: { classId, termId, status: "PUBLISHED" },
        select: { id: true, publishedAt: true },
      }),
    ]);

    const schedule = draft?.bellSchedule
      ? {
          id: draft.bellSchedule.id,
          name: draft.bellSchedule.name,
          startTime: draft.bellSchedule.startTime,
          slots: draft.bellSchedule.slots
            .filter((s) => DAYS.some((d) => d.dayOfWeek === s.dayOfWeek))
            .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.order - b.order)
            .map((s) => ({
              id: s.id,
              dayOfWeek: s.dayOfWeek,
              order: s.order,
              type: s.type,
              label: s.label,
              startTime: s.startTime,
              endTime: s.endTime,
            })),
        }
      : null;

    // Map of section -> subject -> assigned teacher
    const assignments = await prisma.sectionSubjectTeacher.findMany({
      where: {
        sectionId: { in: cls.sections.map((s) => s.id) },
        subjectId: { in: cls.subjects.map((s) => s.id) },
      },
      include: { teacher: { include: { user: { select: { firstName: true, lastName: true } } } } },
    });

    const assignmentMap: Record<string, Record<string, { teacherId: string; teacherName: string }>> = {};
    for (const a of assignments) {
      assignmentMap[a.sectionId] ??= {};
      const firstName = a.teacher?.user?.firstName ?? "";
      const lastName = a.teacher?.user?.lastName ?? "";
      assignmentMap[a.sectionId][a.subjectId] = {
        teacherId: a.teacherId,
        teacherName: `${firstName} ${lastName}`.trim() || "Unknown Teacher",
      };
    }

    return NextResponse.json({
      class: { id: cls.id, name: cls.name },
      term,
      sections: cls.sections.map((s) => ({ id: s.id, name: s.name })),
      subjects: cls.subjects.map((s) => ({ id: s.id, name: s.name, code: s.code, color: s.color })),
      schedule,
      draft: draft
        ? {
            id: draft.id,
            updatedAt: draft.updatedAt,
            slots: draft.slots.map((slot) => ({
              id: slot.id,
              sectionId: slot.sectionId,
              subjectId: slot.subjectId,
              dayOfWeek: slot.dayOfWeek,
              startTime: slot.startTime,
              endTime: slot.endTime,
              bellScheduleSlotId: slot.bellScheduleSlotId,
              room: slot.room,
            })),
          }
        : null,
      published: published
        ? {
            id: published.id,
            publishedAt: published.publishedAt,
          }
        : null,
      assignmentMap,
      days: DAYS,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code =
      error && typeof error === "object" && "code" in error && typeof (error as { code?: unknown }).code === "string"
        ? (error as { code: string }).code
        : undefined;
    console.error("Admin timetable GET failed", error);
    return NextResponse.json(
      {
        error: "Failed to load timetable",
        details: process.env.NODE_ENV !== "production" ? message : undefined,
        code: process.env.NODE_ENV !== "production" ? code : undefined,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const schoolId = await getAdminSchoolId();
  if (!schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action =
    body && typeof body === "object" && "action" in body && typeof (body as { action?: unknown }).action === "string"
      ? (body as { action: string }).action
      : undefined;

  try {
    if (action === "createSchedule") {
      const parsed = z
        .object({
          classId: z.string().min(1),
          termId: z.string().min(1),
          schedule: scheduleInputSchema,
          replaceExisting: z.boolean().optional(),
        })
        .parse(body);

      const cls = await prisma.class.findFirst({
        where: { id: parsed.classId, schoolId },
        select: { id: true, name: true },
      });
      if (!cls) return NextResponse.json({ error: "Class not found" }, { status: 404 });

      const term = await prisma.term.findFirst({
        where: { id: parsed.termId, academicYear: { schoolId } },
        select: { id: true, name: true },
      });
      if (!term) return NextResponse.json({ error: "Term not found" }, { status: 404 });

      const existingDraft = await prisma.timetable.findFirst({
        where: { classId: parsed.classId, termId: parsed.termId, status: "DRAFT" },
        select: { id: true },
      });

      if (existingDraft && !parsed.replaceExisting) {
        return NextResponse.json(
          { error: "Draft timetable already exists. Set replaceExisting=true to overwrite schedule and clear draft." },
          { status: 409 }
        );
      }

      const scheduleName = await ensureUniqueScheduleName(schoolId, parsed.schedule.name);
      const slotsByDay = buildScheduleSlots(parsed.schedule);

      const created = await prisma.$transaction(async (tx) => {
        const schedule = await tx.bellSchedule.create({
          data: {
            schoolId,
            name: scheduleName,
            startTime: parsed.schedule.startTime,
          },
        });

        const scheduleSlots = DAYS.flatMap((day, idx) =>
          slotsByDay[idx].map((slot) => ({
            bellScheduleId: schedule.id,
            dayOfWeek: day.dayOfWeek,
            order: slot.order,
            type: slot.type,
            label: slot.label,
            startTime: slot.startTime,
            endTime: slot.endTime,
          }))
        );

        await tx.bellScheduleSlot.createMany({ data: scheduleSlots });

        const timetable = await tx.timetable.upsert({
          where: {
            classId_termId_status: { classId: parsed.classId, termId: parsed.termId, status: "DRAFT" },
          },
          update: { bellScheduleId: schedule.id },
          create: {
            classId: parsed.classId,
            termId: parsed.termId,
            status: "DRAFT",
            bellScheduleId: schedule.id,
          },
        });

        await tx.timetableSlot.deleteMany({ where: { timetableId: timetable.id } });

        return { scheduleId: schedule.id, timetableId: timetable.id };
      });

      return NextResponse.json({ ok: true, ...created });
    }

    if (action === "saveDraft") {
      const parsed = saveDraftSchema.parse(body);

      const cls = await prisma.class.findFirst({
        where: { id: parsed.classId, schoolId },
        include: { sections: { select: { id: true, name: true }, orderBy: { name: "asc" } } },
      });
      if (!cls) return NextResponse.json({ error: "Class not found" }, { status: 404 });

      const draft = await prisma.timetable.findFirst({
        where: { classId: parsed.classId, termId: parsed.termId, status: "DRAFT" },
        include: { bellSchedule: { include: { slots: true } } },
      });
      if (!draft) return NextResponse.json({ error: "Draft timetable not found. Create a schedule first." }, { status: 404 });

      // Build lookup: dayOfWeek + periodNumber -> bellScheduleSlot (PERIOD)
      const periodSlots = draft.bellSchedule.slots
        .filter((s) => DAYS.some((d) => d.dayOfWeek === s.dayOfWeek))
        .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.order - b.order);

      const byDay: Record<number, Array<typeof periodSlots[number]>> = {};
      for (const day of DAYS) byDay[day.dayOfWeek] = [];
      for (const slot of periodSlots) {
        if (slot.type !== "PERIOD") continue;
        byDay[slot.dayOfWeek].push(slot);
      }

      const periodSlotByDayAndNumber = new Map<string, typeof periodSlots[number]>();
      for (const day of DAYS) {
        const slotsForDay = byDay[day.dayOfWeek].sort((a, b) => a.order - b.order);
        for (let i = 0; i < slotsForDay.length; i++) {
          periodSlotByDayAndNumber.set(`${day.dayOfWeek}:${i + 1}`, slotsForDay[i]);
        }
      }

      const sectionIds = new Set(cls.sections.map((s) => s.id));
      for (const entry of parsed.entries) {
        if (!sectionIds.has(entry.sectionId)) {
          return NextResponse.json({ error: "Invalid section for this class" }, { status: 400 });
        }
        if (!periodSlotByDayAndNumber.get(`${entry.dayOfWeek}:${entry.periodNumber}`)) {
          return NextResponse.json({ error: "Invalid period number for this schedule" }, { status: 400 });
        }
      }

      // Resolve teacher assignments (must exist)
      const assignmentRows = await prisma.sectionSubjectTeacher.findMany({
        where: {
          sectionId: { in: Array.from(sectionIds) },
          subjectId: { in: parsed.entries.map((e) => e.subjectId) },
        },
        select: { sectionId: true, subjectId: true, teacherId: true },
      });
      const assignmentLookup = new Map<string, string>(
        assignmentRows.map((r) => [`${r.sectionId}:${r.subjectId}`, r.teacherId])
      );

      for (const entry of parsed.entries) {
        const key = `${entry.sectionId}:${entry.subjectId}`;
        if (!assignmentLookup.has(key)) {
          return NextResponse.json(
            { error: "Missing teacher assignment for one or more subjects. Assign teachers before creating timetable." },
            { status: 400 }
          );
        }
      }

      const slotsToCreate = parsed.entries.map((entry) => {
        const scheduleSlot = periodSlotByDayAndNumber.get(`${entry.dayOfWeek}:${entry.periodNumber}`)!;
        const teacherId = assignmentLookup.get(`${entry.sectionId}:${entry.subjectId}`)!;
        return {
          timetableId: draft.id,
          sectionId: entry.sectionId,
          subjectId: entry.subjectId,
          teacherId,
          dayOfWeek: entry.dayOfWeek,
          startTime: scheduleSlot.startTime,
          endTime: scheduleSlot.endTime,
          room: entry.room || null,
          bellScheduleSlotId: scheduleSlot.id,
        };
      });

      await prisma.$transaction(async (tx) => {
        await tx.timetableSlot.deleteMany({ where: { timetableId: draft.id } });
        if (slotsToCreate.length > 0) {
          await tx.timetableSlot.createMany({ data: slotsToCreate });
        }
      });

      return NextResponse.json({ ok: true, count: slotsToCreate.length });
    }

    if (action === "editPublished") {
      const parsed = z.object({ classId: z.string().min(1), termId: z.string().min(1) }).parse(body);

      const cls = await prisma.class.findFirst({ where: { id: parsed.classId, schoolId }, select: { id: true } });
      if (!cls) return NextResponse.json({ error: "Class not found" }, { status: 404 });

      const published = await prisma.timetable.findFirst({
        where: { classId: parsed.classId, termId: parsed.termId, status: "PUBLISHED" },
        include: { slots: true },
      });
      if (!published) return NextResponse.json({ error: "No published timetable to edit." }, { status: 404 });

      const draft = await prisma.$transaction(async (tx) => {
        const d = await tx.timetable.upsert({
          where: { classId_termId_status: { classId: parsed.classId, termId: parsed.termId, status: "DRAFT" } },
          update: { bellScheduleId: published.bellScheduleId },
          create: {
            classId: parsed.classId,
            termId: parsed.termId,
            status: "DRAFT",
            bellScheduleId: published.bellScheduleId,
          },
        });
        await tx.timetableSlot.deleteMany({ where: { timetableId: d.id } });
        if (published.slots.length > 0) {
          await tx.timetableSlot.createMany({
            data: published.slots.map((s) => ({
              timetableId: d.id,
              sectionId: s.sectionId,
              subjectId: s.subjectId,
              teacherId: s.teacherId,
              dayOfWeek: s.dayOfWeek,
              startTime: s.startTime,
              endTime: s.endTime,
              room: s.room,
              bellScheduleSlotId: s.bellScheduleSlotId,
            })),
          });
        }
        return d;
      });

      return NextResponse.json({ ok: true, draftId: draft.id });
    }

    if (action === "copyTerm1ToTerm2") {
      const parsed = z
        .object({
          classId: z.string().min(1),
          fromTermId: z.string().min(1),
          toTermId: z.string().min(1),
        })
        .parse(body);

      const cls = await prisma.class.findFirst({ where: { id: parsed.classId, schoolId }, select: { id: true } });
      if (!cls) return NextResponse.json({ error: "Class not found" }, { status: 404 });

      const published = await prisma.timetable.findFirst({
        where: { classId: parsed.classId, termId: parsed.fromTermId, status: "PUBLISHED" },
        include: { slots: true },
      });
      if (!published) return NextResponse.json({ error: "No published Term 1 timetable found." }, { status: 404 });

      const draft = await prisma.$transaction(async (tx) => {
        const d = await tx.timetable.upsert({
          where: { classId_termId_status: { classId: parsed.classId, termId: parsed.toTermId, status: "DRAFT" } },
          update: { bellScheduleId: published.bellScheduleId },
          create: {
            classId: parsed.classId,
            termId: parsed.toTermId,
            status: "DRAFT",
            bellScheduleId: published.bellScheduleId,
          },
        });
        await tx.timetableSlot.deleteMany({ where: { timetableId: d.id } });
        if (published.slots.length > 0) {
          await tx.timetableSlot.createMany({
            data: published.slots.map((s) => ({
              timetableId: d.id,
              sectionId: s.sectionId,
              subjectId: s.subjectId,
              teacherId: s.teacherId,
              dayOfWeek: s.dayOfWeek,
              startTime: s.startTime,
              endTime: s.endTime,
              room: s.room,
              bellScheduleSlotId: s.bellScheduleSlotId,
            })),
          });
        }
        return d;
      });

      return NextResponse.json({ ok: true, draftId: draft.id });
    }

    if (action === "publish") {
      const parsed = z.object({ classId: z.string().min(1), termId: z.string().min(1) }).parse(body);

      const cls = await prisma.class.findFirst({
        where: { id: parsed.classId, schoolId },
        include: { sections: { include: { class: true } } },
      });
      if (!cls) return NextResponse.json({ error: "Class not found" }, { status: 404 });

      const draft = await prisma.timetable.findFirst({
        where: { classId: parsed.classId, termId: parsed.termId, status: "DRAFT" },
        include: {
          slots: { include: { subject: true, section: { include: { class: true } }, teacher: { include: { user: true } } } },
        },
      });
      if (!draft) return NextResponse.json({ error: "No draft timetable to publish." }, { status: 404 });
      if (draft.slots.length === 0) return NextResponse.json({ error: "Draft timetable is empty." }, { status: 400 });

      // Load existing published slots for this term (other classes)
      const publishedSlots = await prisma.timetableSlot.findMany({
        where: {
          timetable: {
            termId: parsed.termId,
            status: "PUBLISHED",
            classId: { not: parsed.classId },
          },
          teacherId: { not: null },
        },
        include: {
          teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
          section: { include: { class: true } },
          subject: true,
        },
      });

      const draftTeacherSlots = draft.slots
        .filter((s) => s.teacherId)
        .map((s) => ({
          teacherId: s.teacherId as string,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          context: `${s.section.class.name}-${s.section.name} • ${s.subject.name}`,
        }));

      const publishedTeacherSlots = publishedSlots
        .filter((s) => s.teacherId)
        .map((s) => ({
          teacherId: s.teacherId as string,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          context: `${s.section.class.name}-${s.section.name} • ${s.subject.name}`,
        }));

      const combined = [...draftTeacherSlots, ...publishedTeacherSlots];
      const grouped = groupSlotsByTeacherDay(combined);

      for (const list of grouped.values()) {
        for (let i = 0; i < list.length - 1; i++) {
          const a = list[i];
          const b = list[i + 1];
          if (rangesOverlap(a.startTime, a.endTime, b.startTime, b.endTime)) {
            return NextResponse.json(
              {
                error: "Teacher timing conflict detected",
                details: { teacherId: a.teacherId, dayOfWeek: a.dayOfWeek, a, b },
              },
              { status: 400 }
            );
          }
        }
      }

      const published = await prisma.$transaction(async (tx) => {
        const p = await tx.timetable.upsert({
          where: { classId_termId_status: { classId: parsed.classId, termId: parsed.termId, status: "PUBLISHED" } },
          update: { bellScheduleId: draft.bellScheduleId, publishedAt: new Date() },
          create: {
            classId: parsed.classId,
            termId: parsed.termId,
            status: "PUBLISHED",
            bellScheduleId: draft.bellScheduleId,
            publishedAt: new Date(),
          },
        });

        await tx.timetableSlot.deleteMany({ where: { timetableId: p.id } });
        await tx.timetableSlot.createMany({
          data: draft.slots.map((s) => ({
            timetableId: p.id,
            sectionId: s.sectionId,
            subjectId: s.subjectId,
            teacherId: s.teacherId,
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            room: s.room,
            bellScheduleSlotId: s.bellScheduleSlotId,
          })),
        });
        return p;
      });

      // Invalidate affected timetable + dashboards across portals
      const sectionIds = Array.from(new Set(draft.slots.map((s) => s.sectionId)));
      const teacherIds = Array.from(new Set(draft.slots.map((s) => s.teacherId).filter(Boolean))) as string[];
      revalidateSections(sectionIds);
      revalidateTeachers(teacherIds);
      const students = await prisma.studentProfile.findMany({
        where: { sectionId: { in: sectionIds } },
        select: { id: true },
      });
      revalidateStudents(students.map((s) => s.id));

      return NextResponse.json({ ok: true, publishedId: published.id });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.issues }, { status: 400 });
    }
    console.error("Admin timetable error:", error);
    return NextResponse.json({ error: "Failed to process timetable request" }, { status: 500 });
  }
}

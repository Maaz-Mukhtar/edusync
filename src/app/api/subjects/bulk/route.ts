import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const subjectInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  code: z.string().trim().max(20).optional().nullable(),
  color: z.string().trim().max(20).optional().nullable(),
});

const applySubjectsSchema = z.object({
  action: z.literal("apply"),
  classIds: z.array(z.string().min(1)).min(1),
  subjects: z.array(subjectInputSchema).min(1),
  mode: z.enum(["skipExisting", "overwrite"]).optional().default("skipExisting"),
});

const copySubjectsSchema = z.object({
  action: z.literal("copy"),
  sourceClassId: z.string().min(1),
  targetClassIds: z.array(z.string().min(1)).min(1),
  copyFields: z
    .object({
      code: z.boolean().optional().default(true),
      color: z.boolean().optional().default(true),
    })
    .optional()
    .default({ code: true, color: true }),
  mode: z.enum(["skipExisting", "overwrite"]).optional().default("skipExisting"),
});

const bulkSubjectsSchema = z.discriminatedUnion("action", [
  applySubjectsSchema,
  copySubjectsSchema,
]);

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const data = bulkSubjectsSchema.parse(body);

    if (data.action === "apply") {
      const classes = await prisma.class.findMany({
        where: {
          id: { in: data.classIds },
          schoolId: session.user.schoolId,
        },
        select: { id: true },
      });

      if (classes.length !== data.classIds.length) {
        return NextResponse.json({ error: "One or more classes not found" }, { status: 404 });
      }

      const subjectInputs = data.subjects.map((s) => {
        const normalizedCode =
          s.code === undefined ? undefined : s.code?.trim() || null;
        const normalizedColor =
          s.color === undefined ? undefined : s.color?.trim() || null;

        return {
          name: s.name.trim(),
          code: normalizedCode,
          color: normalizedColor,
        };
      });

      const result = { created: 0, updated: 0, skipped: 0 };

      await prisma.$transaction(async (tx) => {
        for (const classId of data.classIds) {
          for (const subject of subjectInputs) {
            const existing = await tx.subject.findUnique({
              where: { classId_name: { classId, name: subject.name } },
              select: { id: true },
            });

            if (!existing) {
              await tx.subject.create({
                data: {
                  classId,
                  name: subject.name,
                  code: subject.code ?? null,
                  color: subject.color ?? null,
                },
              });
              result.created++;
              continue;
            }

            if (data.mode === "overwrite") {
              await tx.subject.update({
                where: { id: existing.id },
                data: {
                  ...(subject.code !== undefined ? { code: subject.code } : {}),
                  ...(subject.color !== undefined ? { color: subject.color } : {}),
                },
              });
              result.updated++;
            } else {
              result.skipped++;
            }
          }
        }
      });

      return NextResponse.json({ ...result });
    }

    // action === "copy"
    const sourceClass = await prisma.class.findFirst({
      where: { id: data.sourceClassId, schoolId: session.user.schoolId },
      select: { id: true },
    });
    if (!sourceClass) {
      return NextResponse.json({ error: "Source class not found" }, { status: 404 });
    }

    const uniqueTargetClassIds = Array.from(
      new Set(data.targetClassIds.filter((id) => id !== data.sourceClassId))
    );
    if (uniqueTargetClassIds.length === 0) {
      return NextResponse.json(
        { error: "Select at least one target class (different from source)" },
        { status: 400 }
      );
    }

    const targets = await prisma.class.findMany({
      where: { id: { in: uniqueTargetClassIds }, schoolId: session.user.schoolId },
      select: { id: true },
    });
    if (targets.length !== uniqueTargetClassIds.length) {
      return NextResponse.json({ error: "One or more target classes not found" }, { status: 404 });
    }

    const sourceSubjects = await prisma.subject.findMany({
      where: { classId: data.sourceClassId },
      select: { name: true, code: true, color: true },
      orderBy: { name: "asc" },
    });
    if (sourceSubjects.length === 0) {
      return NextResponse.json({ error: "Source class has no subjects to copy" }, { status: 400 });
    }

    const copyCode = data.copyFields.code ?? true;
    const copyColor = data.copyFields.color ?? true;

    const result = { created: 0, updated: 0, skipped: 0 };

    await prisma.$transaction(async (tx) => {
      for (const classId of uniqueTargetClassIds) {
        for (const s of sourceSubjects) {
          const name = s.name.trim();
          const existing = await tx.subject.findUnique({
            where: { classId_name: { classId, name } },
            select: { id: true },
          });

          const nextData = {
            code: copyCode ? s.code : null,
            color: copyColor ? s.color : null,
          };

          if (!existing) {
            await tx.subject.create({
              data: {
                classId,
                name,
                ...nextData,
              },
            });
            result.created++;
            continue;
          }

          if (data.mode === "overwrite") {
            await tx.subject.update({
              where: { id: existing.id },
              data: nextData,
            });
            result.updated++;
          } else {
            result.skipped++;
          }
        }
      }
    });

    return NextResponse.json({ ...result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error in bulk subjects:", error);
    return NextResponse.json({ error: "Failed to process bulk subjects" }, { status: 500 });
  }
}

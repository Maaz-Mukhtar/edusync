import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { normalizeTopicName } from "@/lib/topics/normalize";

const updateTopicSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
    parentTopicId: z.string().trim().min(1).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No changes provided" });

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ subjectId: string; topicId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!["SUPER_ADMIN", "ADMIN", "TEACHER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { subjectId, topicId } = await params;

    const subject = await prisma.subject.findFirst({
      where: { id: subjectId, class: { schoolId: session.user.schoolId } },
      select: { id: true },
    });
    if (!subject) return NextResponse.json({ error: "Subject not found" }, { status: 404 });

    const topic = await prisma.subjectTopic.findFirst({
      where: { id: topicId, subjectId },
      select: { id: true, source: true, createdByTeacherId: true, nameNormalized: true },
    });
    if (!topic) return NextResponse.json({ error: "Topic not found" }, { status: 404 });

    if (session.user.role === "TEACHER") {
      const teacher = await prisma.teacherProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });
      if (!teacher) return NextResponse.json({ error: "Teacher profile not found" }, { status: 404 });

      const canEdit = topic.source === "TEACHER" && topic.createdByTeacherId === teacher.id;
      if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    } else {
      // ADMIN/SUPER_ADMIN: only admin topics for now (teacher topics managed by teachers)
      if (topic.source !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateTopicSchema.parse(body);

    const nextName = parsed.name?.trim();
    const nameNormalized = nextName ? normalizeTopicName(nextName) : undefined;

    if (parsed.parentTopicId) {
      const parent = await prisma.subjectTopic.findFirst({
        where: { id: parsed.parentTopicId, subjectId },
        select: { id: true },
      });
      if (!parent) return NextResponse.json({ error: "Invalid parentTopicId" }, { status: 400 });
    }

    if (nameNormalized && nameNormalized !== topic.nameNormalized) {
      const existing = await prisma.subjectTopic.findUnique({
        where: { subjectId_nameNormalized: { subjectId, nameNormalized } },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.json({ error: "Topic name already exists" }, { status: 409 });
      }
    }

    const updated = await prisma.subjectTopic.update({
      where: { id: topicId },
      data: {
        ...(nextName ? { name: nextName, nameNormalized: nameNormalized! } : {}),
        ...(parsed.status ? { status: parsed.status } : {}),
        ...(parsed.parentTopicId !== undefined ? { parentTopicId: parsed.parentTopicId } : {}),
      },
      select: {
        id: true,
        name: true,
        parentTopicId: true,
        source: true,
        status: true,
        createdByTeacherId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ topic: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.issues }, { status: 400 });
    }
    console.error("Error updating topic:", error);
    return NextResponse.json({ error: "Failed to update topic" }, { status: 500 });
  }
}


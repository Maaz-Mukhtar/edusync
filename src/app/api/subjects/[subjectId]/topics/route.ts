import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { normalizeTopicName } from "@/lib/topics/normalize";

const createTopicSchema = z.object({
  name: z.string().trim().min(1).max(120),
  parentTopicId: z.string().trim().min(1).optional().nullable(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ subjectId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!["SUPER_ADMIN", "ADMIN", "TEACHER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { subjectId } = await params;

  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, class: { schoolId: session.user.schoolId } },
    select: { id: true },
  });
  if (!subject) return NextResponse.json({ error: "Subject not found" }, { status: 404 });

  const teacherProfileId =
    session.user.role === "TEACHER"
      ? (await prisma.teacherProfile.findUnique({ where: { userId: session.user.id }, select: { id: true } }))?.id ??
        null
      : null;

  const topics = await prisma.subjectTopic.findMany({
    where: { subjectId },
    select: {
      id: true,
      name: true,
      nameNormalized: true,
      parentTopicId: true,
      source: true,
      status: true,
      createdByTeacherId: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({ topics, me: { teacherProfileId } });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ subjectId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!["SUPER_ADMIN", "ADMIN", "TEACHER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { subjectId } = await params;
    const subject = await prisma.subject.findFirst({
      where: { id: subjectId, class: { schoolId: session.user.schoolId } },
      select: { id: true },
    });
    if (!subject) return NextResponse.json({ error: "Subject not found" }, { status: 404 });

    const body = await request.json();
    const parsed = createTopicSchema.parse(body);

    const name = parsed.name.trim();
    const nameNormalized = normalizeTopicName(name);

    let createdByTeacherId: string | null = null;
    let source: "ADMIN" | "TEACHER" = "ADMIN";

    if (session.user.role === "TEACHER") {
      const teacher = await prisma.teacherProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });
      if (!teacher) return NextResponse.json({ error: "Teacher profile not found" }, { status: 404 });
      createdByTeacherId = teacher.id;
      source = "TEACHER";
    }

    const existing = await prisma.subjectTopic.findUnique({
      where: { subjectId_nameNormalized: { subjectId, nameNormalized } },
      select: { id: true, name: true, status: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Topic already exists: ${existing.name}`, existingTopicId: existing.id },
        { status: 409 }
      );
    }

    if (parsed.parentTopicId) {
      const parent = await prisma.subjectTopic.findFirst({
        where: { id: parsed.parentTopicId, subjectId },
        select: { id: true },
      });
      if (!parent) return NextResponse.json({ error: "Invalid parentTopicId" }, { status: 400 });
    }

    const topic = await prisma.subjectTopic.create({
      data: {
        subjectId,
        name,
        nameNormalized,
        parentTopicId: parsed.parentTopicId ?? null,
        source,
        createdByTeacherId,
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

    return NextResponse.json({ topic }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.issues }, { status: 400 });
    }
    console.error("Error creating topic:", error);
    return NextResponse.json({ error: "Failed to create topic" }, { status: 500 });
  }
}


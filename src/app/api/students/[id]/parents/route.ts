import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { hash } from "bcryptjs";
import { revalidateTag } from "next/cache";

const linkExistingSchema = z.object({
  action: z.literal("linkExisting"),
  parentUserId: z.string().min(1),
});

const createAndLinkSchema = z.object({
  action: z.literal("createAndLink"),
  parent: z
    .object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      email: z.string().email().optional().nullable(),
      phone: z.string().min(10).optional().nullable(),
      password: z.string().min(6),
      occupation: z.string().optional().nullable(),
      relationship: z.string().optional().nullable(),
    })
    .refine((data) => data.email || data.phone, {
      message: "Either email or phone is required",
      path: ["email"],
    }),
});

const unlinkSchema = z.object({
  parentUserId: z.string().min(1),
});

const postSchema = z.discriminatedUnion("action", [
  linkExistingSchema,
  createAndLinkSchema,
]);

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

async function getStudentProfileIdOrThrow(studentUserId: string, schoolId: string) {
  const student = await prisma.user.findFirst({
    where: { id: studentUserId, schoolId, role: "STUDENT" },
    select: {
      id: true,
      studentProfile: { select: { id: true } },
    },
  });

  if (!student || !student.studentProfile) {
    return null;
  }
  return student.studentProfile.id;
}

// POST /api/students/[id]/parents - link existing parent OR create+link
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;
    const { session } = authResult;

    const { id: studentUserId } = await params;
    const studentProfileId = await getStudentProfileIdOrThrow(
      studentUserId,
      session.user.schoolId
    );

    if (!studentProfileId) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const body = await request.json();
    const data = postSchema.parse(body);

    if (data.action === "linkExisting") {
      const parent = await prisma.user.findFirst({
        where: { id: data.parentUserId, schoolId: session.user.schoolId, role: "PARENT" },
        include: { parentProfile: true },
      });

      if (!parent || !parent.parentProfile) {
        return NextResponse.json({ error: "Parent not found" }, { status: 404 });
      }

      await prisma.parentStudent.createMany({
        data: [{ parentId: parent.parentProfile.id, studentId: studentProfileId }],
        skipDuplicates: true,
      });

      revalidateTag(`parent-${parent.parentProfile.id}`, "max");

      return NextResponse.json({ success: true, mode: "linkedExisting" });
    }

    // createAndLink
    const normalizedEmail = data.parent.email?.toLowerCase() ?? null;
    const normalizedPhone = data.parent.phone ?? null;

    const result = await prisma.$transaction(async (tx) => {
      const existingParent = await tx.user.findFirst({
        where: {
          schoolId: session.user.schoolId,
          role: "PARENT",
          OR: [
            normalizedEmail ? { email: normalizedEmail } : undefined,
            normalizedPhone ? { phone: normalizedPhone } : undefined,
          ].filter(Boolean) as Array<{ email?: string; phone?: string }>,
        },
        include: { parentProfile: true },
      });

      if (existingParent?.parentProfile) {
        // If the parent already exists, just link them (don’t mutate password).
        await tx.parentStudent.createMany({
          data: [{ parentId: existingParent.parentProfile.id, studentId: studentProfileId }],
          skipDuplicates: true,
        });

        // Fill missing profile fields if provided (non-destructive).
        await tx.parentProfile.update({
          where: { id: existingParent.parentProfile.id },
          data: {
            ...(existingParent.parentProfile.occupation
              ? {}
              : { occupation: data.parent.occupation ?? null }),
            ...(existingParent.parentProfile.relationship
              ? {}
              : { relationship: data.parent.relationship ?? null }),
          },
        });

        return { mode: "linkedExisting", parentUserId: existingParent.id, parentProfileId: existingParent.parentProfile.id };
      }

      const passwordHash = await hash(data.parent.password, 10);

      const created = await tx.user.create({
        data: {
          schoolId: session.user.schoolId,
          email: normalizedEmail,
          phone: normalizedPhone,
          passwordHash,
          role: "PARENT",
          firstName: data.parent.firstName,
          lastName: data.parent.lastName,
          parentProfile: {
            create: {
              occupation: data.parent.occupation ?? null,
              relationship: data.parent.relationship ?? null,
            },
          },
        },
        include: { parentProfile: true },
      });

      await tx.parentStudent.create({
        data: {
          parentId: created.parentProfile!.id,
          studentId: studentProfileId,
        },
      });

      return { mode: "createdAndLinked", parentUserId: created.id, parentProfileId: created.parentProfile!.id };
    });

    revalidateTag(`parent-${result.parentProfileId}`, "max");

    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error linking parent to student:", error);
    return NextResponse.json({ error: "Failed to link parent" }, { status: 500 });
  }
}

// DELETE /api/students/[id]/parents - unlink a parent from a student
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;
    const { session } = authResult;

    const { id: studentUserId } = await params;
    const studentProfileId = await getStudentProfileIdOrThrow(
      studentUserId,
      session.user.schoolId
    );

    if (!studentProfileId) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const body = await request.json();
    const { parentUserId } = unlinkSchema.parse(body);

    const parent = await prisma.user.findFirst({
      where: { id: parentUserId, schoolId: session.user.schoolId, role: "PARENT" },
      include: { parentProfile: true },
    });

    if (!parent || !parent.parentProfile) {
      return NextResponse.json({ error: "Parent not found" }, { status: 404 });
    }

    await prisma.parentStudent.deleteMany({
      where: { parentId: parent.parentProfile.id, studentId: studentProfileId },
    });

    revalidateTag(`parent-${parent.parentProfile.id}`, "max");

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error unlinking parent from student:", error);
    return NextResponse.json({ error: "Failed to unlink parent" }, { status: 500 });
  }
}

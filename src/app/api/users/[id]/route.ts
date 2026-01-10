import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { hash } from "bcryptjs";
import { z } from "zod";

const updateUserSchema = z.object({
  email: z.string().email().optional().nullable(),
  phone: z.string().min(10).optional().nullable(),
  password: z.string().min(6).optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  // Student-specific fields
  sectionId: z.string().optional(),
  rollNumber: z.string().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  // Teacher-specific fields
  employeeId: z.string().optional().nullable(),
  qualification: z.string().optional().nullable(),
  // Parent-specific fields
  occupation: z.string().optional().nullable(),
  relationship: z.string().optional().nullable(),
});

// GET /api/users/[id] - Get a single user
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const user = await prisma.user.findFirst({
      where: {
        id,
        schoolId: session.user.schoolId,
      },
      include: {
        studentProfile: {
          include: {
            section: {
              include: {
                class: true,
              },
            },
            parents: {
              include: {
                parent: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        phone: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        teacherProfile: {
          include: {
            sections: {
              include: {
                section: {
                  include: {
                    class: true,
                  },
                },
              },
            },
            subjectsTaught: {
              include: {
                subject: true,
              },
            },
          },
        },
        parentProfile: {
          include: {
            children: {
              include: {
                student: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                      },
                    },
                    section: {
                      include: {
                        class: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}

// PUT /api/users/[id] - Update a user
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = updateUserSchema.parse(body);

    // Check if user exists and belongs to same school
    const existingUser = await prisma.user.findFirst({
      where: {
        id,
        schoolId: session.user.schoolId,
      },
      include: {
        studentProfile: true,
        teacherProfile: true,
        parentProfile: true,
      },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Normalize email to lowercase
    const normalizedEmail = validatedData.email?.toLowerCase();

    // Check for duplicate email/phone
    if (normalizedEmail || validatedData.phone) {
      const duplicate = await prisma.user.findFirst({
        where: {
          id: { not: id },
          schoolId: session.user.schoolId,
          OR: [
            normalizedEmail ? { email: normalizedEmail } : {},
            validatedData.phone ? { phone: validatedData.phone } : {},
          ].filter((c) => Object.keys(c).length > 0),
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: "Email or phone already in use" },
          { status: 400 }
        );
      }
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};
    if (validatedData.email !== undefined) updateData.email = normalizedEmail;
    if (validatedData.phone !== undefined) updateData.phone = validatedData.phone;
    if (validatedData.firstName) updateData.firstName = validatedData.firstName;
    if (validatedData.lastName) updateData.lastName = validatedData.lastName;
    if (validatedData.isActive !== undefined) updateData.isActive = validatedData.isActive;
    if (validatedData.password) {
      updateData.passwordHash = await hash(validatedData.password, 10);
    }

    // Update user
    const user = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    // Update profile based on role
    if (existingUser.role === "STUDENT" && existingUser.studentProfile) {
      await prisma.studentProfile.update({
        where: { id: existingUser.studentProfile.id },
        data: {
          ...(validatedData.sectionId && { sectionId: validatedData.sectionId }),
          ...(validatedData.rollNumber !== undefined && { rollNumber: validatedData.rollNumber }),
          ...(validatedData.dateOfBirth !== undefined && {
            dateOfBirth: validatedData.dateOfBirth ? new Date(validatedData.dateOfBirth) : null,
          }),
        },
      });
    }

    if (existingUser.role === "TEACHER" && existingUser.teacherProfile) {
      await prisma.teacherProfile.update({
        where: { id: existingUser.teacherProfile.id },
        data: {
          ...(validatedData.employeeId !== undefined && { employeeId: validatedData.employeeId }),
          ...(validatedData.qualification !== undefined && { qualification: validatedData.qualification }),
        },
      });
    }

    if (existingUser.role === "PARENT" && existingUser.parentProfile) {
      await prisma.parentProfile.update({
        where: { id: existingUser.parentProfile.id },
        data: {
          ...(validatedData.occupation !== undefined && { occupation: validatedData.occupation }),
          ...(validatedData.relationship !== undefined && { relationship: validatedData.relationship }),
        },
      });
    }

    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}

// DELETE /api/users/[id] - Delete a user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Check if user exists and belongs to same school
    const existingUser = await prisma.user.findFirst({
      where: {
        id,
        schoolId: session.user.schoolId,
      },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Prevent self-deletion
    if (existingUser.id === session.user.id) {
      return NextResponse.json(
        { error: "Cannot delete yourself" },
        { status: 400 }
      );
    }

    // Delete user (cascades to profiles)
    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}

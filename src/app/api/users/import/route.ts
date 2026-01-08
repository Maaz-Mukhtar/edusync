import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const userRowSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().optional(),
  role: z.enum(["ADMIN", "TEACHER", "STUDENT", "PARENT"]),
  // Student specific
  sectionId: z.string().optional(),
  rollNumber: z.string().optional(),
  dateOfBirth: z.string().optional(),
  // Teacher specific
  employeeId: z.string().optional(),
  qualification: z.string().optional(),
  // Parent specific
  occupation: z.string().optional(),
  relationship: z.string().optional(),
});

type UserRow = z.infer<typeof userRowSchema>;

interface ImportResult {
  success: number;
  failed: number;
  errors: { row: number; email: string; error: string }[];
}

// POST /api/users/import - Bulk import users from CSV
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
    const { users, defaultPassword } = body as {
      users: UserRow[];
      defaultPassword: string;
    };

    if (!users || !Array.isArray(users) || users.length === 0) {
      return NextResponse.json(
        { error: "No users provided" },
        { status: 400 }
      );
    }

    if (users.length > 500) {
      return NextResponse.json(
        { error: "Maximum 500 users can be imported at once" },
        { status: 400 }
      );
    }

    const password = defaultPassword || "Welcome@123";
    const hashedPassword = await bcrypt.hash(password, 10);

    const result: ImportResult = {
      success: 0,
      failed: 0,
      errors: [],
    };

    // Get all existing emails to check for duplicates
    const existingUsers = await prisma.user.findMany({
      where: {
        schoolId: session.user.schoolId,
      },
      select: { email: true },
    });
    const existingEmails = new Set(existingUsers.map((u) => u.email?.toLowerCase()).filter(Boolean) as string[]);

    // Process each user
    for (let i = 0; i < users.length; i++) {
      const row = users[i];
      const rowNumber = i + 2; // +2 because row 1 is header, and array is 0-indexed

      try {
        // Validate the row
        const validatedData = userRowSchema.parse(row);

        // Check for duplicate email
        if (existingEmails.has(validatedData.email.toLowerCase())) {
          result.failed++;
          result.errors.push({
            row: rowNumber,
            email: validatedData.email,
            error: "Email already exists",
          });
          continue;
        }

        // Validate student has section
        if (validatedData.role === "STUDENT" && !validatedData.sectionId) {
          result.failed++;
          result.errors.push({
            row: rowNumber,
            email: validatedData.email,
            error: "Section ID is required for students",
          });
          continue;
        }

        // Verify section exists for students
        if (validatedData.role === "STUDENT" && validatedData.sectionId) {
          const section = await prisma.section.findFirst({
            where: {
              id: validatedData.sectionId,
              class: {
                schoolId: session.user.schoolId,
              },
            },
          });

          if (!section) {
            result.failed++;
            result.errors.push({
              row: rowNumber,
              email: validatedData.email,
              error: "Invalid section ID",
            });
            continue;
          }
        }

        // Create user with profile
        await prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              schoolId: session.user.schoolId,
              email: validatedData.email,
              passwordHash: hashedPassword,
              firstName: validatedData.firstName,
              lastName: validatedData.lastName,
              phone: validatedData.phone || null,
              role: validatedData.role,
            },
          });

          // Create role-specific profile
          if (validatedData.role === "STUDENT" && validatedData.sectionId) {
            await tx.studentProfile.create({
              data: {
                userId: user.id,
                sectionId: validatedData.sectionId,
                rollNumber: validatedData.rollNumber || null,
                dateOfBirth: validatedData.dateOfBirth
                  ? new Date(validatedData.dateOfBirth)
                  : null,
              },
            });
          } else if (validatedData.role === "TEACHER") {
            await tx.teacherProfile.create({
              data: {
                userId: user.id,
                employeeId: validatedData.employeeId || null,
                qualification: validatedData.qualification || null,
              },
            });
          } else if (validatedData.role === "PARENT") {
            await tx.parentProfile.create({
              data: {
                userId: user.id,
                occupation: validatedData.occupation || null,
                relationship: validatedData.relationship || null,
              },
            });
          }
        });

        existingEmails.add(validatedData.email.toLowerCase());
        result.success++;
      } catch (error) {
        result.failed++;
        if (error instanceof z.ZodError) {
          result.errors.push({
            row: rowNumber,
            email: row.email || "unknown",
            error: error.issues.map((e) => e.message).join(", "),
          });
        } else {
          result.errors.push({
            row: rowNumber,
            email: row.email || "unknown",
            error: "Failed to create user",
          });
        }
      }
    }

    return NextResponse.json({
      message: `Import completed: ${result.success} succeeded, ${result.failed} failed`,
      result,
    });
  } catch (error) {
    console.error("Error importing users:", error);
    return NextResponse.json(
      { error: "Failed to import users" },
      { status: 500 }
    );
  }
}

// GET /api/users/import - Get import template info
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get sections for the school (needed for student imports)
    const sections = await prisma.section.findMany({
      where: {
        class: {
          schoolId: session.user.schoolId,
        },
      },
      include: {
        class: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [
        { class: { name: "asc" } },
        { name: "asc" },
      ],
    });

    return NextResponse.json({
      template: {
        headers: [
          "firstName",
          "lastName",
          "email",
          "phone",
          "role",
          "sectionId",
          "rollNumber",
          "dateOfBirth",
          "employeeId",
          "qualification",
          "occupation",
          "relationship",
        ],
        roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"],
        sections: sections.map((s) => ({
          id: s.id,
          name: `${s.class.name} - ${s.name}`,
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching import template:", error);
    return NextResponse.json(
      { error: "Failed to fetch template info" },
      { status: 500 }
    );
  }
}

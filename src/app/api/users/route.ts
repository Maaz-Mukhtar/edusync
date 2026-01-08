import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { hash } from "bcryptjs";
import { z } from "zod";

const createUserSchema = z.object({
  email: z.string().email().optional().nullable(),
  phone: z.string().min(10).optional().nullable(),
  password: z.string().min(6),
  role: z.enum(["ADMIN", "TEACHER", "STUDENT", "PARENT"]),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  // Student-specific fields
  sectionId: z.string().optional(),
  rollNumber: z.string().optional(),
  dateOfBirth: z.string().optional(),
  // Teacher-specific fields
  employeeId: z.string().optional(),
  qualification: z.string().optional(),
  // Parent-specific fields
  occupation: z.string().optional(),
  relationship: z.string().optional(),
});

// GET /api/users - List all users
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can list users
    if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      schoolId: session.user.schoolId,
    };

    if (role && role !== "all") {
      where.role = role;
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          phone: true,
          role: true,
          firstName: true,
          lastName: true,
          avatar: true,
          isActive: true,
          createdAt: true,
          studentProfile: {
            select: {
              id: true,
              rollNumber: true,
              section: {
                select: {
                  id: true,
                  name: true,
                  class: { select: { id: true, name: true } },
                },
              },
            },
          },
          teacherProfile: {
            select: {
              id: true,
              employeeId: true,
              qualification: true,
            },
          },
          parentProfile: {
            select: {
              id: true,
              occupation: true,
              children: {
                select: {
                  student: {
                    select: {
                      user: {
                        select: { firstName: true, lastName: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

// POST /api/users - Create a new user
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
    const validatedData = createUserSchema.parse(body);

    // Validate email or phone is provided
    if (!validatedData.email && !validatedData.phone) {
      return NextResponse.json(
        { error: "Email or phone is required" },
        { status: 400 }
      );
    }

    // Check for existing user with same email or phone
    const existingUser = await prisma.user.findFirst({
      where: {
        schoolId: session.user.schoolId,
        OR: [
          validatedData.email ? { email: validatedData.email } : {},
          validatedData.phone ? { phone: validatedData.phone } : {},
        ].filter((c) => Object.keys(c).length > 0),
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email or phone already exists" },
        { status: 400 }
      );
    }

    // Validate section for students
    if (validatedData.role === "STUDENT" && !validatedData.sectionId) {
      return NextResponse.json(
        { error: "Section is required for students" },
        { status: 400 }
      );
    }

    const passwordHash = await hash(validatedData.password, 10);

    // Create user with profile
    const user = await prisma.user.create({
      data: {
        schoolId: session.user.schoolId,
        email: validatedData.email,
        phone: validatedData.phone,
        passwordHash,
        role: validatedData.role,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        ...(validatedData.role === "STUDENT" && validatedData.sectionId
          ? {
              studentProfile: {
                create: {
                  sectionId: validatedData.sectionId,
                  rollNumber: validatedData.rollNumber,
                  dateOfBirth: validatedData.dateOfBirth
                    ? new Date(validatedData.dateOfBirth)
                    : undefined,
                },
              },
            }
          : {}),
        ...(validatedData.role === "TEACHER"
          ? {
              teacherProfile: {
                create: {
                  employeeId: validatedData.employeeId,
                  qualification: validatedData.qualification,
                },
              },
            }
          : {}),
        ...(validatedData.role === "PARENT"
          ? {
              parentProfile: {
                create: {
                  occupation: validatedData.occupation,
                  relationship: validatedData.relationship,
                },
              },
            }
          : {}),
      },
      include: {
        studentProfile: true,
        teacherProfile: true,
        parentProfile: true,
      },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { hash } from "bcryptjs";
import { z } from "zod";

const createStudentSchema = z.object({
  email: z.string().email().optional().nullable(),
  phone: z.string().min(10).optional().nullable(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  sectionId: z.string().min(1),
  rollNumber: z.string().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
});

// GET /api/students - List all students with filtering and sorting
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");
    const sectionId = searchParams.get("sectionId");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    // Build the where clause for StudentProfile
    const profileWhere: Record<string, unknown> = {};

    if (sectionId) {
      profileWhere.sectionId = sectionId;
    } else if (classId) {
      profileWhere.section = { classId };
    }

    // Build the where clause for User
    const userWhere: Record<string, unknown> = {
      schoolId: session.user.schoolId,
      role: "STUDENT",
      studentProfile: Object.keys(profileWhere).length > 0 ? profileWhere : undefined,
    };

    if (status === "active") {
      userWhere.isActive = true;
    } else if (status === "inactive") {
      userWhere.isActive = false;
    }

    if (search) {
      userWhere.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { studentProfile: { rollNumber: { contains: search, mode: "insensitive" } } },
      ];
    }

    // Build the orderBy clause
    let orderBy: Record<string, unknown> = {};
    switch (sortBy) {
      case "name":
        orderBy = { firstName: sortOrder };
        break;
      case "rollNumber":
        orderBy = { studentProfile: { rollNumber: sortOrder } };
        break;
      case "class":
        orderBy = { studentProfile: { section: { class: { name: sortOrder } } } };
        break;
      case "createdAt":
      default:
        orderBy = { createdAt: sortOrder };
        break;
    }

    const [students, total] = await Promise.all([
      prisma.user.findMany({
        where: userWhere,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
          avatar: true,
          isActive: true,
          createdAt: true,
          studentProfile: {
            select: {
              id: true,
              rollNumber: true,
              dateOfBirth: true,
              section: {
                select: {
                  id: true,
                  name: true,
                  class: { select: { id: true, name: true } },
                },
              },
              parents: {
                select: {
                  parent: {
                    select: {
                      id: true,
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
      prisma.user.count({ where: userWhere }),
    ]);

    return NextResponse.json({
      students,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching students:", error);
    return NextResponse.json(
      { error: "Failed to fetch students" },
      { status: 500 }
    );
  }
}

// POST /api/students - Create a new student
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
    const validatedData = createStudentSchema.parse(body);

    // Validate email or phone is provided
    if (!validatedData.email && !validatedData.phone) {
      return NextResponse.json(
        { error: "Email or phone is required" },
        { status: 400 }
      );
    }

    // Normalize email to lowercase
    const normalizedEmail = validatedData.email?.toLowerCase();

    // Check for existing user with same email or phone
    const existingUser = await prisma.user.findFirst({
      where: {
        schoolId: session.user.schoolId,
        OR: [
          normalizedEmail ? { email: normalizedEmail } : {},
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

    // Verify section exists and belongs to school
    const section = await prisma.section.findFirst({
      where: {
        id: validatedData.sectionId,
        class: { schoolId: session.user.schoolId },
      },
    });

    if (!section) {
      return NextResponse.json(
        { error: "Invalid section" },
        { status: 400 }
      );
    }

    const passwordHash = await hash(validatedData.password, 10);

    // Create user with student profile
    const student = await prisma.user.create({
      data: {
        schoolId: session.user.schoolId,
        email: normalizedEmail,
        phone: validatedData.phone,
        passwordHash,
        role: "STUDENT",
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        studentProfile: {
          create: {
            sectionId: validatedData.sectionId,
            rollNumber: validatedData.rollNumber,
            dateOfBirth: validatedData.dateOfBirth
              ? new Date(validatedData.dateOfBirth)
              : undefined,
          },
        },
      },
      include: {
        studentProfile: {
          include: {
            section: {
              include: { class: true },
            },
          },
        },
      },
    });

    return NextResponse.json({ student }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error creating student:", error);
    return NextResponse.json(
      { error: "Failed to create student" },
      { status: 500 }
    );
  }
}

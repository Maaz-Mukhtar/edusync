import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { hash } from "bcryptjs";
import { z } from "zod";

const createTeacherSchema = z.object({
  email: z.string().email().optional().nullable(),
  phone: z.string().min(10).optional().nullable(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  employeeId: z.string().optional().nullable(),
  qualification: z.string().optional().nullable(),
});

// GET /api/teachers - List all teachers with filtering and sorting
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
    const subjectId = searchParams.get("subjectId");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    // Build the where clause for TeacherProfile
    const profileWhere: Record<string, unknown> = {};

    if (classId) {
      // Teachers who have subject expertise in this class or are assigned to sections in this class
      profileWhere.OR = [
        { subjectsTaught: { some: { subject: { classId } } } },
        { sectionSubjects: { some: { section: { classId } } } },
        { classTeacherOf: { some: { section: { classId } } } },
      ];
    }

    if (subjectId) {
      profileWhere.subjectsTaught = { some: { subjectId } };
    }

    // Build the where clause for User
    const userWhere: Record<string, unknown> = {
      schoolId: session.user.schoolId,
      role: "TEACHER",
      teacherProfile: Object.keys(profileWhere).length > 0 ? profileWhere : undefined,
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
        { teacherProfile: { employeeId: { contains: search, mode: "insensitive" } } },
      ];
    }

    // Build the orderBy clause
    let orderBy: Record<string, unknown> = {};
    switch (sortBy) {
      case "name":
        orderBy = { firstName: sortOrder };
        break;
      case "employeeId":
        orderBy = { teacherProfile: { employeeId: sortOrder } };
        break;
      case "createdAt":
      default:
        orderBy = { createdAt: sortOrder };
        break;
    }

    const [teachers, total] = await Promise.all([
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
          teacherProfile: {
            select: {
              id: true,
              employeeId: true,
              qualification: true,
              subjectsTaught: {
                select: {
                  subject: {
                    select: {
                      id: true,
                      name: true,
                      class: { select: { id: true, name: true } },
                    },
                  },
                },
              },
              classTeacherOf: {
                select: {
                  section: {
                    select: {
                      id: true,
                      name: true,
                      class: { select: { id: true, name: true } },
                    },
                  },
                },
              },
              sectionSubjects: {
                select: {
                  section: {
                    select: {
                      id: true,
                      name: true,
                      class: { select: { id: true, name: true } },
                    },
                  },
                  subject: {
                    select: { id: true, name: true },
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
      teachers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching teachers:", error);
    return NextResponse.json(
      { error: "Failed to fetch teachers" },
      { status: 500 }
    );
  }
}

// POST /api/teachers - Create a new teacher
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
    const validatedData = createTeacherSchema.parse(body);

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

    const passwordHash = await hash(validatedData.password, 10);

    // Create user with teacher profile
    const teacher = await prisma.user.create({
      data: {
        schoolId: session.user.schoolId,
        email: normalizedEmail,
        phone: validatedData.phone,
        passwordHash,
        role: "TEACHER",
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        teacherProfile: {
          create: {
            employeeId: validatedData.employeeId,
            qualification: validatedData.qualification,
          },
        },
      },
      include: {
        teacherProfile: true,
      },
    });

    return NextResponse.json({ teacher }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error creating teacher:", error);
    return NextResponse.json(
      { error: "Failed to create teacher" },
      { status: 500 }
    );
  }
}

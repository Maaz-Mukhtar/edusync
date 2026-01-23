import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

// Naming convention presets
const NAMING_PRESETS: Record<string, string[]> = {
  letters: ["A", "B", "C", "D", "E", "F", "G", "H"],
  colors: ["Blue", "Green", "Red", "Yellow", "Orange", "Purple", "Pink", "White"],
  numbers: ["1", "2", "3", "4", "5", "6", "7", "8"],
  roman: ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"],
};

const bulkCreateSchema = z.object({
  fromGrade: z.number().min(1).max(12),
  toGrade: z.number().min(1).max(12),
  sectionsPerClass: z.number().min(1).max(8),
  namingConvention: z.enum(["letters", "colors", "numbers", "roman", "custom"]),
  customNames: z.array(z.string()).optional().nullable(),
});

function getSectionNames(
  convention: string,
  count: number,
  customNames?: string[] | null
): string[] {
  if (convention === "custom" && customNames && customNames.length > 0) {
    return customNames.slice(0, count);
  }
  const preset = NAMING_PRESETS[convention];
  if (!preset) {
    return NAMING_PRESETS.letters.slice(0, count);
  }
  return preset.slice(0, count);
}

// POST /api/classes/bulk - Bulk create classes with sections
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
    const validatedData = bulkCreateSchema.parse(body);

    // Validate fromGrade <= toGrade
    if (validatedData.fromGrade > validatedData.toGrade) {
      return NextResponse.json(
        { error: "From grade must be less than or equal to To grade" },
        { status: 400 }
      );
    }

    // Validate custom names count
    if (
      validatedData.namingConvention === "custom" &&
      (!validatedData.customNames ||
        validatedData.customNames.length < validatedData.sectionsPerClass)
    ) {
      return NextResponse.json(
        {
          error: `Custom names must have at least ${validatedData.sectionsPerClass} entries`,
        },
        { status: 400 }
      );
    }

    const sectionNames = getSectionNames(
      validatedData.namingConvention,
      validatedData.sectionsPerClass,
      validatedData.customNames
    );

    // Capture schoolId for use in transaction
    const schoolId = session.user.schoolId;

    // Get existing classes to check for duplicates
    const existingClasses = await prisma.class.findMany({
      where: {
        schoolId,
      },
      select: {
        name: true,
      },
    });

    const existingClassNames = new Set(
      existingClasses.map((c) => c.name.toLowerCase())
    );

    // Get the highest display order
    const lastClass = await prisma.class.findFirst({
      where: { schoolId },
      orderBy: { displayOrder: "desc" },
    });

    let currentDisplayOrder = (lastClass?.displayOrder ?? 0) + 1;

    // Prepare classes to create
    const classesToCreate: Array<{
      grade: number;
      name: string;
      displayOrder: number;
    }> = [];
    const skippedClasses: string[] = [];

    for (
      let grade = validatedData.fromGrade;
      grade <= validatedData.toGrade;
      grade++
    ) {
      const className = `Grade ${grade}`;
      if (existingClassNames.has(className.toLowerCase())) {
        skippedClasses.push(className);
      } else {
        classesToCreate.push({
          grade,
          name: className,
          displayOrder: currentDisplayOrder++,
        });
      }
    }

    // If all classes already exist
    if (classesToCreate.length === 0) {
      return NextResponse.json(
        {
          success: true,
          message: "All classes already exist",
          created: { classes: 0, sections: 0 },
          skipped: skippedClasses,
          data: [],
        },
        { status: 200 }
      );
    }

    // Create classes with sections in a transaction
    const createdClasses = await prisma.$transaction(async (tx) => {
      const results = [];

      for (const classData of classesToCreate) {
        const newClass = await tx.class.create({
          data: {
            schoolId,
            name: classData.name,
            displayOrder: classData.displayOrder,
            sections: {
              create: sectionNames.map((name) => ({ name })),
            },
          },
          include: {
            sections: {
              orderBy: { name: "asc" },
            },
          },
        });
        results.push(newClass);
      }

      return results;
    });

    const totalSections = createdClasses.reduce(
      (acc, c) => acc + c.sections.length,
      0
    );

    return NextResponse.json(
      {
        success: true,
        message:
          skippedClasses.length > 0
            ? `Created ${createdClasses.length} classes. ${skippedClasses.length} classes were skipped (already exist).`
            : `Created ${createdClasses.length} classes with ${totalSections} sections.`,
        created: {
          classes: createdClasses.length,
          sections: totalSections,
        },
        skipped: skippedClasses,
        data: createdClasses,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error creating classes in bulk:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to create classes", details: errorMessage },
      { status: 500 }
    );
  }
}

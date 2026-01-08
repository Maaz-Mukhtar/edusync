import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// DELETE /api/parent-students/[id] - Remove a parent-student link
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

    // Check if link exists and belongs to same school
    const existingLink = await prisma.parentStudent.findFirst({
      where: {
        id,
        parent: {
          user: {
            schoolId: session.user.schoolId,
          },
        },
      },
    });

    if (!existingLink) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    await prisma.parentStudent.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting parent-student link:", error);
    return NextResponse.json(
      { error: "Failed to delete parent-student link" },
      { status: 500 }
    );
  }
}

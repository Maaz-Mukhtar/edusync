import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { readFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

// GET /api/teacher/assessments/[id]/files/[fileId] - Download file
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "TEACHER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!teacherProfile) {
      return NextResponse.json({ error: "Teacher profile not found" }, { status: 404 });
    }

    const { id: assessmentId, fileId } = await params;

    // Verify assessment exists and belongs to teacher
    const assessment = await prisma.assessment.findFirst({
      where: {
        id: assessmentId,
        createdById: teacherProfile.id,
      },
    });

    if (!assessment) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    // Get file record
    const fileRecord = await prisma.assessmentFile.findFirst({
      where: {
        id: fileId,
        assessmentId,
      },
    });

    if (!fileRecord) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Get file from disk
    const filePath = path.join(process.cwd(), "uploads", fileRecord.storagePath);

    if (!existsSync(filePath)) {
      return NextResponse.json({ error: "File not found on disk" }, { status: 404 });
    }

    const fileBuffer = await readFile(filePath);

    // Return file with appropriate headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": fileRecord.mimeType,
        "Content-Disposition": `attachment; filename="${fileRecord.originalName}"`,
        "Content-Length": fileRecord.fileSize.toString(),
      },
    });
  } catch (error) {
    console.error("Error downloading file:", error);
    return NextResponse.json(
      { error: "Failed to download file" },
      { status: 500 }
    );
  }
}

// DELETE /api/teacher/assessments/[id]/files/[fileId] - Delete file
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "TEACHER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!teacherProfile) {
      return NextResponse.json({ error: "Teacher profile not found" }, { status: 404 });
    }

    const { id: assessmentId, fileId } = await params;

    // Verify assessment exists and belongs to teacher
    const assessment = await prisma.assessment.findFirst({
      where: {
        id: assessmentId,
        createdById: teacherProfile.id,
      },
    });

    if (!assessment) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    // Get file record
    const fileRecord = await prisma.assessmentFile.findFirst({
      where: {
        id: fileId,
        assessmentId,
      },
    });

    if (!fileRecord) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Delete file from disk
    const filePath = path.join(process.cwd(), "uploads", fileRecord.storagePath);

    if (existsSync(filePath)) {
      await unlink(filePath);
    }

    // Delete database record
    await prisma.assessmentFile.delete({
      where: { id: fileId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting file:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}

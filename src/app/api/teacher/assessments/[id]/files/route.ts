import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { allowedMimeTypes, MAX_FILE_SIZE } from "@/lib/validations/online-tests";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";

// GET /api/teacher/assessments/[id]/files - Get files for an assessment
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id: assessmentId } = await params;

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

    const files = await prisma.assessmentFile.findMany({
      where: { assessmentId },
      orderBy: { uploadedAt: "desc" },
    });

    return NextResponse.json({
      files: files.map((f) => ({
        id: f.id,
        fileName: f.fileName,
        originalName: f.originalName,
        fileType: f.fileType,
        fileSize: f.fileSize,
        mimeType: f.mimeType,
        uploadedAt: f.uploadedAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching files:", error);
    return NextResponse.json(
      { error: "Failed to fetch files" },
      { status: 500 }
    );
  }
}

// POST /api/teacher/assessments/[id]/files - Upload file to assessment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id: assessmentId } = await params;

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

    // Parse form data
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Create storage directory if it doesn't exist
    const uploadDir = path.join(process.cwd(), "uploads", "assessments", assessmentId);
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    const savedFiles = [];
    const errors = [];

    for (const file of files) {
      // Validate file type
      const mimeType = file.type;
      if (!(mimeType in allowedMimeTypes)) {
        errors.push(`${file.name}: Invalid file type`);
        continue;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: File too large (max 10MB)`);
        continue;
      }

      // Generate unique filename
      const ext = path.extname(file.name);
      const uniqueFileName = `${randomUUID()}${ext}`;
      const filePath = path.join(uploadDir, uniqueFileName);

      // Save file to disk
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await writeFile(filePath, buffer);

      // Store path relative to uploads directory
      const storagePath = path.join("assessments", assessmentId, uniqueFileName);

      // Create database record
      const fileRecord = await prisma.assessmentFile.create({
        data: {
          assessmentId,
          fileName: uniqueFileName,
          originalName: file.name,
          fileType: allowedMimeTypes[mimeType as keyof typeof allowedMimeTypes],
          fileSize: file.size,
          mimeType,
          storagePath,
        },
      });

      savedFiles.push({
        id: fileRecord.id,
        fileName: fileRecord.fileName,
        originalName: fileRecord.originalName,
        fileType: fileRecord.fileType,
        fileSize: fileRecord.fileSize,
        mimeType: fileRecord.mimeType,
        uploadedAt: fileRecord.uploadedAt,
      });
    }

    if (savedFiles.length === 0) {
      return NextResponse.json(
        { error: errors.length > 0 ? errors.join(", ") : "No valid files uploaded" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      files: savedFiles,
      errors: errors.length > 0 ? errors : undefined,
    }, { status: 201 });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}

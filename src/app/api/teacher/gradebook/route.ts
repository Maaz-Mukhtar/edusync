import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/teacher/gradebook - Get gradebook data
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const sectionId = searchParams.get("sectionId");
    const subjectId = searchParams.get("subjectId");

    if (!sectionId) {
      return NextResponse.json({ error: "Section ID is required" }, { status: 400 });
    }

    // Verify teacher has access to this section
    const hasAccess = await prisma.sectionTeacher.findFirst({
      where: {
        teacherId: teacherProfile.id,
        sectionId,
      },
    });

    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied to this section" }, { status: 403 });
    }

    // Get section info
    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: {
        class: true,
        students: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { rollNumber: "asc" },
        },
      },
    });

    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    // Get assessments for this section (optionally filtered by subject)
    const assessments = await prisma.assessment.findMany({
      where: {
        sectionId,
        ...(subjectId && { subjectId }),
      },
      include: {
        subject: true,
        results: true,
      },
      orderBy: { date: "desc" },
    });

    // Build gradebook matrix
    const gradebook = section.students.map((student) => {
      const studentResults: Record<
        string,
        {
          marksObtained: number;
          percentage: number;
          grade: string | null;
        } | null
      > = {};

      let totalMarksObtained = 0;
      let totalMaxMarks = 0;

      for (const assessment of assessments) {
        const result = assessment.results.find(
          (r) => r.studentId === student.id
        );

        if (result) {
          studentResults[assessment.id] = {
            marksObtained: result.marksObtained,
            percentage: (result.marksObtained / assessment.totalMarks) * 100,
            grade: result.grade,
          };
          totalMarksObtained += result.marksObtained;
          totalMaxMarks += assessment.totalMarks;
        } else {
          studentResults[assessment.id] = null;
        }
      }

      return {
        studentId: student.id,
        rollNumber: student.rollNumber,
        studentName: `${student.user.firstName} ${student.user.lastName}`,
        results: studentResults,
        average: totalMaxMarks > 0
          ? ((totalMarksObtained / totalMaxMarks) * 100).toFixed(1)
          : null,
        totalObtained: totalMarksObtained,
        totalMax: totalMaxMarks,
      };
    });

    // Calculate class statistics
    const classStats = {
      totalStudents: section.students.length,
      totalAssessments: assessments.length,
      averageScore: 0,
      highestAverage: 0,
      lowestAverage: 100,
    };

    const validAverages = gradebook
      .filter((s) => s.average !== null)
      .map((s) => parseFloat(s.average!));

    if (validAverages.length > 0) {
      classStats.averageScore = parseFloat(
        (validAverages.reduce((a, b) => a + b, 0) / validAverages.length).toFixed(1)
      );
      classStats.highestAverage = Math.max(...validAverages);
      classStats.lowestAverage = Math.min(...validAverages);
    }

    return NextResponse.json({
      section: {
        id: section.id,
        name: `${section.class.name} - ${section.name}`,
      },
      assessments: assessments.map((a) => ({
        id: a.id,
        title: a.title,
        type: a.type,
        totalMarks: a.totalMarks,
        date: a.date,
        subject: {
          id: a.subject.id,
          name: a.subject.name,
          color: a.subject.color,
        },
      })),
      gradebook,
      stats: classStats,
    });
  } catch (error) {
    console.error("Error fetching gradebook:", error);
    return NextResponse.json(
      { error: "Failed to fetch gradebook" },
      { status: 500 }
    );
  }
}

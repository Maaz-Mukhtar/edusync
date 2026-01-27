import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { revalidateParentsForStudents, revalidateStudents, revalidateTeachers } from "@/lib/cache-revalidate";
import { calculateGradeFromMarks } from "@/lib/grades";
import { computeTopicScoresV1 } from "@/lib/analytics/topic-scores";

const upsertQuestionResultsSchema = z.object({
  entries: z.array(
    z.object({
      studentId: z.string().min(1),
      questionId: z.string().min(1),
      marksAwarded: z.number().min(0).nullable(),
    })
  ),
});

// GET /api/teacher/assessments/[id]/question-results - Get assessment questions + per-question marks
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "TEACHER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: session.user.id },
    });
    if (!teacherProfile) return NextResponse.json({ error: "Teacher profile not found" }, { status: 404 });

    const { id } = await params;

    const assessment = await prisma.assessment.findFirst({
      where: { id, createdById: teacherProfile.id },
      include: {
        section: {
          include: {
            class: true,
            students: {
              include: {
                user: {
                  select: { firstName: true, lastName: true },
                },
              },
              orderBy: { rollNumber: "asc" },
            },
          },
        },
        subject: true,
        results: true,
        questions: {
          select: { id: true, type: true, marks: true, orderIndex: true },
          orderBy: { orderIndex: "asc" },
        },
        questionResults: {
          select: { studentId: true, questionId: true, marksAwarded: true },
        },
      },
    });

    if (!assessment) return NextResponse.json({ error: "Assessment not found" }, { status: 404 });

    const resultsMap = new Map(assessment.results.map((r) => [r.studentId, r]));

    return NextResponse.json({
      assessment: {
        id: assessment.id,
        title: assessment.title,
        type: assessment.type,
        totalMarks: assessment.totalMarks,
        date: assessment.date,
        description: assessment.description,
        topics: assessment.topics,
        section: {
          id: assessment.section.id,
          name: `${assessment.section.class.name} - ${assessment.section.name}`,
        },
        subject: {
          id: assessment.subject.id,
          name: assessment.subject.name,
          color: assessment.subject.color,
        },
        questions: assessment.questions.map((q) => ({
          id: q.id,
          type: q.type,
          marks: q.marks,
          orderIndex: q.orderIndex,
        })),
        questionResults: assessment.questionResults.map((r) => ({
          studentId: r.studentId,
          questionId: r.questionId,
          marksAwarded: r.marksAwarded,
        })),
        students: assessment.section.students.map((s) => {
          const result = resultsMap.get(s.id);
          return {
            studentId: s.id,
            rollNumber: s.rollNumber,
            studentName: `${s.user.firstName} ${s.user.lastName}`,
            marksObtained: result?.marksObtained ?? null,
            grade: result?.grade ?? null,
            remarks: result?.remarks ?? null,
            percentage: result ? ((result.marksObtained / assessment.totalMarks) * 100).toFixed(1) : null,
          };
        }),
      },
    });
  } catch (error) {
    console.error("Error fetching assessment question results:", error);
    return NextResponse.json({ error: "Failed to fetch assessment question results" }, { status: 500 });
  }
}

// PUT /api/teacher/assessments/[id]/question-results - Upsert per-question marks + recompute AssessmentResult
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "TEACHER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: session.user.id },
    });
    if (!teacherProfile) return NextResponse.json({ error: "Teacher profile not found" }, { status: 404 });

    const { id: assessmentId } = await params;
    const body = await request.json();
    const validated = upsertQuestionResultsSchema.parse(body);

    const assessment = await prisma.assessment.findFirst({
      where: { id: assessmentId, createdById: teacherProfile.id },
      include: {
        section: { select: { students: { select: { id: true } } } },
        questions: {
          select: {
            id: true,
            type: true,
            marks: true,
            topicId: true,
            topic: { select: { name: true } },
          },
        },
      },
    });

    if (!assessment) return NextResponse.json({ error: "Assessment not found" }, { status: 404 });

    const questionById = new Map(assessment.questions.map((q) => [q.id, q]));
    const studentIdsInSection = new Set(assessment.section.students.map((s) => s.id));
    const computedTotalMarks = assessment.questions.reduce((sum, q) => sum + q.marks, 0);
    const totalForGrade = computedTotalMarks > 0 ? computedTotalMarks : assessment.totalMarks;

    for (const entry of validated.entries) {
      if (!studentIdsInSection.has(entry.studentId)) {
        return NextResponse.json({ error: "Invalid studentId for this assessment section" }, { status: 400 });
      }
      const question = questionById.get(entry.questionId);
      if (!question) {
        return NextResponse.json({ error: "Invalid questionId for this assessment" }, { status: 400 });
      }
      if (entry.marksAwarded === null) continue;

      if (entry.marksAwarded > question.marks) {
        return NextResponse.json({ error: "Marks awarded cannot exceed question marks" }, { status: 400 });
      }
      if (question.type === "MCQ" && entry.marksAwarded !== 0 && entry.marksAwarded !== question.marks) {
        return NextResponse.json({ error: "MCQ marks must be 0 or full marks" }, { status: 400 });
      }
    }

    const affectedStudentIds = Array.from(new Set(validated.entries.map((e) => e.studentId)));
    const questionCount = assessment.questions.length;

    await prisma.$transaction(async (tx) => {
      // If this assessment has explicit questions, keep Assessment.totalMarks in sync with the sum of question marks.
      // This avoids >100% percentages and prevents grading saves from failing when totals drift.
      if (questionCount > 0 && computedTotalMarks > 0 && assessment.totalMarks !== computedTotalMarks) {
        await tx.assessment.update({
          where: { id: assessmentId },
          data: { totalMarks: computedTotalMarks },
        });
      }

      await Promise.all(
        validated.entries.map(async (entry) => {
          if (entry.marksAwarded === null) {
            await tx.assessmentQuestionResult.deleteMany({
              where: { assessmentId: assessmentId, studentId: entry.studentId, questionId: entry.questionId },
            });
            return;
          }

          await tx.assessmentQuestionResult.upsert({
            where: {
              assessmentId_studentId_questionId: {
                assessmentId,
                studentId: entry.studentId,
                questionId: entry.questionId,
              },
            },
            update: { marksAwarded: entry.marksAwarded },
            create: {
              assessmentId,
              studentId: entry.studentId,
              questionId: entry.questionId,
              marksAwarded: entry.marksAwarded,
            },
          });
        })
      );

      if (questionCount === 0) return;

      const results = await tx.assessmentQuestionResult.findMany({
        where: { assessmentId, studentId: { in: affectedStudentIds } },
        select: { studentId: true, questionId: true, marksAwarded: true },
      });

      const totals = new Map<string, { count: number; sum: number; marksByQuestionId: Map<string, number> }>();
      for (const r of results) {
        const current = totals.get(r.studentId) ?? { count: 0, sum: 0, marksByQuestionId: new Map<string, number>() };
        current.marksByQuestionId.set(r.questionId, r.marksAwarded);
        totals.set(r.studentId, { count: current.count + 1, sum: current.sum + r.marksAwarded, marksByQuestionId: current.marksByQuestionId });
      }

      const questionsForScores = assessment.questions.map((q) => ({
        id: q.id,
        marks: q.marks,
        topicId: q.topicId ?? null,
        topicName: q.topic?.name ?? null,
      }));

      for (const studentId of affectedStudentIds) {
        const t = totals.get(studentId);
        if (!t || t.count !== questionCount) {
          await tx.assessmentResult.deleteMany({ where: { assessmentId, studentId } });
          continue;
        }

        if (t.sum - totalForGrade > 0.000001) {
          throw new Error(`Total marks cannot exceed ${totalForGrade}`);
        }

        const topicScores = computeTopicScoresV1({
          questions: questionsForScores,
          marksByQuestionId: t.marksByQuestionId,
        });

        await tx.assessmentResult.upsert({
          where: { assessmentId_studentId: { assessmentId, studentId } },
          update: {
            marksObtained: t.sum,
            grade: calculateGradeFromMarks(t.sum, totalForGrade),
            topicScores,
          },
          create: {
            assessmentId,
            studentId,
            marksObtained: t.sum,
            grade: calculateGradeFromMarks(t.sum, totalForGrade),
            topicScores,
          },
        });
      }
    });

    revalidateTeachers([teacherProfile.id]);
    revalidateStudents(affectedStudentIds);
    await revalidateParentsForStudents(affectedStudentIds);

    return NextResponse.json({ message: "Per-question marks saved" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.issues }, { status: 400 });
    }
    const isTotalMarksError = error instanceof Error && error.message.startsWith("Total marks cannot exceed");
    const message = isTotalMarksError ? error.message : "Failed to save per-question marks";
    console.error("Error saving assessment question results:", error);
    return NextResponse.json({ error: message }, { status: isTotalMarksError ? 400 : 500 });
  }
}

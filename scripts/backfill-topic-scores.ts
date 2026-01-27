import { Prisma, PrismaClient } from "@prisma/client";
import { computeTopicScoresV1 } from "../src/lib/analytics/topic-scores";

const prisma = new PrismaClient();

function getFlagValue(name: string): string | null {
  const prefix = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limit = Number(getFlagValue("limit") ?? "500");

  const targets = await prisma.assessmentResult.findMany({
    where: { topicScores: { equals: Prisma.DbNull } },
    select: { assessmentId: true, studentId: true },
    take: Number.isFinite(limit) ? limit : 500,
  });

  const byAssessment = new Map<string, string[]>();
  for (const t of targets) {
    const arr = byAssessment.get(t.assessmentId) ?? [];
    arr.push(t.studentId);
    byAssessment.set(t.assessmentId, arr);
  }

  let updated = 0;
  let skipped = 0;

  for (const [assessmentId, studentIds] of byAssessment.entries()) {
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: {
        id: true,
        questions: {
          select: { id: true, marks: true, topicId: true, topic: { select: { name: true } } },
        },
      },
    });

    if (!assessment || assessment.questions.length === 0) {
      skipped += studentIds.length;
      continue;
    }

    const questionsForScores = assessment.questions.map((q) => ({
      id: q.id,
      marks: q.marks,
      topicId: q.topicId ?? null,
      topicName: q.topic?.name ?? null,
    }));

    for (const studentId of studentIds) {
      const marks = await prisma.assessmentQuestionResult.findMany({
        where: { assessmentId, studentId },
        select: { questionId: true, marksAwarded: true },
      });

      if (marks.length !== assessment.questions.length) {
        skipped += 1;
        continue;
      }

      const marksByQuestionId = new Map<string, number>();
      for (const m of marks) marksByQuestionId.set(m.questionId, m.marksAwarded);

      const topicScores = computeTopicScoresV1({ questions: questionsForScores, marksByQuestionId });

      if (!dryRun) {
        await prisma.assessmentResult.update({
          where: { assessmentId_studentId: { assessmentId, studentId } },
          data: { topicScores },
        });
      }

      updated += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        limit,
        candidates: targets.length,
        updated,
        skipped,
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

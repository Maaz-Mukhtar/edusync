import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import TestBuilder from "./test-builder";

interface PageProps {
  params: Promise<{ testId: string }>;
}

export default async function TestBuilderPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user || session.user.role !== "TEACHER") {
    notFound();
  }

  const teacherProfile = await prisma.teacherProfile.findUnique({
    where: { userId: session.user.id },
  });

  if (!teacherProfile) {
    notFound();
  }

  const { testId } = await params;

  const onlineTest = await prisma.onlineTest.findFirst({
    where: {
      id: testId,
      assessment: {
        createdById: teacherProfile.id,
      },
    },
    include: {
      assessment: {
        include: {
          section: {
            include: { class: true },
          },
          subject: true,
          questions: {
            include: {
              options: {
                orderBy: { orderIndex: "asc" },
              },
            },
            orderBy: { orderIndex: "asc" },
          },
        },
      },
      _count: {
        select: { attempts: true },
      },
    },
  });

  if (!onlineTest) {
    notFound();
  }

  const initialData = {
    id: onlineTest.id,
    status: onlineTest.status,
    timeLimitMins: onlineTest.timeLimitMins,
    instructions: onlineTest.instructions,
    shuffleQuestions: onlineTest.shuffleQuestions,
    showResults: onlineTest.showResults,
    passingScore: onlineTest.passingScore,
    startTime: onlineTest.startTime,
    endTime: onlineTest.endTime,
    attemptCount: onlineTest._count.attempts,
    assessment: {
      id: onlineTest.assessment.id,
      title: onlineTest.assessment.title,
      totalMarks: onlineTest.assessment.totalMarks,
      date: onlineTest.assessment.date,
    },
    section: {
      id: onlineTest.assessment.section.id,
      name: `${onlineTest.assessment.section.class.name} - ${onlineTest.assessment.section.name}`,
    },
    subject: {
      id: onlineTest.assessment.subject.id,
      name: onlineTest.assessment.subject.name,
      color: onlineTest.assessment.subject.color,
    },
    questions: onlineTest.assessment.questions.map((q) => ({
      id: q.id,
      type: q.type as "MCQ" | "SHORT_ANSWER",
      questionText: q.questionText,
      marks: q.marks,
      orderIndex: q.orderIndex,
      explanation: q.explanation,
      options: q.options.map((opt) => ({
        id: opt.id,
        optionText: opt.optionText,
        isCorrect: opt.isCorrect,
        orderIndex: opt.orderIndex,
      })),
    })),
  };

  return <TestBuilder initialData={initialData} />;
}

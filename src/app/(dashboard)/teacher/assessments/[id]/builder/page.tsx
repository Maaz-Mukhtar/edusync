import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import QuestionBuilder from "./question-builder";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function BuilderPage({ params }: PageProps) {
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

  const { id } = await params;

  const assessment = await prisma.assessment.findFirst({
    where: {
      id,
      createdById: teacherProfile.id,
    },
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
      onlineTest: {
        select: { status: true },
      },
    },
  });

  if (!assessment) {
    notFound();
  }

  const initialData = {
    id: assessment.id,
    title: assessment.title,
    type: assessment.type,
    totalMarks: assessment.totalMarks,
    date: assessment.date,
    description: assessment.description,
    section: {
      id: assessment.section.id,
      name: `${assessment.section.class.name} - ${assessment.section.name}`,
    },
    subject: {
      id: assessment.subject.id,
      name: assessment.subject.name,
      color: assessment.subject.color,
    },
    hasOnlineTest: !!assessment.onlineTest,
    onlineTestStatus: assessment.onlineTest?.status || null,
    questions: assessment.questions.map((q) => ({
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

  return <QuestionBuilder initialData={initialData} />;
}

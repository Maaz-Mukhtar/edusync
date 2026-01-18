import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Clock, FileText } from "lucide-react";

interface PageProps {
  params: Promise<{ testId: string }>;
}

export default async function PreviewPage({ params }: PageProps) {
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
    },
  });

  if (!onlineTest) {
    notFound();
  }

  const totalMarks = onlineTest.assessment.questions.reduce((sum, q) => sum + q.marks, 0);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/teacher/online-tests/${testId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Test Preview</h1>
          <p className="text-muted-foreground">
            This is how students will see the test
          </p>
        </div>
      </div>

      {/* Test Info Card */}
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{onlineTest.assessment.title}</CardTitle>
          <CardDescription>
            {onlineTest.assessment.section.class.name} - {onlineTest.assessment.section.name} &bull;{" "}
            {onlineTest.assessment.subject.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center gap-8 mb-6">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <span>{onlineTest.assessment.questions.length} Questions</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{totalMarks} Marks</Badge>
            </div>
            {onlineTest.timeLimitMins && (
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <span>{onlineTest.timeLimitMins} Minutes</span>
              </div>
            )}
          </div>

          {onlineTest.instructions && (
            <div className="bg-muted p-4 rounded-lg mb-6">
              <h3 className="font-medium mb-2">Instructions:</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {onlineTest.instructions}
              </p>
            </div>
          )}

          <div className="text-center">
            <Button size="lg" disabled>
              Start Test
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              (Preview only - button disabled)
            </p>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Questions Preview */}
      <div className="space-y-6">
        {onlineTest.assessment.questions.map((question, index) => (
          <Card key={question.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  Question {index + 1}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {question.type === "MCQ" ? "Multiple Choice" : "Short Answer"}
                  </Badge>
                  <Badge variant="secondary">
                    {question.marks} mark{question.marks !== 1 ? "s" : ""}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-base">{question.questionText}</p>

              {question.type === "MCQ" && question.options.length > 0 && (
                <div className="space-y-2 pl-4">
                  {question.options.map((option, optIndex) => (
                    <div
                      key={option.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border ${
                        option.isCorrect
                          ? "border-green-500 bg-green-50"
                          : "border-gray-200"
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-sm font-medium ${
                          option.isCorrect
                            ? "border-green-500 bg-green-500 text-white"
                            : "border-gray-300"
                        }`}
                      >
                        {String.fromCharCode(65 + optIndex)}
                      </div>
                      <span className={option.isCorrect ? "font-medium" : ""}>
                        {option.optionText}
                      </span>
                      {option.isCorrect && (
                        <Badge className="ml-auto bg-green-100 text-green-800">
                          Correct
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {question.type === "SHORT_ANSWER" && (
                <div className="border-2 border-dashed rounded-lg p-4 text-center text-muted-foreground">
                  <p className="text-sm">Student will type their answer here</p>
                </div>
              )}

              {question.explanation && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="text-sm font-medium text-blue-800 mb-1">
                    Explanation:
                  </h4>
                  <p className="text-sm text-blue-700">{question.explanation}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {onlineTest.assessment.questions.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">No Questions</h3>
            <p className="text-sm text-muted-foreground mb-4">
              This test doesn&apos;t have any questions yet.
            </p>
            <Button asChild>
              <Link href={`/teacher/online-tests/${testId}`}>
                Add Questions
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/teacher/online-tests/[testId]/export - Export test for printing
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
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

    const { testId } = await params;
    const { searchParams } = new URL(request.url);
    const includeAnswerKey = searchParams.get("answerKey") === "true";
    const format = searchParams.get("format") || "json"; // json or html

    // Verify test exists and belongs to teacher
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
            createdBy: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
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
      return NextResponse.json({ error: "Online test not found" }, { status: 404 });
    }

    // Calculate total marks
    const totalMarks = onlineTest.assessment.questions.reduce((sum, q) => sum + q.marks, 0);

    // Build export data
    const exportData = {
      test: {
        id: onlineTest.id,
        title: onlineTest.assessment.title,
        description: onlineTest.assessment.description,
        instructions: onlineTest.instructions,
        timeLimitMins: onlineTest.timeLimitMins,
        totalMarks,
        questionCount: onlineTest.assessment.questions.length,
        className: onlineTest.assessment.section.class.name,
        sectionName: onlineTest.assessment.section.name,
        subjectName: onlineTest.assessment.subject.name,
        teacherName: `${onlineTest.assessment.createdBy.user.firstName} ${onlineTest.assessment.createdBy.user.lastName}`,
        date: onlineTest.assessment.date,
      },
      questions: onlineTest.assessment.questions.map((q, index) => ({
        number: index + 1,
        type: q.type,
        questionText: q.questionText,
        marks: q.marks,
        options: q.type === "MCQ"
          ? q.options.map((opt, optIndex) => ({
              letter: String.fromCharCode(65 + optIndex), // A, B, C, D
              text: opt.optionText,
              ...(includeAnswerKey && { isCorrect: opt.isCorrect }),
            }))
          : null,
        ...(includeAnswerKey && {
          correctAnswer: q.type === "MCQ"
            ? String.fromCharCode(65 + q.options.findIndex((opt) => opt.isCorrect))
            : null,
          explanation: q.explanation,
        }),
      })),
    };

    // Return JSON format
    if (format === "json") {
      return NextResponse.json({
        export: exportData,
        includeAnswerKey,
      });
    }

    // Generate HTML for printing
    const html = generatePrintableHTML(exportData, includeAnswerKey);

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html",
      },
    });
  } catch (error) {
    console.error("Error exporting test:", error);
    return NextResponse.json(
      { error: "Failed to export test" },
      { status: 500 }
    );
  }
}

interface ExportData {
  test: {
    title: string;
    description: string | null;
    instructions: string | null;
    timeLimitMins: number | null;
    totalMarks: number;
    questionCount: number;
    className: string;
    sectionName: string;
    subjectName: string;
    teacherName: string;
    date: Date;
  };
  questions: Array<{
    number: number;
    type: string;
    questionText: string;
    marks: number;
    options: Array<{
      letter: string;
      text: string;
      isCorrect?: boolean;
    }> | null;
    correctAnswer?: string | null;
    explanation?: string | null;
  }>;
}

function generatePrintableHTML(data: ExportData, includeAnswerKey: boolean): string {
  const { test, questions } = data;

  const questionsHTML = questions
    .map((q) => {
      let optionsHTML = "";
      if (q.type === "MCQ" && q.options) {
        optionsHTML = `
          <div class="options">
            ${q.options
              .map(
                (opt) => `
              <div class="option ${includeAnswerKey && opt.isCorrect ? "correct" : ""}">
                <span class="option-letter">${opt.letter}.</span>
                <span class="option-text">${escapeHtml(opt.text)}</span>
                ${includeAnswerKey && opt.isCorrect ? '<span class="correct-marker">✓</span>' : ""}
              </div>
            `
              )
              .join("")}
          </div>
        `;
      } else if (q.type === "SHORT_ANSWER") {
        optionsHTML = `
          <div class="answer-lines">
            <div class="answer-line"></div>
            <div class="answer-line"></div>
            <div class="answer-line"></div>
          </div>
        `;
      }

      const explanationHTML =
        includeAnswerKey && q.explanation
          ? `<div class="explanation"><strong>Explanation:</strong> ${escapeHtml(q.explanation)}</div>`
          : "";

      return `
        <div class="question">
          <div class="question-header">
            <span class="question-number">Q${q.number}.</span>
            <span class="question-marks">[${q.marks} mark${q.marks !== 1 ? "s" : ""}]</span>
          </div>
          <div class="question-text">${escapeHtml(q.questionText)}</div>
          ${optionsHTML}
          ${explanationHTML}
        </div>
      `;
    })
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(test.title)} - ${includeAnswerKey ? "Answer Key" : "Test"}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 12pt;
      line-height: 1.5;
      padding: 1in;
      max-width: 8.5in;
      margin: 0 auto;
    }

    .header {
      text-align: center;
      margin-bottom: 24pt;
      border-bottom: 2px solid #000;
      padding-bottom: 12pt;
    }

    .school-name {
      font-size: 18pt;
      font-weight: bold;
      margin-bottom: 6pt;
    }

    .test-title {
      font-size: 16pt;
      font-weight: bold;
      margin-bottom: 6pt;
    }

    .test-meta {
      font-size: 11pt;
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 6pt;
    }

    .answer-key-badge {
      background: #000;
      color: #fff;
      padding: 2pt 8pt;
      font-weight: bold;
      margin-bottom: 6pt;
      display: inline-block;
    }

    .student-info {
      border: 1px solid #000;
      padding: 12pt;
      margin-bottom: 18pt;
    }

    .student-info-row {
      display: flex;
      gap: 24pt;
      margin-bottom: 6pt;
    }

    .student-info-field {
      flex: 1;
      border-bottom: 1px solid #000;
    }

    .instructions {
      background: #f5f5f5;
      border: 1px solid #ccc;
      padding: 12pt;
      margin-bottom: 18pt;
    }

    .instructions-title {
      font-weight: bold;
      margin-bottom: 6pt;
    }

    .question {
      margin-bottom: 24pt;
      page-break-inside: avoid;
    }

    .question-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6pt;
    }

    .question-number {
      font-weight: bold;
    }

    .question-marks {
      font-style: italic;
      color: #666;
    }

    .question-text {
      margin-bottom: 12pt;
    }

    .options {
      margin-left: 24pt;
    }

    .option {
      margin-bottom: 6pt;
      display: flex;
      gap: 6pt;
    }

    .option.correct {
      font-weight: bold;
    }

    .option-letter {
      min-width: 18pt;
    }

    .correct-marker {
      color: green;
      margin-left: 6pt;
    }

    .answer-lines {
      margin-left: 24pt;
    }

    .answer-line {
      border-bottom: 1px solid #999;
      height: 24pt;
      margin-bottom: 6pt;
    }

    .explanation {
      margin-top: 12pt;
      padding: 6pt;
      background: #fffbcc;
      border-left: 3px solid #ffcc00;
      font-size: 10pt;
    }

    .footer {
      margin-top: 24pt;
      padding-top: 12pt;
      border-top: 1px solid #ccc;
      text-align: center;
      font-size: 10pt;
      color: #666;
    }

    @media print {
      body {
        padding: 0;
      }

      .question {
        page-break-inside: avoid;
      }

      @page {
        margin: 0.75in;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    ${includeAnswerKey ? '<div class="answer-key-badge">ANSWER KEY</div>' : ""}
    <div class="test-title">${escapeHtml(test.title)}</div>
    <div class="test-meta">
      <span><strong>Class:</strong> ${escapeHtml(test.className)} - ${escapeHtml(test.sectionName)}</span>
      <span><strong>Subject:</strong> ${escapeHtml(test.subjectName)}</span>
      <span><strong>Total Marks:</strong> ${test.totalMarks}</span>
      ${test.timeLimitMins ? `<span><strong>Time:</strong> ${test.timeLimitMins} minutes</span>` : ""}
    </div>
  </div>

  ${
    !includeAnswerKey
      ? `
  <div class="student-info">
    <div class="student-info-row">
      <div class="student-info-field"><strong>Name:</strong> _______________________</div>
      <div class="student-info-field"><strong>Roll No:</strong> _______________________</div>
    </div>
    <div class="student-info-row">
      <div class="student-info-field"><strong>Date:</strong> _______________________</div>
    </div>
  </div>
  `
      : ""
  }

  ${
    test.instructions
      ? `
  <div class="instructions">
    <div class="instructions-title">Instructions:</div>
    <div>${escapeHtml(test.instructions)}</div>
  </div>
  `
      : ""
  }

  <div class="questions">
    ${questionsHTML}
  </div>

  <div class="footer">
    <p>Total Questions: ${test.questionCount} | Total Marks: ${test.totalMarks}</p>
    <p>Teacher: ${escapeHtml(test.teacherName)}</p>
  </div>
</body>
</html>
  `;
}

function escapeHtml(text: string | null): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

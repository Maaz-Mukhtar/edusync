"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Printer, Download, Eye } from "lucide-react";

interface ExportData {
  test: {
    id: string;
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
    dueDate: string | null;
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

export default function ExportPage() {
  const params = useParams();
  const testId = params.testId as string;

  const [loading, setLoading] = useState(true);
  const [exportData, setExportData] = useState<ExportData | null>(null);
  const [includeAnswerKey, setIncludeAnswerKey] = useState(false);

  const fetchExportData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/teacher/online-tests/${testId}/export?answerKey=${includeAnswerKey}`
      );
      if (response.ok) {
        const data = await response.json();
        setExportData(data.export);
      }
    } catch (error) {
      console.error("Failed to fetch export data:", error);
    } finally {
      setLoading(false);
    }
  }, [testId, includeAnswerKey]);

  useEffect(() => {
    fetchExportData();
  }, [fetchExportData]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadHTML = async () => {
    try {
      const response = await fetch(
        `/api/teacher/online-tests/${testId}/export?answerKey=${includeAnswerKey}&format=html`
      );
      if (response.ok) {
        const html = await response.text();
        const blob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${exportData?.test.title || "test"}${includeAnswerKey ? "-answer-key" : ""}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Failed to download:", error);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!exportData) {
    return <div>Failed to load export data</div>;
  }

  const { test, questions } = exportData;

  return (
    <div className="space-y-6">
      {/* Header - Hidden in print */}
      <div className="flex items-center gap-4 print:hidden">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/teacher/online-tests/${testId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Export / Print Test</h1>
          <p className="text-muted-foreground">{test.title}</p>
        </div>
      </div>

      {/* Controls - Hidden in print */}
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>Export Options</CardTitle>
          <CardDescription>Configure how you want to export the test</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Include Answer Key</Label>
              <p className="text-sm text-muted-foreground">
                Show correct answers and explanations
              </p>
            </div>
            <Switch
              checked={includeAnswerKey}
              onCheckedChange={setIncludeAnswerKey}
            />
          </div>

          <div className="flex gap-3">
            <Button onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button variant="outline" onClick={handleDownloadHTML}>
              <Download className="h-4 w-4 mr-2" />
              Download HTML
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card className="print:shadow-none print:border-0">
        <CardContent className="p-8 print:p-0">
          {/* Test Header */}
          <div className="text-center mb-8 pb-4 border-b-2 border-black print:border-b">
            {includeAnswerKey && (
              <div className="inline-block bg-black text-white px-3 py-1 text-sm font-bold mb-3">
                ANSWER KEY
              </div>
            )}
            <h1 className="text-2xl font-bold mb-2">{test.title}</h1>
            <div className="flex justify-center gap-6 text-sm text-muted-foreground print:text-black">
              <span>
                <strong>Class:</strong> {test.className} - {test.sectionName}
              </span>
              <span>
                <strong>Subject:</strong> {test.subjectName}
              </span>
              <span>
                <strong>Total Marks:</strong> {test.totalMarks}
              </span>
              {test.timeLimitMins && (
                <span>
                  <strong>Time:</strong> {test.timeLimitMins} minutes
                </span>
              )}
            </div>
          </div>

          {/* Student Info Section - Only show if not answer key */}
          {!includeAnswerKey && (
            <div className="border p-4 mb-6 print:border-black">
              <div className="grid grid-cols-2 gap-4">
                <div className="border-b pb-2 print:border-black">
                  <strong>Name:</strong> _______________________
                </div>
                <div className="border-b pb-2 print:border-black">
                  <strong>Roll No:</strong> _______________________
                </div>
              </div>
              <div className="mt-4 border-b pb-2 print:border-black">
                <strong>Date:</strong> _______________________
              </div>
            </div>
          )}

          {/* Instructions */}
          {test.instructions && (
            <div className="bg-gray-50 p-4 mb-6 rounded-lg print:bg-gray-100 print:rounded-none">
              <h3 className="font-bold mb-2">Instructions:</h3>
              <p className="text-sm whitespace-pre-wrap">{test.instructions}</p>
            </div>
          )}

          <Separator className="my-6 print:hidden" />

          {/* Questions */}
          <div className="space-y-8">
            {questions.map((question) => (
              <div key={question.number} className="break-inside-avoid">
                <div className="flex justify-between items-start mb-3">
                  <span className="font-bold">Q{question.number}.</span>
                  <span className="text-sm text-muted-foreground print:text-black">
                    [{question.marks} mark{question.marks !== 1 ? "s" : ""}]
                  </span>
                </div>

                <p className="mb-4 pl-6">{question.questionText}</p>

                {/* MCQ Options */}
                {question.type === "MCQ" && question.options && (
                  <div className="space-y-2 pl-6">
                    {question.options.map((option) => (
                      <div
                        key={option.letter}
                        className={`flex items-center gap-3 p-2 rounded ${
                          includeAnswerKey && option.isCorrect
                            ? "bg-green-100 font-bold print:bg-gray-200"
                            : ""
                        }`}
                      >
                        <span className="font-medium">{option.letter}.</span>
                        <span>{option.text}</span>
                        {includeAnswerKey && option.isCorrect && (
                          <span className="ml-auto text-green-700 print:text-black">
                            &#10003;
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Short Answer Lines */}
                {question.type === "SHORT_ANSWER" && (
                  <div className="pl-6 space-y-3">
                    <div className="border-b border-gray-400 h-6"></div>
                    <div className="border-b border-gray-400 h-6"></div>
                    <div className="border-b border-gray-400 h-6"></div>
                  </div>
                )}

                {/* Explanation - Only in answer key */}
                {includeAnswerKey && question.explanation && (
                  <div className="mt-4 pl-6 p-3 bg-yellow-50 border-l-4 border-yellow-400 print:bg-gray-100 print:border-gray-400">
                    <strong className="text-sm">Explanation:</strong>
                    <p className="text-sm mt-1">{question.explanation}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t text-center text-sm text-muted-foreground print:text-black print:border-black">
            <p>
              Total Questions: {test.questionCount} | Total Marks: {test.totalMarks}
            </p>
            <p>Teacher: {test.teacherName}</p>
          </div>
        </CardContent>
      </Card>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            font-family: "Times New Roman", Times, serif;
            font-size: 12pt;
            line-height: 1.5;
          }

          .print\\:hidden {
            display: none !important;
          }

          @page {
            margin: 0.75in;
          }
        }
      `}</style>
    </div>
  );
}

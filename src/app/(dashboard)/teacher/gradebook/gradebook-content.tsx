"use client";

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  GradebookData,
  GradebookSection,
  GradebookSubject,
  GradebookAssessment,
  StudentGrade,
  GradebookStats,
} from "@/lib/data/teacher";

interface GradebookContentProps {
  initialData: GradebookData;
}

interface GradebookViewData {
  section: { id: string; name: string };
  assessments: GradebookAssessment[];
  gradebook: StudentGrade[];
  stats: GradebookStats;
}

export default function GradebookContent({ initialData }: GradebookContentProps) {
  const [sections] = useState<GradebookSection[]>(initialData.sections);
  const [subjects] = useState<GradebookSubject[]>(initialData.subjects);
  const [gradebookData, setGradebookData] = useState<GradebookViewData | null>(
    initialData.initialGradebook
  );
  const [selectedSectionId, setSelectedSectionId] = useState<string>(
    initialData.initialSectionId || ""
  );
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("all");
  const [loadingGradebook, setLoadingGradebook] = useState(false);

  // Fetch gradebook data when section or subject changes
  const fetchGradebook = useCallback(async () => {
    if (!selectedSectionId) return;

    // Skip if it's the initial data with no subject filter
    if (
      selectedSectionId === initialData.initialSectionId &&
      selectedSubjectId === "all" &&
      gradebookData === initialData.initialGradebook
    ) {
      return;
    }

    setLoadingGradebook(true);

    try {
      let url = `/api/teacher/gradebook?sectionId=${selectedSectionId}`;
      if (selectedSubjectId !== "all") {
        url += `&subjectId=${selectedSubjectId}`;
      }

      const response = await fetch(url);
      if (response.ok) {
        const result = await response.json();
        setGradebookData(result);
      }
    } catch (error) {
      console.error("Failed to fetch gradebook:", error);
    } finally {
      setLoadingGradebook(false);
    }
  }, [selectedSectionId, selectedSubjectId, initialData, gradebookData]);

  // Fetch when section or subject changes
  useEffect(() => {
    if (
      selectedSectionId !== initialData.initialSectionId ||
      selectedSubjectId !== "all"
    ) {
      fetchGradebook();
    }
  }, [selectedSectionId, selectedSubjectId, initialData.initialSectionId, fetchGradebook]);

  const getPercentageColor = (percentage: number) => {
    if (percentage >= 80) return "text-green-600 bg-green-50";
    if (percentage >= 60) return "text-blue-600 bg-blue-50";
    if (percentage >= 40) return "text-yellow-600 bg-yellow-50";
    return "text-red-600 bg-red-50";
  };

  const getTrendIcon = (average: string | null, classAverage: number) => {
    if (!average) return null;
    const studentAvg = parseFloat(average);
    if (studentAvg > classAverage + 5) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (studentAvg < classAverage - 5) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-gray-400" />;
  };

  if (sections.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gradebook</h1>
          <p className="text-muted-foreground">View and manage student grades</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No Classes Assigned</h3>
            <p className="text-sm text-muted-foreground">
              You need to be assigned to classes to view the gradebook.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gradebook</h1>
        <p className="text-muted-foreground">
          View and manage student grades across assessments
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Section</Label>
              <Select value={selectedSectionId} onValueChange={setSelectedSectionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select section" />
                </SelectTrigger>
                <SelectContent>
                  {sections.map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.className} - {section.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Subject</Label>
              <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="All subjects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {subjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: subject.color || "#888" }}
                        />
                        {subject.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      {gradebookData && gradebookData.stats.totalAssessments > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Class Average
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{gradebookData.stats.averageScore}%</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Highest Average
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {gradebookData.stats.highestAverage.toFixed(1)}%
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Lowest Average
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {gradebookData.stats.lowestAverage.toFixed(1)}%
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Assessments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{gradebookData.stats.totalAssessments}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Gradebook Table */}
      {loadingGradebook ? (
        <Skeleton className="h-96" />
      ) : gradebookData ? (
        <Card>
          <CardHeader>
            <CardTitle>{gradebookData.section.name}</CardTitle>
            <CardDescription>
              {gradebookData.gradebook.length} students • {gradebookData.assessments.length} assessments
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {gradebookData.assessments.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No assessments found for this section
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20 sticky left-0 bg-background">Roll</TableHead>
                    <TableHead className="min-w-[150px] sticky left-20 bg-background">Student</TableHead>
                    {gradebookData.assessments.map((assessment) => (
                      <TableHead key={assessment.id} className="text-center min-w-[100px]">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs font-normal text-muted-foreground">
                            {assessment.subject.name}
                          </span>
                          <span>{assessment.title}</span>
                          <Badge variant="outline" className="text-xs">
                            {assessment.totalMarks}
                          </Badge>
                        </div>
                      </TableHead>
                    ))}
                    <TableHead className="text-center min-w-[100px]">Average</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gradebookData.gradebook.map((student) => (
                    <TableRow key={student.studentId}>
                      <TableCell className="font-medium sticky left-0 bg-background">
                        {student.rollNumber || "-"}
                      </TableCell>
                      <TableCell className="sticky left-20 bg-background">
                        <div className="flex items-center gap-2">
                          {student.studentName}
                          {getTrendIcon(student.average, gradebookData.stats.averageScore)}
                        </div>
                      </TableCell>
                      {gradebookData.assessments.map((assessment) => {
                        const result = student.results[assessment.id];
                        return (
                          <TableCell key={assessment.id} className="text-center">
                            {result ? (
                              <div
                                className={cn(
                                  "inline-flex flex-col items-center px-2 py-1 rounded",
                                  getPercentageColor(result.percentage)
                                )}
                              >
                                <span className="font-medium">{result.marksObtained}</span>
                                <span className="text-xs">{result.percentage.toFixed(0)}%</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center">
                        {student.average ? (
                          <div
                            className={cn(
                              "inline-flex items-center px-3 py-1 rounded font-medium",
                              getPercentageColor(parseFloat(student.average))
                            )}
                          >
                            {student.average}%
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

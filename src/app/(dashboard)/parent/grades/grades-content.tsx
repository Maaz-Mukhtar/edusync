"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { GraduationCap, TrendingUp, Award, BookOpen, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import ChildSwitcher from "@/components/parent/child-switcher";
import type { ChildGradesData, ChildInfo } from "@/lib/data/parent";

interface GradesContentProps {
  data: ChildGradesData;
  childList: ChildInfo[];
  selectedChildId: string;
}

export default function GradesContent({
  data,
  childList,
  selectedChildId,
}: GradesContentProps) {
  const [filterSubject, setFilterSubject] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  const { child, results, subjectWiseStats, overallStats } = data;

  // Filter results
  const filteredResults = results.filter((r) => {
    if (filterSubject !== "all" && r.subject.id !== filterSubject) return false;
    if (filterType !== "all" && r.type !== filterType) return false;
    return true;
  });

  // Get unique subjects and types for filters
  const subjects = Array.from(
    new Map(results.map((r) => [r.subject.id, r.subject])).values()
  );
  const types = Array.from(new Set(results.map((r) => r.type)));

  const getPercentageColor = (percentage: number) => {
    if (percentage >= 80) return "text-green-600 bg-green-50";
    if (percentage >= 60) return "text-blue-600 bg-blue-50";
    if (percentage >= 40) return "text-yellow-600 bg-yellow-50";
    return "text-red-600 bg-red-50";
  };

  const getPercentageTextColor = (percentage: number) => {
    if (percentage >= 80) return "text-green-600";
    if (percentage >= 60) return "text-blue-600";
    if (percentage >= 40) return "text-yellow-600";
    return "text-red-600";
  };

  const formatType = (type: string) => {
    return type.charAt(0) + type.slice(1).toLowerCase();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Grades & Results</h1>
          <p className="text-muted-foreground">
            {child.name} - {child.className} {child.sectionName}
          </p>
        </div>
        <ChildSwitcher
          childList={childList}
          selectedChildId={selectedChildId}
          basePath="/parent/grades"
        />
      </div>

      {/* Overall Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <BarChart3 className="h-4 w-4" />
              Overall Average
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", getPercentageTextColor(overallStats.averagePercentage))}>
              {overallStats.averagePercentage}%
            </div>
            <p className="text-xs text-muted-foreground">
              across {overallStats.totalAssessments} assessments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Award className="h-4 w-4 text-green-600" />
              Highest Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {overallStats.highestPercentage}%
            </div>
            <p className="text-xs text-muted-foreground">best performance</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              Lowest Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {overallStats.lowestPercentage}%
            </div>
            <p className="text-xs text-muted-foreground">needs improvement</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <GraduationCap className="h-4 w-4" />
              Total Assessments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats.totalAssessments}</div>
            <p className="text-xs text-muted-foreground">completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Subject-wise Performance */}
      {subjectWiseStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Subject-wise Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {subjectWiseStats.map((subject) => (
                <div
                  key={subject.subjectId}
                  className="p-4 rounded-lg border"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: subject.subjectColor || "#888" }}
                    />
                    <h4 className="font-medium">{subject.subjectName}</h4>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Average</span>
                      <span className={cn("font-medium", getPercentageTextColor(subject.averagePercentage))}>
                        {subject.averagePercentage}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Highest</span>
                      <span className="font-medium text-green-600">{subject.highestScore}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Lowest</span>
                      <span className="font-medium">{subject.lowestScore}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Assessments</span>
                      <span className="font-medium">{subject.totalAssessments}</span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        subject.averagePercentage >= 80
                          ? "bg-green-500"
                          : subject.averagePercentage >= 60
                          ? "bg-blue-500"
                          : subject.averagePercentage >= 40
                          ? "bg-yellow-500"
                          : "bg-red-500"
                      )}
                      style={{ width: `${subject.averagePercentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Results */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              All Results
            </CardTitle>
            <div className="flex gap-2">
              <Select value={filterSubject} onValueChange={setFilterSubject}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Subject" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {subjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: subject.color || "#888" }}
                        />
                        {subject.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {types.map((type) => (
                    <SelectItem key={type} value={type}>
                      {formatType(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredResults.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assessment</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-center">Marks</TableHead>
                  <TableHead className="text-center">Percentage</TableHead>
                  <TableHead className="text-center">Grade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResults.map((result) => (
                  <TableRow key={result.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{result.title}</p>
                        {result.remarks && (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {result.remarks}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: result.subject.color || "#888" }}
                        />
                        {result.subject.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{formatType(result.type)}</Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(result.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {result.marksObtained}/{result.totalMarks}
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={cn(
                          "inline-block px-2 py-1 rounded font-medium",
                          getPercentageColor(result.percentage)
                        )}
                      >
                        {result.percentage}%
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {result.grade ? (
                        <Badge variant="secondary">{result.grade}</Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <GraduationCap className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No results found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

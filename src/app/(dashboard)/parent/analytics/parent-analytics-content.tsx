"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExternalLink, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import type { ChildInfo } from "@/lib/data/parent";

type AnalyticsResponse = {
  filters: { academicYearId: string | null; termId: string | null; from: string; to: string };
  student: {
    userId: string;
    firstName: string;
    lastName: string;
    section: { id: string; name: string; class: { id: string; name: string } };
  };
  overall: { assessmentCount: number; resultCount: number; avgPercent: number | null; medianPercent: number | null };
  subjectStats: Array<{
    subjectId: string;
    subjectName: string;
    assessmentCount: number;
    resultCount: number;
    avgPercent: number | null;
  }>;
  typeStats: Array<{
    type: string;
    assessmentCount: number;
    resultCount: number;
    avgPercent: number | null;
  }>;
  subjectTrends: Array<{
    subjectId: string;
    subjectName: string;
    bucket: string;
    resultCount: number;
    avgPercent: number | null;
  }>;
  evidence: Array<{
    assessmentId: string;
    title: string;
    type: string;
    date: string;
    subjectId: string;
    subjectName: string;
    totalMarks: number;
    marksObtained: number;
    percent: number | null;
  }>;
};

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-";
  return `${value.toFixed(1)}%`;
}

function formatMonthLabel(isoDate: string) {
  const date = new Date(isoDate);
  if (!Number.isFinite(date.getTime())) return isoDate;
  return date.toLocaleString(undefined, { month: "short", year: "numeric" });
}

function formatShortDate(isoDate: string) {
  const date = new Date(isoDate);
  if (!Number.isFinite(date.getTime())) return isoDate;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function ParentAnalyticsContent({
  childList,
  selectedChildId,
}: {
  childList: ChildInfo[];
  selectedChildId: string;
}) {
  const router = useRouter();

  const [selectedStudentId, setSelectedStudentId] = useState(selectedChildId);
  const selectedChild = useMemo(
    () => childList.find((c) => c.studentId === selectedStudentId) ?? childList[0],
    [childList, selectedStudentId]
  );

  const [academicYears, setAcademicYears] = useState<Array<{ id: string; name: string; isCurrent: boolean }>>([]);
  const [terms, setTerms] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>("");
  const [selectedTermId, setSelectedTermId] = useState<string>("all");

  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loadingPeriods, setLoadingPeriods] = useState(true);
  const [loadingData, setLoadingData] = useState(false);

  const fetchAcademicYears = useCallback(async () => {
    setLoadingPeriods(true);
    try {
      const response = await fetch("/api/academic-years");
      const json = await response.json();
      if (!response.ok) {
        toast.error(json.error || "Failed to load academic years");
        setAcademicYears([]);
        return;
      }
      const years = (Array.isArray(json) ? json : []).map((y) => ({
        id: y.id as string,
        name: y.name as string,
        isCurrent: Boolean(y.isCurrent),
      }));
      setAcademicYears(years);
      const current = years.find((y) => y.isCurrent) ?? years[0];
      if (current && !selectedAcademicYearId) setSelectedAcademicYearId(current.id);
    } catch {
      toast.error("Failed to load academic years");
      setAcademicYears([]);
    } finally {
      setLoadingPeriods(false);
    }
  }, [selectedAcademicYearId]);

  const fetchTerms = useCallback(async (academicYearId: string) => {
    if (!academicYearId) {
      setTerms([]);
      return;
    }
    try {
      const response = await fetch(`/api/academic-years/${academicYearId}`);
      const json = await response.json();
      if (!response.ok) {
        setTerms([]);
        return;
      }
      setTerms((json.terms || []).map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })));
    } catch {
      setTerms([]);
    }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    if (!selectedAcademicYearId) return;
    if (!selectedChild?.studentUserId) return;
    setLoadingData(true);
    try {
      const params = new URLSearchParams();
      params.set("academicYearId", selectedAcademicYearId);
      if (selectedTermId && selectedTermId !== "all") params.set("termId", selectedTermId);
      const response = await fetch(
        `/api/analytics/performance/students/${selectedChild.studentUserId}?${params.toString()}`
      );
      const json = await response.json();
      if (!response.ok) {
        toast.error(json.error || "Failed to load analytics");
        setData(null);
        return;
      }
      setData(json);
    } catch {
      toast.error("Failed to load analytics");
      setData(null);
    } finally {
      setLoadingData(false);
    }
  }, [selectedAcademicYearId, selectedTermId, selectedChild?.studentUserId]);

  useEffect(() => {
    fetchAcademicYears();
  }, [fetchAcademicYears]);

  useEffect(() => {
    if (!selectedAcademicYearId) return;
    fetchTerms(selectedAcademicYearId);
    setSelectedTermId("all");
  }, [selectedAcademicYearId, fetchTerms]);

  useEffect(() => {
    if (!selectedAcademicYearId) return;
    fetchAnalytics();
  }, [selectedAcademicYearId, selectedTermId, selectedChild?.studentUserId, fetchAnalytics]);

  const trendsBySubject = useMemo(() => {
    const map = new Map<string, AnalyticsResponse["subjectTrends"]>();
    for (const row of data?.subjectTrends ?? []) {
      const list = map.get(row.subjectId) ?? [];
      list.push(row);
      map.set(row.subjectId, list);
    }
    return map;
  }, [data?.subjectTrends]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <TrendingUp className="h-7 w-7" />
            Analytics
          </h1>
          <p className="text-muted-foreground">Performance trends for your child.</p>
          {data ? (
            <div className="mt-1 text-xs text-muted-foreground">
              {data.student.firstName} {data.student.lastName} • {data.student.section.class.name} -{" "}
              {data.student.section.name} • Range {formatShortDate(data.filters.from)} →{" "}
              {formatShortDate(data.filters.to)}
            </div>
          ) : null}
        </div>

        <div className="w-[260px]">
          <Select
            value={selectedStudentId}
            onValueChange={(value) => {
              setSelectedStudentId(value);
              router.push(`/parent/analytics?child=${value}`);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select child" />
            </SelectTrigger>
            <SelectContent>
              {childList.map((c) => (
                <SelectItem key={c.studentId} value={c.studentId}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Choose academic year and term.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">Academic Year</div>
            <Select
              value={selectedAcademicYearId}
              onValueChange={setSelectedAcademicYearId}
              disabled={loadingPeriods || academicYears.length === 0}
            >
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder={loadingPeriods ? "Loading…" : "Select year"} />
              </SelectTrigger>
              <SelectContent>
                {academicYears.map((y) => (
                  <SelectItem key={y.id} value={y.id}>
                    {y.name}
                    {y.isCurrent ? " (Current)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Term</div>
            <Select value={selectedTermId} onValueChange={setSelectedTermId} disabled={!selectedAcademicYearId}>
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder="All terms" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Terms</SelectItem>
                {terms.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loadingData ? (
        <div className="text-sm text-muted-foreground">Loading analytics…</div>
      ) : !data ? (
        <div className="text-sm text-muted-foreground">No analytics available.</div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Average</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatPercent(data.overall.avgPercent)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Median</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatPercent(data.overall.medianPercent)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Assessments</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.overall.assessmentCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.overall.resultCount}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Subjects</CardTitle>
              <CardDescription>Average scores by subject.</CardDescription>
            </CardHeader>
            <CardContent>
              {data.subjectStats.length === 0 ? (
                <div className="text-sm text-muted-foreground">No results for this range.</div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Subject</TableHead>
                        <TableHead className="text-right">Avg</TableHead>
                        <TableHead className="text-right">Results</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.subjectStats.map((s) => (
                        <TableRow key={s.subjectId}>
                          <TableCell className="font-medium">{s.subjectName}</TableCell>
                          <TableCell className="text-right">{formatPercent(s.avgPercent)}</TableCell>
                          <TableCell className="text-right">{s.resultCount}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Assessment Types</CardTitle>
              <CardDescription>Average scores by assessment type.</CardDescription>
            </CardHeader>
            <CardContent>
              {data.typeStats.length === 0 ? (
                <div className="text-sm text-muted-foreground">No results for this range.</div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Avg</TableHead>
                        <TableHead className="text-right">Results</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.typeStats.map((t) => (
                        <TableRow key={t.type}>
                          <TableCell className="font-medium">{t.type}</TableCell>
                          <TableCell className="text-right">{formatPercent(t.avgPercent)}</TableCell>
                          <TableCell className="text-right">{t.resultCount}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Trends (monthly)</CardTitle>
              <CardDescription>Per-subject monthly averages.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.subjectStats.length === 0 ? (
                <div className="text-sm text-muted-foreground">No results for this range.</div>
              ) : (
                data.subjectStats.map((sub) => {
                  const points = trendsBySubject.get(sub.subjectId) ?? [];
                  return (
                    <div key={sub.subjectId} className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium">{sub.subjectName}</div>
                        <Badge variant="outline">Avg {formatPercent(sub.avgPercent)}</Badge>
                      </div>
                      {points.length === 0 ? (
                        <div className="text-sm text-muted-foreground">No data points.</div>
                      ) : (
                        <div className="rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Month</TableHead>
                                <TableHead className="text-right">Avg</TableHead>
                                <TableHead className="text-right">Results</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {points.map((p) => (
                                <TableRow key={`${sub.subjectId}:${p.bucket}`}>
                                  <TableCell>{formatMonthLabel(p.bucket)}</TableCell>
                                  <TableCell className="text-right">{formatPercent(p.avgPercent)}</TableCell>
                                  <TableCell className="text-right">{p.resultCount}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Evidence</CardTitle>
              <CardDescription>Assessments included in these calculations.</CardDescription>
            </CardHeader>
            <CardContent>
              {data.evidence.length === 0 ? (
                <div className="text-sm text-muted-foreground">No graded assessments in this range.</div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Assessment</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead className="text-right">Score</TableHead>
                        <TableHead className="w-[120px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.evidence.map((e) => (
                        <TableRow key={e.assessmentId}>
                          <TableCell>{new Date(e.date).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <div className="font-medium">{e.title}</div>
                            <div className="text-xs text-muted-foreground">{e.type}</div>
                          </TableCell>
                          <TableCell>{e.subjectName}</TableCell>
                          <TableCell className="text-right">
                            <div className="font-medium">
                              {e.marksObtained}/{e.totalMarks}
                            </div>
                            <div className="text-xs text-muted-foreground">{formatPercent(e.percent)}</div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button asChild size="sm" variant="outline">
                              <Link
                                href={`/parent/grades?child=${encodeURIComponent(selectedStudentId)}&assessmentId=${encodeURIComponent(e.assessmentId)}`}
                              >
                                Grades <ExternalLink className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

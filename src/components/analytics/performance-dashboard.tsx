"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { TrendingUp, Users, BookOpen, ListChecks, ExternalLink } from "lucide-react";

type SectionRow = {
  sectionId: string;
  sectionName: string;
  classId: string;
  className: string;
  studentCount: number;
  assessmentCount: number;
  resultCount: number;
  avgPercent: number | null;
};

type SectionDetailResponse = {
  filters: { from: string; to: string };
  section: {
    id: string;
    name: string;
    class: { id: string; name: string };
    studentCount: number;
  };
  overall: { assessmentCount: number; resultCount: number; avgPercent: number | null };
  subjectStats: Array<{
    subjectId: string;
    subjectName: string;
    assessmentCount: number;
    resultCount: number;
    avgPercent: number | null;
  }>;
  studentStats: Array<{
    studentProfileId: string;
    studentUserId: string;
    firstName: string;
    lastName: string;
    rollNumber: string | null;
    resultCount: number;
    avgPercent: number | null;
  }>;
};

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-";
  return `${value.toFixed(1)}%`;
}

export function PerformanceDashboard({
  role,
}: {
  role: "admin" | "teacher";
}) {
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [academicYears, setAcademicYears] = useState<
    Array<{ id: string; name: string; isCurrent: boolean }>
  >([]);
  const [terms, setTerms] = useState<Array<{ id: string; name: string }>>([]);

  const [sections, setSections] = useState<SectionRow[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("all");
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");
  const [sectionDetail, setSectionDetail] = useState<SectionDetailResponse | null>(null);

  const [isLoadingSections, setIsLoadingSections] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isLoadingPeriods, setIsLoadingPeriods] = useState(true);

  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>("");
  const [selectedTermId, setSelectedTermId] = useState<string>("all");

  const fetchSections = useCallback(async () => {
    setIsLoadingSections(true);
    try {
      const params = new URLSearchParams();
      if (selectedAcademicYearId) params.set("academicYearId", selectedAcademicYearId);
      if (selectedTermId) params.set("termId", selectedTermId);
      if (selectedClassId !== "all") params.set("classId", selectedClassId);
      const response = await fetch(`/api/analytics/performance/sections?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || "Failed to load analytics");
        setClasses([]);
        setSections([]);
        return;
      }
      setClasses(data.classes || []);
      setSections(data.sections || []);
    } catch {
      toast.error("Failed to load analytics");
      setClasses([]);
      setSections([]);
    } finally {
      setIsLoadingSections(false);
    }
  }, [selectedAcademicYearId, selectedTermId, selectedClassId]);

  const fetchAcademicYears = useCallback(async () => {
    setIsLoadingPeriods(true);
    try {
      const response = await fetch("/api/academic-years");
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || "Failed to load academic years");
        setAcademicYears([]);
        return;
      }
      const years = (Array.isArray(data) ? data : []).map((y) => ({
        id: y.id as string,
        name: y.name as string,
        isCurrent: Boolean(y.isCurrent),
      }));
      setAcademicYears(years);

      const current = years.find((y) => y.isCurrent) ?? years[0];
      if (current && !selectedAcademicYearId) {
        setSelectedAcademicYearId(current.id);
      }
    } catch {
      toast.error("Failed to load academic years");
      setAcademicYears([]);
    } finally {
      setIsLoadingPeriods(false);
    }
  }, [selectedAcademicYearId]);

  const fetchTerms = useCallback(async (academicYearId: string) => {
    if (!academicYearId) {
      setTerms([]);
      return;
    }
    try {
      const response = await fetch(`/api/academic-years/${academicYearId}`);
      const data = await response.json();
      if (!response.ok) {
        setTerms([]);
        return;
      }
      const nextTerms = (data.terms || []).map((t: { id: string; name: string }) => ({
        id: t.id,
        name: t.name,
      }));
      setTerms(nextTerms);
    } catch {
      setTerms([]);
    }
  }, []);

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
    fetchSections();
  }, [selectedAcademicYearId, selectedClassId, selectedTermId, fetchSections]);

  useEffect(() => {
    if (!selectedSectionId) {
      setSectionDetail(null);
      return;
    }

    const exists = sections.some((s) => s.sectionId === selectedSectionId);
    if (!exists) {
      setSelectedSectionId("");
      setSectionDetail(null);
    }
  }, [sections, selectedSectionId]);

  const fetchSectionDetail = useCallback(async (sectionId: string) => {
    setIsLoadingDetail(true);
    try {
      const params = new URLSearchParams();
      if (selectedAcademicYearId) params.set("academicYearId", selectedAcademicYearId);
      if (selectedTermId) params.set("termId", selectedTermId);
      const response = await fetch(
        `/api/analytics/performance/sections/${sectionId}?${params.toString()}`
      );
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || "Failed to load section analytics");
        setSectionDetail(null);
        return;
      }
      setSectionDetail(data);
    } catch {
      toast.error("Failed to load section analytics");
      setSectionDetail(null);
    } finally {
      setIsLoadingDetail(false);
    }
  }, [selectedAcademicYearId, selectedTermId]);

  useEffect(() => {
    if (!selectedSectionId) return;
    fetchSectionDetail(selectedSectionId);
  }, [selectedSectionId, selectedAcademicYearId, selectedTermId, fetchSectionDetail]);

  const headerTitle = role === "admin" ? "Analytics" : "My Analytics";
  const headerDescription =
    role === "admin"
      ? "Performance analytics across classes, sections, and students."
      : "Performance analytics for your classes, sections, and students.";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <TrendingUp className="h-7 w-7" />
            {headerTitle}
          </h1>
          <p className="text-muted-foreground">{headerDescription}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Choose academic year, term, and class.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">Academic Year</div>
            <Select
              value={selectedAcademicYearId}
              onValueChange={(value) => setSelectedAcademicYearId(value)}
              disabled={isLoadingPeriods || academicYears.length === 0}
            >
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder={isLoadingPeriods ? "Loading…" : "Select year"} />
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
            <Select
              value={selectedTermId}
              onValueChange={(value) => setSelectedTermId(value)}
              disabled={!selectedAcademicYearId}
            >
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

          <div className="space-y-2">
            <div className="text-sm font-medium">Class</div>
            <Select value={selectedClassId} onValueChange={setSelectedClassId}>
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder="All classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" onClick={fetchSections} disabled={isLoadingSections}>
            Refresh
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Sections
            </CardTitle>
            <CardDescription>Average scores by section (percent).</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingSections ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : sections.length === 0 ? (
              <div className="text-sm text-muted-foreground">No sections found for this filter.</div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Section</TableHead>
                      <TableHead className="text-right">Avg</TableHead>
                      <TableHead className="text-right">Results</TableHead>
                      <TableHead className="w-[110px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sections.map((s) => {
                      const isSelected = selectedSectionId === s.sectionId;
                      return (
                        <TableRow key={s.sectionId} data-state={isSelected ? "selected" : undefined}>
                          <TableCell>
                            <div className="font-medium">{s.className} - {s.sectionName}</div>
                            <div className="text-xs text-muted-foreground">
                              {s.studentCount} students • {s.assessmentCount} assessments
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant={s.avgPercent === null ? "secondary" : "default"}>
                              {formatPercent(s.avgPercent)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{s.resultCount}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant={isSelected ? "default" : "outline"}
                              size="sm"
                              onClick={() => setSelectedSectionId(s.sectionId)}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Section Detail
            </CardTitle>
            <CardDescription>
              Subject breakdown and student averages for the selected section.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!selectedSectionId ? (
              <div className="text-sm text-muted-foreground">
                Select a section to view detailed analytics.
              </div>
            ) : isLoadingDetail ? (
              <div className="text-sm text-muted-foreground">Loading section analytics…</div>
            ) : !sectionDetail ? (
              <div className="text-sm text-muted-foreground">No details available.</div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">
                      {sectionDetail.section.class.name} - {sectionDetail.section.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {sectionDetail.section.studentCount} students • {sectionDetail.overall.assessmentCount} assessments • {sectionDetail.overall.resultCount} results
                    </div>
                  </div>
                  <Badge variant={sectionDetail.overall.avgPercent === null ? "secondary" : "default"}>
                    Overall {formatPercent(sectionDetail.overall.avgPercent)}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    Subjects
                  </div>
                  {sectionDetail.subjectStats.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No subject results for this range.</div>
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
                          {sectionDetail.subjectStats.map((sub) => (
                            <TableRow key={sub.subjectId}>
                              <TableCell>
                                <div className="font-medium">{sub.subjectName}</div>
                                <div className="text-xs text-muted-foreground">{sub.assessmentCount} assessments</div>
                              </TableCell>
                              <TableCell className="text-right">{formatPercent(sub.avgPercent)}</TableCell>
                              <TableCell className="text-right">{sub.resultCount}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium flex items-center gap-2">
                    <ListChecks className="h-4 w-4" />
                    Students
                  </div>
                  {sectionDetail.studentStats.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No students found.</div>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Student</TableHead>
                            <TableHead className="text-right">Avg</TableHead>
                            <TableHead className="text-right">Results</TableHead>
                            <TableHead className="w-[110px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sectionDetail.studentStats.map((st) => (
                            <TableRow key={st.studentProfileId}>
                              <TableCell>
                                <div className="font-medium">
                                  {st.rollNumber ? `${st.rollNumber} • ` : ""}
                                  {st.firstName} {st.lastName}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">{formatPercent(st.avgPercent)}</TableCell>
                              <TableCell className="text-right">{st.resultCount}</TableCell>
                              <TableCell className="text-right">
                                {role === "admin" ? (
                                  <Button asChild size="sm" variant="outline">
                                    <Link href={`/admin/students/${st.studentUserId}`}>
                                      Open <ExternalLink className="h-3.5 w-3.5" />
                                    </Link>
                                  </Button>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

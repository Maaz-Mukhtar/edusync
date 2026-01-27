"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Save, Upload, Copy, Settings2 } from "lucide-react";
import type { AdminTimetableBootstrapData } from "@/lib/data/admin-timetable";

type DayInfo = { dayOfWeek: number; label: string };
type ScheduleSlot = {
  id: string;
  dayOfWeek: number;
  order: number;
  type: "PERIOD" | "BREAK";
  label: string | null;
  startTime: string;
  endTime: string;
};

type TimetableDetails = {
  class: { id: string; name: string };
  term: { id: string; name: string; startDate: string; endDate: string };
  sections: { id: string; name: string }[];
  subjects: { id: string; name: string; code: string | null; color: string | null }[];
  schedule: { id: string; name: string; startTime: string | null; slots: ScheduleSlot[] } | null;
  draft: { id: string; updatedAt: string; slots: Array<{ id: string; sectionId: string; subjectId: string; dayOfWeek: number; startTime: string; endTime: string; bellScheduleSlotId: string; room: string | null; }> } | null;
  published: { id: string; publishedAt: string | null } | null;
  assignmentMap: Record<string, Record<string, { teacherId: string; teacherName: string }>>;
  days: DayInfo[];
};

type ScheduleForm = {
  name: string;
  startTime: string;
  periodCount: number;
  periodMinutes: number;
  breakAfterPeriod: number;
  breakMinutes: number;
};

type GridEntry = { subjectId: string | null; room: string };

type DraftSlots = NonNullable<TimetableDetails["draft"]>["slots"];

function termOptionsForYear(data: AdminTimetableBootstrapData, academicYearId: string | null) {
  const year = data.academicYears.find((y) => y.id === academicYearId);
  return year?.terms ?? [];
}

async function readApiJson(res: Response): Promise<{ json: unknown; text: string }> {
  const text = await res.text();
  if (!text) return { json: null, text: "" };
  try {
    return { json: JSON.parse(text), text };
  } catch {
    return { json: null, text };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export default function AdminTimetableContent({ data }: { data: AdminTimetableBootstrapData }) {
  const [academicYearId, setAcademicYearId] = useState<string | null>(data.defaultAcademicYearId);
  const [termId, setTermId] = useState<string | null>(data.defaultTermId);
  const [classId, setClassId] = useState<string | null>(data.classes[0]?.id ?? null);

  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState<TimetableDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [scheduleForm, setScheduleForm] = useState<ScheduleForm>(() => ({
    name: "Junior 45m (4 periods + break)",
    startTime: "09:00",
    periodCount: 4,
    periodMinutes: 45,
    breakAfterPeriod: 2,
    breakMinutes: 45,
  }));

  const [grid, setGrid] = useState<Record<string, GridEntry>>({});
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);

  const termOptions = useMemo(() => termOptionsForYear(data, academicYearId), [data, academicYearId]);

  useEffect(() => {
    if (!termId && termOptions.length > 0) setTermId(termOptions[0].id);
  }, [termId, termOptions]);

  const selectedTerm = useMemo(() => termOptions.find((t) => t.id === termId) ?? null, [termOptions, termId]);

  const load = async () => {
    if (!classId || !termId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/timetable?classId=${classId}&termId=${termId}`);
      const { json } = await readApiJson(res);
      if (!json) throw new Error(`Failed to load timetable (HTTP ${res.status})`);
      if (!res.ok) {
        const obj = isRecord(json) ? json : {};
        const details = typeof obj.details === "string" && obj.details ? `: ${obj.details}` : "";
        const code = typeof obj.code === "string" && obj.code ? ` (${obj.code})` : "";
        const message =
          typeof obj.error === "string" ? obj.error : `Failed to load timetable (HTTP ${res.status})`;
        throw new Error(message + code + details);
      }
      const payload = json as TimetableDetails;
      setDetails(payload);

      if (!payload.schedule) {
        setGrid({});
        const clsName = data.classes.find((c) => c.id === classId)?.name ?? "Class";
        const termName = selectedTerm?.name ?? "Term";
        setScheduleForm((prev) => ({
          ...prev,
          name: `${clsName} - ${termName} (09:00 start)`,
        }));
        return;
      }

      // Precompute bellSlotId -> periodNumber per day (PERIOD only)
      const scheduleSlots: ScheduleSlot[] = payload.schedule.slots;
      const perDayPeriodSlots: Record<number, ScheduleSlot[]> = {};
      for (const day of payload.days as DayInfo[]) perDayPeriodSlots[day.dayOfWeek] = [];
      for (const slot of scheduleSlots) {
        if (slot.type !== "PERIOD") continue;
        perDayPeriodSlots[slot.dayOfWeek].push(slot);
      }
      for (const dayKey of Object.keys(perDayPeriodSlots)) {
        perDayPeriodSlots[Number(dayKey)].sort((a, b) => a.order - b.order);
      }
      const bellIdToPeriodNumber = new Map<string, number>();
      for (const dayKey of Object.keys(perDayPeriodSlots)) {
        const list = perDayPeriodSlots[Number(dayKey)];
        list.forEach((slot, idx) => bellIdToPeriodNumber.set(slot.id, idx + 1));
      }

      const nextGrid: Record<string, GridEntry> = {};
      const draftSlots = (payload.draft?.slots ?? []) as DraftSlots;
      for (const slot of draftSlots) {
        const periodNumber = bellIdToPeriodNumber.get(slot.bellScheduleSlotId);
        if (!periodNumber) continue;
        const key = `${slot.sectionId}:${slot.dayOfWeek}:${periodNumber}`;
        nextGrid[key] = { subjectId: slot.subjectId, room: slot.room ?? "" };
      }
      setGrid(nextGrid);
    } catch (e) {
      setError((e as Error).message);
      setDetails(null);
      setGrid({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, termId]);

  const scheduleTemplate = useMemo(() => {
    if (!details?.schedule) return null;
    const slots = details.schedule.slots.filter((s) => s.dayOfWeek === 1).sort((a, b) => a.order - b.order);
    let periodNumber = 0;
    return slots.map((s) => {
      if (s.type === "PERIOD") periodNumber += 1;
      return { ...s, periodNumber: s.type === "PERIOD" ? periodNumber : null };
    });
  }, [details?.schedule]);

  const handleCreateSchedule = async (replaceExisting: boolean) => {
    if (!classId || !termId) return;
    setScheduleSaving(true);
    try {
      const res = await fetch("/api/admin/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createSchedule",
          classId,
          termId,
          replaceExisting,
          schedule: scheduleForm,
        }),
      });
      const { json } = await readApiJson(res);
      if (!json) throw new Error(`Failed to create schedule (HTTP ${res.status})`);
      if (!res.ok) {
        const obj = isRecord(json) ? json : {};
        const message =
          typeof obj.error === "string" ? obj.error : `Failed to create schedule (HTTP ${res.status})`;
        throw new Error(message);
      }
      toast.success("Schedule created");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!details?.schedule || !details?.draft) {
      toast.error("Create a schedule first");
      return;
    }
    if (!classId || !termId) return;
    setSaving(true);
    try {
      const entries: Array<{ sectionId: string; dayOfWeek: number; periodNumber: number; subjectId: string; room?: string }> = [];
      for (const [key, value] of Object.entries(grid)) {
        if (!value.subjectId) continue;
        const [sectionId, dayStr, periodStr] = key.split(":");
        entries.push({
          sectionId,
          dayOfWeek: Number(dayStr),
          periodNumber: Number(periodStr),
          subjectId: value.subjectId,
          room: value.room || undefined,
        });
      }

      const res = await fetch("/api/admin/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "saveDraft", classId, termId, entries }),
      });
      const { json } = await readApiJson(res);
      if (!json) throw new Error(`Failed to save draft (HTTP ${res.status})`);
      if (!res.ok) {
        const obj = isRecord(json) ? json : {};
        const message =
          typeof obj.error === "string" ? obj.error : `Failed to save draft (HTTP ${res.status})`;
        throw new Error(message);
      }
      const obj = isRecord(json) ? json : {};
      const count = typeof obj.count === "number" ? obj.count : 0;
      toast.success(`Draft saved (${count} slots)`);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!classId || !termId) return;
    setPublishing(true);
    try {
      const res = await fetch("/api/admin/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish", classId, termId }),
      });
      const { json } = await readApiJson(res);
      if (!json) throw new Error(`Failed to publish (HTTP ${res.status})`);
      if (!res.ok) {
        const obj = isRecord(json) ? json : {};
        const details = isRecord(obj.details) ? (obj.details as Record<string, unknown>) : null;
        const a = details && isRecord(details.a) ? (details.a as Record<string, unknown>) : null;
        const b = details && isRecord(details.b) ? (details.b as Record<string, unknown>) : null;
        const aCtx = a && typeof a.context === "string" ? a.context : null;
        const bCtx = b && typeof b.context === "string" ? b.context : null;
        if (aCtx && bCtx) throw new Error(`Teacher conflict: ${aCtx} overlaps ${bCtx}`);

        const message = typeof obj.error === "string" ? obj.error : "Failed to publish";
        throw new Error(message);
      }
      toast.success("Timetable published");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPublishing(false);
    }
  };

  const handleEditPublished = async () => {
    if (!classId || !termId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "editPublished", classId, termId }),
      });
      const { json } = await readApiJson(res);
      if (!json) throw new Error(`Failed to start editing published timetable (HTTP ${res.status})`);
      if (!res.ok) {
        const obj = isRecord(json) ? json : {};
        const message =
          typeof obj.error === "string"
            ? obj.error
            : `Failed to start editing published timetable (HTTP ${res.status})`;
        throw new Error(message);
      }
      toast.success("Draft created from published timetable");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyTerm1ToTerm2 = async () => {
    if (!classId || !termId) return;
    const term1 = termOptions[0];
    if (!term1 || term1.id === termId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "copyTerm1ToTerm2", classId, fromTermId: term1.id, toTermId: termId }),
      });
      const { json } = await readApiJson(res);
      if (!json) throw new Error(`Failed to copy timetable (HTTP ${res.status})`);
      if (!res.ok) {
        const obj = isRecord(json) ? json : {};
        const message =
          typeof obj.error === "string" ? obj.error : `Failed to copy timetable (HTTP ${res.status})`;
        throw new Error(message);
      }
      toast.success("Copied published Term 1 into this term's draft");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const setCell = (sectionId: string, dayOfWeek: number, periodNumber: number, patch: Partial<GridEntry>) => {
    const key = `${sectionId}:${dayOfWeek}:${periodNumber}`;
    setGrid((prev) => ({
      ...prev,
      [key]: { subjectId: prev[key]?.subjectId ?? null, room: prev[key]?.room ?? "", ...patch },
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Timetable</h1>
        <p className="text-muted-foreground">
          Create timetables per term. Draft first, then publish.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Setup</CardTitle>
          <CardDescription>Select academic year, term, and class.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Academic Year</Label>
            <Select value={academicYearId ?? ""} onValueChange={(v) => setAcademicYearId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select academic year" />
              </SelectTrigger>
              <SelectContent>
                {data.academicYears.map((y) => (
                  <SelectItem key={y.id} value={y.id}>
                    <div className="flex items-center gap-2">
                      {y.name}
                      {y.isCurrent && <Badge variant="secondary">Current</Badge>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Term</Label>
            <Select value={termId ?? ""} onValueChange={(v) => setTermId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select term" />
              </SelectTrigger>
              <SelectContent>
                {termOptions.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Class</Label>
            <Select value={classId ?? ""} onValueChange={(v) => setClassId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                {data.classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && (
        <Card>
          <CardContent className="py-8">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-4 w-80 mt-2" />
            <Skeleton className="h-64 mt-6" />
          </CardContent>
        </Card>
      )}

      {!loading && details && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>
                  {details.class.name} • {details.term.name}
                </span>
                <div className="flex items-center gap-2">
                  {details.draft ? <Badge>Draft</Badge> : <Badge variant="secondary">No Draft</Badge>}
                  {details.published ? <Badge variant="outline">Published</Badge> : <Badge variant="secondary">Not Published</Badge>}
                </div>
              </CardTitle>
              <CardDescription>
                Teachers must be assigned to section-subjects before placing them in the timetable.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button onClick={handleSaveDraft} disabled={saving || !details.schedule || !details.draft}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save Draft"}
              </Button>
              <Button onClick={handlePublish} disabled={publishing || !details.draft}>
                <Upload className="h-4 w-4 mr-2" />
                {publishing ? "Publishing..." : "Publish"}
              </Button>
              {details.published && (
                <Button variant="outline" onClick={handleEditPublished} disabled={saving}>
                  <Settings2 className="h-4 w-4 mr-2" />
                  Edit Published
                </Button>
              )}
              {termOptions.length >= 2 && termOptions[0].id !== termId && (
                <Button variant="outline" onClick={handleCopyTerm1ToTerm2} disabled={saving}>
                  <Copy className="h-4 w-4 mr-2" />
                  Use Term 1 Timetable
                </Button>
              )}
            </CardContent>
          </Card>

          {!details.schedule ? (
            <Card>
              <CardHeader>
                <CardTitle>Create Bell Schedule</CardTitle>
                <CardDescription>
                  Set number of periods and times for this class and term (Mon–Fri).
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2 md:col-span-3">
                  <Label>Name</Label>
                  <Input value={scheduleForm.name} onChange={(e) => setScheduleForm((p) => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input value={scheduleForm.startTime} onChange={(e) => setScheduleForm((p) => ({ ...p, startTime: e.target.value }))} placeholder="09:00" />
                </div>
                <div className="space-y-2">
                  <Label>Periods / Day</Label>
                  <Input
                    type="number"
                    value={scheduleForm.periodCount}
                    onChange={(e) => setScheduleForm((p) => ({ ...p, periodCount: Number(e.target.value) }))}
                    min={1}
                    max={12}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Period Minutes</Label>
                  <Input
                    type="number"
                    value={scheduleForm.periodMinutes}
                    onChange={(e) => setScheduleForm((p) => ({ ...p, periodMinutes: Number(e.target.value) }))}
                    min={15}
                    max={180}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Break After Period</Label>
                  <Input
                    type="number"
                    value={scheduleForm.breakAfterPeriod}
                    onChange={(e) => setScheduleForm((p) => ({ ...p, breakAfterPeriod: Number(e.target.value) }))}
                    min={0}
                    max={12}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Break Minutes</Label>
                  <Input
                    type="number"
                    value={scheduleForm.breakMinutes}
                    onChange={(e) => setScheduleForm((p) => ({ ...p, breakMinutes: Number(e.target.value) }))}
                    min={0}
                    max={180}
                  />
                </div>
                <div className="md:col-span-3 flex gap-2">
                  <Button onClick={() => handleCreateSchedule(false)} disabled={scheduleSaving}>
                    {scheduleSaving ? "Creating..." : "Create Schedule"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Bell Schedule</CardTitle>
                <CardDescription>{details.schedule.name}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {scheduleTemplate && (
                  <div className="flex flex-wrap gap-2">
                    {scheduleTemplate.map((s) => (
                      <Badge key={s.id} variant={s.type === "BREAK" ? "secondary" : "outline"}>
                        {s.type === "BREAK" ? "Break" : `P${s.periodNumber}`} • {s.startTime}-{s.endTime}
                      </Badge>
                    ))}
                  </div>
                )}
                <details className="rounded-lg border p-4">
                  <summary className="cursor-pointer select-none text-sm font-medium">Change schedule (clears draft)</summary>
                  <div className="grid gap-4 md:grid-cols-3 mt-4">
                    <div className="space-y-2 md:col-span-3">
                      <Label>Name</Label>
                      <Input value={scheduleForm.name} onChange={(e) => setScheduleForm((p) => ({ ...p, name: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Start Time</Label>
                      <Input value={scheduleForm.startTime} onChange={(e) => setScheduleForm((p) => ({ ...p, startTime: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Periods / Day</Label>
                      <Input type="number" value={scheduleForm.periodCount} onChange={(e) => setScheduleForm((p) => ({ ...p, periodCount: Number(e.target.value) }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Period Minutes</Label>
                      <Input type="number" value={scheduleForm.periodMinutes} onChange={(e) => setScheduleForm((p) => ({ ...p, periodMinutes: Number(e.target.value) }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Break After Period</Label>
                      <Input type="number" value={scheduleForm.breakAfterPeriod} onChange={(e) => setScheduleForm((p) => ({ ...p, breakAfterPeriod: Number(e.target.value) }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Break Minutes</Label>
                      <Input type="number" value={scheduleForm.breakMinutes} onChange={(e) => setScheduleForm((p) => ({ ...p, breakMinutes: Number(e.target.value) }))} />
                    </div>
                    <div className="md:col-span-3">
                      <Button onClick={() => handleCreateSchedule(true)} variant="destructive" disabled={scheduleSaving}>
                        {scheduleSaving ? "Updating..." : "Replace Schedule & Clear Draft"}
                      </Button>
                    </div>
                  </div>
                </details>
              </CardContent>
            </Card>
          )}

          {details.schedule && scheduleTemplate && (
            <div className="space-y-4">
              {details.days.map((day) => {
                const periodColumns = scheduleTemplate;
                return (
                  <Card key={day.dayOfWeek}>
                    <CardHeader>
                      <CardTitle>{day.label}</CardTitle>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                      <table className="w-full min-w-[900px]">
                        <thead>
                          <tr>
                            <th className="text-left p-2 border-b text-muted-foreground text-sm">Section</th>
                            {periodColumns.map((col) => (
                              <th key={col.id} className="p-2 border-b text-sm text-center">
                                {col.type === "BREAK" ? "Break" : `Period ${col.periodNumber}`}
                                <div className="text-xs text-muted-foreground">{col.startTime}-{col.endTime}</div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {details.sections.map((section) => (
                            <tr key={section.id} className="border-b last:border-0">
                              <td className="p-2 text-sm font-medium">{section.name}</td>
                              {periodColumns.map((col) => {
                                if (col.type === "BREAK") {
                                  return (
                                    <td key={col.id} className="p-2 text-center text-xs text-muted-foreground">
                                      —
                                    </td>
                                  );
                                }
                                const key = `${section.id}:${day.dayOfWeek}:${col.periodNumber}`;
                                const value = grid[key]?.subjectId ?? null;
                                const assigned = value ? details.assignmentMap?.[section.id]?.[value] : null;
                                return (
                                  <td key={col.id} className="p-2 align-top">
                                    <Select
                                      value={value ?? ""}
                                      onValueChange={(v) => setCell(section.id, day.dayOfWeek, col.periodNumber as number, { subjectId: v || null })}
                                    >
                                      <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Select subject" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {details.subjects.map((sub) => {
                                          const mapping = details.assignmentMap?.[section.id]?.[sub.id];
                                          const disabled = !mapping;
                                          return (
                                            <SelectItem key={sub.id} value={sub.id} disabled={disabled}>
                                              <div className="flex items-center justify-between gap-3">
                                                <span className="truncate">{sub.name}</span>
                                                <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                                                  {mapping ? mapping.teacherName : "Assign teacher first"}
                                                </span>
                                              </div>
                                            </SelectItem>
                                          );
                                        })}
                                      </SelectContent>
                                    </Select>
                                    {assigned && (
                                      <p className="text-[11px] text-muted-foreground mt-1 truncate">
                                        {assigned.teacherName}
                                      </p>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

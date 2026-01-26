"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin } from "lucide-react";
import type { TeacherTimetableData } from "@/lib/data/teacher";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function TeacherTimetableContent({ data }: { data: TeacherTimetableData }) {
  const today = new Date().getDay();

  const slotsByDay = data.slots.reduce<Record<number, TeacherTimetableData["slots"]>>((acc, slot) => {
    acc[slot.dayOfWeek] ??= [];
    acc[slot.dayOfWeek].push(slot);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Timetable</h1>
        <p className="text-muted-foreground">
          {data.academicYearName && data.termName ? `${data.academicYearName} • ${data.termName}` : "No current term"}
        </p>
      </div>

      {data.slots.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No published timetable found for the current term.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {[1, 2, 3, 4, 5].map((day) => (
            <Card key={day}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {DAYS[day]}
                  {day === today && (
                    <Badge variant="secondary" className="ml-2">
                      Today
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(slotsByDay[day] ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No classes scheduled</p>
                ) : (
                  <div className="grid gap-3">
                    {(slotsByDay[day] ?? []).map((slot) => (
                      <Card key={slot.id} className="overflow-hidden">
                        <div className="flex">
                          <div className="w-2" style={{ backgroundColor: slot.subjectColor || "#888" }} />
                          <div className="flex-1 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-medium truncate">{slot.subject}</p>
                                <p className="text-xs text-muted-foreground truncate">{slot.section}</p>
                              </div>
                              <div className="text-right">
                                <div className="flex items-center justify-end gap-1 text-sm">
                                  <Clock className="h-4 w-4 text-muted-foreground" />
                                  <span className="whitespace-nowrap">
                                    {slot.startTime} - {slot.endTime}
                                  </span>
                                </div>
                                {slot.room && (
                                  <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground mt-1">
                                    <MapPin className="h-3 w-3" />
                                    <span className="truncate max-w-[200px]">{slot.room}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}


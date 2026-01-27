"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Clock, MapPin } from "lucide-react";
import ChildSwitcher from "@/components/parent/child-switcher";
import type { ChildInfo, ChildTimetableData } from "@/lib/data/parent";
import { cn } from "@/lib/utils";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function TimetableContent({
  data,
  childList,
  selectedChildId,
}: {
  data: ChildTimetableData;
  childList: ChildInfo[];
  selectedChildId: string;
}) {
  const today = new Date().getDay();
  const [selectedDay, setSelectedDay] = useState(today.toString());

  const slotsByDay = data.slots.reduce((acc, slot) => {
    const day = slot.dayOfWeek;
    acc[day] ??= [];
    acc[day].push(slot);
    return acc;
  }, {} as Record<number, ChildTimetableData["slots"]>);

  const getDaySlots = (day: number) => slotsByDay[day] || [];
  const hasClasses = (day: number) => (slotsByDay[day]?.length || 0) > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Timetable</h1>
          <p className="text-muted-foreground">
            {data.academicYearName && data.termName ? `${data.academicYearName} • ${data.termName} • ` : ""}
            {data.child.name} - {data.child.className} {data.child.sectionName}
          </p>
        </div>
        <ChildSwitcher childList={childList} selectedChildId={selectedChildId} basePath="/parent/timetable" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Weekly Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedDay} onValueChange={setSelectedDay}>
            <TabsList className="grid w-full grid-cols-7">
              {DAYS.map((day, index) => (
                <TabsTrigger
                  key={day}
                  value={index.toString()}
                  className={cn("relative", index === today && "ring-2 ring-primary ring-offset-1")}
                >
                  <span className="hidden sm:inline">{day.slice(0, 3)}</span>
                  <span className="sm:hidden">{day.slice(0, 1)}</span>
                  {hasClasses(index) && <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />}
                </TabsTrigger>
              ))}
            </TabsList>

            {DAYS.map((day, index) => (
              <TabsContent key={day} value={index.toString()} className="mt-4">
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg">
                    {day}
                    {index === today && (
                      <Badge variant="secondary" className="ml-2">
                        Today
                      </Badge>
                    )}
                  </h3>
                  {getDaySlots(index).length > 0 ? (
                    <div className="grid gap-3">
                      {getDaySlots(index).map((slot) => (
                        <Card key={slot.id} className="overflow-hidden">
                          <div className="flex">
                            <div className="w-2" style={{ backgroundColor: slot.subject.color || "#888" }} />
                            <div className="flex-1 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <h4 className="font-medium truncate">{slot.subject.name}</h4>
                                  {slot.teacher && (
                                    <p className="text-xs text-muted-foreground truncate">Teacher: {slot.teacher.name}</p>
                                  )}
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
                  ) : (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-8">
                        <Calendar className="h-10 w-10 text-muted-foreground mb-2" />
                        <p className="text-muted-foreground">No classes scheduled</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}


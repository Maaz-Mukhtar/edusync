"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Clock, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TimetableData, TimetableSlot } from "@/lib/data/student";

interface TimetableContentProps {
  data: TimetableData;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function TimetableContent({ data }: TimetableContentProps) {
  const today = new Date().getDay();
  const [selectedDay, setSelectedDay] = useState(today.toString());

  // Group slots by day
  const slotsByDay = data.slots.reduce((acc, slot) => {
    const day = slot.dayOfWeek;
    if (!acc[day]) acc[day] = [];
    acc[day].push(slot);
    return acc;
  }, {} as Record<number, TimetableSlot[]>);

  // Get slots for selected day
  const getDaySlots = (day: number) => slotsByDay[day] || [];

  // Check if a day has classes
  const hasClasses = (day: number) => (slotsByDay[day]?.length || 0) > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Timetable</h1>
        <p className="text-muted-foreground">
          {data.className} - {data.sectionName} weekly schedule
        </p>
      </div>

      {/* Week Overview */}
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
                  className={cn(
                    "relative",
                    index === today && "ring-2 ring-primary ring-offset-1"
                  )}
                >
                  <span className="hidden sm:inline">{day.slice(0, 3)}</span>
                  <span className="sm:hidden">{day.slice(0, 1)}</span>
                  {hasClasses(index) && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />
                  )}
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
                            <div
                              className="w-2"
                              style={{ backgroundColor: slot.subject.color || "#888" }}
                            />
                            <div className="flex-1 p-4">
                              <div className="flex items-start justify-between">
                                <div>
                                  <h4 className="font-medium">{slot.subject.name}</h4>
                                  {slot.subject.code && (
                                    <p className="text-xs text-muted-foreground">
                                      {slot.subject.code}
                                    </p>
                                  )}
                                </div>
                                <div className="text-right">
                                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                    <Clock className="h-3.5 w-3.5" />
                                    {slot.startTime} - {slot.endTime}
                                  </div>
                                  {slot.room && (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                      <MapPin className="h-3 w-3" />
                                      {slot.room}
                                    </div>
                                  )}
                                </div>
                              </div>
                              {slot.teacher && (
                                <p className="text-sm text-muted-foreground mt-2">
                                  Teacher: {slot.teacher.name}
                                </p>
                              )}
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

      {/* Full Week Grid View */}
      <Card>
        <CardHeader>
          <CardTitle>Full Week View</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr>
                <th className="text-left p-2 border-b font-medium text-muted-foreground">
                  Time
                </th>
                {SHORT_DAYS.map((day, index) => (
                  <th
                    key={day}
                    className={cn(
                      "text-center p-2 border-b font-medium",
                      index === today ? "bg-primary/10 text-primary" : "text-muted-foreground"
                    )}
                  >
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {getUniqueTimeSlots(data.slots).map((time) => (
                <tr key={time} className="border-b last:border-0">
                  <td className="p-2 text-sm text-muted-foreground whitespace-nowrap">
                    {time}
                  </td>
                  {DAYS.map((_, dayIndex) => {
                    const slot = getDaySlots(dayIndex).find(
                      (s) => `${s.startTime} - ${s.endTime}` === time
                    );
                    return (
                      <td
                        key={dayIndex}
                        className={cn(
                          "p-2 text-center",
                          dayIndex === today && "bg-primary/5"
                        )}
                      >
                        {slot ? (
                          <div
                            className="rounded-md p-2 text-xs"
                            style={{
                              backgroundColor: `${slot.subject.color}20` || "#88888820",
                              borderLeft: `3px solid ${slot.subject.color || "#888"}`,
                            }}
                          >
                            <p className="font-medium truncate">{slot.subject.name}</p>
                            {slot.room && (
                              <p className="text-muted-foreground truncate">{slot.room}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
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
    </div>
  );
}

// Helper function to get unique time slots sorted
function getUniqueTimeSlots(slots: TimetableSlot[]): string[] {
  const times = new Set(slots.map((s) => `${s.startTime} - ${s.endTime}`));
  return Array.from(times).sort((a, b) => {
    const timeA = a.split(" - ")[0];
    const timeB = b.split(" - ")[0];
    return timeA.localeCompare(timeB);
  });
}

"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, BookOpen, Star } from "lucide-react";
import { getInitials } from "@/lib/utils";
import { fetcher, swrConfig } from "@/lib/swr";

interface Student {
  id: string;
  rollNumber: string | null;
  userId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  avatar: string | null;
}

interface Section {
  id: string;
  name: string;
  className: string;
  classId: string;
  isClassTeacher: boolean;
  capacity: number | null;
  studentCount: number;
  students: Student[];
}

interface Subject {
  id: string;
  name: string;
  code: string | null;
  color: string | null;
}

interface ClassesData {
  sections: Section[];
  subjects: Subject[];
}

export default function TeacherClassesPage() {
  const { data, isLoading } = useSWR<ClassesData>("/api/teacher/classes", fetcher, swrConfig);
  const [selectedSection, setSelectedSection] = useState<Section | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Failed to load classes</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Classes</h1>
        <p className="text-muted-foreground">
          View your assigned sections and students
        </p>
      </div>

      {/* Subjects Taught */}
      {data.subjects.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Subjects I Teach
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.subjects.map((subject) => (
                <Badge
                  key={subject.id}
                  variant="secondary"
                  className="text-sm py-1 px-3"
                  style={{
                    backgroundColor: subject.color ? `${subject.color}20` : undefined,
                    borderColor: subject.color || undefined,
                    borderWidth: subject.color ? 1 : 0,
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full mr-2"
                    style={{ backgroundColor: subject.color || "#888" }}
                  />
                  {subject.name}
                  {subject.code && (
                    <span className="text-muted-foreground ml-1">({subject.code})</span>
                  )}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sections Grid */}
      {data.sections.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No Classes Assigned</h3>
            <p className="text-sm text-muted-foreground">
              You haven&apos;t been assigned to any classes yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.sections.map((section) => (
            <Card key={section.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {section.className} - {section.name}
                      {section.isClassTeacher && (
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      )}
                    </CardTitle>
                    <CardDescription>
                      {section.isClassTeacher ? "Class Teacher" : "Subject Teacher"}
                    </CardDescription>
                  </div>
                  <Badge variant="outline">
                    <Users className="h-3 w-3 mr-1" />
                    {section.studentCount}
                    {section.capacity && `/${section.capacity}`}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Student Avatars Preview */}
                  <div className="flex -space-x-2">
                    {section.students.slice(0, 5).map((student) => (
                      <Avatar key={student.id} className="border-2 border-background h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {getInitials(student.firstName, student.lastName)}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                    {section.studentCount > 5 && (
                      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted text-xs font-medium">
                        +{section.studentCount - 5}
                      </div>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setSelectedSection(section)}
                  >
                    View Students
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Student List Dialog */}
      <Dialog open={!!selectedSection} onOpenChange={() => setSelectedSection(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedSection?.className} - {selectedSection?.name} Students
            </DialogTitle>
            <DialogDescription>
              {selectedSection?.studentCount} students enrolled
            </DialogDescription>
          </DialogHeader>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Roll No</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedSection?.students.map((student) => (
                <TableRow key={student.id}>
                  <TableCell className="font-medium">
                    {student.rollNumber || "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {getInitials(student.firstName, student.lastName)}
                        </AvatarFallback>
                      </Avatar>
                      {student.firstName} {student.lastName}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {student.email || "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </div>
  );
}

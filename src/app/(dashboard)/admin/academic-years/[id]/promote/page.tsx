"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  ArrowRight,
  GraduationCap,
  Users,
  AlertTriangle,
  Loader2,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";

interface Student {
  enrollmentId: string;
  studentId: string;
  firstName: string;
  lastName: string;
  rollNumber: string | null;
}

interface Section {
  id: string;
  name: string;
  studentCount: number;
  students: Student[];
  suggestedTargetSectionId: string | null;
  suggestedTargetSectionName: string | null;
}

interface ClassData {
  id: string;
  name: string;
  displayOrder: number;
  isLastClass: boolean;
  sections: Section[];
}

interface AcademicYear {
  id: string;
  name: string;
}

interface PromotionData {
  sourceYear: AcademicYear;
  targetYear: AcademicYear | null;
  availableTargetYears: AcademicYear[];
  classes: ClassData[];
  totalEnrollments: number;
}

interface SectionMapping {
  sourceSectionId: string;
  targetSectionId: string | null;
  excludeStudentIds: string[];
}

export default function PromotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [promoting, setPromoting] = useState(false);
  const [data, setData] = useState<PromotionData | null>(null);
  const [targetYearId, setTargetYearId] = useState<string>("");
  const [mappings, setMappings] = useState<Record<string, SectionMapping>>({});
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [promotionResult, setPromotionResult] = useState<{
    promoted: number;
    graduated: number;
    skipped: number;
  } | null>(null);

  const fetchPromotionData = async (targetId?: string) => {
    try {
      const url = targetId
        ? `/api/academic-years/${id}/promote?targetYearId=${targetId}`
        : `/api/academic-years/${id}/promote`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch");
      const result = await response.json();
      setData(result);

      // Initialize mappings with suggested values
      const initialMappings: Record<string, SectionMapping> = {};
      result.classes.forEach((cls: ClassData) => {
        cls.sections.forEach((section: Section) => {
          initialMappings[section.id] = {
            sourceSectionId: section.id,
            targetSectionId: section.suggestedTargetSectionId,
            excludeStudentIds: [],
          };
        });
      });
      setMappings(initialMappings);

      // Set default target year if available
      if (result.availableTargetYears.length > 0 && !targetId) {
        setTargetYearId(result.availableTargetYears[0].id);
      }
    } catch (error) {
      console.error("Error fetching promotion data:", error);
      toast.error("Failed to load promotion data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPromotionData();
  }, [id]);

  useEffect(() => {
    if (targetYearId) {
      fetchPromotionData(targetYearId);
    }
  }, [targetYearId]);

  const updateMapping = (sectionId: string, targetSectionId: string | null) => {
    setMappings((prev) => ({
      ...prev,
      [sectionId]: {
        ...prev[sectionId],
        targetSectionId,
      },
    }));
  };

  const toggleStudentExclusion = (sectionId: string, studentId: string) => {
    setMappings((prev) => {
      const current = prev[sectionId];
      const isExcluded = current.excludeStudentIds.includes(studentId);
      return {
        ...prev,
        [sectionId]: {
          ...current,
          excludeStudentIds: isExcluded
            ? current.excludeStudentIds.filter((id) => id !== studentId)
            : [...current.excludeStudentIds, studentId],
        },
      };
    });
  };

  const handlePromote = async () => {
    if (!targetYearId) {
      toast.error("Please select a target academic year");
      return;
    }

    setPromoting(true);
    try {
      const response = await fetch(`/api/academic-years/${id}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetYearId,
          mappings: Object.values(mappings),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to promote");
      }

      const result = await response.json();
      setPromotionResult(result);
      setConfirmDialogOpen(false);
      setSuccessDialogOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to promote students");
    } finally {
      setPromoting(false);
    }
  };

  // Build available target sections for dropdowns
  const getTargetSectionsForClass = (currentClassIndex: number): Array<{ id: string; label: string }> => {
    if (!data) return [];

    const options: Array<{ id: string; label: string }> = [];

    // Add sections from next class
    if (currentClassIndex < data.classes.length - 1) {
      const nextClass = data.classes[currentClassIndex + 1];
      nextClass.sections.forEach((section) => {
        options.push({
          id: section.id,
          label: `${nextClass.name} - ${section.name}`,
        });
      });
    }

    // Add sections from other classes (for custom mapping)
    data.classes.forEach((cls, idx) => {
      if (idx !== currentClassIndex && idx !== currentClassIndex + 1) {
        cls.sections.forEach((section) => {
          options.push({
            id: section.id,
            label: `${cls.name} - ${section.name}`,
          });
        });
      }
    });

    return options;
  };

  const getTotalStats = () => {
    if (!data) return { toPromote: 0, toGraduate: 0, excluded: 0 };

    let toPromote = 0;
    let toGraduate = 0;
    let excluded = 0;

    data.classes.forEach((cls) => {
      cls.sections.forEach((section) => {
        const mapping = mappings[section.id];
        if (!mapping) return;

        const activeCount = section.studentCount - mapping.excludeStudentIds.length;
        excluded += mapping.excludeStudentIds.length;

        if (mapping.targetSectionId) {
          toPromote += activeCount;
        } else {
          toGraduate += activeCount;
        }
      });
    });

    return { toPromote, toGraduate, excluded };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Failed to load promotion data</p>
        <Button variant="outline" onClick={() => router.back()} className="mt-4">
          Go Back
        </Button>
      </div>
    );
  }

  const stats = getTotalStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Promote Students</h1>
          <p className="text-muted-foreground">
            From {data.sourceYear.name} to next academic year
          </p>
        </div>
      </div>

      {/* Target Year Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Target Academic Year</CardTitle>
          <CardDescription>
            Choose the academic year to promote students to
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.availableTargetYears.length === 0 ? (
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              <span>No future academic years available. Please create one first.</span>
            </div>
          ) : (
            <Select value={targetYearId} onValueChange={setTargetYearId}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Select target year" />
              </SelectTrigger>
              <SelectContent>
                {data.availableTargetYears.map((year) => (
                  <SelectItem key={year.id} value={year.id}>
                    {year.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <ArrowRight className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.toPromote}</p>
                <p className="text-sm text-muted-foreground">To Promote</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <GraduationCap className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.toGraduate}</p>
                <p className="text-sm text-muted-foreground">To Graduate</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-100 rounded-lg">
                <Users className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.excluded}</p>
                <p className="text-sm text-muted-foreground">Excluded</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Class-by-Class Mapping */}
      <Card>
        <CardHeader>
          <CardTitle>Promotion Mappings</CardTitle>
          <CardDescription>
            Configure where each section&apos;s students will be promoted to.
            Uncheck students to exclude them from promotion.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="space-y-2">
            {data.classes.map((cls, classIndex) => (
              <AccordionItem key={cls.id} value={cls.id} className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-4">
                    <span className="font-medium">{cls.name}</span>
                    <Badge variant="secondary">
                      {cls.sections.reduce((sum, s) => sum + s.studentCount, 0)} students
                    </Badge>
                    {cls.isLastClass && (
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        <GraduationCap className="h-3 w-3 mr-1" />
                        Graduating Class
                      </Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-2">
                    {cls.sections.map((section) => {
                      const mapping = mappings[section.id];
                      const targetOptions = getTargetSectionsForClass(classIndex);

                      return (
                        <div key={section.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {cls.name} - {section.name}
                              </span>
                              <Badge variant="outline">{section.studentCount} students</Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <ArrowRight className="h-4 w-4 text-muted-foreground" />
                              {cls.isLastClass ? (
                                <Badge variant="default" className="bg-green-600">
                                  <GraduationCap className="h-3 w-3 mr-1" />
                                  Graduate
                                </Badge>
                              ) : (
                                <Select
                                  value={mapping?.targetSectionId || "__graduate__"}
                                  onValueChange={(value) =>
                                    updateMapping(
                                      section.id,
                                      value === "__graduate__" ? null : value
                                    )
                                  }
                                >
                                  <SelectTrigger className="w-[250px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {targetOptions.map((opt) => (
                                      <SelectItem key={opt.id} value={opt.id}>
                                        {opt.label}
                                      </SelectItem>
                                    ))}
                                    <SelectItem value="__graduate__">
                                      <span className="flex items-center gap-1">
                                        <GraduationCap className="h-3 w-3" />
                                        Graduate (No promotion)
                                      </span>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                          </div>

                          {/* Student list for exclusion */}
                          {section.students.length > 0 && (
                            <div className="border-t pt-3 mt-3">
                              <p className="text-sm text-muted-foreground mb-2">
                                Uncheck to exclude from promotion:
                              </p>
                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                {section.students.map((student) => {
                                  const isExcluded = mapping?.excludeStudentIds.includes(
                                    student.studentId
                                  );
                                  return (
                                    <div
                                      key={student.studentId}
                                      className="flex items-center gap-2"
                                    >
                                      <Checkbox
                                        id={student.studentId}
                                        checked={!isExcluded}
                                        onCheckedChange={() =>
                                          toggleStudentExclusion(
                                            section.id,
                                            student.studentId
                                          )
                                        }
                                      />
                                      <Label
                                        htmlFor={student.studentId}
                                        className={`text-sm cursor-pointer ${
                                          isExcluded ? "line-through text-muted-foreground" : ""
                                        }`}
                                      >
                                        {student.firstName} {student.lastName}
                                        {student.rollNumber && (
                                          <span className="text-muted-foreground ml-1">
                                            ({student.rollNumber})
                                          </span>
                                        )}
                                      </Label>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button
          onClick={() => setConfirmDialogOpen(true)}
          disabled={!targetYearId || data.totalEnrollments === 0}
        >
          <ArrowRight className="h-4 w-4 mr-2" />
          Promote Students
        </Button>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Student Promotion</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to promote students from{" "}
              <strong>{data.sourceYear.name}</strong> to{" "}
              <strong>
                {data.availableTargetYears.find((y) => y.id === targetYearId)?.name}
              </strong>
              .
              <br />
              <br />
              <strong>{stats.toPromote}</strong> students will be promoted.
              <br />
              <strong>{stats.toGraduate}</strong> students will graduate.
              <br />
              <strong>{stats.excluded}</strong> students will be skipped.
              <br />
              <br />
              This action cannot be easily undone. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={promoting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePromote} disabled={promoting}>
              {promoting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm Promotion
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Success Dialog */}
      <AlertDialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Promotion Complete
            </AlertDialogTitle>
            <AlertDialogDescription>
              {promotionResult && (
                <>
                  <strong>{promotionResult.promoted}</strong> students promoted.
                  <br />
                  <strong>{promotionResult.graduated}</strong> students graduated.
                  <br />
                  <strong>{promotionResult.skipped}</strong> students skipped.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => router.push("/admin/academic-years")}>
              Back to Academic Years
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

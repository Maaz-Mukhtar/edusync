import { Skeleton } from "@/components/ui/skeleton";

export default function TeacherAssessmentsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>

      {/* Filters */}
      <Skeleton className="h-24" />

      {/* Assessments Table */}
      <Skeleton className="h-96" />
    </div>
  );
}

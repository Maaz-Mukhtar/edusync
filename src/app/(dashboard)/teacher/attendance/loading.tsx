import { Skeleton } from "@/components/ui/skeleton";

export default function TeacherAttendanceLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>

      {/* Filters */}
      <Skeleton className="h-24" />

      {/* Attendance Table */}
      <Skeleton className="h-96" />
    </div>
  );
}

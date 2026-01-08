import { Skeleton } from "@/components/ui/skeleton";

export default function TeacherGradebookLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>

      {/* Filters */}
      <Skeleton className="h-24" />

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>

      {/* Gradebook Table */}
      <Skeleton className="h-96" />
    </div>
  );
}

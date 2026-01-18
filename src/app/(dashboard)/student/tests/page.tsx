import { Suspense } from "react";
import TestsContent from "./tests-content";
import { Skeleton } from "@/components/ui/skeleton";

function TestsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<TestsLoading />}>
      <TestsContent />
    </Suspense>
  );
}

import { Suspense } from "react";
import { getStudentGradesData } from "@/lib/data/student";
import GradesContent from "./grades-content";
import { Skeleton } from "@/components/ui/skeleton";

function GradesLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-64" />
      <Skeleton className="h-96" />
    </div>
  );
}

async function GradesPage() {
  const data = await getStudentGradesData();
  return <GradesContent data={data} />;
}

export default function Page() {
  return (
    <Suspense fallback={<GradesLoading />}>
      <GradesPage />
    </Suspense>
  );
}

import { Suspense } from "react";
import { getTeacherGradebookData } from "@/lib/data/teacher";
import GradebookContent from "./gradebook-content";
import { Skeleton } from "@/components/ui/skeleton";

function GradebookLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <Skeleton className="h-24" />
      <div className="grid gap-4 md:grid-cols-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}

async function GradebookPage() {
  const data = await getTeacherGradebookData();
  return <GradebookContent initialData={data} />;
}

export default function Page() {
  return (
    <Suspense fallback={<GradebookLoading />}>
      <GradebookPage />
    </Suspense>
  );
}

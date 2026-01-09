import { Suspense } from "react";
import { getTeacherAssessmentsData } from "@/lib/data/teacher";
import AssessmentsContent from "./assessments-content";
import { Skeleton } from "@/components/ui/skeleton";

function AssessmentsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>
      <Skeleton className="h-24" />
      <Skeleton className="h-96" />
    </div>
  );
}

async function AssessmentsPage() {
  const data = await getTeacherAssessmentsData();
  return <AssessmentsContent initialData={data} />;
}

export default function Page() {
  return (
    <Suspense fallback={<AssessmentsLoading />}>
      <AssessmentsPage />
    </Suspense>
  );
}

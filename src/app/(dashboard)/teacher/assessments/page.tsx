import { Suspense } from "react";
import { getCombinedAssessmentsData } from "@/lib/data/teacher";
import AssessmentsPage from "./assessments-page";
import { Skeleton } from "@/components/ui/skeleton";

function AssessmentsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
      </div>
      <Skeleton className="h-12 w-[600px]" />
      <Skeleton className="h-24" />
      <Skeleton className="h-96" />
    </div>
  );
}

async function AssessmentsPageWrapper() {
  const data = await getCombinedAssessmentsData();
  return <AssessmentsPage initialData={data} />;
}

export default function Page() {
  return (
    <Suspense fallback={<AssessmentsLoading />}>
      <AssessmentsPageWrapper />
    </Suspense>
  );
}

import { Suspense } from "react";
import { getParentFeesData } from "@/lib/data/parent";
import FeesContent from "./fees-content";
import { Skeleton } from "@/components/ui/skeleton";

function FeesLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-48" />
      <Skeleton className="h-96" />
    </div>
  );
}

async function FeesPage() {
  const data = await getParentFeesData();
  return <FeesContent data={data} />;
}

export default function Page() {
  return (
    <Suspense fallback={<FeesLoading />}>
      <FeesPage />
    </Suspense>
  );
}

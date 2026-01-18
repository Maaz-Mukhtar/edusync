import { Suspense } from "react";
import { getTeacherOnlineTestsData } from "@/lib/data/teacher";
import OnlineTestsContent from "./online-tests-content";
import { Skeleton } from "@/components/ui/skeleton";

function OnlineTestsLoading() {
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

async function OnlineTestsPage() {
  const data = await getTeacherOnlineTestsData();
  return <OnlineTestsContent initialData={data} />;
}

export default function Page() {
  return (
    <Suspense fallback={<OnlineTestsLoading />}>
      <OnlineTestsPage />
    </Suspense>
  );
}

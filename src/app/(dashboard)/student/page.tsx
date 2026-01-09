import { Suspense } from "react";
import { getStudentDashboardData } from "@/lib/data/student";
import DashboardContent from "./dashboard-content";
import { Skeleton } from "@/components/ui/skeleton";

function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

async function StudentDashboard() {
  const data = await getStudentDashboardData();
  return <DashboardContent data={data} />;
}

export default function Page() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <StudentDashboard />
    </Suspense>
  );
}

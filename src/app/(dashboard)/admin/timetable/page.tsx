import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getAdminTimetableBootstrapData } from "@/lib/data/admin-timetable";
import AdminTimetableContent from "./timetable-content";

function Loading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <Skeleton className="h-24" />
      <Skeleton className="h-96" />
    </div>
  );
}

async function TimetablePage() {
  const data = await getAdminTimetableBootstrapData();
  return <AdminTimetableContent data={data} />;
}

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <TimetablePage />
    </Suspense>
  );
}


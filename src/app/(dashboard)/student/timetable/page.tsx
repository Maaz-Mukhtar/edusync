import { Suspense } from "react";
import { getStudentTimetableData } from "@/lib/data/student";
import TimetableContent from "./timetable-content";
import { Skeleton } from "@/components/ui/skeleton";

function TimetableLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <Skeleton className="h-96" />
      <Skeleton className="h-64" />
    </div>
  );
}

async function TimetablePage() {
  const data = await getStudentTimetableData();
  return <TimetableContent data={data} />;
}

export default function Page() {
  return (
    <Suspense fallback={<TimetableLoading />}>
      <TimetablePage />
    </Suspense>
  );
}

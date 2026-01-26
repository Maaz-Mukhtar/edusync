import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getTeacherTimetableData } from "@/lib/data/teacher";
import TeacherTimetableContent from "./timetable-content";

function Loading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}

async function TimetablePage() {
  const data = await getTeacherTimetableData();
  return <TeacherTimetableContent data={data} />;
}

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <TimetablePage />
    </Suspense>
  );
}


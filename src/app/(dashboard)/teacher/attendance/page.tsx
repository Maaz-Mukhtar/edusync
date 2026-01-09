import { Suspense } from "react";
import { getTeacherAttendanceData } from "@/lib/data/teacher";
import AttendanceContent from "./attendance-content";
import { Skeleton } from "@/components/ui/skeleton";

function AttendanceLoading() {
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

async function AttendancePage() {
  const data = await getTeacherAttendanceData();
  return <AttendanceContent initialData={data} />;
}

export default function Page() {
  return (
    <Suspense fallback={<AttendanceLoading />}>
      <AttendancePage />
    </Suspense>
  );
}

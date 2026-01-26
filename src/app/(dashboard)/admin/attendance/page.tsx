import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getAdminAttendanceData } from "@/lib/data/admin-attendance";
import AdminAttendanceContent from "./attendance-content";

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
  const data = await getAdminAttendanceData();
  return <AdminAttendanceContent initialData={data} />;
}

export default function Page() {
  return (
    <Suspense fallback={<AttendanceLoading />}>
      <AttendancePage />
    </Suspense>
  );
}


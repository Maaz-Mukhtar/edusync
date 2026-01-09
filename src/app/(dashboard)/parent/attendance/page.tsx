import { Suspense } from "react";
import { getChildAttendanceData, getParentChildren } from "@/lib/data/parent";
import AttendanceContent from "./attendance-content";
import { Skeleton } from "@/components/ui/skeleton";
import { redirect } from "next/navigation";

function AttendanceLoading() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <Skeleton className="h-10 w-[250px]" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-48" />
      <Skeleton className="h-96" />
    </div>
  );
}

interface PageProps {
  searchParams: Promise<{ child?: string }>;
}

async function AttendancePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const children = await getParentChildren();

  if (children.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground">No children found</p>
      </div>
    );
  }

  // Use child from URL or default to first child
  const selectedChildId = params.child || children[0].studentId;

  // Verify the selected child belongs to this parent
  const validChild = children.find((c) => c.studentId === selectedChildId);
  if (!validChild) {
    redirect(`/parent/attendance?child=${children[0].studentId}`);
  }

  const data = await getChildAttendanceData(selectedChildId);

  return (
    <AttendanceContent
      data={data}
      children={children}
      selectedChildId={selectedChildId}
    />
  );
}

export default function Page(props: PageProps) {
  return (
    <Suspense fallback={<AttendanceLoading />}>
      <AttendancePage {...props} />
    </Suspense>
  );
}

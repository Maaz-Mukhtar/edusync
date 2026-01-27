import { Suspense } from "react";
import { getParentChildren } from "@/lib/data/parent";
import { redirect } from "next/navigation";
import ParentAnalyticsContent from "./parent-analytics-content";
import { Skeleton } from "@/components/ui/skeleton";

function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <Skeleton className="h-10 w-[250px]" />
      </div>
      <Skeleton className="h-24" />
      <Skeleton className="h-64" />
    </div>
  );
}

interface PageProps {
  searchParams: Promise<{ child?: string }>;
}

async function ParentAnalyticsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const children = await getParentChildren();

  if (children.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground">No children found</p>
      </div>
    );
  }

  const selectedChildId = params.child || children[0].studentId;
  const validChild = children.find((c) => c.studentId === selectedChildId);
  if (!validChild) {
    redirect(`/parent/analytics?child=${children[0].studentId}`);
  }

  return <ParentAnalyticsContent childList={children} selectedChildId={selectedChildId} />;
}

export default function Page(props: PageProps) {
  return (
    <Suspense fallback={<Loading />}>
      <ParentAnalyticsPage {...props} />
    </Suspense>
  );
}


import { Suspense } from "react";
import { getChildGradesData, getParentChildren } from "@/lib/data/parent";
import GradesContent from "./grades-content";
import { Skeleton } from "@/components/ui/skeleton";
import { redirect } from "next/navigation";

function GradesLoading() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <Skeleton className="h-10 w-[250px]" />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-64" />
      <Skeleton className="h-96" />
    </div>
  );
}

interface PageProps {
  searchParams: Promise<{ child?: string }>;
}

async function GradesPage({ searchParams }: PageProps) {
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
    redirect(`/parent/grades?child=${children[0].studentId}`);
  }

  const data = await getChildGradesData(selectedChildId);

  return (
    <GradesContent
      data={data}
      children={children}
      selectedChildId={selectedChildId}
    />
  );
}

export default function Page(props: PageProps) {
  return (
    <Suspense fallback={<GradesLoading />}>
      <GradesPage {...props} />
    </Suspense>
  );
}

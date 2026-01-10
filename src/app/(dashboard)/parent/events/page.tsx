import { Suspense } from "react";
import { getParentEventsData } from "@/lib/data/events";
import EventsContent from "./events-content";
import { Skeleton } from "@/components/ui/skeleton";

function EventsLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-12 w-full" />
      <div className="space-y-4">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    </div>
  );
}

async function EventsPage() {
  const data = await getParentEventsData();
  return <EventsContent data={data} />;
}

export default function Page() {
  return (
    <Suspense fallback={<EventsLoading />}>
      <EventsPage />
    </Suspense>
  );
}

import { Suspense } from "react";
import { getAdminEventsData, getSchoolClasses } from "@/lib/data/admin-events";
import EventsContent from "./events-content";
import { Skeleton } from "@/components/ui/skeleton";

function EventsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}

async function EventsPage() {
  const [data, classes] = await Promise.all([
    getAdminEventsData(),
    getSchoolClasses(),
  ]);
  return <EventsContent data={data} classes={classes} />;
}

export default function Page() {
  return (
    <Suspense fallback={<EventsLoading />}>
      <EventsPage />
    </Suspense>
  );
}

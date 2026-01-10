import { Suspense } from "react";
import { getTeacherConversations, getTeacherStudentsForMessaging } from "@/lib/data/messages";
import MessagesContent from "./messages-content";
import { Skeleton } from "@/components/ui/skeleton";

function MessagesLoading() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-1">
          <Skeleton className="h-[600px]" />
        </div>
        <div className="md:col-span-2">
          <Skeleton className="h-[600px]" />
        </div>
      </div>
    </div>
  );
}

async function MessagesPage() {
  const [conversations, studentsForMessaging] = await Promise.all([
    getTeacherConversations(),
    getTeacherStudentsForMessaging(),
  ]);
  return <MessagesContent conversations={conversations} studentsForMessaging={studentsForMessaging} />;
}

export default function Page() {
  return (
    <Suspense fallback={<MessagesLoading />}>
      <MessagesPage />
    </Suspense>
  );
}

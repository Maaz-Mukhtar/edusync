import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getRoleDashboardPath } from "@/lib/utils";

export default async function HomePage() {
  const session = await auth();

  if (session?.user) {
    redirect(getRoleDashboardPath(session.user.role));
  }

  redirect("/login");
}

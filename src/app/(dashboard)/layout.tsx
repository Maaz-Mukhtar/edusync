import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { DashboardLayout } from "@/components/layout/dashboard-layout";

export default async function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Fetch school name for the layout
  const school = await prisma.school.findUnique({
    where: { id: session.user.schoolId },
    select: { name: true },
  });

  // Fetch user details
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      firstName: true,
      lastName: true,
      email: true,
      avatar: true,
      role: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <DashboardLayout
      user={{
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        image: user.avatar,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
      }}
      schoolName={school?.name}
    >
      {children}
    </DashboardLayout>
  );
}

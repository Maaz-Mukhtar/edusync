import { getTeacherDashboardData } from "@/lib/data/teacher";
import { TeacherDashboardContent } from "./dashboard-content";

export default async function TeacherDashboard() {
  const data = await getTeacherDashboardData();

  return <TeacherDashboardContent data={data} />;
}

import { getTeacherClassesData } from "@/lib/data/teacher";
import { TeacherClassesContent } from "./classes-content";

export default async function TeacherClassesPage() {
  const data = await getTeacherClassesData();

  return <TeacherClassesContent data={data} />;
}

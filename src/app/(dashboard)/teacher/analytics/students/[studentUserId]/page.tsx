import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function TeacherStudentAnalyticsPage({
  params,
}: {
  params: Promise<{ studentUserId: string }>;
}) {
  const { studentUserId } = await params;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Student Analytics</h1>
        <p className="text-muted-foreground">Detailed student analytics (drilldown) is coming soon.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Student</CardTitle>
          <CardDescription>Student user id: {studentUserId}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            For now, use the Section Detail view to compare student averages.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


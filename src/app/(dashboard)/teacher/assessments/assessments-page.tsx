"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Globe, Upload } from "lucide-react";
import type { CombinedAssessmentsData } from "@/lib/data/teacher";
import AssessmentsTab from "./components/tabs/assessments-tab";
import OnlineTestsTab from "./components/tabs/online-tests-tab";
import FileUploadsTab from "./components/tabs/file-uploads-tab";

interface AssessmentsPageProps {
  initialData: CombinedAssessmentsData;
}

export default function AssessmentsPage({ initialData }: AssessmentsPageProps) {
  const [activeTab, setActiveTab] = useState("assessments");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Assessments</h1>
        <p className="text-muted-foreground">
          Create, manage, and deliver tests, quizzes, and assignments
        </p>
      </div>

      {/* Tabbed Interface */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 lg:w-[600px]">
          <TabsTrigger value="assessments" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Assessments</span>
          </TabsTrigger>
          <TabsTrigger value="online-tests" className="gap-2">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">Online Tests</span>
          </TabsTrigger>
          <TabsTrigger value="file-uploads" className="gap-2">
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Upload Files</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assessments" className="space-y-4">
          <AssessmentsTab initialData={initialData.assessments} />
        </TabsContent>

        <TabsContent value="online-tests" className="space-y-4">
          <OnlineTestsTab initialData={initialData.onlineTests} />
        </TabsContent>

        <TabsContent value="file-uploads" className="space-y-4">
          <FileUploadsTab assessments={initialData.assessments.assessments} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

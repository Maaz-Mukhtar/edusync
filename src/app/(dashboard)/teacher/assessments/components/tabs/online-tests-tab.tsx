"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import {
  FileText,
  Plus,
  Clock,
  Users,
  MoreHorizontal,
  Eye,
  Trash2,
  AlertCircle,
  CheckCircle,
  Edit,
  FileDown,
  Play,
  Lock,
  HelpCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  OnlineTestsData,
  OnlineTestItem,
  OnlineTestStatus,
} from "@/lib/data/teacher";

const statusColors: Record<OnlineTestStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  PUBLISHED: "bg-green-100 text-green-800",
  CLOSED: "bg-red-100 text-red-800",
};

const statusIcons: Record<OnlineTestStatus, React.ReactNode> = {
  DRAFT: <Edit className="h-3 w-3" />,
  PUBLISHED: <Play className="h-3 w-3" />,
  CLOSED: <Lock className="h-3 w-3" />,
};

interface OnlineTestsTabProps {
  initialData: OnlineTestsData;
}

export default function OnlineTestsTab({ initialData }: OnlineTestsTabProps) {
  const router = useRouter();
  const [onlineTests, setOnlineTests] = useState<OnlineTestItem[]>(initialData.onlineTests);
  const [assessmentsWithoutTests] = useState(initialData.assessmentsWithoutTests);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Filter states
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSection, setFilterSection] = useState<string>("all");

  // Form states for creating from existing assessment
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>("");
  const [formData, setFormData] = useState({
    timeLimitMins: 60,
    instructions: "",
    shuffleQuestions: false,
    showResults: true,
    passingScore: 40,
  });

  const refreshOnlineTests = useCallback(async () => {
    try {
      let url = "/api/teacher/online-tests";
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.append("status", filterStatus);
      if (filterSection !== "all") params.append("sectionId", filterSection);
      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        setOnlineTests(data.onlineTests);
      }
    } catch (error) {
      console.error("Failed to refresh:", error);
    }
  }, [filterStatus, filterSection]);

  // Filter online tests client-side
  const filteredTests = onlineTests.filter((t) => {
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterSection !== "all" && t.section.id !== filterSection) return false;
    return true;
  });

  const handleCreate = async () => {
    if (!selectedAssessmentId) {
      setError("Please select an assessment");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/teacher/online-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentId: selectedAssessmentId,
          ...formData,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setSuccess("Online test created successfully");
        setDialogOpen(false);
        setSelectedAssessmentId("");
        setFormData({
          timeLimitMins: 60,
          instructions: "",
          shuffleQuestions: false,
          showResults: true,
          passingScore: 40,
        });
        router.push(`/teacher/online-tests/${result.onlineTest.id}`);
      } else {
        const result = await response.json();
        setError(result.error || "Failed to create online test");
      }
    } catch (error) {
      console.error("Failed to create:", error);
      setError("Failed to create online test");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this online test?")) return;

    try {
      const response = await fetch(`/api/teacher/online-tests/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setSuccess("Online test deleted");
        refreshOnlineTests();
        router.refresh();
      } else {
        const result = await response.json();
        setError(result.error || "Failed to delete online test");
      }
    } catch (error) {
      console.error("Failed to delete:", error);
      setError("Failed to delete online test");
    }
  };

  const handlePublish = async (id: string) => {
    try {
      const response = await fetch(`/api/teacher/online-tests/${id}/publish`, {
        method: "POST",
      });

      if (response.ok) {
        setSuccess("Test published successfully");
        refreshOnlineTests();
        router.refresh();
      } else {
        const result = await response.json();
        setError(result.error || "Failed to publish test");
      }
    } catch (error) {
      console.error("Failed to publish:", error);
      setError("Failed to publish test");
    }
  };

  const handleClose = async (id: string) => {
    if (!confirm("Are you sure you want to close this test? Students won't be able to take it anymore.")) return;

    try {
      const response = await fetch(`/api/teacher/online-tests/${id}/close`, {
        method: "POST",
      });

      if (response.ok) {
        setSuccess("Test closed successfully");
        refreshOnlineTests();
        router.refresh();
      } else {
        const result = await response.json();
        setError(result.error || "Failed to close test");
      }
    } catch (error) {
      console.error("Failed to close:", error);
      setError("Failed to close test");
    }
  };

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Convert assessments to interactive online tests for students
        </p>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={assessmentsWithoutTests.length === 0}>
              <Plus className="h-4 w-4 mr-2" />
              New Online Test
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[550px]">
            <DialogHeader>
              <DialogTitle>Create Online Test</DialogTitle>
              <DialogDescription>
                Create an online test from an existing assessment
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Select Assessment *</Label>
                <Select
                  value={selectedAssessmentId}
                  onValueChange={setSelectedAssessmentId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an assessment" />
                  </SelectTrigger>
                  <SelectContent>
                    {assessmentsWithoutTests.map((assessment) => (
                      <SelectItem key={assessment.id} value={assessment.id}>
                        {assessment.title} - {assessment.section.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {assessmentsWithoutTests.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No assessments available. Create an assessment first.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Time Limit (minutes)</Label>
                  <Input
                    type="number"
                    value={formData.timeLimitMins}
                    onChange={(e) => setFormData({ ...formData, timeLimitMins: parseInt(e.target.value) || 0 })}
                    min={1}
                    max={300}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Passing Score (%)</Label>
                  <Input
                    type="number"
                    value={formData.passingScore}
                    onChange={(e) => setFormData({ ...formData, passingScore: parseInt(e.target.value) || 0 })}
                    min={0}
                    max={100}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Instructions (Optional)</Label>
                <Textarea
                  value={formData.instructions}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, instructions: e.target.value })}
                  placeholder="Add any instructions for students..."
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Shuffle Questions</Label>
                  <p className="text-sm text-muted-foreground">
                    Randomize question order for each student
                  </p>
                </div>
                <Switch
                  checked={formData.shuffleQuestions}
                  onCheckedChange={(checked) => setFormData({ ...formData, shuffleQuestions: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Show Results</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow students to see their results after submission
                  </p>
                </div>
                <Switch
                  checked={formData.showResults}
                  onCheckedChange={(checked) => setFormData({ ...formData, showResults: checked })}
                />
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={creating || !selectedAssessmentId}>
                {creating ? "Creating..." : "Create Online Test"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Alerts */}
      {success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {error && !dialogOpen && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Draft Tests</CardTitle>
            <Edit className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {onlineTests.filter((t) => t.status === "DRAFT").length}
            </div>
            <p className="text-xs text-muted-foreground">
              Pending questions or publication
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Tests</CardTitle>
            <Play className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {onlineTests.filter((t) => t.status === "PUBLISHED").length}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently available to students
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Attempts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {onlineTests.reduce((sum, t) => sum + t.attemptCount, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Across all tests
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Filter by Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="PUBLISHED">Published</SelectItem>
                  <SelectItem value="CLOSED">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Filter by Section</Label>
              <Select value={filterSection} onValueChange={setFilterSection}>
                <SelectTrigger>
                  <SelectValue placeholder="All sections" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sections</SelectItem>
                  {initialData.sections.map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.className} - {section.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Online Tests Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Online Tests</CardTitle>
          <CardDescription>
            {filteredTests.length} test{filteredTests.length !== 1 ? "s" : ""} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredTests.length === 0 ? (
            <div className="text-center py-12">
              <HelpCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">No Online Tests</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {assessmentsWithoutTests.length > 0
                  ? "Create your first online test from an existing assessment"
                  : "Create an assessment first, then convert it to an online test"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Test</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Questions</TableHead>
                  <TableHead className="text-center">Time</TableHead>
                  <TableHead className="text-center">Attempts</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTests.map((test) => (
                  <TableRow key={test.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/teacher/online-tests/${test.id}`}
                        className="hover:underline"
                      >
                        {test.assessment.title}
                      </Link>
                    </TableCell>
                    <TableCell>{test.section.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: test.subject.color || "#888" }}
                        />
                        {test.subject.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={statusColors[test.status]} variant="secondary">
                        <span className="mr-1">{statusIcons[test.status]}</span>
                        {test.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>{test.questionCount}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {test.timeLimitMins ? (
                        <div className="flex items-center justify-center gap-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>{test.timeLimitMins}m</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{test.attemptCount}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/teacher/online-tests/${test.id}`}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Test
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/teacher/online-tests/${test.id}/preview`}>
                              <Eye className="h-4 w-4 mr-2" />
                              Preview
                            </Link>
                          </DropdownMenuItem>
                          {test.status === "DRAFT" && test.questionCount > 0 && (
                            <DropdownMenuItem onClick={() => handlePublish(test.id)}>
                              <Play className="h-4 w-4 mr-2" />
                              Publish
                            </DropdownMenuItem>
                          )}
                          {test.status === "PUBLISHED" && (
                            <DropdownMenuItem onClick={() => handleClose(test.id)}>
                              <Lock className="h-4 w-4 mr-2" />
                              Close Test
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {test.attemptCount > 0 && (
                            <DropdownMenuItem asChild>
                              <Link href={`/teacher/online-tests/${test.id}/attempts`}>
                                <Users className="h-4 w-4 mr-2" />
                                View Attempts
                              </Link>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem asChild>
                            <Link href={`/teacher/online-tests/${test.id}/export`}>
                              <FileDown className="h-4 w-4 mr-2" />
                              Export / Print
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {test.attemptCount === 0 && (
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleDelete(test.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

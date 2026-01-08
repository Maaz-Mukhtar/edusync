"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  Info,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Section {
  id: string;
  name: string;
}

interface ImportError {
  row: number;
  email: string;
  error: string;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: ImportError[];
}

interface ParsedUser {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: string;
  sectionId?: string;
  rollNumber?: string;
  dateOfBirth?: string;
  employeeId?: string;
  qualification?: string;
  occupation?: string;
  relationship?: string;
}

export default function ImportUsersPage() {
  const [sections, setSections] = useState<Section[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [parsedUsers, setParsedUsers] = useState<ParsedUser[]>([]);
  const [defaultPassword, setDefaultPassword] = useState("Welcome@123");
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchTemplateInfo = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/users/import");
      const data = await response.json();

      if (response.ok) {
        setSections(data.template.sections);
      }
    } catch {
      toast.error("Failed to fetch template info");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplateInfo();
  }, [fetchTemplateInfo]);

  const parseCSV = (text: string): ParsedUser[] => {
    const lines = text.split("\n").filter((line) => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const users: ParsedUser[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim());
      const user: Record<string, string> = {};

      headers.forEach((header, index) => {
        if (values[index]) {
          // Map common header variations
          const normalizedHeader = header
            .replace(/first\s*name/i, "firstName")
            .replace(/last\s*name/i, "lastName")
            .replace(/date\s*of\s*birth/i, "dateOfBirth")
            .replace(/roll\s*number/i, "rollNumber")
            .replace(/section\s*id/i, "sectionId")
            .replace(/employee\s*id/i, "employeeId");
          user[normalizedHeader] = values[index];
        }
      });

      if (user.firstName && user.lastName && user.email && user.role) {
        users.push(user as unknown as ParsedUser);
      }
    }

    return users;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast.error("Please upload a CSV file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const users = parseCSV(text);

      if (users.length === 0) {
        toast.error("No valid users found in the CSV file");
        return;
      }

      setParsedUsers(users);
      setImportResult(null);
      toast.success(`Found ${users.length} users in the file`);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (parsedUsers.length === 0) {
      toast.error("No users to import");
      return;
    }

    setIsImporting(true);
    try {
      const response = await fetch("/api/users/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          users: parsedUsers,
          defaultPassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setImportResult(data.result);
        if (data.result.success > 0) {
          toast.success(`Successfully imported ${data.result.success} users`);
        }
        if (data.result.failed > 0) {
          toast.error(`Failed to import ${data.result.failed} users`);
        }
      } else {
        toast.error(data.error || "Failed to import users");
      }
    } catch {
      toast.error("Failed to import users");
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = () => {
    const headers = [
      "firstName",
      "lastName",
      "email",
      "phone",
      "role",
      "sectionId",
      "rollNumber",
      "dateOfBirth",
      "employeeId",
      "qualification",
      "occupation",
      "relationship",
    ];

    const sampleData = [
      [
        "John",
        "Doe",
        "john.doe@example.com",
        "03001234567",
        "STUDENT",
        sections[0]?.id || "section-id-here",
        "001",
        "2010-05-15",
        "",
        "",
        "",
        "",
      ],
      [
        "Jane",
        "Smith",
        "jane.smith@example.com",
        "03009876543",
        "TEACHER",
        "",
        "",
        "",
        "EMP001",
        "M.Sc Mathematics",
        "",
        "",
      ],
      [
        "Ali",
        "Khan",
        "ali.khan@example.com",
        "03005551234",
        "PARENT",
        "",
        "",
        "",
        "",
        "",
        "Engineer",
        "Father",
      ],
    ];

    const csvContent = [
      headers.join(","),
      ...sampleData.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "users_import_template.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const clearImport = () => {
    setParsedUsers([]);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/users">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Import Users</h1>
          <p className="text-muted-foreground">
            Bulk import users from a CSV file
          </p>
        </div>
      </div>

      {/* Instructions */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Import Instructions</AlertTitle>
        <AlertDescription>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>Download the template CSV file to see the required format</li>
            <li>Role must be one of: ADMIN, TEACHER, STUDENT, PARENT</li>
            <li>Students require a valid sectionId</li>
            <li>Maximum 500 users can be imported at once</li>
            <li>All users will receive the default password</li>
          </ul>
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle>Upload CSV File</CardTitle>
            <CardDescription>
              Select a CSV file containing user data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="csvFile">CSV File</Label>
              <Input
                id="csvFile"
                type="file"
                accept=".csv"
                ref={fileInputRef}
                onChange={handleFileChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultPassword">Default Password</Label>
              <Input
                id="defaultPassword"
                type="text"
                value={defaultPassword}
                onChange={(e) => setDefaultPassword(e.target.value)}
                placeholder="Default password for all users"
              />
              <p className="text-xs text-muted-foreground">
                All imported users will receive this password
              </p>
            </div>
            <Button variant="outline" onClick={downloadTemplate} className="w-full">
              <Download className="mr-2 h-4 w-4" />
              Download Template
            </Button>
          </CardContent>
        </Card>

        {/* Section Reference */}
        <Card>
          <CardHeader>
            <CardTitle>Section IDs Reference</CardTitle>
            <CardDescription>
              Use these IDs for student imports
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sections.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No sections found. Create classes and sections first.
              </p>
            ) : (
              <div className="max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Section</TableHead>
                      <TableHead>ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sections.map((section) => (
                      <TableRow key={section.id}>
                        <TableCell>{section.name}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-1 py-0.5 rounded">
                            {section.id}
                          </code>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Preview */}
      {parsedUsers.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Preview ({parsedUsers.length} users)</CardTitle>
                <CardDescription>
                  Review the data before importing
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={clearImport}>
                  Clear
                </Button>
                <Button onClick={handleImport} disabled={isImporting}>
                  {isImporting ? (
                    "Importing..."
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Import Users
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Section/Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedUsers.slice(0, 50).map((user, index) => (
                    <TableRow key={index}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>
                        {user.firstName} {user.lastName}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{user.role}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.role === "STUDENT" && user.sectionId && (
                          <span>Section: {user.sectionId.slice(0, 8)}...</span>
                        )}
                        {user.role === "TEACHER" && user.employeeId && (
                          <span>ID: {user.employeeId}</span>
                        )}
                        {user.role === "PARENT" && user.relationship && (
                          <span>{user.relationship}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {parsedUsers.length > 50 && (
                <p className="text-sm text-muted-foreground text-center mt-4">
                  Showing first 50 of {parsedUsers.length} users
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import Result */}
      {importResult && (
        <Card>
          <CardHeader>
            <CardTitle>Import Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="font-medium">{importResult.success} Succeeded</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <span className="font-medium">{importResult.failed} Failed</span>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Errors:</h4>
                <div className="max-h-48 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importResult.errors.map((error, index) => (
                        <TableRow key={index}>
                          <TableCell>{error.row}</TableCell>
                          <TableCell>{error.email}</TableCell>
                          <TableCell className="text-red-600">
                            {error.error}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <Button asChild>
              <Link href="/admin/users">
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                View All Users
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

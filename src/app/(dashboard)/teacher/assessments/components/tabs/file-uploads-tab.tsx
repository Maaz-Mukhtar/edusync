"use client";

import { useState, useCallback, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FileText,
  Image as ImageIcon,
  File,
  Trash2,
  Download,
  AlertCircle,
  CheckCircle,
  X,
  Loader2,
} from "lucide-react";
import type { AssessmentItem } from "@/lib/data/teacher";

interface AssessmentFile {
  id: string;
  fileName: string;
  originalName: string;
  fileType: "PDF" | "IMAGE" | "DOCUMENT";
  fileSize: number;
  uploadedAt: string;
}

interface FileUploadsTabProps {
  assessments: AssessmentItem[];
}

const fileTypeIcons: Record<string, React.ReactNode> = {
  PDF: <FileText className="h-4 w-4 text-red-500" />,
  IMAGE: <ImageIcon className="h-4 w-4 text-blue-500" />,
  DOCUMENT: <File className="h-4 w-4 text-blue-700" />,
};

const fileTypeColors: Record<string, string> = {
  PDF: "bg-red-100 text-red-800",
  IMAGE: "bg-blue-100 text-blue-800",
  DOCUMENT: "bg-purple-100 text-purple-800",
};

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export default function FileUploadsTab({ assessments }: FileUploadsTabProps) {
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>("");
  const [files, setFiles] = useState<AssessmentFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = useCallback(async (assessmentId: string) => {
    if (!assessmentId) {
      setFiles([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/teacher/assessments/${assessmentId}/files`);
      if (response.ok) {
        const data = await response.json();
        setFiles(data.files || []);
      } else {
        setError("Failed to load files");
      }
    } catch (error) {
      console.error("Failed to fetch files:", error);
      setError("Failed to load files");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAssessmentChange = (assessmentId: string) => {
    setSelectedAssessmentId(assessmentId);
    setError(null);
    setSuccess(null);
    fetchFiles(assessmentId);
  };

  const handleUpload = async (filesToUpload: FileList | null) => {
    if (!filesToUpload || filesToUpload.length === 0) return;
    if (!selectedAssessmentId) {
      setError("Please select an assessment first");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      for (let i = 0; i < filesToUpload.length; i++) {
        formData.append("files", filesToUpload[i]);
      }

      const response = await fetch(`/api/teacher/assessments/${selectedAssessmentId}/files`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setSuccess(`${data.files.length} file(s) uploaded successfully`);
        fetchFiles(selectedAssessmentId);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } else {
        const result = await response.json();
        setError(result.error || "Failed to upload files");
      }
    } catch (error) {
      console.error("Failed to upload:", error);
      setError("Failed to upload files");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (fileId: string, fileName: string) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"?`)) return;

    try {
      const response = await fetch(`/api/teacher/assessments/${selectedAssessmentId}/files/${fileId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setSuccess("File deleted");
        setFiles(files.filter((f) => f.id !== fileId));
      } else {
        setError("Failed to delete file");
      }
    } catch (error) {
      console.error("Failed to delete:", error);
      setError("Failed to delete file");
    }
  };

  const handleDownload = (fileId: string) => {
    window.open(`/api/teacher/assessments/${selectedAssessmentId}/files/${fileId}`, "_blank");
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  };

  const selectedAssessment = assessments.find((a) => a.id === selectedAssessmentId);

  return (
    <div className="space-y-4">
      {/* Description */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Upload PDFs, images, or Word documents to your assessments
        </p>
      </div>

      {/* Alerts */}
      {success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Assessment Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Assessment</CardTitle>
          <CardDescription>
            Choose an assessment to view or upload files
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Assessment</Label>
            <Select value={selectedAssessmentId} onValueChange={handleAssessmentChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select an assessment" />
              </SelectTrigger>
              <SelectContent>
                {assessments.map((assessment) => (
                  <SelectItem key={assessment.id} value={assessment.id}>
                    {assessment.title} - {assessment.section.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Upload Area */}
      {selectedAssessmentId && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Files</CardTitle>
            <CardDescription>
              Drag and drop files or click to browse (PDF, JPG, PNG, DOC, DOCX - Max 10MB each)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-gray-300 hover:border-gray-400"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx"
                multiple
                onChange={(e) => handleUpload(e.target.files)}
              />

              {uploading ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
                  <p className="text-sm text-muted-foreground">Uploading files...</p>
                </div>
              ) : (
                <>
                  <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm font-medium mb-2">
                    Drag and drop files here, or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Supported formats: PDF, JPG, PNG, GIF, WebP, DOC, DOCX
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Browse Files
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Files List */}
      {selectedAssessmentId && (
        <Card>
          <CardHeader>
            <CardTitle>Uploaded Files</CardTitle>
            <CardDescription>
              {loading
                ? "Loading files..."
                : `${files.length} file(s) for ${selectedAssessment?.title || "this assessment"}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : files.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium">No Files</h3>
                <p className="text-sm text-muted-foreground">
                  Upload files for this assessment
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead className="text-center">Type</TableHead>
                    <TableHead className="text-center">Size</TableHead>
                    <TableHead className="text-center">Uploaded</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {files.map((file) => (
                    <TableRow key={file.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {fileTypeIcons[file.fileType]}
                          <span className="font-medium truncate max-w-[200px]">
                            {file.originalName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={fileTypeColors[file.fileType]} variant="secondary">
                          {file.fileType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {formatFileSize(file.fileSize)}
                      </TableCell>
                      <TableCell className="text-center">
                        {new Date(file.uploadedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDownload(file.id)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500 hover:text-red-600"
                            onClick={() => handleDelete(file.id, file.originalName)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Instructions when no assessment selected */}
      {!selectedAssessmentId && (
        <Card>
          <CardContent className="py-12 text-center">
            <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">Select an Assessment</h3>
            <p className="text-sm text-muted-foreground">
              Choose an assessment above to view or upload files
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

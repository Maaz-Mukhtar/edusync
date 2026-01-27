"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Pencil, Plus, Archive, Undo2 } from "lucide-react";
import { normalizeTopicName } from "@/lib/topics/normalize";

type Topic = {
  id: string;
  name: string;
  nameNormalized: string;
  parentTopicId: string | null;
  source: "ADMIN" | "TEACHER";
  status: "ACTIVE" | "ARCHIVED";
  createdByTeacherId: string | null;
  createdAt: string;
  updatedAt: string;
};

type TopicsResponse = {
  topics: Topic[];
  me: { teacherProfileId: string | null };
};

export function SubjectTopicsDialog({
  open,
  onOpenChange,
  subjectId,
  mode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectId: string;
  mode: "admin" | "teacher";
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [meTeacherProfileId, setMeTeacherProfileId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [editing, setEditing] = useState<Topic | null>(null);

  const visibleTopics = useMemo(() => {
    const active = topics.filter((t) => t.status === "ACTIVE");
    const archived = topics.filter((t) => t.status === "ARCHIVED");
    return { active, archived };
  }, [topics]);

  const canEditTopic = useCallback(
    (topic: Topic) => {
      if (mode === "admin") return topic.source === "ADMIN";
      // teacher
      return topic.source === "TEACHER" && topic.createdByTeacherId && topic.createdByTeacherId === meTeacherProfileId;
    },
    [mode, meTeacherProfileId]
  );

  const fetchTopics = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/subjects/${subjectId}/topics`);
      const json = (await res.json()) as TopicsResponse;
      if (!res.ok) {
        const errorMessage = "error" in json && typeof json.error === "string" ? json.error : "Failed to load topics";
        throw new Error(errorMessage);
      }
      setTopics(json.topics ?? []);
      setMeTeacherProfileId(json.me?.teacherProfileId ?? null);
    } catch (e) {
      toast.error((e as Error).message);
      setTopics([]);
      setMeTeacherProfileId(null);
    } finally {
      setLoading(false);
    }
  }, [open, subjectId]);

  useEffect(() => {
    void fetchTopics();
  }, [fetchTopics]);

  const resetForm = () => {
    setName("");
    setEditing(null);
  };

  const saveTopic = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const normalized = normalizeTopicName(trimmed);
    const exists = topics.some((t) => t.nameNormalized === normalized);
    if (!editing && exists) {
      toast.error("Topic already exists");
      return;
    }

    setSaving(true);
    try {
      if (!editing) {
        const res = await fetch(`/api/subjects/${subjectId}/topics`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to create topic");
        toast.success("Topic created");
      } else {
        const res = await fetch(`/api/subjects/${subjectId}/topics/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to update topic");
        toast.success("Topic updated");
      }
      resetForm();
      await fetchTopics();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const toggleArchive = async (topic: Topic) => {
    if (!canEditTopic(topic)) return;
    setSaving(true);
    try {
      const nextStatus = topic.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE";
      const res = await fetch(`/api/subjects/${subjectId}/topics/${topic.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update topic");
      toast.success(nextStatus === "ARCHIVED" ? "Topic archived" : "Topic restored");
      await fetchTopics();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const beginEdit = (topic: Topic) => {
    if (!canEditTopic(topic)) return;
    setEditing(topic);
    setName(topic.name);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetForm();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Topics</DialogTitle>
          <DialogDescription>
            {mode === "admin"
              ? "Manage baseline topics for this subject."
              : "Use admin topics or create your own teacher topics for this subject."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[240px]">
            <div className="text-sm font-medium mb-1">{editing ? "Edit topic" : "New topic"}</div>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fractions" />
          </div>
          <Button onClick={saveTopic} disabled={saving || loading || !name.trim()}>
            <Plus className="h-4 w-4 mr-2" />
            {editing ? "Save" : "Add"}
          </Button>
          {editing ? (
            <Button variant="outline" onClick={resetForm} disabled={saving || loading}>
              Cancel
            </Button>
          ) : null}
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Loading topics…</div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[160px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleTopics.active.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-sm text-muted-foreground">
                        No topics yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    visibleTopics.active.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell>
                          <Badge variant={t.source === "ADMIN" ? "default" : "secondary"}>{t.source}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{t.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => beginEdit(t)}
                              disabled={!canEditTopic(t) || saving}
                              title={!canEditTopic(t) ? "You can only edit your own topics" : "Edit"}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toggleArchive(t)}
                              disabled={!canEditTopic(t) || saving}
                              title={!canEditTopic(t) ? "You can only archive your own topics" : "Archive"}
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {visibleTopics.archived.length > 0 ? (
              <div className="space-y-2">
                <div className="text-sm font-medium">Archived</div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead className="w-[160px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleTopics.archived.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-medium">{t.name}</TableCell>
                          <TableCell>
                            <Badge variant={t.source === "ADMIN" ? "default" : "secondary"}>{t.source}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toggleArchive(t)}
                              disabled={!canEditTopic(t) || saving}
                              title={!canEditTopic(t) ? "You can only restore your own topics" : "Restore"}
                            >
                              <Undo2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          Topics are de-duplicated by name (case/whitespace-insensitive) within a subject.
        </div>
      </DialogContent>
    </Dialog>
  );
}

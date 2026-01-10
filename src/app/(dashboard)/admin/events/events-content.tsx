"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Calendar,
  CalendarCheck,
  Plus,
  Pencil,
  Trash2,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  MapPin,
  DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import type { AdminEventsData, EventWithStats, EventFormData } from "@/lib/data/admin-events";
import { createEvent, updateEvent, deleteEvent } from "@/lib/data/admin-events";
import { EventType } from "@prisma/client";

interface EventsContentProps {
  data: AdminEventsData;
  classes: { id: string; name: string }[];
}

const eventTypeOptions: { value: EventType; label: string }[] = [
  { value: "TRIP", label: "Trip" },
  { value: "EVENT", label: "Event" },
  { value: "ACTIVITY", label: "Activity" },
  { value: "WORKSHOP", label: "Workshop" },
  { value: "COMPETITION", label: "Competition" },
];

const getEventTypeBadgeColor = (type: EventType) => {
  switch (type) {
    case "TRIP":
      return "bg-blue-100 text-blue-800";
    case "EVENT":
      return "bg-purple-100 text-purple-800";
    case "ACTIVITY":
      return "bg-green-100 text-green-800";
    case "WORKSHOP":
      return "bg-orange-100 text-orange-800";
    case "COMPETITION":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

export default function EventsContent({ data, classes }: EventsContentProps) {
  const { events, stats } = data;
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventWithStats | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<EventWithStats | null>(null);
  const [isPending, startTransition] = useTransition();

  const statCards = [
    {
      title: "Total Events",
      value: stats.total,
      icon: Calendar,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Upcoming",
      value: stats.upcoming,
      icon: CalendarCheck,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Past",
      value: stats.past,
      icon: Clock,
      color: "text-gray-600",
      bgColor: "bg-gray-100",
    },
    {
      title: "Pending Approvals",
      value: stats.pendingApprovals,
      icon: Users,
      color: "text-amber-600",
      bgColor: "bg-amber-100",
    },
  ];

  const handleDelete = async () => {
    if (!deletingEvent) return;

    startTransition(async () => {
      const result = await deleteEvent(deletingEvent.id);
      if (result.success) {
        setDeletingEvent(null);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Events Management</h1>
          <p className="text-muted-foreground">
            Create and manage school events, trips, and activities
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Event
            </Button>
          </DialogTrigger>
          <EventFormDialog
            classes={classes}
            onClose={() => setIsCreateOpen(false)}
          />
        </Dialog>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={cn("rounded-full p-2", stat.bgColor)}>
                <stat.icon className={cn("h-4 w-4", stat.color)} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Events Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Events</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No events created yet</p>
              <p className="text-sm">Create your first event to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Fee</TableHead>
                  <TableHead>Approvals</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => {
                  const isPast = new Date(event.startDate) < new Date();
                  return (
                    <TableRow key={event.id} className={isPast ? "opacity-60" : ""}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{event.title}</p>
                          {event.location && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {event.location}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("font-normal", getEventTypeBadgeColor(event.type))}>
                          {event.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(event.startDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {new Date(event.deadline).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {event.fee ? formatCurrency(event.fee) : "Free"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="h-3 w-3" />
                            {event.stats.approved}
                          </span>
                          <span className="flex items-center gap-1 text-amber-600">
                            <Clock className="h-3 w-3" />
                            {event.stats.pending}
                          </span>
                          <span className="flex items-center gap-1 text-red-600">
                            <XCircle className="h-3 w-3" />
                            {event.stats.declined}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingEvent(event)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingEvent(event)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {editingEvent && (
        <Dialog open={!!editingEvent} onOpenChange={() => setEditingEvent(null)}>
          <EventFormDialog
            event={editingEvent}
            classes={classes}
            onClose={() => setEditingEvent(null)}
          />
        </Dialog>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingEvent} onOpenChange={() => setDeletingEvent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingEvent?.title}&quot;? This will also
              delete all approval records. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Event Form Dialog Component
interface EventFormDialogProps {
  event?: EventWithStats;
  classes: { id: string; name: string }[];
  onClose: () => void;
}

function EventFormDialog({ event, classes, onClose }: EventFormDialogProps) {
  const isEditing = !!event;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    type: EventType;
    location: string;
    startDate: string;
    endDate: string;
    fee: string;
    capacity: string;
    deadline: string;
    targetAudience: string[];
    requiresApproval: boolean;
  }>({
    title: event?.title || "",
    description: event?.description || "",
    type: event?.type || "EVENT",
    location: event?.location || "",
    startDate: event?.startDate
      ? new Date(event.startDate).toISOString().split("T")[0]
      : "",
    endDate: event?.endDate
      ? new Date(event.endDate).toISOString().split("T")[0]
      : "",
    fee: event?.fee?.toString() || "",
    capacity: event?.capacity?.toString() || "",
    deadline: event?.deadline
      ? new Date(event.deadline).toISOString().split("T")[0]
      : "",
    targetAudience: event?.targetAudience || [],
    requiresApproval: event?.requiresApproval ?? true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.title || !formData.startDate || !formData.deadline) {
      setError("Please fill in all required fields");
      return;
    }

    startTransition(async () => {
      const eventData: EventFormData = {
        title: formData.title,
        description: formData.description || undefined,
        type: formData.type,
        location: formData.location || undefined,
        startDate: new Date(formData.startDate),
        endDate: formData.endDate ? new Date(formData.endDate) : undefined,
        fee: formData.fee ? parseFloat(formData.fee) : undefined,
        capacity: formData.capacity ? parseInt(formData.capacity) : undefined,
        deadline: new Date(formData.deadline),
        targetAudience: formData.targetAudience.length > 0 ? formData.targetAudience : ["All"],
        requiresApproval: formData.requiresApproval,
      };

      const result = isEditing
        ? await updateEvent(event.id, eventData)
        : await createEvent(eventData);

      if (result.success) {
        onClose();
      } else {
        setError(result.error || "Something went wrong");
      }
    });
  };

  const toggleClass = (className: string) => {
    setFormData((prev) => ({
      ...prev,
      targetAudience: prev.targetAudience.includes(className)
        ? prev.targetAudience.filter((c) => c !== className)
        : [...prev.targetAudience, className],
    }));
  };

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{isEditing ? "Edit Event" : "Create New Event"}</DialogTitle>
        <DialogDescription>
          {isEditing
            ? "Update the event details below"
            : "Fill in the details to create a new event"}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Event title"
            required
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Event description"
            rows={3}
          />
        </div>

        {/* Type and Location Row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="type">Event Type *</Label>
            <Select
              value={formData.type}
              onValueChange={(value) => setFormData({ ...formData, type: value as EventType })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {eventTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="Event location"
            />
          </div>
        </div>

        {/* Dates Row */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date *</Label>
            <Input
              id="startDate"
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="endDate">End Date</Label>
            <Input
              id="endDate"
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="deadline">Response Deadline *</Label>
            <Input
              id="deadline"
              type="date"
              value={formData.deadline}
              onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
              required
            />
          </div>
        </div>

        {/* Fee and Capacity Row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="fee">Fee (PKR)</Label>
            <Input
              id="fee"
              type="number"
              value={formData.fee}
              onChange={(e) => setFormData({ ...formData, fee: e.target.value })}
              placeholder="0 for free"
              min="0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="capacity">Capacity</Label>
            <Input
              id="capacity"
              type="number"
              value={formData.capacity}
              onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
              placeholder="Leave empty for unlimited"
              min="1"
            />
          </div>
        </div>

        {/* Target Audience */}
        <div className="space-y-2">
          <Label>Target Audience</Label>
          <div className="flex flex-wrap gap-2 p-3 border rounded-md">
            {classes.map((cls) => (
              <Badge
                key={cls.id}
                variant={formData.targetAudience.includes(cls.name) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleClass(cls.name)}
              >
                {cls.name}
              </Badge>
            ))}
            {classes.length === 0 && (
              <p className="text-sm text-muted-foreground">No classes available</p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Click to select classes. Leave empty for all students.
          </p>
        </div>

        {/* Requires Approval */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="requiresApproval"
            checked={formData.requiresApproval}
            onCheckedChange={(checked: boolean) =>
              setFormData({ ...formData, requiresApproval: checked })
            }
          />
          <Label htmlFor="requiresApproval" className="cursor-pointer">
            Requires parent approval
          </Label>
        </div>

        {/* Error */}
        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
            {error}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? "Update Event" : "Create Event"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

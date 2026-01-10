"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  CalendarDays,
  MapPin,
  Clock,
  DollarSign,
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Calendar,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import { updateEventApproval, bulkUpdateEventApprovals } from "@/lib/data/events";
import type { ParentEventsListData, ParentEventData, EventApprovalInfo } from "@/lib/data/events";
import { useRouter } from "next/navigation";

interface EventsContentProps {
  data: ParentEventsListData;
}

const EVENT_TYPE_CONFIG = {
  TRIP: { label: "Trip", color: "bg-blue-100 text-blue-800" },
  EVENT: { label: "Event", color: "bg-purple-100 text-purple-800" },
  ACTIVITY: { label: "Activity", color: "bg-green-100 text-green-800" },
  WORKSHOP: { label: "Workshop", color: "bg-orange-100 text-orange-800" },
  COMPETITION: { label: "Competition", color: "bg-red-100 text-red-800" },
};

const STATUS_CONFIG = {
  PENDING: { label: "Pending", icon: Clock, color: "text-yellow-600", bg: "bg-yellow-100" },
  APPROVED: { label: "Approved", icon: CheckCircle2, color: "text-green-600", bg: "bg-green-100" },
  DECLINED: { label: "Declined", icon: XCircle, color: "text-red-600", bg: "bg-red-100" },
};

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(date: Date) {
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getDaysUntil(date: Date) {
  const now = new Date();
  const diff = new Date(date).getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

interface ApprovalDialogProps {
  approval: EventApprovalInfo | null;
  event: ParentEventData | null;
  action: "approve" | "decline" | null;
  onClose: () => void;
  onConfirm: (remarks: string) => Promise<void>;
  isPending: boolean;
}

function ApprovalDialog({ approval, event, action, onClose, onConfirm, isPending }: ApprovalDialogProps) {
  const [remarks, setRemarks] = useState("");

  if (!approval || !event || !action) return null;

  const isApprove = action === "approve";

  return (
    <Dialog open={!!approval} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isApprove ? "Approve" : "Decline"} Event for {approval.studentName}
          </DialogTitle>
          <DialogDescription>
            {event.event.title} - {formatDate(event.event.startDate)}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <label className="text-sm font-medium">Remarks (optional)</label>
          <Textarea
            placeholder={isApprove ? "Any special instructions..." : "Reason for declining..."}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="mt-2"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant={isApprove ? "default" : "destructive"}
            onClick={() => onConfirm(remarks)}
            disabled={isPending}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isApprove ? "Approve" : "Decline"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EventCard({ eventData, onApprove, onDecline }: {
  eventData: ParentEventData;
  onApprove: (approval: EventApprovalInfo) => void;
  onDecline: (approval: EventApprovalInfo) => void;
}) {
  const { event, approvals, isExpired } = eventData;
  const typeConfig = EVENT_TYPE_CONFIG[event.type as keyof typeof EVENT_TYPE_CONFIG] || EVENT_TYPE_CONFIG.EVENT;
  const daysUntilDeadline = getDaysUntil(event.deadline);
  const isUrgent = daysUntilDeadline <= 2 && daysUntilDeadline >= 0;

  return (
    <Card className={cn(isExpired && "opacity-60")}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge className={typeConfig.color}>{typeConfig.label}</Badge>
              {isUrgent && !isExpired && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Urgent
                </Badge>
              )}
              {isExpired && (
                <Badge variant="secondary">Deadline Passed</Badge>
              )}
            </div>
            <CardTitle className="text-xl">{event.title}</CardTitle>
            {event.description && (
              <CardDescription className="line-clamp-2">{event.description}</CardDescription>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Event Details */}
        <div className="grid gap-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
            <span>
              {formatDate(event.startDate)}
              {event.endDate && ` - ${formatDate(event.endDate)}`}
            </span>
          </div>
          {event.location && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{event.location}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className={cn(isUrgent && !isExpired && "text-red-600 font-medium")}>
              Response deadline: {formatDateTime(event.deadline)}
              {!isExpired && ` (${daysUntilDeadline} day${daysUntilDeadline !== 1 ? "s" : ""} left)`}
            </span>
          </div>
          {event.fee && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              <span>Fee: {formatCurrency(event.fee)}</span>
            </div>
          )}
          {event.capacity && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>Capacity: {event.capacity} students</span>
            </div>
          )}
        </div>

        {/* Approval Status per Child */}
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium mb-3">Your Children</h4>
          <div className="space-y-3">
            {approvals.map((approval) => {
              const statusConfig = STATUS_CONFIG[approval.status];
              const StatusIcon = statusConfig.icon;

              return (
                <div
                  key={approval.id}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg",
                    statusConfig.bg
                  )}
                >
                  <div className="flex items-center gap-3">
                    <StatusIcon className={cn("h-5 w-5", statusConfig.color)} />
                    <div>
                      <p className="font-medium">{approval.studentName}</p>
                      <p className="text-xs text-muted-foreground">
                        {approval.status === "PENDING"
                          ? "Awaiting your response"
                          : approval.respondedAt
                          ? `Responded on ${formatDate(approval.respondedAt)}`
                          : statusConfig.label}
                      </p>
                      {approval.remarks && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Note: {approval.remarks}
                        </p>
                      )}
                    </div>
                  </div>
                  {approval.status === "PENDING" && !isExpired && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={() => onApprove(approval)}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => onDecline(approval)}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Decline
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function EventsContent({ data }: EventsContentProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedApproval, setSelectedApproval] = useState<EventApprovalInfo | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<ParentEventData | null>(null);
  const [dialogAction, setDialogAction] = useState<"approve" | "decline" | null>(null);

  const { pendingEvents, upcomingEvents, pastEvents, stats } = data;

  const handleApprove = (approval: EventApprovalInfo, eventData: ParentEventData) => {
    setSelectedApproval(approval);
    setSelectedEvent(eventData);
    setDialogAction("approve");
  };

  const handleDecline = (approval: EventApprovalInfo, eventData: ParentEventData) => {
    setSelectedApproval(approval);
    setSelectedEvent(eventData);
    setDialogAction("decline");
  };

  const handleConfirm = async (remarks: string) => {
    if (!selectedApproval || !dialogAction) return;

    startTransition(async () => {
      const result = await updateEventApproval(
        selectedApproval.id,
        dialogAction === "approve" ? "APPROVED" : "DECLINED",
        remarks
      );

      if (result.success) {
        setSelectedApproval(null);
        setSelectedEvent(null);
        setDialogAction(null);
        router.refresh();
      } else {
        alert(result.error || "Failed to update approval");
      }
    });
  };

  const handleCloseDialog = () => {
    setSelectedApproval(null);
    setSelectedEvent(null);
    setDialogAction(null);
  };

  const totalEvents = pendingEvents.length + upcomingEvents.length + pastEvents.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Events & Trips</h1>
        <p className="text-muted-foreground">
          Review and approve events and trips for your children
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Clock className="h-4 w-4 text-yellow-600" />
              Pending Approvals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.totalPending}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting your response
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Approved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.totalApproved}</div>
            <p className="text-xs text-muted-foreground">
              Events approved
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <XCircle className="h-4 w-4 text-red-600" />
              Declined
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.totalDeclined}</div>
            <p className="text-xs text-muted-foreground">
              Events declined
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Events Tabs */}
      {totalEvents > 0 ? (
        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pending" className="gap-2">
              Pending
              {pendingEvents.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {pendingEvents.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="upcoming">
              Upcoming
              {upcomingEvents.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {upcomingEvents.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            {pendingEvents.length > 0 ? (
              pendingEvents.map((eventData) => (
                <EventCard
                  key={eventData.event.id}
                  eventData={eventData}
                  onApprove={(approval) => handleApprove(approval, eventData)}
                  onDecline={(approval) => handleDecline(approval, eventData)}
                />
              ))
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle2 className="h-12 w-12 text-green-600 mb-4" />
                  <p className="text-lg font-medium">All caught up!</p>
                  <p className="text-muted-foreground">No pending approvals</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="upcoming" className="space-y-4">
            {upcomingEvents.length > 0 ? (
              upcomingEvents.map((eventData) => (
                <EventCard
                  key={eventData.event.id}
                  eventData={eventData}
                  onApprove={(approval) => handleApprove(approval, eventData)}
                  onDecline={(approval) => handleDecline(approval, eventData)}
                />
              ))
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No upcoming events</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="past" className="space-y-4">
            {pastEvents.length > 0 ? (
              pastEvents.map((eventData) => (
                <EventCard
                  key={eventData.event.id}
                  eventData={eventData}
                  onApprove={(approval) => handleApprove(approval, eventData)}
                  onDecline={(approval) => handleDecline(approval, eventData)}
                />
              ))
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No past events</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No Events Yet</p>
            <p className="text-muted-foreground">
              Events and trips will appear here when they are announced
            </p>
          </CardContent>
        </Card>
      )}

      {/* Approval Dialog */}
      <ApprovalDialog
        approval={selectedApproval}
        event={selectedEvent}
        action={dialogAction}
        onClose={handleCloseDialog}
        onConfirm={handleConfirm}
        isPending={isPending}
      />
    </div>
  );
}

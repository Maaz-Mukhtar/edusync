"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { unstable_cache } from "next/cache";
import { ApprovalStatus } from "@prisma/client";

// ==================== TYPES ====================

export interface EventInfo {
  id: string;
  title: string;
  description: string | null;
  type: string;
  location: string | null;
  startDate: Date;
  endDate: Date | null;
  fee: number | null;
  capacity: number | null;
  deadline: Date;
  requiresApproval: boolean;
}

export interface EventApprovalInfo {
  id: string;
  eventId: string;
  studentId: string;
  studentName: string;
  status: ApprovalStatus;
  remarks: string | null;
  respondedAt: Date | null;
}

export interface ParentEventData {
  event: EventInfo;
  approvals: EventApprovalInfo[];
  isExpired: boolean;
  approvedCount: number;
  pendingCount: number;
  declinedCount: number;
}

export interface ParentEventsListData {
  pendingEvents: ParentEventData[];
  upcomingEvents: ParentEventData[];
  pastEvents: ParentEventData[];
  stats: {
    totalPending: number;
    totalApproved: number;
    totalDeclined: number;
  };
}

// ==================== HELPER FUNCTIONS ====================

async function getParentProfileId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const parent = await prisma.parentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  return parent?.id || null;
}

async function getParentChildrenIds(parentId: string): Promise<string[]> {
  const children = await prisma.parentStudent.findMany({
    where: { parentId },
    select: { studentId: true },
  });
  return children.map((c) => c.studentId);
}

// ==================== DATA FETCHING ====================

async function fetchParentEventsInternal(parentId: string): Promise<ParentEventsListData> {
  const now = new Date();

  // Get parent's children
  const childrenIds = await getParentChildrenIds(parentId);
  if (childrenIds.length === 0) {
    return {
      pendingEvents: [],
      upcomingEvents: [],
      pastEvents: [],
      stats: { totalPending: 0, totalApproved: 0, totalDeclined: 0 },
    };
  }

  // Get children details for name lookup
  const children = await prisma.studentProfile.findMany({
    where: { id: { in: childrenIds } },
    include: {
      user: { select: { firstName: true, lastName: true } },
    },
  });

  const childNameMap = new Map(
    children.map((c) => [c.id, `${c.user.firstName} ${c.user.lastName}`])
  );

  // Get all event approvals for this parent's children
  const approvals = await prisma.eventApproval.findMany({
    where: {
      studentId: { in: childrenIds },
      parentId,
    },
    include: {
      event: true,
    },
    orderBy: { event: { startDate: "asc" } },
  });

  // Group approvals by event
  const eventMap = new Map<string, ParentEventData>();

  for (const approval of approvals) {
    const eventId = approval.eventId;

    if (!eventMap.has(eventId)) {
      const event = approval.event;
      eventMap.set(eventId, {
        event: {
          id: event.id,
          title: event.title,
          description: event.description,
          type: event.type,
          location: event.location,
          startDate: event.startDate,
          endDate: event.endDate,
          fee: event.fee,
          capacity: event.capacity,
          deadline: event.deadline,
          requiresApproval: event.requiresApproval,
        },
        approvals: [],
        isExpired: event.deadline < now,
        approvedCount: 0,
        pendingCount: 0,
        declinedCount: 0,
      });
    }

    const eventData = eventMap.get(eventId)!;
    eventData.approvals.push({
      id: approval.id,
      eventId: approval.eventId,
      studentId: approval.studentId,
      studentName: childNameMap.get(approval.studentId) || "Unknown",
      status: approval.status,
      remarks: approval.remarks,
      respondedAt: approval.respondedAt,
    });

    // Update counts
    if (approval.status === "PENDING") eventData.pendingCount++;
    else if (approval.status === "APPROVED") eventData.approvedCount++;
    else if (approval.status === "DECLINED") eventData.declinedCount++;
  }

  // Categorize events
  const pendingEvents: ParentEventData[] = [];
  const upcomingEvents: ParentEventData[] = [];
  const pastEvents: ParentEventData[] = [];

  let totalPending = 0;
  let totalApproved = 0;
  let totalDeclined = 0;

  for (const eventData of eventMap.values()) {
    totalPending += eventData.pendingCount;
    totalApproved += eventData.approvedCount;
    totalDeclined += eventData.declinedCount;

    if (eventData.event.startDate < now) {
      pastEvents.push(eventData);
    } else if (eventData.pendingCount > 0 && !eventData.isExpired) {
      pendingEvents.push(eventData);
    } else {
      upcomingEvents.push(eventData);
    }
  }

  // Sort
  pendingEvents.sort((a, b) => a.event.deadline.getTime() - b.event.deadline.getTime());
  upcomingEvents.sort((a, b) => a.event.startDate.getTime() - b.event.startDate.getTime());
  pastEvents.sort((a, b) => b.event.startDate.getTime() - a.event.startDate.getTime());

  return {
    pendingEvents,
    upcomingEvents,
    pastEvents: pastEvents.slice(0, 10), // Limit past events
    stats: { totalPending, totalApproved, totalDeclined },
  };
}

export async function getParentEventsData(): Promise<ParentEventsListData> {
  const parentId = await getParentProfileId();
  if (!parentId) {
    return {
      pendingEvents: [],
      upcomingEvents: [],
      pastEvents: [],
      stats: { totalPending: 0, totalApproved: 0, totalDeclined: 0 },
    };
  }

  const getCachedEvents = unstable_cache(
    async (pid: string) => fetchParentEventsInternal(pid),
    ["parent-events"],
    { revalidate: 30, tags: ["parent-events"] }
  );

  return getCachedEvents(parentId);
}

// ==================== ACTIONS ====================

export async function updateEventApproval(
  approvalId: string,
  status: "APPROVED" | "DECLINED",
  remarks?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const parentId = await getParentProfileId();
    if (!parentId) {
      return { success: false, error: "Not authenticated" };
    }

    // Verify the approval belongs to this parent
    const approval = await prisma.eventApproval.findFirst({
      where: {
        id: approvalId,
        parentId,
      },
      include: { event: true },
    });

    if (!approval) {
      return { success: false, error: "Approval not found" };
    }

    // Check if deadline has passed
    if (approval.event.deadline < new Date()) {
      return { success: false, error: "Deadline has passed" };
    }

    // Update the approval
    await prisma.eventApproval.update({
      where: { id: approvalId },
      data: {
        status,
        remarks: remarks || null,
        respondedAt: new Date(),
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Error updating event approval:", error);
    return { success: false, error: "Failed to update approval" };
  }
}

export async function bulkUpdateEventApprovals(
  eventId: string,
  status: "APPROVED" | "DECLINED",
  remarks?: string
): Promise<{ success: boolean; error?: string; count?: number }> {
  try {
    const parentId = await getParentProfileId();
    if (!parentId) {
      return { success: false, error: "Not authenticated" };
    }

    // Verify the event deadline hasn't passed
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { deadline: true },
    });

    if (!event) {
      return { success: false, error: "Event not found" };
    }

    if (event.deadline < new Date()) {
      return { success: false, error: "Deadline has passed" };
    }

    // Update all pending approvals for this parent's children
    const result = await prisma.eventApproval.updateMany({
      where: {
        eventId,
        parentId,
        status: "PENDING",
      },
      data: {
        status,
        remarks: remarks || null,
        respondedAt: new Date(),
      },
    });

    return { success: true, count: result.count };
  } catch (error) {
    console.error("Error bulk updating approvals:", error);
    return { success: false, error: "Failed to update approvals" };
  }
}

// ==================== DASHBOARD DATA ====================

export interface PendingApprovalSummary {
  eventId: string;
  eventTitle: string;
  eventType: string;
  deadline: Date;
  childrenPending: string[];
  isUrgent: boolean;
}

export async function getParentPendingApprovals(): Promise<PendingApprovalSummary[]> {
  const parentId = await getParentProfileId();
  if (!parentId) return [];

  const childrenIds = await getParentChildrenIds(parentId);
  if (childrenIds.length === 0) return [];

  const now = new Date();

  // Get children names
  const children = await prisma.studentProfile.findMany({
    where: { id: { in: childrenIds } },
    include: { user: { select: { firstName: true } } },
  });
  const childNameMap = new Map(children.map((c) => [c.id, c.user.firstName]));

  // Get pending approvals
  const pendingApprovals = await prisma.eventApproval.findMany({
    where: {
      parentId,
      status: "PENDING",
      event: {
        deadline: { gte: now },
        startDate: { gte: now },
      },
    },
    include: {
      event: { select: { id: true, title: true, type: true, deadline: true } },
    },
    orderBy: { event: { deadline: "asc" } },
  });

  // Group by event
  const eventMap = new Map<string, PendingApprovalSummary>();

  for (const approval of pendingApprovals) {
    const eventId = approval.eventId;

    if (!eventMap.has(eventId)) {
      const daysUntilDeadline = Math.ceil(
        (approval.event.deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      eventMap.set(eventId, {
        eventId,
        eventTitle: approval.event.title,
        eventType: approval.event.type,
        deadline: approval.event.deadline,
        childrenPending: [],
        isUrgent: daysUntilDeadline <= 2,
      });
    }

    const childName = childNameMap.get(approval.studentId);
    if (childName) {
      eventMap.get(eventId)!.childrenPending.push(childName);
    }
  }

  return Array.from(eventMap.values());
}

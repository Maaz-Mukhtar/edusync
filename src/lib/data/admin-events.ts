"use server";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import { unstable_cache } from "next/cache";
import { EventType, ApprovalStatus } from "@prisma/client";

// ============================================
// AUTH HELPER
// ============================================

async function getAdminSchoolId() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
    redirect("/");
  }

  return session.user.schoolId;
}

// ============================================
// TYPES
// ============================================

export interface EventWithStats {
  id: string;
  title: string;
  description: string | null;
  type: EventType;
  location: string | null;
  startDate: Date;
  endDate: Date | null;
  fee: number | null;
  capacity: number | null;
  deadline: Date;
  targetAudience: string[];
  requiresApproval: boolean;
  createdAt: Date;
  stats: {
    total: number;
    pending: number;
    approved: number;
    declined: number;
  };
}

export interface EventFormData {
  title: string;
  description?: string;
  type: EventType;
  location?: string;
  startDate: Date;
  endDate?: Date;
  fee?: number;
  capacity?: number;
  deadline: Date;
  targetAudience: string[];
  requiresApproval: boolean;
}

export interface AdminEventsData {
  events: EventWithStats[];
  stats: {
    total: number;
    upcoming: number;
    past: number;
    pendingApprovals: number;
  };
}

// ============================================
// DATA FETCHING
// ============================================

async function fetchAdminEventsInternal(schoolId: string): Promise<AdminEventsData> {
  const now = new Date();

  const events = await prisma.event.findMany({
    where: { schoolId },
    include: {
      approvals: {
        select: { status: true },
      },
    },
    orderBy: { startDate: "desc" },
  });

  const eventsWithStats: EventWithStats[] = events.map((event) => {
    const approvals = event.approvals;
    return {
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
      targetAudience: event.targetAudience,
      requiresApproval: event.requiresApproval,
      createdAt: event.createdAt,
      stats: {
        total: approvals.length,
        pending: approvals.filter((a) => a.status === "PENDING").length,
        approved: approvals.filter((a) => a.status === "APPROVED").length,
        declined: approvals.filter((a) => a.status === "DECLINED").length,
      },
    };
  });

  const upcoming = eventsWithStats.filter((e) => e.startDate > now).length;
  const past = eventsWithStats.filter((e) => e.startDate <= now).length;
  const pendingApprovals = eventsWithStats.reduce((acc, e) => acc + e.stats.pending, 0);

  return {
    events: eventsWithStats,
    stats: {
      total: eventsWithStats.length,
      upcoming,
      past,
      pendingApprovals,
    },
  };
}

const getCachedAdminEvents = (schoolId: string) =>
  unstable_cache(
    () => fetchAdminEventsInternal(schoolId),
    [`admin-events-${schoolId}`],
    {
      revalidate: 30,
      tags: [`school-${schoolId}`, "admin-events"],
    }
  )();

export async function getAdminEventsData(): Promise<AdminEventsData> {
  const schoolId = await getAdminSchoolId();
  return getCachedAdminEvents(schoolId);
}

// ============================================
// EVENT CRUD OPERATIONS
// ============================================

export async function createEvent(data: EventFormData): Promise<{ success: boolean; error?: string; eventId?: string }> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Not authenticated" };
    }

    const schoolId = session.user.schoolId;

    const event = await prisma.event.create({
      data: {
        schoolId,
        title: data.title,
        description: data.description || null,
        type: data.type,
        location: data.location || null,
        startDate: data.startDate,
        endDate: data.endDate || null,
        fee: data.fee || null,
        capacity: data.capacity || null,
        deadline: data.deadline,
        targetAudience: data.targetAudience,
        requiresApproval: data.requiresApproval,
        createdBy: session.user.id,
      },
    });

    // If approval is required, create approval records for students in target audience
    if (data.requiresApproval) {
      // Build filter for target audience
      const targetClasses = data.targetAudience.filter(t => t !== "All");

      // Get students in targeted classes with their parent links
      const students = await prisma.studentProfile.findMany({
        where: {
          section: {
            class: {
              schoolId,
              // Filter by class name if specific classes are targeted
              ...(targetClasses.length > 0 && {
                name: { in: targetClasses },
              }),
            },
          },
        },
        include: {
          parents: true,
          section: {
            include: { class: { select: { name: true } } },
          },
        },
      });

      console.log(`Creating approvals for ${students.length} students in classes:`, targetClasses.length > 0 ? targetClasses : "All");

      // Create approval records for each student-parent pair
      const approvalData = students.flatMap((student) =>
        student.parents.map((ps) => ({
          eventId: event.id,
          studentId: student.id,
          parentId: ps.parentId,
          status: ApprovalStatus.PENDING,
        }))
      );

      console.log(`Created ${approvalData.length} approval records`);

      if (approvalData.length > 0) {
        await prisma.eventApproval.createMany({
          data: approvalData,
        });
      }
    }

    // Revalidate admin events page
    revalidatePath("/admin/events");

    // Revalidate parent portal caches so they see new events immediately
    revalidateTag("parent-events", "max");
    revalidateTag("parent-dashboard", "max");

    return { success: true, eventId: event.id };
  } catch (error) {
    console.error("Error creating event:", error);
    return { success: false, error: "Failed to create event" };
  }
}

export async function updateEvent(
  eventId: string,
  data: Partial<EventFormData>
): Promise<{ success: boolean; error?: string }> {
  try {
    const schoolId = await getAdminSchoolId();

    // Verify event belongs to this school
    const event = await prisma.event.findFirst({
      where: { id: eventId, schoolId },
    });

    if (!event) {
      return { success: false, error: "Event not found" };
    }

    await prisma.event.update({
      where: { id: eventId },
      data: {
        title: data.title,
        description: data.description,
        type: data.type,
        location: data.location,
        startDate: data.startDate,
        endDate: data.endDate,
        fee: data.fee,
        capacity: data.capacity,
        deadline: data.deadline,
        targetAudience: data.targetAudience,
        requiresApproval: data.requiresApproval,
      },
    });

    revalidatePath("/admin/events");
    revalidateTag("parent-events", "max");
    revalidateTag("parent-dashboard", "max");
    return { success: true };
  } catch (error) {
    console.error("Error updating event:", error);
    return { success: false, error: "Failed to update event" };
  }
}

export async function deleteEvent(eventId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const schoolId = await getAdminSchoolId();

    // Verify event belongs to this school
    const event = await prisma.event.findFirst({
      where: { id: eventId, schoolId },
    });

    if (!event) {
      return { success: false, error: "Event not found" };
    }

    // Delete approvals first (cascade)
    await prisma.eventApproval.deleteMany({
      where: { eventId },
    });

    // Delete the event
    await prisma.event.delete({
      where: { id: eventId },
    });

    revalidatePath("/admin/events");
    revalidateTag("parent-events", "max");
    revalidateTag("parent-dashboard", "max");
    return { success: true };
  } catch (error) {
    console.error("Error deleting event:", error);
    return { success: false, error: "Failed to delete event" };
  }
}

// ============================================
// GET SINGLE EVENT
// ============================================

export async function getEventById(eventId: string): Promise<EventWithStats | null> {
  const schoolId = await getAdminSchoolId();

  const event = await prisma.event.findFirst({
    where: { id: eventId, schoolId },
    include: {
      approvals: {
        select: { status: true },
      },
    },
  });

  if (!event) return null;

  return {
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
    targetAudience: event.targetAudience,
    requiresApproval: event.requiresApproval,
    createdAt: event.createdAt,
    stats: {
      total: event.approvals.length,
      pending: event.approvals.filter((a) => a.status === "PENDING").length,
      approved: event.approvals.filter((a) => a.status === "APPROVED").length,
      declined: event.approvals.filter((a) => a.status === "DECLINED").length,
    },
  };
}

// ============================================
// GET CLASSES FOR TARGET AUDIENCE
// ============================================

export async function getSchoolClasses(): Promise<{ id: string; name: string }[]> {
  const schoolId = await getAdminSchoolId();

  const classes = await prisma.class.findMany({
    where: { schoolId },
    select: { id: true, name: true },
    orderBy: { displayOrder: "asc" },
  });

  return classes;
}

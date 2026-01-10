"use server";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import { unstable_cache } from "next/cache";
import { UserRole } from "@prisma/client";

// ============================================
// TYPES
// ============================================

export interface ConversationWithDetails {
  id: string;
  studentId: string;
  studentName: string;
  teacherId: string;
  teacherName: string;
  parentId: string;
  parentName: string;
  subject: string | null;
  lastMessage: {
    content: string;
    senderRole: UserRole;
    createdAt: Date;
    isRead: boolean;
  } | null;
  unreadCount: number;
  updatedAt: Date;
}

export interface MessageWithSender {
  id: string;
  content: string;
  senderRole: UserRole;
  senderName: string;
  isRead: boolean;
  createdAt: Date;
}

export interface ConversationDetails {
  id: string;
  studentName: string;
  teacherName: string;
  parentName: string;
  subject: string | null;
  messages: MessageWithSender[];
}

export interface NewConversationData {
  studentId: string;
  parentId?: string; // Required for teachers
  teacherId?: string; // Required for parents
  subject?: string;
  initialMessage: string;
}

// ============================================
// AUTH HELPERS
// ============================================

async function getTeacherInfo() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "TEACHER") {
    redirect("/");
  }

  const teacherProfile = await prisma.teacherProfile.findUnique({
    where: { userId: session.user.id },
    include: { user: { select: { firstName: true, lastName: true, schoolId: true } } },
  });

  if (!teacherProfile) {
    throw new Error("Teacher profile not found");
  }

  return { profile: teacherProfile, userId: session.user.id, schoolId: teacherProfile.user.schoolId };
}

async function getParentInfo() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "PARENT") {
    redirect("/");
  }

  const parentProfile = await prisma.parentProfile.findUnique({
    where: { userId: session.user.id },
    include: { user: { select: { firstName: true, lastName: true, schoolId: true } } },
  });

  if (!parentProfile) {
    throw new Error("Parent profile not found");
  }

  return { profile: parentProfile, userId: session.user.id, schoolId: parentProfile.user.schoolId };
}

// ============================================
// TEACHER MESSAGING
// ============================================

async function fetchTeacherConversationsInternal(teacherId: string): Promise<ConversationWithDetails[]> {
  const conversations = await prisma.conversation.findMany({
    where: { teacherId },
    include: {
      student: {
        include: {
          user: { select: { firstName: true, lastName: true } },
        },
      },
      teacher: {
        include: {
          user: { select: { firstName: true, lastName: true } },
        },
      },
      parent: {
        include: {
          user: { select: { firstName: true, lastName: true } },
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Get unread counts
  const unreadCounts = await prisma.message.groupBy({
    by: ["conversationId"],
    where: {
      conversationId: { in: conversations.map((c) => c.id) },
      senderRole: "PARENT",
      isRead: false,
    },
    _count: true,
  });

  const unreadMap = new Map(unreadCounts.map((u) => [u.conversationId, u._count]));

  return conversations.map((conv) => ({
    id: conv.id,
    studentId: conv.studentId,
    studentName: `${conv.student.user.firstName} ${conv.student.user.lastName}`,
    teacherId: conv.teacherId,
    teacherName: `${conv.teacher.user.firstName} ${conv.teacher.user.lastName}`,
    parentId: conv.parentId,
    parentName: `${conv.parent.user.firstName} ${conv.parent.user.lastName}`,
    subject: conv.subject,
    lastMessage: conv.messages[0]
      ? {
          content: conv.messages[0].content,
          senderRole: conv.messages[0].senderRole,
          createdAt: conv.messages[0].createdAt,
          isRead: conv.messages[0].isRead,
        }
      : null,
    unreadCount: unreadMap.get(conv.id) || 0,
    updatedAt: conv.updatedAt,
  }));
}

const getCachedTeacherConversations = (teacherId: string) =>
  unstable_cache(
    () => fetchTeacherConversationsInternal(teacherId),
    [`teacher-conversations-${teacherId}`],
    {
      revalidate: 30,
      tags: [`teacher-${teacherId}-messages`],
    }
  )();

export async function getTeacherConversations(): Promise<ConversationWithDetails[]> {
  const { profile } = await getTeacherInfo();
  return getCachedTeacherConversations(profile.id);
}

// Get students that teacher can message (from their sections)
export async function getTeacherStudentsForMessaging() {
  const { profile, schoolId } = await getTeacherInfo();

  const students = await prisma.studentProfile.findMany({
    where: {
      section: {
        teachers: {
          some: { teacherId: profile.id },
        },
      },
    },
    include: {
      user: { select: { firstName: true, lastName: true } },
      section: {
        include: {
          class: { select: { name: true } },
        },
      },
      parents: {
        include: {
          parent: {
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
      },
    },
    orderBy: [
      { section: { class: { name: "asc" } } },
      { user: { firstName: "asc" } },
    ],
  });

  return students.map((s) => ({
    id: s.id,
    name: `${s.user.firstName} ${s.user.lastName}`,
    className: s.section.class.name,
    sectionName: s.section.name,
    parents: s.parents.map((ps) => ({
      id: ps.parent.id,
      name: `${ps.parent.user.firstName} ${ps.parent.user.lastName}`,
    })),
  }));
}

// ============================================
// PARENT MESSAGING
// ============================================

async function fetchParentConversationsInternal(parentId: string): Promise<ConversationWithDetails[]> {
  const conversations = await prisma.conversation.findMany({
    where: { parentId },
    include: {
      student: {
        include: {
          user: { select: { firstName: true, lastName: true } },
        },
      },
      teacher: {
        include: {
          user: { select: { firstName: true, lastName: true } },
        },
      },
      parent: {
        include: {
          user: { select: { firstName: true, lastName: true } },
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Get unread counts (messages from teacher)
  const unreadCounts = await prisma.message.groupBy({
    by: ["conversationId"],
    where: {
      conversationId: { in: conversations.map((c) => c.id) },
      senderRole: "TEACHER",
      isRead: false,
    },
    _count: true,
  });

  const unreadMap = new Map(unreadCounts.map((u) => [u.conversationId, u._count]));

  return conversations.map((conv) => ({
    id: conv.id,
    studentId: conv.studentId,
    studentName: `${conv.student.user.firstName} ${conv.student.user.lastName}`,
    teacherId: conv.teacherId,
    teacherName: `${conv.teacher.user.firstName} ${conv.teacher.user.lastName}`,
    parentId: conv.parentId,
    parentName: `${conv.parent.user.firstName} ${conv.parent.user.lastName}`,
    subject: conv.subject,
    lastMessage: conv.messages[0]
      ? {
          content: conv.messages[0].content,
          senderRole: conv.messages[0].senderRole,
          createdAt: conv.messages[0].createdAt,
          isRead: conv.messages[0].isRead,
        }
      : null,
    unreadCount: unreadMap.get(conv.id) || 0,
    updatedAt: conv.updatedAt,
  }));
}

const getCachedParentConversations = (parentId: string) =>
  unstable_cache(
    () => fetchParentConversationsInternal(parentId),
    [`parent-conversations-${parentId}`],
    {
      revalidate: 30,
      tags: [`parent-${parentId}-messages`],
    }
  )();

export async function getParentConversations(): Promise<ConversationWithDetails[]> {
  const { profile } = await getParentInfo();
  return getCachedParentConversations(profile.id);
}

// Get teachers that parent can message (teachers of their children)
export async function getParentTeachersForMessaging() {
  const { profile } = await getParentInfo();

  // Get parent's children and their teachers
  const children = await prisma.parentStudent.findMany({
    where: { parentId: profile.id },
    include: {
      student: {
        include: {
          user: { select: { firstName: true, lastName: true } },
          section: {
            include: {
              class: { select: { name: true } },
              teachers: {
                include: {
                  teacher: {
                    include: {
                      user: { select: { firstName: true, lastName: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return children.map((c) => ({
    studentId: c.student.id,
    studentName: `${c.student.user.firstName} ${c.student.user.lastName}`,
    className: c.student.section.class.name,
    sectionName: c.student.section.name,
    teachers: c.student.section.teachers.map((st) => ({
      id: st.teacher.id,
      name: `${st.teacher.user.firstName} ${st.teacher.user.lastName}`,
      isClassTeacher: st.isClassTeacher,
    })),
  }));
}

// ============================================
// SHARED OPERATIONS
// ============================================

export async function getConversationMessages(conversationId: string): Promise<ConversationDetails | null> {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      student: {
        include: {
          user: { select: { firstName: true, lastName: true } },
        },
      },
      teacher: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      parent: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!conversation) return null;

  // Verify access - user must be the teacher or parent in this conversation
  const isTeacher = session.user.id === conversation.teacher.user.id;
  const isParent = session.user.id === conversation.parent.user.id;

  if (!isTeacher && !isParent) {
    return null;
  }

  // Mark messages as read for the current user
  const oppositeRole = isTeacher ? "PARENT" : "TEACHER";
  await prisma.message.updateMany({
    where: {
      conversationId,
      senderRole: oppositeRole,
      isRead: false,
    },
    data: { isRead: true },
  });

  // Invalidate cache
  if (isTeacher) {
    revalidateTag(`teacher-${conversation.teacherId}-messages`, "max");
  } else {
    revalidateTag(`parent-${conversation.parentId}-messages`, "max");
  }

  return {
    id: conversation.id,
    studentName: `${conversation.student.user.firstName} ${conversation.student.user.lastName}`,
    teacherName: `${conversation.teacher.user.firstName} ${conversation.teacher.user.lastName}`,
    parentName: `${conversation.parent.user.firstName} ${conversation.parent.user.lastName}`,
    subject: conversation.subject,
    messages: conversation.messages.map((m) => ({
      id: m.id,
      content: m.content,
      senderRole: m.senderRole,
      senderName:
        m.senderRole === "TEACHER"
          ? `${conversation.teacher.user.firstName} ${conversation.teacher.user.lastName}`
          : `${conversation.parent.user.firstName} ${conversation.parent.user.lastName}`,
      isRead: m.isRead,
      createdAt: m.createdAt,
    })),
  };
}

export async function sendMessage(
  conversationId: string,
  content: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth();

    if (!session?.user) {
      return { success: false, error: "Not authenticated" };
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        teacher: { include: { user: { select: { id: true } } } },
        parent: { include: { user: { select: { id: true } } } },
      },
    });

    if (!conversation) {
      return { success: false, error: "Conversation not found" };
    }

    // Verify access
    const isTeacher = session.user.id === conversation.teacher.user.id;
    const isParent = session.user.id === conversation.parent.user.id;

    if (!isTeacher && !isParent) {
      return { success: false, error: "Access denied" };
    }

    // Create the message
    await prisma.message.create({
      data: {
        conversationId,
        senderId: session.user.id,
        senderRole: isTeacher ? "TEACHER" : "PARENT",
        content,
      },
    });

    // Update conversation timestamp
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Invalidate caches
    revalidateTag(`teacher-${conversation.teacherId}-messages`, "max");
    revalidateTag(`parent-${conversation.parentId}-messages`, "max");
    revalidatePath("/teacher/messages");
    revalidatePath("/parent/messages");

    return { success: true };
  } catch (error) {
    console.error("Error sending message:", error);
    return { success: false, error: "Failed to send message" };
  }
}

export async function createConversation(
  data: NewConversationData
): Promise<{ success: boolean; error?: string; conversationId?: string }> {
  try {
    const session = await auth();

    if (!session?.user) {
      return { success: false, error: "Not authenticated" };
    }

    const isTeacher = session.user.role === "TEACHER";
    const isParent = session.user.role === "PARENT";

    if (!isTeacher && !isParent) {
      return { success: false, error: "Only teachers and parents can start conversations" };
    }

    let teacherId: string;
    let parentId: string;
    let schoolId: string;

    if (isTeacher) {
      const teacherProfile = await prisma.teacherProfile.findUnique({
        where: { userId: session.user.id },
        include: { user: { select: { schoolId: true } } },
      });
      if (!teacherProfile) {
        return { success: false, error: "Teacher profile not found" };
      }
      teacherId = teacherProfile.id;
      schoolId = teacherProfile.user.schoolId;

      if (!data.parentId) {
        return { success: false, error: "Parent is required" };
      }
      parentId = data.parentId;
    } else {
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId: session.user.id },
        include: { user: { select: { schoolId: true } } },
      });
      if (!parentProfile) {
        return { success: false, error: "Parent profile not found" };
      }
      parentId = parentProfile.id;
      schoolId = parentProfile.user.schoolId;

      if (!data.teacherId) {
        return { success: false, error: "Teacher is required" };
      }
      teacherId = data.teacherId;
    }

    // Check if conversation already exists
    const existingConversation = await prisma.conversation.findUnique({
      where: {
        studentId_teacherId_parentId: {
          studentId: data.studentId,
          teacherId,
          parentId,
        },
      },
    });

    if (existingConversation) {
      // Add message to existing conversation
      await prisma.message.create({
        data: {
          conversationId: existingConversation.id,
          senderId: session.user.id,
          senderRole: isTeacher ? "TEACHER" : "PARENT",
          content: data.initialMessage,
        },
      });

      await prisma.conversation.update({
        where: { id: existingConversation.id },
        data: { updatedAt: new Date() },
      });

      revalidateTag(`teacher-${teacherId}-messages`, "max");
      revalidateTag(`parent-${parentId}-messages`, "max");
      revalidatePath("/teacher/messages");
      revalidatePath("/parent/messages");

      return { success: true, conversationId: existingConversation.id };
    }

    // Create new conversation with initial message
    const conversation = await prisma.conversation.create({
      data: {
        schoolId,
        studentId: data.studentId,
        teacherId,
        parentId,
        subject: data.subject || null,
        messages: {
          create: {
            senderId: session.user.id,
            senderRole: isTeacher ? "TEACHER" : "PARENT",
            content: data.initialMessage,
          },
        },
      },
    });

    revalidateTag(`teacher-${teacherId}-messages`, "max");
    revalidateTag(`parent-${parentId}-messages`, "max");
    revalidatePath("/teacher/messages");
    revalidatePath("/parent/messages");

    return { success: true, conversationId: conversation.id };
  } catch (error) {
    console.error("Error creating conversation:", error);
    return { success: false, error: "Failed to create conversation" };
  }
}

// Get unread message count for dashboard
export async function getUnreadMessageCount(): Promise<number> {
  const session = await auth();

  if (!session?.user) {
    return 0;
  }

  if (session.user.role === "TEACHER") {
    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!teacherProfile) return 0;

    return prisma.message.count({
      where: {
        conversation: { teacherId: teacherProfile.id },
        senderRole: "PARENT",
        isRead: false,
      },
    });
  }

  if (session.user.role === "PARENT") {
    const parentProfile = await prisma.parentProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!parentProfile) return 0;

    return prisma.message.count({
      where: {
        conversation: { parentId: parentProfile.id },
        senderRole: "TEACHER",
        isRead: false,
      },
    });
  }

  return 0;
}

"use server";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";

// ============================================
// TYPES
// ============================================

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
  parentId?: string;
  teacherId?: string;
  subject?: string;
  initialMessage: string;
}

// ============================================
// SERVER ACTIONS
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

    // Invalidate page caches
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

    revalidatePath("/teacher/messages");
    revalidatePath("/parent/messages");

    return { success: true, conversationId: conversation.id };
  } catch (error) {
    console.error("Error creating conversation:", error);
    return { success: false, error: "Failed to create conversation" };
  }
}

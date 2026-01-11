import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
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

export async function getTeacherConversations(): Promise<ConversationWithDetails[]> {
  const { profile } = await getTeacherInfo();
  return fetchTeacherConversationsInternal(profile.id);
}

// Get students that teacher can message (from their sections)
export async function getTeacherStudentsForMessaging() {
  const { profile } = await getTeacherInfo();

  // Get sections where teacher is class teacher
  const classTeacherSections = await prisma.sectionTeacher.findMany({
    where: { teacherId: profile.id },
    select: { sectionId: true },
  });

  // Get sections where teacher teaches subjects
  const subjectTeacherSections = await prisma.sectionSubjectTeacher.findMany({
    where: { teacherId: profile.id },
    select: { sectionId: true },
  });

  const sectionIds = [...new Set([
    ...classTeacherSections.map(s => s.sectionId),
    ...subjectTeacherSections.map(s => s.sectionId),
  ])];

  const students = await prisma.studentProfile.findMany({
    where: {
      sectionId: { in: sectionIds },
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

export async function getParentConversations(): Promise<ConversationWithDetails[]> {
  const { profile } = await getParentInfo();
  return fetchParentConversationsInternal(profile.id);
}

// Get teachers that parent can message (teachers of their children)
export async function getParentTeachersForMessaging() {
  const { profile } = await getParentInfo();

  // Get parent's children with their sections
  const children = await prisma.parentStudent.findMany({
    where: { parentId: profile.id },
    include: {
      student: {
        include: {
          user: { select: { firstName: true, lastName: true } },
          section: {
            include: {
              class: { select: { name: true } },
              classTeacher: {
                include: {
                  teacher: {
                    include: {
                      user: { select: { firstName: true, lastName: true } },
                    },
                  },
                },
              },
              subjectTeachers: {
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

  return children.map((c) => {
    // Combine class teacher and subject teachers
    const teachersMap = new Map<string, { id: string; name: string; isClassTeacher: boolean }>();

    // Add class teacher if exists
    if (c.student.section.classTeacher) {
      const ct = c.student.section.classTeacher;
      teachersMap.set(ct.teacherId, {
        id: ct.teacher.id,
        name: `${ct.teacher.user.firstName} ${ct.teacher.user.lastName}`,
        isClassTeacher: true,
      });
    }

    // Add subject teachers
    for (const st of c.student.section.subjectTeachers) {
      if (!teachersMap.has(st.teacherId)) {
        teachersMap.set(st.teacherId, {
          id: st.teacher.id,
          name: `${st.teacher.user.firstName} ${st.teacher.user.lastName}`,
          isClassTeacher: false,
        });
      }
    }

    return {
      studentId: c.student.id,
      studentName: `${c.student.user.firstName} ${c.student.user.lastName}`,
      className: c.student.section.class.name,
      sectionName: c.student.section.name,
      teachers: Array.from(teachersMap.values()),
    };
  });
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

"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { MessageSquare, Plus, Send, User } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ConversationWithDetails } from "@/lib/data/messages";
import {
  MessageWithSender,
  getConversationMessages,
  sendMessage,
  createConversation,
} from "@/lib/actions/messages";
import { cn } from "@/lib/utils";

interface TeacherForMessaging {
  studentId: string;
  studentName: string;
  className: string;
  sectionName: string;
  teachers: { id: string; name: string; isClassTeacher: boolean }[];
}

interface MessagesContentProps {
  conversations: ConversationWithDetails[];
  teachersForMessaging: TeacherForMessaging[];
}

export default function MessagesContent({
  conversations,
  teachersForMessaging,
}: MessagesContentProps) {
  const router = useRouter();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(
    conversations[0]?.id || null
  );
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [conversationDetails, setConversationDetails] = useState<{
    studentName: string;
    teacherName: string;
    subject: string | null;
  } | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [selectedChild, setSelectedChild] = useState<string>("");
  const [selectedTeacher, setSelectedTeacher] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [initialMessage, setInitialMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation);
    }
  }, [selectedConversation]);

  const loadMessages = async (conversationId: string) => {
    setLoading(true);
    try {
      const data = await getConversationMessages(conversationId);
      if (data) {
        setMessages(data.messages);
        setConversationDetails({
          studentName: data.studentName,
          teacherName: data.teacherName,
          subject: data.subject,
        });
      }
    } catch (error) {
      toast.error("Failed to load messages");
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    setSending(true);
    try {
      const result = await sendMessage(selectedConversation, newMessage.trim());
      if (result.success) {
        setNewMessage("");
        await loadMessages(selectedConversation);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to send message");
      }
    } catch (error) {
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleCreateConversation = async () => {
    if (!selectedChild || !selectedTeacher || !initialMessage.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setCreating(true);
    try {
      const result = await createConversation({
        studentId: selectedChild,
        teacherId: selectedTeacher,
        subject: subject || undefined,
        initialMessage: initialMessage.trim(),
      });

      if (result.success && result.conversationId) {
        toast.success("Conversation started");
        setNewConversationOpen(false);
        setSelectedChild("");
        setSelectedTeacher("");
        setSubject("");
        setInitialMessage("");
        setSelectedConversation(result.conversationId);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to start conversation");
      }
    } catch (error) {
      toast.error("Failed to start conversation");
    } finally {
      setCreating(false);
    }
  };

  const selectedChildData = teachersForMessaging.find((c) => c.studentId === selectedChild);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
          <p className="text-muted-foreground">
            Communicate with your children's teachers
          </p>
        </div>
        <Dialog open={newConversationOpen} onOpenChange={setNewConversationOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Message
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Message a Teacher</DialogTitle>
              <DialogDescription>
                Select a child and their teacher to start a conversation.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Child</Label>
                <Select value={selectedChild} onValueChange={(v) => {
                  setSelectedChild(v);
                  setSelectedTeacher("");
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a child" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachersForMessaging.map((child) => (
                      <SelectItem key={child.studentId} value={child.studentId}>
                        {child.studentName} ({child.className} - {child.sectionName})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedChildData && selectedChildData.teachers.length > 0 && (
                <div className="space-y-2">
                  <Label>Teacher</Label>
                  <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a teacher" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedChildData.teachers.map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                          {teacher.name}
                          {teacher.isClassTeacher && " (Class Teacher)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {selectedChildData && selectedChildData.teachers.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No teachers assigned to this class.
                </p>
              )}
              <div className="space-y-2">
                <Label>Subject (Optional)</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g., Homework Help, Attendance Query"
                />
              </div>
              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea
                  value={initialMessage}
                  onChange={(e) => setInitialMessage(e.target.value)}
                  placeholder="Type your message..."
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewConversationOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateConversation}
                disabled={creating || !selectedChild || !selectedTeacher || !initialMessage.trim()}
              >
                {creating ? "Sending..." : "Send Message"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Main Content */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Conversation List */}
        <Card className="md:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Conversations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[550px]">
              {conversations.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  <MessageSquare className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  <p>No conversations yet</p>
                  <p className="text-sm">Start a new conversation with a teacher</p>
                </div>
              ) : (
                <div className="divide-y">
                  {conversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConversation(conv.id)}
                      className={cn(
                        "w-full p-4 text-left hover:bg-muted/50 transition-colors",
                        selectedConversation === conv.id && "bg-muted"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{conv.teacherName}</p>
                            {conv.unreadCount > 0 && (
                              <Badge variant="default" className="h-5 min-w-[20px] px-1.5">
                                {conv.unreadCount}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            Re: {conv.studentName}
                          </p>
                          {conv.lastMessage && (
                            <p className="text-sm text-muted-foreground truncate mt-1">
                              {conv.lastMessage.senderRole === "PARENT" ? "You: " : ""}
                              {conv.lastMessage.content}
                            </p>
                          )}
                        </div>
                        {conv.lastMessage && (
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(conv.lastMessage.createdAt), "MMM d")}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Message Thread */}
        <Card className="md:col-span-2">
          {selectedConversation && conversationDetails ? (
            <>
              <CardHeader className="border-b pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{conversationDetails.teacherName}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      About: {conversationDetails.studentName}
                      {conversationDetails.subject && ` - ${conversationDetails.subject}`}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 flex flex-col h-[500px]">
                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  {loading ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-muted-foreground">Loading messages...</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={cn(
                            "flex",
                            message.senderRole === "PARENT" ? "justify-end" : "justify-start"
                          )}
                        >
                          <div
                            className={cn(
                              "max-w-[70%] rounded-lg px-4 py-2",
                              message.senderRole === "PARENT"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            )}
                          >
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                            <p
                              className={cn(
                                "text-xs mt-1",
                                message.senderRole === "PARENT"
                                  ? "text-primary-foreground/70"
                                  : "text-muted-foreground"
                              )}
                            >
                              {format(new Date(message.createdAt), "MMM d, h:mm a")}
                            </p>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>

                {/* Message Input */}
                <div className="border-t p-4">
                  <div className="flex gap-2">
                    <Textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a message..."
                      className="min-h-[80px] resize-none"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={sending || !newMessage.trim()}
                      className="self-end"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Press Enter to send, Shift+Enter for new line
                  </p>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex items-center justify-center h-[550px]">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">Select a conversation</p>
                <p className="text-sm">Choose a conversation from the list or start a new one</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}

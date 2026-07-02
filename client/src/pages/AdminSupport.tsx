import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send, Loader2, Headset, User, Mail, Phone, CheckCircle2, Bell, BellOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { SupportConversation, SupportMessage } from "@shared/schema";

type ConversationListItem = SupportConversation & { lastMessage: string | null; messageCount: number };

function timeAgo(date: string | Date) {
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString();
}

export default function AdminSupport() {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [reply, setReply] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("dropandsell_support_sound") !== "off";
  });
  const audioCtxRef = useRef<AudioContext | null>(null);
  const prevUnreadSigRef = useRef<Set<string> | null>(null);

  // Play a short two-tone chime using the Web Audio API (no audio file needed).
  const playChime = () => {
    try {
      if (!audioCtxRef.current) {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        if (!Ctx) return;
        audioCtxRef.current = new Ctx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") void ctx.resume().catch(() => {});
      const now = ctx.currentTime;
      const notes = [880, 1174.66];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        const start = now + i * 0.16;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.25, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.3);
      });
    } catch {
      // Audio can be blocked before the admin interacts with the page — ignore.
    }
  };

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("dropandsell_support_sound", next ? "on" : "off");
      // Play a confirmation chime when turning it on so the admin hears the alert.
      if (next) playChime();
      return next;
    });
  };

  // Release the audio context when leaving the page.
  useEffect(() => {
    return () => {
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
    };
  }, []);

  const { data: conversations, isLoading } = useQuery<ConversationListItem[]>({
    queryKey: ["/api/support/admin/conversations"],
    refetchInterval: 8000,
  });

  // Detect brand-new customer messages and play an alert sound.
  useEffect(() => {
    if (!conversations) return;
    const currentSig = new Set(
      conversations
        .filter((c) => c.unreadForAdmin)
        .map((c) => `${c.id}:${c.lastMessageAt ?? ""}`)
    );
    const prev = prevUnreadSigRef.current;
    if (prev !== null) {
      let hasNew = false;
      currentSig.forEach((sig) => {
        if (!prev.has(sig)) hasNew = true;
      });
      if (hasNew && soundEnabled) playChime();
    }
    prevUnreadSigRef.current = currentSig;
  }, [conversations, soundEnabled]);

  const { data: thread } = useQuery<{ conversation: SupportConversation; messages: SupportMessage[] }>({
    queryKey: ["/api/support/admin/conversations", selectedId],
    enabled: selectedId !== null,
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thread?.messages?.length]);

  const replyMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", `/api/support/admin/conversations/${selectedId}/reply`, { content });
      return res.json();
    },
    onSuccess: () => {
      setReply("");
      queryClient.invalidateQueries({ queryKey: ["/api/support/admin/conversations", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["/api/support/admin/conversations"] });
    },
    onError: (e: any) => {
      toast({ title: "Failed to send", description: e.message || "Please try again", variant: "destructive" });
    },
  });

  const closeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/support/admin/conversations/${selectedId}/close`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/admin/conversations", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["/api/support/admin/conversations"] });
      toast({ title: "Conversation closed" });
    },
  });

  const sendReply = () => {
    if (!reply.trim() || replyMutation.isPending) return;
    replyMutation.mutate(reply.trim());
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500" data-testid="page-admin-support">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
          <MessageSquare className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-support-title">Live Support</h1>
          <p className="text-muted-foreground text-sm">Reply to customer chat messages in real time.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={toggleSound}
          className="flex-shrink-0"
          title={soundEnabled ? "Sound alerts on — click to mute" : "Sound alerts off — click to enable"}
          data-testid="button-toggle-sound"
        >
          {soundEnabled ? <Bell className="h-4 w-4 mr-1.5" /> : <BellOff className="h-4 w-4 mr-1.5" />}
          {soundEnabled ? "Sound on" : "Sound off"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-220px)] min-h-[500px]">
        {/* Conversation list */}
        <Card className="lg:col-span-1 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b font-semibold text-sm">Conversations</div>
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !conversations || conversations.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-10 px-4" data-testid="text-no-conversations">
                No customer messages yet.
              </div>
            ) : (
              <div className="divide-y">
                {conversations.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${selectedId === c.id ? "bg-muted" : ""}`}
                    data-testid={`conversation-${c.id}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">{c.name}</span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {c.unreadForAdmin && (
                          <span className="h-2 w-2 rounded-full bg-primary" data-testid={`unread-${c.id}`} />
                        )}
                        <span className="text-[11px] text-muted-foreground">{timeAgo(c.lastMessageAt)}</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{c.lastMessage || "…"}</p>
                    {c.status === "closed" && (
                      <Badge variant="secondary" className="mt-1 text-[10px]">Closed</Badge>
                    )}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </Card>

        {/* Thread */}
        <Card className="lg:col-span-2 overflow-hidden flex flex-col">
          {!selectedId || !thread ? (
            <div className="flex-1 flex items-center justify-center text-center text-muted-foreground text-sm p-6" data-testid="text-select-conversation">
              {selectedId ? <Loader2 className="h-5 w-5 animate-spin" /> : "Select a conversation to view and reply."}
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-semibold text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {thread.conversation.name}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{thread.conversation.email}</span>
                    {thread.conversation.phone && (
                      <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{thread.conversation.phone}</span>
                    )}
                  </div>
                </div>
                {thread.conversation.status !== "closed" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => closeMutation.mutate()}
                    disabled={closeMutation.isPending}
                    data-testid="button-close-conversation"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                    Close
                  </Button>
                )}
              </div>

              <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                <div className="space-y-4">
                  {thread.messages.map((m) => (
                    <div key={m.id} className={`flex gap-2 ${m.sender === "admin" ? "justify-end" : "justify-start"}`}>
                      {m.sender === "user" && (
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <User className="h-4 w-4" />
                        </div>
                      )}
                      <div
                        className={`max-w-[75%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${m.sender === "admin" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                        data-testid={`message-${m.sender}-${m.id}`}
                      >
                        {m.content}
                        <div className={`text-[10px] mt-1 ${m.sender === "admin" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                          {timeAgo(m.createdAt)}
                        </div>
                      </div>
                      {m.sender === "admin" && (
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Headset className="h-4 w-4 text-primary" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="p-3 border-t flex gap-2">
                <Input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendReply();
                    }
                  }}
                  placeholder="Type your reply…"
                  className="flex-1"
                  data-testid="input-admin-reply"
                />
                <Button onClick={sendReply} disabled={!reply.trim() || replyMutation.isPending} size="icon" data-testid="button-send-reply">
                  {replyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

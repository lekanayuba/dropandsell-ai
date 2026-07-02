import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { MessageSquare, Search, Send, User, Clock, ChevronLeft, Loader2, Paperclip, MoreHorizontal, Trash2, Inbox, Archive } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { queryClient } from "@/lib/queryClient";

export default function AdminSupport() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [replyText, setReplyText] = useState("");
  const [showMobileList, setShowMobileList] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["/api/conversations"],
    queryFn: async () => {
      const res = await fetch("/api/conversations", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch conversations");
      return res.json();
    },
    refetchInterval: 15000,
  });

  const { data: selectedConv } = useQuery({
    queryKey: ["/api/conversations", selectedId],
    queryFn: async () => {
      const res = await fetch(`/api/conversations/${selectedId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    enabled: !!selectedId,
    refetchInterval: 10000,
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/conversations/${selectedId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: replyText, role: "admin" }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to send");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", selectedId] });
      setReplyText("");
    },
    onError: () => {
      toast({ title: "Failed to send message", variant: "destructive" });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedConv?.messages]);

  const convs = Array.isArray(conversations) ? conversations : [];
  const filtered = convs.filter((c: any) =>
    c.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const selected = convs.find((c: any) => c.id === selectedId);
  const messages = selectedConv?.messages ?? [];

  const handleSelect = (id: number) => {
    setSelectedId(id);
    setShowMobileList(false);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedId) return;
    sendMutation.mutate();
  };

  return (
    <div className="h-[calc(100vh-2rem)] animate-in fade-in duration-300">
      <div className="h-full flex rounded-2xl overflow-hidden border border-border/40 bg-background shadow-sm">
        {/* Conversation List */}
        <div className={cn(
          "w-full sm:w-[360px] border-r border-border/40 flex flex-col bg-muted/10 shrink-0",
          !showMobileList && "hidden sm:flex"
        )}>
          {/* Header */}
          <div className="p-4 border-b border-border/40">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Support</h2>
                <p className="text-xs text-muted-foreground">{convs.length} conversations</p>
              </div>
              <Badge variant="secondary" className="h-6 text-[10px]">
                {convs.filter((c: any) => {
                  const msgs = c.messages ?? [];
                  return msgs.length > 0 && msgs[msgs.length - 1]?.role === "user";
                }).length} unread
              </Badge>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm bg-muted/50 border-border/40"
              />
            </div>
          </div>

          {/* List */}
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <Inbox className="h-8 w-8 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">No conversations found</p>
              </div>
            ) : (
              <div className="py-1">
                {filtered.map((conv: any) => {
                  const lastMsg = conv.messages?.[conv.messages.length - 1];
                  const hasUnread = lastMsg?.role === "user";
                  return (
                    <button
                      key={conv.id}
                      onClick={() => handleSelect(conv.id)}
                      className={cn(
                        "w-full text-left px-4 py-3.5 flex items-start gap-3 transition-colors hover:bg-muted/30 border-b border-border/10 last:border-0",
                        selectedId === conv.id && "bg-muted/40"
                      )}
                    >
                      <Avatar className="h-9 w-9 shrink-0 mt-0.5">
                        <AvatarFallback className={cn(
                          "text-xs font-medium",
                          hasUnread ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                        )}>
                          {conv.title?.charAt(0)?.toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className={cn("text-sm truncate", hasUnread ? "font-semibold" : "font-medium")}>
                            {conv.title || "Untitled"}
                          </p>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {conv.createdAt ? new Date(conv.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {lastMsg?.content || "No messages yet"}
                        </p>
                      </div>
                      {hasUnread && (
                        <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Conversation Detail */}
        <div className={cn(
          "flex-1 flex flex-col",
          showMobileList && "hidden sm:flex"
        )}>
          {selected ? (
            <>
              {/* Chat Header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 bg-muted/5 shrink-0">
                <button
                  onClick={() => setShowMobileList(true)}
                  className="sm:hidden p-1 -ml-1 hover:bg-muted rounded-md transition-colors"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                    {selected.title?.charAt(0)?.toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{selected.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Created {new Date(selected.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                    <Archive className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 px-4 py-4">
                <div className="space-y-3 max-w-3xl mx-auto">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <MessageSquare className="h-10 w-10 text-muted-foreground/30 mb-3" />
                      <p className="text-sm text-muted-foreground">No messages yet</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">Send a message to start the conversation</p>
                    </div>
                  ) : (
                    messages.map((msg: any, idx: number) => {
                      const isUser = msg.role === "user";
                      const showAvatar = idx === 0 || messages[idx - 1]?.role !== msg.role;
                      return (
                        <div key={msg.id} className={cn("flex gap-3", isUser ? "" : "flex-row-reverse")}>
                          <div className={cn(
                            "shrink-0 transition-all duration-200",
                            showAvatar ? "opacity-100" : "opacity-0 pointer-events-none"
                          )}>
                            <Avatar className="h-7 w-7">
                              <AvatarFallback className={cn(
                                "text-[10px] font-medium",
                                isUser ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-600"
                              )}>
                                {isUser ? "U" : "A"}
                              </AvatarFallback>
                            </Avatar>
                          </div>
                          <div className={cn("flex flex-col max-w-[75%]", isUser ? "items-start" : "items-end")}>
                            <div className={cn(
                              "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                              isUser
                                ? "bg-muted/80 border border-border/50 rounded-bl-md"
                                : "bg-primary/10 border border-primary/20 rounded-br-md"
                            )}>
                              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                            </div>
                            <p className="text-[10px] text-muted-foreground/60 mt-1 px-1">
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Reply Input */}
              <div className="border-t border-border/40 p-3 sm:p-4 bg-muted/5">
                <form onSubmit={handleSend} className="flex items-end gap-2 max-w-3xl mx-auto">
                  <div className="flex-1 relative">
                    <Input
                      placeholder="Type your reply..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      className="pr-10 h-11 bg-muted/30 border-border/40 text-sm rounded-xl resize-none"
                      disabled={sendMutation.isPending}
                    />
                  </div>
                  <Button
                    type="submit"
                    size="icon"
                    className="h-11 w-11 rounded-xl shrink-0 bg-primary hover:bg-primary/90"
                    disabled={!replyText.trim() || sendMutation.isPending}
                  >
                    {sendMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <h3 className="text-lg font-semibold text-muted-foreground">Select a conversation</h3>
                <p className="text-sm text-muted-foreground/60 mt-1">Choose a conversation from the list to view messages</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

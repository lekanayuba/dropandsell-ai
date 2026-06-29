import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, User, Clock, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

export default function AdminSupport() {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["/api/conversations"],
    queryFn: async () => {
      const res = await fetch("/api/conversations", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch conversations");
      return res.json();
    },
  });

  if (isLoading) return <div className="p-8">Loading conversations...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-bold font-display tracking-tight">Support Inbox</h2>
        <p className="text-muted-foreground mt-2">View user support conversations</p>
      </div>

      {(!conversations || conversations.length === 0) ? (
        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-border rounded-xl bg-muted/20">
          <MessageSquare className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No conversations yet</h3>
          <p className="text-muted-foreground text-center max-w-sm">
            User support messages will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {conversations.map((conv: any) => (
            <ConversationCard
              key={conv.id}
              conversation={conv}
              isExpanded={expandedId === conv.id}
              onToggle={() => setExpandedId(expandedId === conv.id ? null : conv.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ConversationCard({
  conversation,
  isExpanded,
  onToggle,
}: {
  conversation: any;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { data: messages } = useQuery({
    queryKey: ["/api/conversations", conversation.id],
    queryFn: async () => {
      const res = await fetch(`/api/conversations/${conversation.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    enabled: isExpanded,
  });

  const convMessages = messages?.messages ?? [];

  return (
    <Card className="overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full text-left p-4 hover:bg-muted/50 transition-colors flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          <div>
            <div className="font-medium">{conversation.title}</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <Clock className="w-3 h-3" />
              {new Date(conversation.createdAt).toLocaleDateString()}
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {convMessages.length > 0 ? `${convMessages.length} messages` : "0 messages"}
              </Badge>
            </div>
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-border">
          <ScrollArea className="h-[400px]">
            <div className="p-4 space-y-4">
              {convMessages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No messages in this conversation</p>
              ) : (
                convMessages.map((msg: any) => (
                  <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "" : "flex-row-reverse"}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${
                      msg.role === "user" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    }`}>
                      {msg.role === "user" ? "U" : "AI"}
                    </div>
                    <div className={`rounded-lg px-3 py-2 text-sm max-w-[80%] ${
                      msg.role === "user" ? "bg-primary/5 border border-primary/10" : "bg-muted/50 border border-border"
                    }`}>
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(msg.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </Card>
  );
}

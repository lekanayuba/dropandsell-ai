import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, X, Send, Loader2, Bot, User, Plus } from "lucide-react";

interface StoredMessage {
  role: "user" | "assistant";
  content: string;
}

export function SupportChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingDb, setLoadingDb] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load existing conversations on mount
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/conversations", { credentials: "include" });
        if (!res.ok) return;
        const convs = await res.json();
        if (cancelled) return;
        if (convs.length > 0) {
          const latest = convs[0];
          setConversationId(latest.id);
          setLoadingDb(true);
          const msgRes = await fetch(`/api/conversations/${latest.id}`, { credentials: "include" });
          if (msgRes.ok) {
            const data = await msgRes.json();
            if (!cancelled) setMessages(data.messages ?? []);
          }
          setLoadingDb(false);
        } else {
          setMessages([]);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [isOpen]);

  // Update title with first user message
  const updateTitle = useCallback(async (id: number, text: string) => {
    try {
      await fetch(`/api/conversations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: text.slice(0, 60) }),
        credentials: "include",
      });
    } catch {}
  }, []);

  // Create a new conversation
  const startNewChat = useCallback(async () => {
    setConversationId(null);
    setMessages([]);
    setInput("");
  }, []);

  const sendStreamingMessage = async (convId: number, text: string) => {
    abortRef.current = new AbortController();
    try {
      const userMsg: StoredMessage = { role: "user", content: text };
      const updated = [...messages, userMsg];
      setMessages(updated);
      setInput("");

      const assistantMsg: StoredMessage = { role: "assistant", content: "" };
      setMessages([...updated, assistantMsg]);
      setIsLoading(true);

      const res = await fetch(`/api/conversations/${convId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
        credentials: "include",
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error("Failed to send message");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.done) break;
            if (data.content) {
              setMessages(prev => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last && last.role === "assistant") {
                  next[next.length - 1] = { ...last, content: last.content + data.content };
                }
                return next;
              });
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      setMessages(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === "assistant" && !last.content) {
          next[next.length - 1] = {
            role: "assistant",
            content: "Sorry, I'm having trouble connecting. Please try again or contact support.",
          };
        }
        return next;
      });
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    // Create conversation if needed
    if (!conversationId) {
      try {
        const res = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: text.slice(0, 60) }),
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to create conversation");
        const conv = await res.json();
        setConversationId(conv.id);
        await sendStreamingMessage(conv.id, text);
        updateTitle(conv.id, text);
      } catch {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: "Failed to start conversation. Please try again.",
        }]);
      }
    } else {
      await sendStreamingMessage(conversationId, text);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <>
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
          size="icon"
          data-testid="button-open-chat"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      )}

      {isOpen && (
        <Card className="fixed bottom-6 right-6 w-[380px] h-[calc(100vh-4rem)] max-h-[540px] shadow-2xl z-50 flex flex-col" data-testid="chat-widget">
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 py-3 px-4 border-b bg-primary text-primary-foreground rounded-t-lg">
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="h-5 w-5" />
              DropandSell Support
            </CardTitle>
            <div className="flex items-center gap-1">
              {conversationId && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={startNewChat}
                  className="h-8 w-8 text-primary-foreground hover:bg-primary/80"
                  title="New chat"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8 text-primary-foreground hover:bg-primary/80"
                data-testid="button-close-chat"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
            <ScrollArea className="flex-1" ref={scrollRef}>
              {loadingDb ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <Bot className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Ask me anything about managing your store!
                  </p>
                </div>
              ) : (
                <div className="space-y-4 p-4">
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {message.role === "assistant" && (
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Bot className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      <div
                        className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                        data-testid={`message-${message.role}-${index}`}
                      >
                        {message.content}
                      </div>
                      {message.role === "user" && (
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <User className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                  ))}
                  {isLoading && messages[messages.length - 1]?.role === "user" && (
                    <div className="flex gap-2 justify-start">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                      <div className="bg-muted rounded-lg px-3 py-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
            <div className="p-4 border-t bg-background">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Ask a question..."
                  disabled={isLoading}
                  className="flex-1"
                  data-testid="input-chat-message"
                />
                <Button
                  onClick={sendMessage}
                  disabled={!input.trim() || isLoading}
                  size="icon"
                  data-testid="button-send-message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

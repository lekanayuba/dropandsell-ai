import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MessageCircle, X, Send, Loader2, Bot, User, Trash2, UserRound, ArrowLeft, Headset } from "lucide-react";
import { searchFaq, faqData } from "@/lib/faq-data";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AgentMessage {
  id: number;
  sender: "user" | "admin";
  content: string;
  createdAt: string;
}

const STORAGE_KEY = "dropandsell_chat_history";
const AGENT_CONV_KEY = "dropandsell_support_conv_id";
const INITIAL_MESSAGE: Message = {
  role: "assistant",
  content: "Hi! I'm your DropandSell assistant. Ask me anything about the platform, or pick a topic below!",
};

function loadMessages(): Message[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [INITIAL_MESSAGE];
}

function saveMessages(messages: Message[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {}
}

function loadConvId(): number | null {
  try {
    const stored = localStorage.getItem(AGENT_CONV_KEY);
    if (stored) {
      const n = Number(stored);
      if (Number.isFinite(n)) return n;
    }
  } catch {}
  return null;
}

export function SupportChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(loadMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(() => {
    const stored = loadMessages();
    return stored.length <= 1;
  });
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactFirstName, setContactFirstName] = useState("");
  const [contactLastName, setContactLastName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactSending, setContactSending] = useState(false);

  // Live agent chat state
  const [agentConvId, setAgentConvId] = useState<number | null>(loadConvId);
  const [showAgentThread, setShowAgentThread] = useState(false);
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);
  const [agentInput, setAgentInput] = useState("");
  const [agentSending, setAgentSending] = useState(false);
  const [agentUnread, setAgentUnread] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const agentScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (agentScrollRef.current) {
      agentScrollRef.current.scrollTop = agentScrollRef.current.scrollHeight;
    }
  }, [agentMessages, showAgentThread]);

  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  // Fetch the user's current support conversation (admin replies included)
  const fetchAgentThread = useCallback(async (markRead: boolean) => {
    try {
      const res = await fetch("/api/support/mine", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.conversation) {
        setAgentConvId(data.conversation.id);
        try { localStorage.setItem(AGENT_CONV_KEY, String(data.conversation.id)); } catch {}
        setAgentMessages(data.messages || []);
        if (!markRead) {
          setAgentUnread(!!data.conversation.unreadForUser);
        } else {
          setAgentUnread(false);
        }
      } else {
        // No conversation for this account — clear any stale local state
        setAgentConvId(null);
        setAgentMessages([]);
        setAgentUnread(false);
        setShowAgentThread(false);
        try { localStorage.removeItem(AGENT_CONV_KEY); } catch {}
      }
    } catch {}
  }, []);

  // Poll for new admin replies while the widget is open
  useEffect(() => {
    if (!isOpen) return;
    fetchAgentThread(showAgentThread);
    const interval = setInterval(() => {
      fetchAgentThread(showAgentThread);
    }, 5000);
    return () => clearInterval(interval);
  }, [isOpen, showAgentThread, fetchAgentThread]);

  const popularQuestions = [
    "How do I connect my store?",
    "Can I connect multiple stores?",
    "How do I publish to all stores at once?",
    "How do I import products?",
    "What is automated fulfillment?",
    "How does the referral programme work?",
  ];

  const handleQuestionClick = (question: string) => {
    setShowSuggestions(false);
    processMessage(question);
  };

  const clearHistory = useCallback(() => {
    const fresh = [INITIAL_MESSAGE];
    setMessages(fresh);
    setShowSuggestions(true);
    saveMessages(fresh);
  }, []);

  const processMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: messageText.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setShowSuggestions(false);

    const faqMatch = searchFaq(messageText);

    if (faqMatch) {
      const withFaq = [
        ...updatedMessages,
        { role: "assistant" as const, content: faqMatch.a }
      ];
      setMessages(withFaq);
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/support-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();
      setMessages([...updatedMessages, { role: "assistant", content: data.reply }]);
    } catch (error) {
      setMessages([
        ...updatedMessages,
        {
          role: "assistant",
          content: "Sorry, I'm having trouble connecting. Please try again or contact support at support@dropandsell.com.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    await processMessage(input);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const openAgentThread = async () => {
    setShowContactForm(false);
    setShowAgentThread(true);
    await fetchAgentThread(true);
  };

  const handleTalkToAgent = () => {
    if (agentConvId) {
      openAgentThread();
    } else {
      setShowContactForm(true);
    }
  };

  const handleContactSubmit = async () => {
    if (!contactFirstName.trim() || !contactLastName.trim() || !contactEmail.trim() || !contactMessage.trim()) return;
    setContactSending(true);
    try {
      const response = await fetch("/api/support/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: `${contactFirstName.trim()} ${contactLastName.trim()}`,
          email: contactEmail.trim(),
          phone: contactPhone.trim(),
          message: contactMessage.trim(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.conversationId) {
          setAgentConvId(data.conversationId);
          try { localStorage.setItem(AGENT_CONV_KEY, String(data.conversationId)); } catch {}
        }
        setShowContactForm(false);
        setShowAgentThread(true);
        await fetchAgentThread(true);
      } else {
        const data = await response.json().catch(() => ({}));
        setMessages(prev => [
          ...prev,
          { role: "assistant", content: data.message || "Failed to send your message. Please try again." }
        ]);
        setShowContactForm(false);
      }
    } catch {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "Failed to send your message. Please try again later." }
      ]);
      setShowContactForm(false);
    } finally {
      setContactSending(false);
    }
  };

  const sendAgentMessage = async () => {
    const text = agentInput.trim();
    if (!text || !agentConvId || agentSending) return;
    setAgentSending(true);
    setAgentInput("");
    // Optimistic append
    setAgentMessages(prev => [
      ...prev,
      { id: Date.now(), sender: "user", content: text, createdAt: new Date().toISOString() },
    ]);
    try {
      await fetch(`/api/support/${agentConvId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: text }),
      });
      await fetchAgentThread(true);
    } catch {}
    finally {
      setAgentSending(false);
    }
  };

  const resetContactForm = () => {
    setShowContactForm(false);
    setContactFirstName("");
    setContactLastName("");
    setContactEmail("");
    setContactPhone("");
    setContactMessage("");
  };

  return (
    <>
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 right-6 h-14 w-14 rounded-full shadow-lg z-50"
          size="icon"
          data-testid="button-open-chat"
        >
          <MessageCircle className="h-6 w-6" />
          {agentUnread && (
            <span className="absolute top-0 right-0 h-3.5 w-3.5 rounded-full bg-red-500 border-2 border-background" data-testid="badge-agent-unread" />
          )}
        </Button>
      )}

      {isOpen && (
        <Card className="fixed bottom-20 right-6 w-[380px] h-[500px] shadow-2xl z-50 flex flex-col" data-testid="chat-widget">
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 py-3 px-4 border-b bg-primary text-primary-foreground rounded-t-lg">
            <CardTitle className="text-base flex items-center gap-2">
              {showAgentThread ? <Headset className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
              {showAgentThread ? "Support Agent" : "DropandSell Support"}
            </CardTitle>
            <div className="flex items-center gap-1">
              {!showAgentThread && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearHistory}
                  className="h-8 w-8 text-primary-foreground hover:text-primary-foreground hover:bg-primary-foreground/20"
                  title="Clear chat history"
                  data-testid="button-clear-chat"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8 text-primary-foreground hover:text-primary-foreground hover:bg-primary-foreground/20"
                data-testid="button-close-chat"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
            {showAgentThread ? (
              <>
                <div className="px-3 py-2 border-b flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => setShowAgentThread(false)} className="h-7 w-7" data-testid="button-back-from-agent">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <p className="text-xs text-muted-foreground">You're chatting with our support team. Replies appear here.</p>
                </div>
                <ScrollArea className="flex-1 p-4" ref={agentScrollRef}>
                  <div className="space-y-4">
                    {agentMessages.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-6">No messages yet.</p>
                    )}
                    {agentMessages.map((m) => (
                      <div key={m.id} className={`flex gap-2 ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
                        {m.sender === "admin" && (
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Headset className="h-4 w-4 text-primary" />
                          </div>
                        )}
                        <div
                          className={`max-w-[75%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                            m.sender === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                          }`}
                          data-testid={`agent-message-${m.sender}-${m.id}`}
                        >
                          {m.content}
                        </div>
                        {m.sender === "user" && (
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                            <User className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <div className="p-3 border-t flex gap-2">
                  <Input
                    value={agentInput}
                    onChange={(e) => setAgentInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendAgentMessage();
                      }
                    }}
                    placeholder="Type your message..."
                    disabled={agentSending}
                    className="flex-1"
                    data-testid="input-agent-message"
                  />
                  <Button onClick={sendAgentMessage} disabled={!agentInput.trim() || agentSending} size="icon" data-testid="button-send-agent-message">
                    {agentSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </>
            ) : showContactForm ? (
              <div className="flex-1 p-4 overflow-y-auto">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Button variant="ghost" size="icon" onClick={resetContactForm} className="h-8 w-8" data-testid="button-back-from-contact">
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <h3 className="font-semibold">Talk to an Agent</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">Fill in your details and our support team will reply right here in this chat.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label htmlFor="contact-first-name" className="text-sm">First Name</Label>
                      <Input
                        id="contact-first-name"
                        value={contactFirstName}
                        onChange={(e) => setContactFirstName(e.target.value)}
                        placeholder="First Name"
                        data-testid="input-contact-first-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contact-last-name" className="text-sm">Last Name</Label>
                      <Input
                        id="contact-last-name"
                        value={contactLastName}
                        onChange={(e) => setContactLastName(e.target.value)}
                        placeholder="Last Name"
                        data-testid="input-contact-last-name"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-email" className="text-sm">Email Address</Label>
                    <Input
                      id="contact-email"
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="you@example.com"
                      data-testid="input-contact-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-phone" className="text-sm">Phone Number</Label>
                    <Input
                      id="contact-phone"
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="+44 7700 900000"
                      data-testid="input-contact-phone"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-message" className="text-sm">Your Message</Label>
                    <Textarea
                      id="contact-message"
                      value={contactMessage}
                      onChange={(e) => setContactMessage(e.target.value)}
                      placeholder="Describe your issue or question..."
                      rows={4}
                      data-testid="input-contact-message"
                    />
                  </div>
                  <Button
                    onClick={handleContactSubmit}
                    disabled={!contactFirstName.trim() || !contactLastName.trim() || !contactEmail.trim() || !contactMessage.trim() || contactSending}
                    className="w-full"
                    data-testid="button-submit-contact"
                  >
                    {contactSending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Starting chat...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Start Chat with Support
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                  <div className="space-y-4">
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

                    {showSuggestions && messages.length <= 1 && (
                      <div className="space-y-2 mt-2">
                        <p className="text-xs text-muted-foreground font-medium">Popular questions:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {popularQuestions.map((q, i) => (
                            <button
                              key={i}
                              onClick={() => handleQuestionClick(q)}
                              className="text-xs bg-primary/5 hover:bg-primary/10 text-primary border border-primary/20 rounded-full px-3 py-1.5 transition-colors text-left"
                              data-testid={`suggestion-${i}`}
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {isLoading && (
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
                </ScrollArea>
                <div className="p-3 border-t space-y-2">
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
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs relative"
                    onClick={handleTalkToAgent}
                    data-testid="button-talk-to-agent"
                  >
                    <UserRound className="h-3.5 w-3.5 mr-1.5" />
                    {agentConvId ? "Open Agent Chat" : "Talk to an Agent"}
                    {agentUnread && (
                      <span className="absolute top-1 right-2 h-2 w-2 rounded-full bg-red-500" data-testid="badge-agent-unread-button" />
                    )}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}

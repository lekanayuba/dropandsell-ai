import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MessageCircle, X, Send, Loader2, Bot, User, Trash2, UserRound, ArrowLeft } from "lucide-react";
import { searchFaq, faqData } from "@/lib/faq-data";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const STORAGE_KEY = "dropandsell_chat_history";
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
  const [contactSent, setContactSent] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

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

  const handleContactSubmit = async () => {
    if (!contactFirstName.trim() || !contactLastName.trim() || !contactEmail.trim() || !contactMessage.trim()) return;
    setContactSending(true);
    try {
      const chatHistoryText = messages
        .map(m => `${m.role === 'user' ? 'You' : 'Bot'}: ${m.content}`)
        .join('\n');

      const response = await fetch("/api/contact-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: `${contactFirstName.trim()} ${contactLastName.trim()}`,
          email: contactEmail.trim(),
          phone: contactPhone.trim(),
          message: contactMessage.trim(),
          chatHistory: chatHistoryText,
        }),
      });

      if (response.ok) {
        setContactSent(true);
        setMessages(prev => [
          ...prev,
          { role: "assistant", content: "Your message has been sent to our support team. We'll get back to you via email shortly!" }
        ]);
      } else {
        const data = await response.json();
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

  const resetContactForm = () => {
    setShowContactForm(false);
    setContactSent(false);
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
        </Button>
      )}

      {isOpen && (
        <Card className="fixed bottom-20 right-6 w-[380px] h-[500px] shadow-2xl z-50 flex flex-col" data-testid="chat-widget">
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 py-3 px-4 border-b bg-primary text-primary-foreground rounded-t-lg">
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="h-5 w-5" />
              DropandSell Support
            </CardTitle>
            <div className="flex items-center gap-1">
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
            {showContactForm ? (
              <div className="flex-1 p-4 overflow-y-auto">
                {contactSent ? (
                  <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                    <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <UserRound className="h-8 w-8 text-green-600" />
                    </div>
                    <h3 className="font-semibold text-lg">Message Sent!</h3>
                    <p className="text-sm text-muted-foreground">Our support team will respond to your email shortly.</p>
                    <Button variant="outline" onClick={resetContactForm} data-testid="button-back-to-chat">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back to Chat
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Button variant="ghost" size="icon" onClick={resetContactForm} className="h-8 w-8" data-testid="button-back-from-contact">
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                      <h3 className="font-semibold">Talk to an Agent</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">Fill in your details below and our support team will get back to you via email.</p>
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
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Send to Support Team
                        </>
                      )}
                    </Button>
                  </div>
                )}
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
                    className="w-full text-xs"
                    onClick={() => setShowContactForm(true)}
                    data-testid="button-talk-to-agent"
                  >
                    <UserRound className="h-3.5 w-3.5 mr-1.5" />
                    Talk to an Agent
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

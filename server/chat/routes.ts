import type { Express, Request, Response } from "express";
import OpenAI from "openai";
import { chatStorage } from "./storage";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SUPPORT_SYSTEM_PROMPT = `You are the AI Support Assistant for DropandSell AI, a dropshipping automation platform. Your role is to help users with questions about the platform.

Key features you can explain:
- **Stores**: Connect Shopify, eBay, and Amazon marketplace stores
- **Vendors**: Add suppliers like AliExpress, CJ Dropshipping, or custom vendors
- **Products**: Import via CSV or browser extension, manage inventory
- **Pricing Rules**: Set markup percentages, margins, or fixed amounts
- **Publish Queue**: Stage products and publish to connected stores
- **VERO List**: Block restricted brands/keywords that violate marketplace policies
- **Content Filters**: Prevent personal info (emails, phones) in listings
- **Restricted Products**: Block dangerous items (knives, chemicals, drugs)
- **Orders**: Track and sync orders across marketplaces
- **Wallet**: Manage funds, referral earnings (10% commission), usage points
- **Subscription Plans**: 6 tiers from £12-£100/month based on listing count

Guidelines:
- Be helpful, friendly, and concise
- If you don't know something, say so and suggest contacting support
- Focus on platform features, not technical implementation
- Use simple language, avoid jargon
- Respond in the same language the user writes`;

export function registerChatRoutes(app: Express): void {
  // Get all conversations for a user
  app.get("/api/conversations", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const conversations = userId
        ? await chatStorage.getAllConversations(userId)
        : await chatStorage.getAllConversations();
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  // Get single conversation with messages
  app.get("/api/conversations/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      const conversation = await chatStorage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      const messages = await chatStorage.getMessagesByConversation(id);
      res.json({ ...conversation, messages });
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  // Create new conversation
  app.post("/api/conversations", async (req: Request, res: Response) => {
    try {
      const { title } = req.body;
      const userId = (req as any).user?.id;
      const conversation = await chatStorage.createConversation(title || "New Chat", userId);
      res.status(201).json(conversation);
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  // Update conversation title
  app.put("/api/conversations/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      const { title } = req.body;
      const conversation = await chatStorage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      await chatStorage.updateConversationTitle(id, title);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating conversation:", error);
      res.status(500).json({ error: "Failed to update conversation" });
    }
  });

  // Delete conversation
  app.delete("/api/conversations/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      await chatStorage.deleteConversation(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({ error: "Failed to delete conversation" });
    }
  });

  // Send message and get AI response (streaming)
  app.post("/api/conversations/:id/messages", async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id as string);
      const { content } = req.body;

      // Save user message
      await chatStorage.createMessage(conversationId, "user", content);

      // Get conversation history for context
      const messages = await chatStorage.getMessagesByConversation(conversationId);
      const chatMessages = [
        { role: "system" as const, content: SUPPORT_SYSTEM_PROMPT },
        ...messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ];

      // Set up SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");

      // Stream response from OpenAI
      const stream = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: chatMessages,
        stream: true,
        max_tokens: 2048,
      });

      let fullResponse = "";

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          fullResponse += content;
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      // Save assistant message
      await chatStorage.createMessage(conversationId, "assistant", fullResponse);

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Error sending message:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Failed to send message" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to send message" });
      }
    }
  });
}

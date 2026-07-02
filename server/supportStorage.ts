import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "./db";
import {
  supportConversations,
  supportMessages,
  type SupportConversation,
  type SupportMessage,
} from "@shared/schema";

export async function createSupportConversation(data: {
  userId?: string | null;
  name: string;
  email: string;
  phone?: string | null;
  message: string;
}): Promise<SupportConversation> {
  const [conversation] = await db
    .insert(supportConversations)
    .values({
      userId: data.userId ?? null,
      name: data.name,
      email: data.email,
      phone: data.phone ?? null,
      unreadForAdmin: true,
      unreadForUser: false,
    })
    .returning();

  await db.insert(supportMessages).values({
    conversationId: conversation.id,
    sender: "user",
    content: data.message,
  });

  return conversation;
}

export async function addSupportMessage(
  conversationId: number,
  sender: "user" | "admin",
  content: string,
): Promise<SupportMessage> {
  const [msg] = await db
    .insert(supportMessages)
    .values({ conversationId, sender, content })
    .returning();

  await db
    .update(supportConversations)
    .set({
      lastMessageAt: sql`CURRENT_TIMESTAMP`,
      status: "open",
      unreadForAdmin: sender === "user",
      unreadForUser: sender === "admin",
    })
    .where(eq(supportConversations.id, conversationId));

  return msg;
}

export async function getSupportConversationById(
  conversationId: number,
): Promise<SupportConversation | undefined> {
  const [conversation] = await db
    .select()
    .from(supportConversations)
    .where(eq(supportConversations.id, conversationId));
  return conversation;
}

export async function getLatestUserConversation(
  userId: string,
): Promise<SupportConversation | undefined> {
  const [conversation] = await db
    .select()
    .from(supportConversations)
    .where(eq(supportConversations.userId, userId))
    .orderBy(desc(supportConversations.lastMessageAt))
    .limit(1);
  return conversation;
}

export async function getSupportMessages(
  conversationId: number,
): Promise<SupportMessage[]> {
  return db
    .select()
    .from(supportMessages)
    .where(eq(supportMessages.conversationId, conversationId))
    .orderBy(supportMessages.createdAt);
}

export async function listSupportConversations(): Promise<
  (SupportConversation & { lastMessage: string | null; messageCount: number })[]
> {
  const conversations = await db
    .select()
    .from(supportConversations)
    .orderBy(desc(supportConversations.lastMessageAt));

  const enriched = await Promise.all(
    conversations.map(async (c) => {
      const msgs = await getSupportMessages(c.id);
      const last = msgs[msgs.length - 1];
      return {
        ...c,
        lastMessage: last ? last.content : null,
        messageCount: msgs.length,
      };
    }),
  );
  return enriched;
}

export async function countAdminUnread(): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(supportConversations)
    .where(eq(supportConversations.unreadForAdmin, true));
  return row?.count ?? 0;
}

export async function markConversationRead(
  conversationId: number,
  side: "admin" | "user",
): Promise<void> {
  await db
    .update(supportConversations)
    .set(side === "admin" ? { unreadForAdmin: false } : { unreadForUser: false })
    .where(eq(supportConversations.id, conversationId));
}

export async function setConversationStatus(
  conversationId: number,
  status: "open" | "closed",
): Promise<void> {
  await db
    .update(supportConversations)
    .set({ status })
    .where(eq(supportConversations.id, conversationId));
}

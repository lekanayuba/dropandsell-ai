import { pgTable, serial, integer, text, timestamp, varchar, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

export const supportConversations = pgTable("support_conversations", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  status: varchar("status", { length: 20 }).default("open").notNull(),
  lastMessageAt: timestamp("last_message_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  unreadForAdmin: boolean("unread_for_admin").default(true).notNull(),
  unreadForUser: boolean("unread_for_user").default(false).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const supportMessages = pgTable("support_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => supportConversations.id, { onDelete: "cascade" }),
  sender: varchar("sender", { length: 10 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertSupportConversationSchema = createInsertSchema(supportConversations).omit({
  id: true,
  status: true,
  lastMessageAt: true,
  unreadForAdmin: true,
  unreadForUser: true,
  createdAt: true,
});

export const insertSupportMessageSchema = createInsertSchema(supportMessages).omit({
  id: true,
  createdAt: true,
});

export type SupportConversation = typeof supportConversations.$inferSelect;
export type InsertSupportConversation = z.infer<typeof insertSupportConversationSchema>;
export type SupportMessage = typeof supportMessages.$inferSelect;
export type InsertSupportMessage = z.infer<typeof insertSupportMessageSchema>;

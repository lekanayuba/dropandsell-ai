import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User storage table.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  password: varchar("password"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  phone: varchar("phone", { length: 20 }),
  profileImageUrl: varchar("profile_image_url"),
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeConnectAccountId: varchar("stripe_connect_account_id"),
  emailVerified: timestamp("email_verified"),
  verificationToken: varchar("verification_token"),
  verificationTokenExpiry: timestamp("verification_token_expiry"),
  policiesAccepted: timestamp("policies_accepted"),
  onboardingCompleted: timestamp("onboarding_completed"),
  paymentSkipped: timestamp("payment_skipped"),
  subscriptionPlan: varchar("subscription_plan"),
  subscriptionStatus: varchar("subscription_status"),
  billingInterval: varchar("billing_interval", { length: 10 }),
  referralCode: varchar("referral_code").unique(),
  referredBy: varchar("referred_by"),
  apiKey: varchar("api_key").unique(),
  uniqueUrl: varchar("unique_url").unique(),
  profileChangeCode: varchar("profile_change_code", { length: 6 }),
  profileChangeCodeExpiry: timestamp("profile_change_code_expiry"),
  profileChangePending: jsonb("profile_change_pending"),
  resetPasswordToken: varchar("reset_password_token"),
  resetPasswordTokenExpiry: timestamp("reset_password_token_expiry"),
  currency: varchar("currency", { length: 3 }).default("GBP"),
  disclaimerAccepted: timestamp("disclaimer_accepted"),
  isAdmin: varchar("is_admin", { length: 5 }).default("false"),
  // Per-user store rules (toggled on dashboard, applied across all stores).
  autoRestockEnabled: boolean("auto_restock_enabled").default(false),
  autoRestockBuffer: integer("auto_restock_buffer").default(10),
  defaultProfitEnabled: boolean("default_profit_enabled").default(false),
  defaultProfitPercentage: integer("default_profit_percentage").default(30),
  // Safety net: when a product's vendor stock check has failed 3+ times in a
  // row (confidence='low'), automatically end the live eBay listing so we
  // never sell something we can't verify. The user is emailed and can re-list
  // with one click. Default ON because the harm of selling an unavailable
  // item is far worse than the harm of pausing a still-available one.
  autoPauseOnFailedStock: boolean("auto_pause_on_failed_stock").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

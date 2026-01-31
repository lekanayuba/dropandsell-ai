import { pgTable, text, serial, integer, boolean, timestamp, jsonb, decimal, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./models/auth";

// Export auth models so they are available
export * from "./models/auth";

// === TABLE DEFINITIONS ===

// Stores (Marketplace connections)
export const stores = pgTable("stores", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  platform: text("platform").notNull(), // 'shopify', 'amazon', 'ebay', etc.
  credentials: jsonb("credentials").notNull(), // Encrypted API keys, tokens
  status: text("status").notNull().default("active"), // 'active', 'inactive', 'error'
  lastSync: timestamp("last_sync"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Vendors (Suppliers)
export const vendors = pgTable("vendors", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  website: text("website"),
  integrationType: text("integration_type").notNull().default("custom"), // 'api', 'csv', 'feed', 'custom'
  config: jsonb("config"), // API endpoints, CSV mapping rules
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Products (Unified internal schema)
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  vendorId: integer("vendor_id").references(() => vendors.id),
  title: text("title").notNull(),
  description: text("description"),
  sku: text("sku").notNull(),
  costPrice: decimal("cost_price", { precision: 10, scale: 2 }).notNull(),
  sellingPrice: decimal("selling_price", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull().default(0),
  images: text("images").array(),
  attributes: jsonb("attributes"), // Color, size, etc.
  veroStatus: text("vero_status").default("clean"), // 'clean', 'flagged', 'blocked'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Marketplace Listings (Link internal products to store listings)
export const marketplaceListings = pgTable("marketplace_listings", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").notNull().references(() => stores.id),
  productId: integer("product_id").notNull().references(() => products.id),
  externalId: text("external_id").notNull(), // ID on the marketplace
  status: text("status").notNull().default("active"), // 'active', 'ended', 'error'
  syncStatus: text("sync_status").default("synced"),
  lastSync: timestamp("last_sync"),
});

// Orders
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  storeId: integer("store_id").references(() => stores.id),
  externalOrderId: text("external_order_id"),
  customerName: text("customer_name"),
  customerEmail: text("customer_email"),
  shippingAddress: jsonb("shipping_address"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }),
  status: text("status").notNull().default("pending"), // 'pending', 'processing', 'shipped', 'cancelled'
  fulfillmentStatus: text("fulfillment_status").default("unfulfilled"),
  trackingNumber: text("tracking_number"),
  carrier: text("carrier"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Wallet & Transactions
export const wallet = pgTable("wallet", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().unique().references(() => users.id),
  balance: decimal("balance", { precision: 12, scale: 2 }).notNull().default("0.00"),
  currency: text("currency").default("USD"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  walletId: integer("wallet_id").notNull().references(() => wallet.id),
  type: text("type").notNull(), // 'deposit', 'withdrawal', 'payment', 'refund', 'referral_bonus'
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  referenceId: text("reference_id"), // Order ID or external transaction ID
  status: text("status").notNull().default("completed"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Subscriptions (Stripe mapping)
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  stripeSubscriptionId: text("stripe_subscription_id"),
  planName: text("plan_name"),
  status: text("status").notNull().default("active"),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Referrals
export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: varchar("referrer_id").notNull().references(() => users.id),
  referredUserId: varchar("referred_user_id").notNull().references(() => users.id),
  status: text("status").default("pending"),
  totalEarnings: decimal("total_earnings", { precision: 10, scale: 2 }).default("0.00"),
  createdAt: timestamp("created_at").defaultNow(),
});

// === RELATIONS ===
export const usersRelations = relations(users, ({ one, many }) => ({
  stores: many(stores),
  vendors: many(vendors),
  wallet: one(wallet),
  subscription: one(subscriptions),
  referrals: many(referrals, { relationName: "referrer" }),
}));

export const storesRelations = relations(stores, ({ one, many }) => ({
  user: one(users, { fields: [stores.userId], references: [users.id] }),
  listings: many(marketplaceListings),
  orders: many(orders),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  user: one(users, { fields: [products.userId], references: [users.id] }),
  vendor: one(vendors, { fields: [products.vendorId], references: [vendors.id] }),
  listings: many(marketplaceListings),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  store: one(stores, { fields: [orders.storeId], references: [stores.id] }),
  user: one(users, { fields: [orders.userId], references: [users.id] }),
}));

// === ZOD SCHEMAS ===

// Stores
export const insertStoreSchema = createInsertSchema(stores).omit({ id: true, userId: true, lastSync: true, createdAt: true });
export type InsertStore = z.infer<typeof insertStoreSchema>;
export type Store = typeof stores.$inferSelect;

// Vendors
export const insertVendorSchema = createInsertSchema(vendors).omit({ id: true, userId: true, createdAt: true });
export type InsertVendor = z.infer<typeof insertVendorSchema>;
export type Vendor = typeof vendors.$inferSelect;

// Products
export const insertProductSchema = createInsertSchema(products).omit({ id: true, userId: true, createdAt: true, updatedAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

// Orders
export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, userId: true, createdAt: true, updatedAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

// Wallet
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, walletId: true, createdAt: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type Wallet = typeof wallet.$inferSelect;

// Subscriptions
export type Subscription = typeof subscriptions.$inferSelect;

// API Request/Response Types
export type CreateStoreRequest = InsertStore;
export type UpdateStoreRequest = Partial<InsertStore>;

export type CreateVendorRequest = InsertVendor;
export type UpdateVendorRequest = Partial<InsertVendor>;

export type CreateProductRequest = InsertProduct;
export type UpdateProductRequest = Partial<InsertProduct>;

export type WalletBalanceResponse = {
  balance: number;
  currency: string;
};

export type DashboardStatsResponse = {
  totalRevenue: number;
  totalOrders: number;
  activeListings: number;
  walletBalance: number;
};

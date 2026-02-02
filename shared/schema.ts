import { pgTable, text, serial, integer, boolean, timestamp, jsonb, decimal, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./models/auth";

// Export auth models so they are available
export * from "./models/auth";

// Export chat models for AI integrations
export * from "./models/chat";

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
  deliveryType: text("delivery_type").default("buyer_pays"), // 'free', 'seller_pays', 'buyer_pays'
  deliveryCost: decimal("delivery_cost", { precision: 10, scale: 2 }).default("0"),
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

// === AUTOMATION TABLES ===

// Pricing Rules for automated markup/margin calculations
export const pricingRules = pgTable("pricing_rules", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  ruleType: text("rule_type").notNull().default("markup"), // 'markup', 'margin', 'fixed'
  value: decimal("value", { precision: 10, scale: 2 }).notNull(), // Percentage or fixed amount
  minPrice: decimal("min_price", { precision: 10, scale: 2 }), // Optional minimum selling price
  maxPrice: decimal("max_price", { precision: 10, scale: 2 }), // Optional maximum selling price
  applyToVendor: integer("apply_to_vendor").references(() => vendors.id), // Null = all vendors
  applyToCategory: text("apply_to_category"), // Optional category filter
  priority: integer("priority").notNull().default(0), // Higher = applied first
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Import Jobs for tracking CSV/API imports
export const importJobs = pgTable("import_jobs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  vendorId: integer("vendor_id").references(() => vendors.id),
  source: text("source").notNull(), // 'csv', 'api', 'manual'
  fileName: text("file_name"),
  fieldMapping: jsonb("field_mapping"), // Maps CSV columns to product fields
  status: text("status").notNull().default("pending"), // 'pending', 'processing', 'completed', 'failed'
  totalRows: integer("total_rows").default(0),
  processedRows: integer("processed_rows").default(0),
  successCount: integer("success_count").default(0),
  errorCount: integer("error_count").default(0),
  errors: jsonb("errors"), // Array of error messages
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Publish Queue for staging products before publishing to marketplaces
export const publishQueue = pgTable("publish_queue", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  productId: integer("product_id").notNull().references(() => products.id),
  storeId: integer("store_id").notNull().references(() => stores.id),
  calculatedPrice: decimal("calculated_price", { precision: 10, scale: 2 }).notNull(),
  pricingRuleId: integer("pricing_rule_id").references(() => pricingRules.id),
  quantity: integer("quantity").notNull().default(1),
  aiDescription: text("ai_description"),
  postageType: text("postage_type").default("store_default"), // 'store_default', 'free', 'seller_pays'
  postageCost: decimal("postage_cost", { precision: 10, scale: 2 }),
  status: text("status").notNull().default("pending"), // 'pending', 'approved', 'publishing', 'published', 'failed'
  errorMessage: text("error_message"),
  scheduledAt: timestamp("scheduled_at"),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// VERO List - Restricted brands/keywords that cannot be listed
export const veroList = pgTable("vero_list", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: text("type").notNull().default("brand"), // 'brand', 'keyword', 'sku'
  value: text("value").notNull(), // The brand name, keyword, or SKU pattern
  platform: text("platform"), // Optional: 'ebay', 'amazon', null = all platforms
  reason: text("reason"), // Why this item is on VERO list
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Content Filters - Prevent personal information in listings
export const contentFilters = pgTable("content_filters", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // 'email', 'phone', 'url', 'social', 'custom'
  pattern: text("pattern"), // Custom regex pattern (for 'custom' type)
  description: text("description"), // User-friendly description
  isActive: boolean("is_active").notNull().default(true),
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

// Pricing Rules
export const insertPricingRuleSchema = createInsertSchema(pricingRules).omit({ id: true, userId: true, createdAt: true });
export type InsertPricingRule = z.infer<typeof insertPricingRuleSchema>;
export type PricingRule = typeof pricingRules.$inferSelect;

// Import Jobs
export const insertImportJobSchema = createInsertSchema(importJobs).omit({ id: true, userId: true, createdAt: true, completedAt: true });
export type InsertImportJob = z.infer<typeof insertImportJobSchema>;
export type ImportJob = typeof importJobs.$inferSelect;

// Publish Queue
export const insertPublishQueueSchema = createInsertSchema(publishQueue).omit({ id: true, userId: true, createdAt: true, publishedAt: true });
export type InsertPublishQueue = z.infer<typeof insertPublishQueueSchema>;
export type PublishQueueItem = typeof publishQueue.$inferSelect;

// Marketplace Listings
export const insertMarketplaceListingSchema = createInsertSchema(marketplaceListings).omit({ id: true, lastSync: true });
export type InsertMarketplaceListing = z.infer<typeof insertMarketplaceListingSchema>;
export type MarketplaceListing = typeof marketplaceListings.$inferSelect;

// VERO List
export const insertVeroListSchema = createInsertSchema(veroList).omit({ id: true, userId: true, createdAt: true });
export type InsertVeroItem = z.infer<typeof insertVeroListSchema>;
export type VeroItem = typeof veroList.$inferSelect;

// Content Filters
export const insertContentFilterSchema = createInsertSchema(contentFilters).omit({ id: true, userId: true, createdAt: true });
export type InsertContentFilter = z.infer<typeof insertContentFilterSchema>;
export type ContentFilter = typeof contentFilters.$inferSelect;

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

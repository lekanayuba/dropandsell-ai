import { pgTable, text, serial, integer, boolean, timestamp, jsonb, decimal, varchar, uniqueIndex } from "drizzle-orm/pg-core";
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
  brand: text("brand").default(""),
  sku: text("sku").notNull(),
  costPrice: decimal("cost_price", { precision: 10, scale: 2 }).notNull(),
  sellingPrice: decimal("selling_price", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull().default(0),
  images: text("images").array(),
  attributes: jsonb("attributes"),
  veroStatus: text("vero_status").default("clean"),
  veroOverride: boolean("vero_override").default(false),
  veroOverrideBy: text("vero_override_by"),
  veroOverrideReason: text("vero_override_reason"),
  deliveryType: text("delivery_type").default("buyer_pays"),
  deliveryCost: decimal("delivery_cost", { precision: 10, scale: 2 }).default("0"),
  // When a Drop-and-Sell lister publishes a product into the customer's
  // inventory on the customer's behalf, we stamp their freelancer profile id
  // here so they can track their work in the "My Listings" tab.
  // Intentionally NOT a foreign key (avoids a forward reference to
  // freelancerProfiles which is declared further down in this file).
  listedByFreelancerId: integer("listed_by_freelancer_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Marketplace Listings (Link internal products to store listings)
export const marketplaceListings = pgTable("marketplace_listings", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").notNull().references(() => stores.id),
  productId: integer("product_id").references(() => products.id),
  externalId: text("external_id").notNull(),
  listingUrl: text("listing_url"),
  status: text("status").notNull().default("active"),
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
  lineItems: jsonb("line_items"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }),
  status: text("status").notNull().default("pending"),
  fulfillmentStatus: text("fulfillment_status").default("unfulfilled"),
  trackingNumber: text("tracking_number"),
  carrier: text("carrier"),
  trackingInfo: jsonb("tracking_info"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Wallet & Transactions
export const wallet = pgTable("wallet", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().unique().references(() => users.id),
  balance: decimal("balance", { precision: 12, scale: 2 }).notNull().default("0.00"),
  referralBalance: decimal("referral_balance", { precision: 12, scale: 2 }).notNull().default("0.00"),
  points: decimal("points", { precision: 12, scale: 4 }).notNull().default("0.0000"),
  currency: text("currency").default("GBP"),
  bankAccountName: varchar("bank_account_name"),
  bankAccountNumber: varchar("bank_account_number"),
  bankSortCode: varchar("bank_sort_code"),
  bankName: varchar("bank_name"),
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
  withdrawMethod: text("withdraw_method"),
  adminNote: text("admin_note"),
  processedAt: timestamp("processed_at"),
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
  cyclesCredited: integer("cycles_credited").default(0),
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

// Global VERO List - System-wide restricted brands (applies to ALL users)
export const globalVeroList = pgTable("global_vero_list", {
  id: serial("id").primaryKey(),
  type: text("type").notNull().default("brand"),
  value: text("value").notNull(),
  platform: text("platform"),
  reason: text("reason"),
  category: text("category"),
  severity: text("severity").notNull().default("block"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertGlobalVeroItemSchema = createInsertSchema(globalVeroList).omit({ id: true, createdAt: true });
export type InsertGlobalVeroItem = z.infer<typeof insertGlobalVeroItemSchema>;
export type GlobalVeroItem = typeof globalVeroList.$inferSelect;

export const veroBrandAliases = pgTable("vero_brand_aliases", {
  id: serial("id").primaryKey(),
  canonicalBrand: text("canonical_brand").notNull(),
  alias: text("alias").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertVeroBrandAliasSchema = createInsertSchema(veroBrandAliases).omit({ id: true, createdAt: true });
export type InsertVeroBrandAlias = z.infer<typeof insertVeroBrandAliasSchema>;
export type VeroBrandAlias = typeof veroBrandAliases.$inferSelect;

export const veroAuditLog = pgTable("vero_audit_log", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  productId: integer("product_id"),
  submittedBrand: text("submitted_brand").notNull(),
  matchedVeroBrand: text("matched_vero_brand"),
  matchMethod: text("match_method"),
  outcome: text("outcome").notNull(),
  overrideBy: text("override_by"),
  overrideReason: text("override_reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertVeroAuditLogSchema = createInsertSchema(veroAuditLog).omit({ id: true, createdAt: true });
export type InsertVeroAuditLog = z.infer<typeof insertVeroAuditLogSchema>;
export type VeroAuditLog = typeof veroAuditLog.$inferSelect;

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

// Restricted Products - Regulatory compliance for harmful/dangerous items
export const restrictedProducts = pgTable("restricted_products", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  category: text("category").notNull(), // 'sharp_objects', 'chemicals', 'drugs', 'weapons', 'custom'
  keyword: text("keyword").notNull(), // Specific keyword to detect
  jurisdiction: text("jurisdiction"), // Optional: 'UK', 'EU', 'US', null = global
  reason: text("reason"), // Why this is restricted
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
export const insertProductSchema = createInsertSchema(products).omit({ id: true, userId: true, createdAt: true, updatedAt: true, veroOverride: true, veroOverrideBy: true, veroOverrideReason: true });
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

// PayPal payout accruals — one row per (active subscriber, calendar month).
// Recurring £0.10p tithe to PayPal.Me/OLADIRANOJO that admin batch-settles manually.
// Keyed off users.subscriptionStatus (the source of truth on this platform) so that
// every active/trialing user accrues £0.10 each calendar month they are active.
export const paypalPayoutAccruals = pgTable("paypal_payout_accruals", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  recipientHandle: text("recipient_handle").notNull(),
  monthYear: text("month_year").notNull(),
  amountPence: integer("amount_pence").notNull().default(10),
  status: text("status").notNull().default("pending"),
  settledAt: timestamp("settled_at"),
  settledByUserId: varchar("settled_by_user_id").references(() => users.id),
  settledNote: text("settled_note"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  uniqUserMonth: uniqueIndex("paypal_payout_accruals_user_month_uniq").on(t.userId, t.monthYear, t.recipientHandle),
}));
export type PaypalPayoutAccrual = typeof paypalPayoutAccruals.$inferSelect;

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

// Restricted Products
export const insertRestrictedProductSchema = createInsertSchema(restrictedProducts).omit({ id: true, userId: true, createdAt: true });
export type InsertRestrictedProduct = z.infer<typeof insertRestrictedProductSchema>;
export type RestrictedProduct = typeof restrictedProducts.$inferSelect;

// Add-on Purchases
export const addonPurchases = pgTable("addon_purchases", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  addonId: varchar("addon_id").notNull(),
  status: text("status").notNull().default("active"),
  stripePaymentId: varchar("stripe_payment_id"),
  purchasedAt: timestamp("purchased_at").defaultNow(),
});

export const insertAddonPurchaseSchema = createInsertSchema(addonPurchases).omit({ id: true, purchasedAt: true });
export type InsertAddonPurchase = z.infer<typeof insertAddonPurchaseSchema>;
export type AddonPurchase = typeof addonPurchases.$inferSelect;

// Trending Products (best-sellers across platforms)
export const trendingProducts = pgTable("trending_products", {
  id: serial("id").primaryKey(),
  platform: text("platform").notNull(),
  title: text("title").notNull(),
  category: text("category"),
  price: decimal("price", { precision: 10, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("GBP"),
  salesVolume: integer("sales_volume"),
  rank: integer("rank"),
  imageUrl: text("image_url"),
  productUrl: text("product_url"),
  vendorName: text("vendor_name"),
  vendorRating: decimal("vendor_rating", { precision: 3, scale: 1 }),
  vendorReviews: integer("vendor_reviews"),
  vendorReliability: text("vendor_reliability"),
  linkVerifiedAt: timestamp("link_verified_at"),
  monthYear: varchar("month_year", { length: 10 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export type TrendingProduct = typeof trendingProducts.$inferSelect;

// User Suggestions & Complaints
export const suggestions = pgTable("suggestions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  userEmail: text("user_email").notNull(),
  userName: text("user_name"),
  category: text("category").notNull().default("feature_request"),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("new"),
  // Optional screenshots / pictures attached by the user when submitting.
  // Each entry is a data URL (e.g. "data:image/jpeg;base64,...") produced by
  // the upload handler after server-side compression. Capped at 4 images.
  imageUrls: text("image_urls").array().default([]),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSuggestionSchema = createInsertSchema(suggestions).omit({ id: true, userId: true, userEmail: true, userName: true, status: true, createdAt: true, imageUrls: true });
export type InsertSuggestion = z.infer<typeof insertSuggestionSchema>;
export type Suggestion = typeof suggestions.$inferSelect;

// === FULFILLMENT SYSTEM TABLES ===

export const skuMappings = pgTable("sku_mappings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  ebaySku: text("ebay_sku").notNull(),
  vendorId: integer("vendor_id").references(() => vendors.id),
  vendorSku: text("vendor_sku").notNull().default(''),
  vendorProductUrl: text("vendor_product_url"),
  vendorName: text("vendor_name"),
  costPrice: decimal("cost_price", { precision: 10, scale: 2 }),
  priceThreshold: decimal("price_threshold", { precision: 10, scale: 2 }),
  ebayTitle: text("ebay_title"),
  ebayPrice: decimal("ebay_price", { precision: 10, scale: 2 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const fulfillmentJobs = pgTable("fulfillment_jobs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  orderId: integer("order_id").notNull().references(() => orders.id),
  skuMappingId: integer("sku_mapping_id").references(() => skuMappings.id),
  vendorId: integer("vendor_id").references(() => vendors.id),
  vendorName: text("vendor_name"),
  vendorOrderId: text("vendor_order_id"),
  status: text("status").notNull().default("pending"),
  trackingNumber: text("tracking_number"),
  carrier: text("carrier"),
  paymentMethod: text("payment_method"),
  paymentStatus: text("payment_status"),
  amountCharged: decimal("amount_charged", { precision: 10, scale: 2 }),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").notNull().default(0),
  sourcingType: text("sourcing_type").default("primary"),
  createdAt: timestamp("created_at").defaultNow(),
  fulfilledAt: timestamp("fulfilled_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const paymentCards = pgTable("payment_cards", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  lastFour: varchar("last_four", { length: 4 }).notNull(),
  brand: text("brand").notNull(),
  expiryMonth: integer("expiry_month").notNull(),
  expiryYear: integer("expiry_year").notNull(),
  tokenizedId: text("tokenized_id").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  priority: integer("priority").notNull().default(0),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const returnRequests = pgTable("return_requests", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  orderId: integer("order_id").notNull().references(() => orders.id),
  fulfillmentJobId: integer("fulfillment_job_id").references(() => fulfillmentJobs.id),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"),
  vendorReturnId: text("vendor_return_id"),
  refundAmount: decimal("refund_amount", { precision: 10, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  orderId: integer("order_id").references(() => orders.id),
  action: text("action").notNull(),
  source: text("source"),
  vendorUsed: text("vendor_used"),
  paymentMethod: text("payment_method"),
  fulfillmentStatus: text("fulfillment_status"),
  details: jsonb("details"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const featureFlags = pgTable("feature_flags", {
  id: serial("id").primaryKey(),
  featureKey: text("feature_key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  isEnabled: boolean("is_enabled").notNull().default(false),
  adminOnly: boolean("admin_only").notNull().default(true),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// === DROP-AND-SELL LISTING SERVICE ===

export const freelancerProfiles = pgTable("freelancer_profiles", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"),
  name: text("name").notNull(),
  email: text("email").notNull(),
  specialties: text("specialties").array(),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("5.00"),
  completedJobs: integer("completed_jobs").notNull().default(0),
  isAvailable: boolean("is_available").notNull().default(true),
  walletBalance: decimal("wallet_balance", { precision: 10, scale: 2 }).notNull().default("0.00"),
  totalEarnings: decimal("total_earnings", { precision: 10, scale: 2 }).notNull().default("0.00"),
  stripeConnectId: text("stripe_connect_id"),
  activeJobCount: integer("active_job_count").notNull().default(0),
  yearsExperience: text("years_experience"),
  hasCommunity: boolean("has_community").default(false),
  communityName: text("community_name"),
  referralsMade: integer("referrals_made").default(0),
  applicationStatus: text("application_status").default("approved"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const dropAndSellOrders = pgTable("drop_and_sell_orders", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  storeId: integer("store_id"),
  listingCount: integer("listing_count").notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  listerEarnings: decimal("lister_earnings", { precision: 10, scale: 2 }).notNull().default("0.00"),
  platformFee: decimal("platform_fee", { precision: 10, scale: 2 }).notNull().default("0.00"),
  status: text("status").notNull().default("pending"),
  freelancerId: integer("freelancer_id").references(() => freelancerProfiles.id),
  assignedAt: timestamp("assigned_at"),
  deadline: timestamp("deadline"),
  completedAt: timestamp("completed_at"),
  progressCount: integer("progress_count").notNull().default(0),
  paymentStatus: text("payment_status").notNull().default("unpaid"),
  payoutStatus: text("payout_status").notNull().default("pending"),
  stripeSessionId: text("stripe_session_id"),
  notes: text("notes"),
  deliverySummary: jsonb("delivery_summary"),
  userFeedback: text("user_feedback"),
  userRating: integer("user_rating"),
  // Customer auto-listing preferences (collected via popup on the request form).
  // Empty array / null means "no preference (N/A)" — the lister can pick any
  // category, default quantity falls back to 1, and any price range is fine.
  categories: text("categories").array().default([]),
  defaultQuantity: integer("default_quantity").default(1),
  pricePreference: text("price_preference"), // 'low' | 'high' | null (no preference)
  // Customer's preferred profit-margin markup, expressed as a whole
  // percentage applied on top of the source/vendor cost (e.g. 30 = +30%).
  // null = "no preference (N/A)" — the lister uses their own judgement.
  profitMarginPercent: integer("profit_margin_percent"),
  // Customer-selected supplier sites the lister should source from. Stores
  // each vendor's name (e.g. "Amazon UK", "AliExpress"). Empty array means
  // "no preference (N/A)" — the lister can pick any vendor in the directory.
  preferredVendors: text("preferred_vendors").array().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const dropAndSellOrdersRelations = relations(dropAndSellOrders, ({ one }) => ({
  user: one(users, { fields: [dropAndSellOrders.userId], references: [users.id] }),
  freelancer: one(freelancerProfiles, { fields: [dropAndSellOrders.freelancerId], references: [freelancerProfiles.id] }),
}));

// === FULFILLMENT ZOD SCHEMAS ===

export const insertSkuMappingSchema = createInsertSchema(skuMappings).omit({ id: true, userId: true, createdAt: true });
export type InsertSkuMapping = z.infer<typeof insertSkuMappingSchema>;
export type SkuMapping = typeof skuMappings.$inferSelect;

export const insertFulfillmentJobSchema = createInsertSchema(fulfillmentJobs).omit({ id: true, userId: true, createdAt: true, fulfilledAt: true, updatedAt: true });
export type InsertFulfillmentJob = z.infer<typeof insertFulfillmentJobSchema>;
export type FulfillmentJob = typeof fulfillmentJobs.$inferSelect;

export const insertPaymentCardSchema = createInsertSchema(paymentCards).omit({ id: true, userId: true, createdAt: true });
export type InsertPaymentCard = z.infer<typeof insertPaymentCardSchema>;
export type PaymentCard = typeof paymentCards.$inferSelect;

export const insertReturnRequestSchema = createInsertSchema(returnRequests).omit({ id: true, userId: true, createdAt: true, updatedAt: true });
export type InsertReturnRequest = z.infer<typeof insertReturnRequestSchema>;
export type ReturnRequest = typeof returnRequests.$inferSelect;

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, userId: true, createdAt: true });
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

export const insertFeatureFlagSchema = createInsertSchema(featureFlags).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFeatureFlag = z.infer<typeof insertFeatureFlagSchema>;
export type FeatureFlag = typeof featureFlags.$inferSelect;

export const insertFreelancerProfileSchema = createInsertSchema(freelancerProfiles).omit({ id: true, createdAt: true });
export type InsertFreelancerProfile = z.infer<typeof insertFreelancerProfileSchema>;
export type FreelancerProfile = typeof freelancerProfiles.$inferSelect;

export const insertDropAndSellOrderSchema = createInsertSchema(dropAndSellOrders).omit({ id: true, userId: true, createdAt: true, updatedAt: true });
export type InsertDropAndSellOrder = z.infer<typeof insertDropAndSellOrderSchema>;
export type DropAndSellOrder = typeof dropAndSellOrders.$inferSelect;

// === FULFILLMENT RELATIONS ===
export const fulfillmentJobsRelations = relations(fulfillmentJobs, ({ one }) => ({
  order: one(orders, { fields: [fulfillmentJobs.orderId], references: [orders.id] }),
  user: one(users, { fields: [fulfillmentJobs.userId], references: [users.id] }),
  skuMapping: one(skuMappings, { fields: [fulfillmentJobs.skuMappingId], references: [skuMappings.id] }),
}));

export const returnRequestsRelations = relations(returnRequests, ({ one }) => ({
  order: one(orders, { fields: [returnRequests.orderId], references: [orders.id] }),
  user: one(users, { fields: [returnRequests.userId], references: [users.id] }),
  fulfillmentJob: one(fulfillmentJobs, { fields: [returnRequests.fulfillmentJobId], references: [fulfillmentJobs.id] }),
}));

// API Request/Response Types
export type CreateStoreRequest = InsertStore;
export type UpdateStoreRequest = Partial<InsertStore>;

export type CreateVendorRequest = InsertVendor;
export type UpdateVendorRequest = Partial<InsertVendor>;

export type CreateProductRequest = InsertProduct;
export type UpdateProductRequest = Partial<InsertProduct>;

export type WalletBalanceResponse = {
  balance: number;
  referralBalance: number;
  points: number;
  currency: string;
};

export type DashboardStatsResponse = {
  totalRevenue: number;
  totalOrders: number;
  activeListings: number;
  walletBalance: number;
};

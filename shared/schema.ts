import { pgTable, text, serial, integer, boolean, timestamp, jsonb, decimal, varchar, date, unique } from "drizzle-orm/pg-core";
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
  email: text("email"),
  credentials: jsonb("credentials").notNull(), // Encrypted API keys, tokens
  status: text("status").notNull().default("active"), // 'active', 'inactive', 'error'
  autoRestock: boolean("auto_restock").notNull().default(false), // Auto-restock out-of-stock items when quantity becomes available
  autoPauseListings: boolean("auto_pause_listings").notNull().default(false), // Auto-pause marketplace listings when out of stock
  autoMarkOutOfStock: boolean("auto_mark_out_of_stock").notNull().default(false), // Auto-mark listings as out of stock on marketplace
  autoSwitchSupplier: boolean("auto_switch_supplier").notNull().default(false), // Auto-switch to alternative supplier when out of stock
  restockThreshold: integer("restock_threshold").notNull().default(1), // Min quantity to trigger auto-restock
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
  // Contact Info
  contactPerson: text("contact_person"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  // Classification
  category: text("category"), // 'wholesale', 'manufacturer', 'dropshipper', 'distributor', 'other'
  tags: text("tags"), // comma-separated tags
  country: text("country"),
  // Business Terms
  leadTime: text("lead_time"), // e.g. "3-5 days"
  paymentTerms: text("payment_terms"), // e.g. "Net 30", "PayPal"
  minOrderAmount: decimal("min_order_amount", { precision: 10, scale: 2 }),
  notes: text("notes"),
  // Supplier Health Score
  healthScore: integer("health_score"), // 1–5 star rating
  averageShippingDays: text("average_shipping_days"), // e.g. "5–8 days"
  cancellationRate: decimal("cancellation_rate", { precision: 5, scale: 2 }), // percentage
  stockUpdateReliability: text("stock_update_reliability"), // 'high', 'medium', 'low'
  returnRate: decimal("return_rate", { precision: 5, scale: 2 }), // percentage
  lateDeliveryRate: decimal("late_delivery_rate", { precision: 5, scale: 2 }), // percentage
  totalOrdersFulfilled: integer("total_orders_fulfilled").default(0),
  lastHealthCheck: timestamp("last_health_check"),
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
  // Temu / external marketplace tracking
  externalProductId: text("external_product_id"), // ID on Temu (from URL)
  marketplacePrice: decimal("marketplace_price", { precision: 10, scale: 2 }), // Temu's current price
  marketplaceStockStatus: text("marketplace_stock_status").default("unknown"), // 'in_stock', 'out_of_stock', 'unknown'
  shippingInfo: jsonb("shipping_info"), // { estimatedDays: string, cost: string, origin: string }
  lastMarketplaceSync: timestamp("last_marketplace_sync"), // last time we checked Temu
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueExternalProduct: unique("uq_external_product").on(table.userId, table.externalProductId),
}));

// Product Variations (size, color, etc. from Temu)
export const productVariations = pgTable("product_variations", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id),
  name: text("name").notNull(), // e.g. "Black / XL"
  sku: text("sku").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(), // Temu's price for this variant
  stock: integer("stock").notNull().default(0),
  image: text("image"), // variant-specific image URL
  attributes: jsonb("attributes"), // { color: "Black", size: "XL" }
  externalId: text("external_id"), // Temu variant ID
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Marketplace Listings (Link internal products to store listings)
export const marketplaceListings = pgTable("marketplace_listings", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").notNull().references(() => stores.id),
  productId: integer("product_id").notNull().references(() => products.id),
  externalId: text("external_id").notNull(), // ID on the marketplace
  status: text("status").notNull().default("active"), // 'active', 'ended', 'error'
  syncStatus: text("sync_status").default("synced"),
  stockStatus: text("stock_status").default("in_stock"), // 'in_stock', 'out_of_stock', 'unknown'
  outOfStockAt: timestamp("out_of_stock_at"),
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
  trackingStatus: text("tracking_status").default("pending"), // 'pending', 'in_transit', 'delivered', 'failed'
  trackingUrl: text("tracking_url"),
  trackingUpdatedAt: timestamp("tracking_updated_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Wallet & Transactions
export const wallet = pgTable("wallet", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().unique().references(() => users.id),
  balance: decimal("balance", { precision: 12, scale: 2 }).notNull().default("0.00"),
  referralBalance: decimal("referral_balance", { precision: 12, scale: 2 }).notNull().default("0.00"), // Separate referral earnings
  points: decimal("points", { precision: 12, scale: 4 }).notNull().default("0.0000"), // Usage points (0.001 per £1)
  currency: text("currency").default("GBP"),
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

// Notifications
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: text("type").notNull().default("info"), // 'info', 'order_shipped', 'order_delivered', 'stock_alert', 'price_alert', 'supplier_alert', 'new_products', 'restock'
  title: text("title").notNull(),
  message: text("message"),
  orderId: integer("order_id").references(() => orders.id),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
  order: one(orders, { fields: [notifications.orderId], references: [orders.id] }),
}));

// Add-on Catalog
export const addonCatalog = pgTable("addon_catalog", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  image: text("image"),
  category: text("category").notNull().default("general"), // 'general', 'tools', 'services', 'content'
  price: decimal("price", { precision: 10, scale: 2 }).notNull().default("0"),
  isNew: boolean("is_new").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const catalogRefreshLog = pgTable("catalog_refresh_log", {
  id: serial("id").primaryKey(),
  itemsAdded: integer("items_added").notNull().default(0),
  itemsUpdated: integer("items_updated").notNull().default(0),
  lastRefreshedAt: timestamp("last_refreshed_at").defaultNow(),
});

// Restock Logs
export const restockLogs = pgTable("restock_logs", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").notNull().references(() => stores.id),
  productId: integer("product_id").notNull().references(() => products.id),
  previousQuantity: integer("previous_quantity").notNull(),
  newQuantity: integer("new_quantity").notNull(),
  marketplaceListingId: integer("marketplace_listing_id").references(() => marketplaceListings.id),
  triggeredBy: text("triggered_by").notNull().default("auto"), // 'auto' | 'manual'
  createdAt: timestamp("created_at").defaultNow(),
});

export const restockLogsRelations = relations(restockLogs, ({ one }) => ({
  store: one(stores, { fields: [restockLogs.storeId], references: [stores.id] }),
  product: one(products, { fields: [restockLogs.productId], references: [products.id] }),
  marketplaceListing: one(marketplaceListings, { fields: [restockLogs.marketplaceListingId], references: [marketplaceListings.id] }),
}));

// Supplier replacement log — tracks when auto-switch finds a new vendor
export const supplierReplacementLog = pgTable("supplier_replacement_log", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id),
  oldVendorId: integer("old_vendor_id").references(() => vendors.id),
  newVendorId: integer("new_vendor_id").notNull().references(() => vendors.id),
  oldVendorName: text("old_vendor_name"),
  newVendorName: text("new_vendor_name").notNull(),
  productTitle: text("product_title").notNull(),
  productSku: text("product_sku"),
  reason: text("reason").notNull().default("out_of_stock"), // 'out_of_stock' | 'supplier_disappeared' | 'manual'
  triggeredBy: text("triggered_by").notNull().default("auto"), // 'auto' | 'manual'
  createdAt: timestamp("created_at").defaultNow(),
});

export const supplierReplacementLogRelations = relations(supplierReplacementLog, ({ one }) => ({
  product: one(products, { fields: [supplierReplacementLog.productId], references: [products.id] }),
  oldVendor: one(vendors, { fields: [supplierReplacementLog.oldVendorId], references: [vendors.id] }),
  newVendor: one(vendors, { fields: [supplierReplacementLog.newVendorId], references: [vendors.id] }),
}));

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
export const insertProductSchema = createInsertSchema(products).omit({ id: true, userId: true, createdAt: true, updatedAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

// Product Variations
export const insertProductVariationSchema = createInsertSchema(productVariations).omit({ id: true, createdAt: true });
export type InsertProductVariation = z.infer<typeof insertProductVariationSchema>;
export type ProductVariation = typeof productVariations.$inferSelect;

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
export const insertMarketplaceListingSchema = createInsertSchema(marketplaceListings).omit({ id: true, lastSync: true, outOfStockAt: true });
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

// Restock Logs
export const insertRestockLogSchema = createInsertSchema(restockLogs).omit({ id: true, createdAt: true });
export type InsertRestockLog = z.infer<typeof insertRestockLogSchema>;
export type RestockLog = typeof restockLogs.$inferSelect;

// Supplier replacement log
export const insertSupplierReplacementLogSchema = createInsertSchema(supplierReplacementLog).omit({ id: true, createdAt: true });
export type InsertSupplierReplacementLog = z.infer<typeof insertSupplierReplacementLogSchema>;
export type SupplierReplacementLog = typeof supplierReplacementLog.$inferSelect;

// Notifications
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// Add-on Catalog
export const insertAddonCatalogSchema = createInsertSchema(addonCatalog).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAddonCatalog = z.infer<typeof insertAddonCatalogSchema>;
export type AddonCatalogItem = typeof addonCatalog.$inferSelect;

export type CatalogRefreshLog = typeof catalogRefreshLog.$inferSelect;

// Shipping Profiles
export const shippingProfiles = pgTable("shipping_profiles", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  carrier: text("carrier").notNull().default("other"), // 'royal_mail', 'fedex', 'dhl', 'ups', 'usps', 'other'
  serviceLevel: text("service_level").notNull().default("standard"), // 'standard', 'express', 'overnight', 'economy'
  baseRate: decimal("base_rate", { precision: 10, scale: 2 }).notNull().default("0"),
  ratePerKg: decimal("rate_per_kg", { precision: 10, scale: 2 }).default("0"),
  freeShippingThreshold: decimal("free_shipping_threshold", { precision: 10, scale: 2 }),
  estimatedDaysMin: integer("estimated_days_min").default(3),
  estimatedDaysMax: integer("estimated_days_max").default(7),
  regions: text("regions"), // Comma-separated: 'US,UK,EU'
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertShippingProfileSchema = createInsertSchema(shippingProfiles).omit({ id: true, userId: true, createdAt: true, updatedAt: true });
export type InsertShippingProfile = z.infer<typeof insertShippingProfileSchema>;
export type ShippingProfile = typeof shippingProfiles.$inferSelect;

// Admin settings
export const adminSettings = pgTable("admin_settings", {
  id: serial("id").primaryKey(),
  siteName: text("site_name").default("DropandSell AI"),
  maintenanceMode: boolean("maintenance_mode").default(false),
  allowNewRegistrations: boolean("allow_new_registrations").default(true),
  defaultSubscriptionPlan: text("default_subscription_plan").default("free"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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
  outOfStockProducts: number;
};

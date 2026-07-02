import { 
  stores, vendors, products, orders, wallet, transactions, subscriptions, referrals,
  pricingRules, importJobs, publishQueue, marketplaceListings, veroList, globalVeroList, contentFilters, restrictedProducts,
  addonPurchases, trendingProducts, suggestions,
  skuMappings, fulfillmentJobs, paymentCards, returnRequests, auditLogs, featureFlags,
  veroBrandAliases, veroAuditLog, freelancerProfiles, dropAndSellOrders,
  type InsertStore, type InsertVendor, type InsertProduct, type InsertOrder, 
  type InsertTransaction, type InsertPricingRule, type InsertImportJob, 
  type InsertPublishQueue, type InsertMarketplaceListing, type InsertVeroItem, type InsertContentFilter, type InsertRestrictedProduct,
  type AddonPurchase, type TrendingProduct, type InsertSuggestion, type Suggestion,
  type InsertSkuMapping, type SkuMapping, type InsertFulfillmentJob, type FulfillmentJob,
  type InsertPaymentCard, type PaymentCard, type InsertReturnRequest, type ReturnRequest,
  type InsertAuditLog, type AuditLog, type InsertFeatureFlag, type FeatureFlag,
  type InsertVeroAuditLog, type VeroAuditLog,
  type InsertFreelancerProfile, type FreelancerProfile,
  type InsertDropAndSellOrder, type DropAndSellOrder
} from "@shared/schema";
import { users, type User } from "@shared/models/auth";
import { db } from "./db";
import { eq, desc, and, or, ilike, gte, lt, sql, ne, isNull, inArray } from "drizzle-orm";

function stripToAlphanumeric(text: string): string {
  return text.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function normalizeBrandName(brand: string): string {
  return brand
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function removeBrandFromText(text: string, brand: string): string {
  if (!text || !brand || brand.length < 2) return text;
  const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(?:^|(?<=[\\s,;:!?.\\-/()\\[\\]{}|"']))${escaped}(?=[\\s,;:!?.\\-/()\\[\\]{}|"']|$)`, 'gi');
  let cleaned = text.replace(pattern, '');
  cleaned = cleaned.replace(/\(\s*\)/g, '').replace(/\s*-\s*-\s*/g, ' - ').replace(/\s{2,}/g, ' ').replace(/^[\s,;:\-]+|[\s,;:\-]+$/g, '').trim();
  return cleaned;
}

function strictTextMatch(text: string, keyword: string): boolean {
  const keywordLower = keyword.toLowerCase().trim();
  const textLower = text.toLowerCase();
  
  if (textLower.includes(keywordLower)) {
    const escaped = keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const wordBoundary = new RegExp(`(?:^|[\\s,;:!?./()\\[\\]{}|"'\\-])${escaped}(?:$|[\\s,;:!?./()\\[\\]{}|"'\\-])`, 'i');
    if (wordBoundary.test(` ${textLower} `)) {
      return true;
    }
  }
  
  if (keywordLower.length >= 3) {
    const strippedText = stripToAlphanumeric(text);
    const strippedKeyword = stripToAlphanumeric(keyword);
    if (strippedKeyword.length >= 3 && strippedText.includes(strippedKeyword)) {
      return true;
    }
  }
  
  return false;
}
import crypto from "crypto";

function generateUniqueUrlCode(): string {
  return crypto.randomBytes(6).toString('hex');
}

async function generateUniqueUrlWithRetry(maxRetries = 5): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    const uniqueUrl = crypto.randomBytes(6 + i).toString('hex').slice(0, 12 + i);
    const existing = await db.select().from(users).where(eq(users.uniqueUrl, uniqueUrl));
    if (existing.length === 0) {
      return uniqueUrl;
    }
    console.log(`Unique URL collision detected, retrying (attempt ${i + 1}/${maxRetries})`);
  }
  const fallbackUrl = crypto.randomBytes(16).toString('hex');
  const existing = await db.select().from(users).where(eq(users.uniqueUrl, fallbackUrl));
  if (existing.length === 0) {
    return fallbackUrl;
  }
  return crypto.randomBytes(20).toString('hex');
}

async function updateUserUniqueUrlWithRetry(userId: string, maxRetries = 3): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const uniqueUrl = await generateUniqueUrlWithRetry();
      const result = await db.update(users)
        .set({ uniqueUrl, updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning();
      if (result.length === 0) {
        throw new Error('User not found');
      }
      return result[0].uniqueUrl!;
    } catch (err: any) {
      if (err.code === '23505' && i < maxRetries - 1) {
        console.log(`Unique constraint violation on URL update, retrying (attempt ${i + 1}/${maxRetries})`);
        continue;
      }
      throw err;
    }
  }
  throw new Error('Failed to generate unique URL after retries');
}

export interface IStorage {
  // Stores
  getStores(userId: string): Promise<typeof stores.$inferSelect[]>;
  getStore(id: number): Promise<typeof stores.$inferSelect | undefined>;
  getAllActiveStoresByPlatform(platform: string): Promise<typeof stores.$inferSelect[]>;
  createStore(store: InsertStore & { userId: string }): Promise<typeof stores.$inferSelect>;
  updateStore(id: number, userId: string, updates: Partial<InsertStore>): Promise<typeof stores.$inferSelect>;
  deleteStore(id: number, userId: string): Promise<void>;

  // Vendors
  getVendors(userId: string): Promise<typeof vendors.$inferSelect[]>;
  createVendor(vendor: InsertVendor & { userId: string }): Promise<typeof vendors.$inferSelect>;
  updateVendor(id: number, userId: string, updates: Partial<InsertVendor>): Promise<typeof vendors.$inferSelect>;
  deleteVendor(id: number, userId: string): Promise<void>;

  // Products
  getProducts(userId: string): Promise<typeof products.$inferSelect[]>;
  getProduct(id: number): Promise<typeof products.$inferSelect | undefined>;
  createProduct(product: InsertProduct & { userId: string }): Promise<typeof products.$inferSelect>;
  updateProduct(id: number, userId: string, updates: Partial<InsertProduct>): Promise<typeof products.$inferSelect>;
  deleteProduct(id: number, userId: string): Promise<void>;
  getProductsListedByFreelancer(freelancerId: number): Promise<any[]>;

  // Orders
  getOrders(userId: string): Promise<typeof orders.$inferSelect[]>;
  getOrder(id: number): Promise<typeof orders.$inferSelect | undefined>;
  createOrder(order: InsertOrder & { userId: string }): Promise<typeof orders.$inferSelect>;

  // Wallet
  getWallet(userId: string): Promise<typeof wallet.$inferSelect | undefined>;
  createWallet(userId: string): Promise<typeof wallet.$inferSelect>;
  getTransactions(walletId: number): Promise<typeof transactions.$inferSelect[]>;
  createTransaction(transaction: InsertTransaction & { walletId: number }): Promise<typeof transactions.$inferSelect>;
  updateWalletBalance(walletId: number, amount: number): Promise<void>;

  // Add-ons
  getUserAddonPurchases(userId: string): Promise<AddonPurchase[]>;
  getAllAddonPurchases(): Promise<AddonPurchase[]>;
  createAddonPurchase(userId: string, addonId: string, stripePaymentId?: string): Promise<AddonPurchase>;
  getTrendingProducts(monthYear?: string): Promise<TrendingProduct[]>;

  // Admin
  getAllSubscribers(): Promise<User[]>;

  // Auth/Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: any): Promise<User>;
  getUserByApiKey(apiKey: string): Promise<User | undefined>;
  getUserByVerificationToken(token: string): Promise<User | undefined>;
  getUserByResetPasswordToken(token: string): Promise<User | undefined>;
  getUserByReferralCode(referralCode: string): Promise<User | undefined>;
  getUserByStripeCustomerId(stripeCustomerId: string): Promise<User | undefined>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  createUser(user: { email: string; password: string; firstName?: string; lastName?: string }): Promise<User>;
  generateUniqueUrl(): Promise<string>;
  regenerateUserUniqueUrl(userId: string): Promise<string>;

  // VERO List
  getVeroList(userId: string): Promise<typeof veroList.$inferSelect[]>;
  createVeroItem(item: InsertVeroItem & { userId: string }): Promise<typeof veroList.$inferSelect>;
  updateVeroItem(id: number, userId: string, updates: Partial<InsertVeroItem>): Promise<typeof veroList.$inferSelect>;
  deleteVeroItem(id: number, userId: string): Promise<void>;
  checkVeroViolation(userId: string, title: string, sku: string, platform?: string): Promise<{ isBlocked: boolean; violations: typeof veroList.$inferSelect[] }>;
  checkVeroViolationFull(userId: string, title: string, description: string, sku: string, platform?: string): Promise<{ isBlocked: boolean; violations: typeof veroList.$inferSelect[] }>;
  checkVeroBrand(userId: string, brand: string, productId?: number, platform?: string): Promise<{ isBlocked: boolean; matchedBrand: string | null; matchMethod: string | null; violations: any[] }>;
  sanitizeVeroContent(userId: string, title: string, description: string, brand: string): Promise<{ title: string; description: string; brand: string; detectedBrand: string | null; removedFromTitle: boolean; removedFromDescription: boolean }>;
  logVeroAudit(entry: InsertVeroAuditLog): Promise<VeroAuditLog>;
  getVeroAuditLog(userId?: string, productId?: number, limit?: number): Promise<VeroAuditLog[]>;
  getVeroBrandAliases(): Promise<typeof veroBrandAliases.$inferSelect[]>;
  createVeroBrandAlias(canonicalBrand: string, alias: string): Promise<typeof veroBrandAliases.$inferSelect>;
  deleteVeroBrandAlias(id: number): Promise<void>;
  setVeroOverride(productId: number, userId: string, overrideBy: string, reason: string): Promise<any>;

  // Content Filters (Personal info detection)
  getContentFilters(userId: string): Promise<typeof contentFilters.$inferSelect[]>;
  createContentFilter(filter: InsertContentFilter & { userId: string }): Promise<typeof contentFilters.$inferSelect>;
  updateContentFilter(id: number, userId: string, updates: Partial<InsertContentFilter>): Promise<typeof contentFilters.$inferSelect>;
  deleteContentFilter(id: number, userId: string): Promise<void>;
  checkContentViolations(userId: string, text: string): Promise<{ hasViolations: boolean; violations: Array<{ type: string; matches: string[] }> }>;

  // Restricted Products (Regulatory compliance)
  getRestrictedProducts(userId: string): Promise<typeof restrictedProducts.$inferSelect[]>;
  createRestrictedProduct(item: InsertRestrictedProduct & { userId: string }): Promise<typeof restrictedProducts.$inferSelect>;
  updateRestrictedProduct(id: number, userId: string, updates: Partial<InsertRestrictedProduct>): Promise<typeof restrictedProducts.$inferSelect>;
  deleteRestrictedProduct(id: number, userId: string): Promise<void>;
  checkRestrictedViolations(userId: string, title: string, description: string): Promise<{ isBlocked: boolean; violations: typeof restrictedProducts.$inferSelect[] }>;

  // Suggestions
  createSuggestion(suggestion: InsertSuggestion & { userId: string; userEmail: string; userName?: string }): Promise<Suggestion>;
  getUserSuggestions(userId: string): Promise<Suggestion[]>;
  getAllSuggestions(): Promise<Suggestion[]>;
  updateSuggestionStatus(id: number, status: string): Promise<Suggestion>;

  // Points & Referral Wallet
  addReferralBonus(userId: string, amount: number, description?: string, referenceId?: string): Promise<void>;
  withdrawReferralBalance(userId: string, amount: number, description?: string, withdrawMethod?: string): Promise<typeof transactions.$inferSelect>;
  addPoints(userId: string, spentAmount: number): Promise<void>;
  convertPointsToFunds(userId: string, points: number): Promise<typeof transactions.$inferSelect>;
  updateWalletBankDetails(userId: string, details: { accountName: string; accountNumber: string; sortCode: string; bankName: string | null }): Promise<void>;

  // SKU Mappings
  getSkuMappings(userId: string): Promise<SkuMapping[]>;
  getSkuMappingByEbaySku(userId: string, ebaySku: string): Promise<SkuMapping | undefined>;
  createSkuMapping(mapping: InsertSkuMapping & { userId: string }): Promise<SkuMapping>;
  updateSkuMapping(id: number, userId: string, updates: Partial<InsertSkuMapping>): Promise<SkuMapping>;
  deleteSkuMapping(id: number, userId: string): Promise<void>;

  // Fulfillment Jobs
  getFulfillmentJobs(userId: string, filters?: { status?: string; orderId?: number }): Promise<FulfillmentJob[]>;
  getFulfillmentJob(id: number, userId: string): Promise<FulfillmentJob | undefined>;
  getFulfillmentJobByOrderId(orderId: number, userId: string): Promise<FulfillmentJob | undefined>;
  createFulfillmentJob(job: InsertFulfillmentJob & { userId: string }): Promise<FulfillmentJob>;
  updateFulfillmentJob(id: number, userId: string, updates: Partial<InsertFulfillmentJob>): Promise<FulfillmentJob>;

  // Payment Cards
  getPaymentCards(userId: string): Promise<PaymentCard[]>;
  createPaymentCard(card: InsertPaymentCard & { userId: string }): Promise<PaymentCard>;
  updatePaymentCard(id: number, userId: string, updates: Partial<InsertPaymentCard>): Promise<PaymentCard>;
  deletePaymentCard(id: number, userId: string): Promise<void>;

  // Return Requests
  getReturnRequests(userId: string): Promise<ReturnRequest[]>;
  getReturnRequest(id: number, userId: string): Promise<ReturnRequest | undefined>;
  createReturnRequest(request: InsertReturnRequest & { userId: string }): Promise<ReturnRequest>;
  updateReturnRequest(id: number, userId: string, updates: Partial<InsertReturnRequest>): Promise<ReturnRequest>;

  // Audit Logs
  getAuditLogs(userId: string, filters?: { orderId?: number }): Promise<AuditLog[]>;
  createAuditLog(log: InsertAuditLog & { userId: string }): Promise<AuditLog>;

  // Feature Flags
  getFeatureFlags(): Promise<FeatureFlag[]>;
  getFeatureFlag(featureKey: string): Promise<FeatureFlag | undefined>;
  updateFeatureFlag(featureKey: string, updates: Partial<InsertFeatureFlag>): Promise<FeatureFlag>;
  createFeatureFlag(flag: InsertFeatureFlag): Promise<FeatureFlag>;

  // Fulfilled Orders
  getFulfilledOrders(userId: string, filters?: { status?: string; vendorName?: string; dateFrom?: Date; dateTo?: Date }): Promise<any[]>;
}

export class DatabaseStorage implements IStorage {
  // Stores
  async getStores(userId: string) {
    return await db.select().from(stores).where(eq(stores.userId, userId)).orderBy(stores.id);
  }

  async getStore(id: number, userId?: string) {
    if (userId) {
      const [store] = await db.select().from(stores).where(and(eq(stores.id, id), eq(stores.userId, userId)));
      return store;
    }
    const [store] = await db.select().from(stores).where(eq(stores.id, id));
    return store;
  }

  async getAllActiveStoresByPlatform(platform: string) {
    return await db.select().from(stores).where(and(eq(stores.platform, platform), eq(stores.status, 'active'))).orderBy(stores.id);
  }

  async createStore(store: InsertStore & { userId: string }) {
    const [newStore] = await db.insert(stores).values(store).returning();
    return newStore;
  }

  async updateStore(id: number, userId: string, updates: Partial<InsertStore>) {
    const [updated] = await db.update(stores).set(updates)
      .where(and(eq(stores.id, id), eq(stores.userId, userId)))
      .returning();
    return updated;
  }

  async deleteStore(id: number, userId: string) {
    const store = await db.select().from(stores).where(and(eq(stores.id, id), eq(stores.userId, userId)));
    if (store.length === 0) return;
    await db.delete(marketplaceListings).where(eq(marketplaceListings.storeId, id));
    await db.delete(publishQueue).where(and(eq(publishQueue.storeId, id), eq(publishQueue.userId, userId)));
    await db.delete(orders).where(and(eq(orders.storeId, id), eq(orders.userId, userId)));
    await db.delete(stores).where(and(eq(stores.id, id), eq(stores.userId, userId)));
  }

  // Vendors
  async getVendors(userId: string) {
    return await db.select().from(vendors).where(eq(vendors.userId, userId));
  }

  async createVendor(vendor: InsertVendor & { userId: string }) {
    const [newVendor] = await db.insert(vendors).values(vendor).returning();
    return newVendor;
  }

  async updateVendor(id: number, userId: string, updates: Partial<InsertVendor>) {
    const [updated] = await db.update(vendors).set(updates)
      .where(and(eq(vendors.id, id), eq(vendors.userId, userId)))
      .returning();
    return updated;
  }

  async deleteVendor(id: number, userId: string) {
    await db.delete(vendors).where(and(eq(vendors.id, id), eq(vendors.userId, userId)));
  }

  // Products
  async getProducts(userId: string) {
    const rows = await db.select({
      product: products,
      vendorName: vendors.name,
      vendorWebsite: vendors.website,
    }).from(products)
      .leftJoin(vendors, eq(products.vendorId, vendors.id))
      .where(eq(products.userId, userId))
      .orderBy(desc(products.createdAt));
    return rows.map(r => ({ ...r.product, vendorName: r.vendorName, vendorWebsite: r.vendorWebsite }));
  }

  async getProductBySku(userId: string, sku: string) {
    const [product] = await db.select({
      product: products,
      vendorName: vendors.name,
      vendorWebsite: vendors.website,
    }).from(products)
      .leftJoin(vendors, eq(products.vendorId, vendors.id))
      .where(and(eq(products.userId, userId), eq(products.sku, sku)));
    return product ? { ...product.product, vendorName: product.vendorName, vendorWebsite: product.vendorWebsite } : undefined;
  }

  async getProduct(id: number, userId?: string) {
    if (userId) {
      const [product] = await db.select().from(products).where(and(eq(products.id, id), eq(products.userId, userId)));
      return product;
    }
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async createProduct(product: InsertProduct & { userId: string }) {
    const [newProduct] = await db.insert(products).values(product).returning();
    return newProduct;
  }

  async updateProduct(id: number, userId: string, updates: Partial<InsertProduct>) {
    const [updated] = await db.update(products).set(updates)
      .where(and(eq(products.id, id), eq(products.userId, userId)))
      .returning();
    return updated;
  }

  async deleteProduct(id: number, userId: string) {
    const product = await db.select().from(products).where(and(eq(products.id, id), eq(products.userId, userId)));
    if (product.length === 0) return;
    await db.update(marketplaceListings).set({ productId: null }).where(eq(marketplaceListings.productId, id));
    await db.delete(publishQueue).where(eq(publishQueue.productId, id));
    await db.delete(products).where(and(eq(products.id, id), eq(products.userId, userId)));
  }

  // Returns every product a Drop-and-Sell lister has published into a
  // customer's inventory, joined with the resulting eBay listing (so the
  // lister can click straight through to the live listing) and the customer's
  // public-ish identity (name + eBay username only — never email or token).
  // Powers the "My Listings" tab in the lister UI. Projection is deliberately
  // tight — we ONLY pull the public eBay username out of stores.credentials
  // (via JSON ->> operator) so the OAuth tokens that live alongside it never
  // enter application memory, even by accident.
  async getProductsListedByFreelancer(freelancerId: number) {
    const rows = await db.select({
      product: products,
      vendorName: vendors.name,
      listing: marketplaceListings,
      storeName: stores.name,
      storePlatform: stores.platform,
      storeEbayUsername: sql<string | null>`${stores.credentials}->>'ebayUsername'`,
      customerFirstName: users.firstName,
      customerLastName: users.lastName,
    }).from(products)
      .leftJoin(vendors, eq(products.vendorId, vendors.id))
      .leftJoin(marketplaceListings, eq(marketplaceListings.productId, products.id))
      .leftJoin(stores, eq(stores.id, marketplaceListings.storeId))
      .leftJoin(users, eq(users.id, products.userId))
      .where(eq(products.listedByFreelancerId, freelancerId))
      .orderBy(desc(products.createdAt));

    return rows.map(r => {
      const attrs = (r.product.attributes as any) || {};
      return {
        productId: r.product.id,
        title: r.product.title,
        sku: r.product.sku,
        costPrice: r.product.costPrice,
        sellingPrice: r.product.sellingPrice,
        quantity: r.product.quantity,
        vendorName: r.vendorName || attrs.vendorName || null,
        vendorUrl: attrs.sourceUrl || null,
        createdAt: r.product.createdAt,
        // Listing details (may be null if marketplace_listings write failed
        // or hasn't synced yet).
        externalId: r.listing?.externalId || null,
        listingUrl: r.listing?.listingUrl || null,
        listingStatus: r.listing?.status || null,
        // Customer-facing identity (NEVER expose email or auth token here).
        // customerUserId is exposed so the lister UI can navigate to the
        // full customer catalog view (gated server-side by the
        // dropAndSellOrders relationship).
        customerUserId: r.product.userId,
        customerName: `${r.customerFirstName || ''} ${r.customerLastName || ''}`.trim() || 'Customer',
        customerEbayUsername: r.storePlatform === 'ebay' ? (r.storeEbayUsername || r.storeName || null) : null,
      };
    });
  }

  // Orders
  async getOrders(userId: string) {
    return await db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
  }

  async getOrder(id: number, userId?: string) {
    if (userId) {
      const [order] = await db.select().from(orders).where(and(eq(orders.id, id), eq(orders.userId, userId)));
      return order;
    }
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order;
  }

  async createOrder(order: InsertOrder & { userId: string }) {
    const [newOrder] = await db.insert(orders).values(order).returning();
    return newOrder;
  }

  async getOrderByExternalId(externalOrderId: string, userId: string) {
    const [order] = await db.select().from(orders)
      .where(and(eq(orders.externalOrderId, externalOrderId), eq(orders.userId, userId)));
    return order;
  }

  async updateOrder(id: number, userId: string, data: Partial<InsertOrder>) {
    const [updated] = await db.update(orders)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(orders.id, id), eq(orders.userId, userId)))
      .returning();
    return updated;
  }

  // Wallet
  async getWallet(userId: string) {
    const [w] = await db.select().from(wallet).where(eq(wallet.userId, userId));
    return w;
  }

  async createWallet(userId: string) {
    const [w] = await db.insert(wallet).values({ userId }).returning();
    return w;
  }

  async getTransactions(walletId: number) {
    return await db.select().from(transactions)
      .where(eq(transactions.walletId, walletId))
      .orderBy(desc(transactions.createdAt));
  }

  async createTransaction(transaction: InsertTransaction & { walletId: number }) {
    const [t] = await db.insert(transactions).values(transaction).returning();
    return t;
  }

  async transactionExistsByReference(referenceId: string) {
    const [existing] = await db.select({ id: transactions.id })
      .from(transactions)
      .where(eq(transactions.referenceId, referenceId))
      .limit(1);
    return !!existing;
  }

  async updateWalletBalance(walletId: number, amount: number) {
    // Note: Concurrency safe update in a real app would use a transaction or specific increment/decrement operations
    // For now, this assumes a simple update. 
    // Ideally: UPDATE wallet SET balance = balance + amount WHERE id = walletId
    const w = await db.query.wallet.findFirst({ where: eq(wallet.id, walletId) });
    if (w) {
      const newBalance = Number(w.balance) + amount;
      await db.update(wallet).set({ balance: newBalance.toString() }).where(eq(wallet.id, walletId));
    }
  }

  // Add-ons
  async getUserAddonPurchases(userId: string) {
    return db.select().from(addonPurchases).where(eq(addonPurchases.userId, userId));
  }

  async getAllAddonPurchases() {
    return db.select().from(addonPurchases);
  }

  async createAddonPurchase(userId: string, addonId: string, stripePaymentId?: string) {
    const [purchase] = await db.insert(addonPurchases).values({
      userId,
      addonId,
      stripePaymentId: stripePaymentId || null,
      status: 'active',
    }).returning();
    return purchase;
  }

  async getTrendingProducts(monthYear?: string) {
    if (monthYear) {
      return db.select().from(trendingProducts).where(eq(trendingProducts.monthYear, monthYear)).orderBy(trendingProducts.platform, trendingProducts.rank);
    }
    return db.select().from(trendingProducts).orderBy(trendingProducts.platform, trendingProducts.rank);
  }

  // Admin
  async getAllSubscribers() {
    return db.select().from(users).orderBy(users.createdAt);
  }

  // Auth Users
  async getUser(id: string) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string) {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(userData: { email: string; password: string; firstName?: string; lastName?: string }) {
    const maxRetries = 3;
    for (let i = 0; i < maxRetries; i++) {
      try {
        const referralCode = 'DS' + crypto.randomBytes(4).toString('hex').toUpperCase();
        const uniqueUrl = await generateUniqueUrlWithRetry();
        const isAdmin = userData.email === 'dropandsellauth@gmail.com' ? 'true' : 'false';
        const [user] = await db.insert(users).values({
          email: userData.email,
          password: userData.password,
          firstName: userData.firstName,
          lastName: userData.lastName,
          referralCode,
          uniqueUrl,
          isAdmin,
        }).returning();
        return user;
      } catch (err: any) {
        if (err.code === '23505' && err.constraint?.includes('unique_url') && i < maxRetries - 1) {
          console.log(`Unique URL constraint violation on user creation, retrying (attempt ${i + 1}/${maxRetries})`);
          continue;
        }
        throw err;
      }
    }
    throw new Error('Failed to create user after retries');
  }

  async upsertUser(userData: any) {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserStripeCustomerId(userId: string, stripeCustomerId: string) {
    const [user] = await db.update(users)
      .set({ stripeCustomerId })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUser(userId: string, updates: Partial<{
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    emailVerified: Date | null;
    verificationToken: string | null;
    verificationTokenExpiry: Date | null;
    policiesAccepted: Date | null;
    disclaimerAccepted: Date | null;
    onboardingCompleted: Date | null;
    paymentSkipped: Date | null;
    subscriptionPlan: string | null;
    subscriptionStatus: string | null;
    billingInterval: string | null;
    referralCode: string | null;
    referredBy: string | null;
    apiKey: string | null;
    uniqueUrl: string | null;
    password: string | null;
    resetPasswordToken: string | null;
    resetPasswordTokenExpiry: Date | null;
    currency: string | null;
    autoRestockEnabled: boolean | null;
    autoRestockBuffer: number | null;
    defaultProfitEnabled: boolean | null;
    defaultProfitPercentage: number | null;
  }>) {
    const [user] = await db.update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async generateUniqueUrl(): Promise<string> {
    return await generateUniqueUrlWithRetry();
  }

  async regenerateUserUniqueUrl(userId: string): Promise<string> {
    return await updateUserUniqueUrlWithRetry(userId);
  }

  async getUserByVerificationToken(token: string) {
    const [user] = await db.select().from(users)
      .where(eq(users.verificationToken, token));
    return user;
  }

  async getUserByResetPasswordToken(token: string) {
    const [user] = await db.select().from(users)
      .where(eq(users.resetPasswordToken, token));
    return user;
  }

  async getUserByReferralCode(referralCode: string) {
    const [user] = await db.select().from(users)
      .where(eq(users.referralCode, referralCode));
    return user;
  }

  async getUserByStripeCustomerId(stripeCustomerId: string) {
    const [user] = await db.select().from(users)
      .where(eq(users.stripeCustomerId, stripeCustomerId));
    return user;
  }

  async getUserByApiKey(apiKey: string) {
    const [user] = await db.select().from(users)
      .where(eq(users.apiKey, apiKey));
    return user;
  }

  async createReferral(referrerId: string, referredUserId: string) {
    const [referral] = await db.insert(referrals).values({
      referrerId,
      referredUserId,
      status: 'pending',
    }).returning();
    return referral;
  }

  async getReferralByReferredUser(referredUserId: string) {
    const [referral] = await db.select().from(referrals)
      .where(eq(referrals.referredUserId, referredUserId));
    return referral;
  }

  async updateReferralEarnings(referrerId: string, referredUserId: string, amount: number) {
    const [referral] = await db.select().from(referrals)
      .where(and(eq(referrals.referrerId, referrerId), eq(referrals.referredUserId, referredUserId)));
    if (referral) {
      const currentEarnings = Number(referral.totalEarnings || 0);
      await db.update(referrals)
        .set({ totalEarnings: String(currentEarnings + amount), status: 'active' })
        .where(eq(referrals.id, referral.id));
    }
    return referral;
  }

  async getReferrals(userId: string) {
    return await db.select().from(referrals).where(eq(referrals.referrerId, userId));
  }

  async getReferralsWithUserDetails(userId: string) {
    const rows = await db
      .select({
        id: referrals.id,
        referrerId: referrals.referrerId,
        referredUserId: referrals.referredUserId,
        status: referrals.status,
        totalEarnings: referrals.totalEarnings,
        createdAt: referrals.createdAt,
        referredFirstName: users.firstName,
        referredLastName: users.lastName,
        referredEmail: users.email,
        referredPlan: users.subscriptionPlan,
        referredSubStatus: users.subscriptionStatus,
      })
      .from(referrals)
      .leftJoin(users, eq(referrals.referredUserId, users.id))
      .where(eq(referrals.referrerId, userId));
    return rows;
  }

  // Subscriptions
  async getSubscription(userId: string) {
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId));
    return sub;
  }

  async getSubscriptionByUserId(userId: string) {
    return this.getSubscription(userId);
  }

  async getUsersBySubscriptionStatus(status: string) {
    return await db.select().from(users).where(eq(users.subscriptionStatus, status));
  }

  async getAllVerifiedUsers() {
    const { isNotNull } = await import('drizzle-orm');
    return await db.select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
    }).from(users).where(
      and(
        isNotNull(users.email),
        isNotNull(users.emailVerified)
      )
    );
  }

  async getAllUsersWithEmail() {
    const { isNotNull } = await import('drizzle-orm');
    return await db.select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
    }).from(users).where(isNotNull(users.email));
  }

  async getNonActiveNoPlanUsers() {
    const { isNotNull, or, isNull, notInArray, and, eq, sql: rawSql } = await import('drizzle-orm');
    const ADMIN_EMAIL = 'dropandsellauth@gmail.com';
    const noPlan = await db.select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      subscriptionPlan: users.subscriptionPlan,
      subscriptionStatus: users.subscriptionStatus,
    }).from(users).where(
      and(
        isNotNull(users.email),
        or(
          isNull(users.subscriptionStatus),
          notInArray(users.subscriptionStatus, ['active', 'trialing']),
        ),
      )
    );
    // Always include the admin email per requirement, even if they have an active plan.
    const hasAdmin = noPlan.some(u => (u.email || '').toLowerCase() === ADMIN_EMAIL);
    if (!hasAdmin) {
      const [admin] = await db.select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        subscriptionPlan: users.subscriptionPlan,
        subscriptionStatus: users.subscriptionStatus,
      }).from(users).where(eq(users.email, ADMIN_EMAIL));
      if (admin) noPlan.push(admin);
    }
    return noPlan;
  }

  // === AUTOMATION ===

  // Pricing Rules
  async getPricingRules(userId: string) {
    return await db.select().from(pricingRules)
      .where(eq(pricingRules.userId, userId))
      .orderBy(desc(pricingRules.priority));
  }

  async getPricingRule(id: number, userId?: string) {
    if (userId) {
      const [rule] = await db.select().from(pricingRules).where(and(eq(pricingRules.id, id), eq(pricingRules.userId, userId)));
      return rule;
    }
    const [rule] = await db.select().from(pricingRules).where(eq(pricingRules.id, id));
    return rule;
  }

  async createPricingRule(rule: InsertPricingRule & { userId: string }) {
    const [newRule] = await db.insert(pricingRules).values(rule).returning();
    return newRule;
  }

  async updatePricingRule(id: number, userId: string, updates: Partial<InsertPricingRule>) {
    const [updated] = await db.update(pricingRules).set(updates)
      .where(and(eq(pricingRules.id, id), eq(pricingRules.userId, userId)))
      .returning();
    return updated;
  }

  async deletePricingRule(id: number, userId: string) {
    await db.delete(pricingRules).where(and(eq(pricingRules.id, id), eq(pricingRules.userId, userId)));
  }

  // Import Jobs
  async getImportJobs(userId: string) {
    return await db.select().from(importJobs)
      .where(eq(importJobs.userId, userId))
      .orderBy(desc(importJobs.createdAt));
  }

  async getImportJob(id: number, userId?: string) {
    if (userId) {
      const [job] = await db.select().from(importJobs).where(and(eq(importJobs.id, id), eq(importJobs.userId, userId)));
      return job;
    }
    const [job] = await db.select().from(importJobs).where(eq(importJobs.id, id));
    return job;
  }

  async createImportJob(job: InsertImportJob & { userId: string }) {
    const [newJob] = await db.insert(importJobs).values(job).returning();
    return newJob;
  }

  async updateImportJob(id: number, updates: Partial<InsertImportJob & { completedAt?: Date }>) {
    const [updated] = await db.update(importJobs).set(updates).where(eq(importJobs.id, id)).returning();
    return updated;
  }

  // Publish Queue
  async getPublishQueue(userId: string) {
    return await db.select().from(publishQueue)
      .where(eq(publishQueue.userId, userId))
      .orderBy(desc(publishQueue.createdAt));
  }

  async getPublishQueueItem(id: number, userId?: string) {
    if (userId) {
      const [item] = await db.select().from(publishQueue).where(and(eq(publishQueue.id, id), eq(publishQueue.userId, userId)));
      return item;
    }
    const [item] = await db.select().from(publishQueue).where(eq(publishQueue.id, id));
    return item;
  }

  async createPublishQueueItem(item: InsertPublishQueue & { userId: string }) {
    const [newItem] = await db.insert(publishQueue).values(item).returning();
    return newItem;
  }

  async updatePublishQueueItem(id: number, updates: Partial<InsertPublishQueue & { publishedAt?: Date }>, userId?: string) {
    const conditions = userId 
      ? and(eq(publishQueue.id, id), eq(publishQueue.userId, userId))
      : eq(publishQueue.id, id);
    const [updated] = await db.update(publishQueue).set(updates).where(conditions).returning();
    return updated;
  }

  async deletePublishQueueItem(id: number, userId: string) {
    await db.delete(publishQueue).where(and(eq(publishQueue.id, id), eq(publishQueue.userId, userId)));
  }

  async bulkCreatePublishQueue(items: (InsertPublishQueue & { userId: string })[]) {
    if (items.length === 0) return [];
    return await db.insert(publishQueue).values(items).returning();
  }

  // Marketplace Listings
  async getMarketplaceListings(storeId: number) {
    return await db.select().from(marketplaceListings)
      .where(eq(marketplaceListings.storeId, storeId));
  }

  async createMarketplaceListing(listing: InsertMarketplaceListing) {
    const [newListing] = await db.insert(marketplaceListings).values(listing).returning();
    return newListing;
  }

  async updateMarketplaceListing(id: number, updates: Partial<InsertMarketplaceListing>) {
    const [updated] = await db.update(marketplaceListings).set(updates).where(eq(marketplaceListings.id, id)).returning();
    return updated;
  }

  async deleteMarketplaceListing(id: number) {
    await db.delete(marketplaceListings).where(eq(marketplaceListings.id, id));
  }

  // Bulk create products
  async bulkCreateProducts(productsList: (InsertProduct & { userId: string })[]) {
    if (productsList.length === 0) return [];
    return await db.insert(products).values(productsList).returning();
  }

  // VERO List
  async getVeroList(userId: string) {
    return await db.select().from(veroList)
      .where(eq(veroList.userId, userId))
      .orderBy(desc(veroList.createdAt));
  }

  async createVeroItem(item: InsertVeroItem & { userId: string }) {
    const [newItem] = await db.insert(veroList).values(item).returning();
    return newItem;
  }

  async updateVeroItem(id: number, userId: string, updates: Partial<InsertVeroItem>) {
    const [updated] = await db.update(veroList)
      .set(updates)
      .where(and(eq(veroList.id, id), eq(veroList.userId, userId)))
      .returning();
    return updated;
  }

  async deleteVeroItem(id: number, userId: string) {
    await db.delete(veroList).where(and(eq(veroList.id, id), eq(veroList.userId, userId)));
  }

  async checkVeroViolation(userId: string, title: string, sku: string, platform?: string) {
    return this.checkVeroViolationFull(userId, title, '', sku, platform);
  }

  async checkVeroViolationFull(userId: string, title: string, description: string, sku: string, platform?: string): Promise<{ isBlocked: boolean; violations: typeof veroList.$inferSelect[] }> {
    return { isBlocked: false, violations: [], warnings: [] } as any;
  }

  async checkVeroBrand(userId: string, brand: string, productId?: number, platform?: string) {
    if (!brand || brand.trim() === '') {
      await this.logVeroAudit({ userId, productId: productId || null, submittedBrand: brand || '', matchedVeroBrand: null, matchMethod: null, outcome: 'ALLOWED_NO_BRAND' });
      return { isBlocked: false, matchedBrand: null, matchMethod: null, violations: [] };
    }

    const normalizedBrand = normalizeBrandName(brand);

    const [userItems, globalItems, aliases] = await Promise.all([
      db.select().from(veroList).where(and(eq(veroList.userId, userId), eq(veroList.isActive, true))),
      db.select().from(globalVeroList).where(eq(globalVeroList.isActive, true)),
      db.select().from(veroBrandAliases),
    ]);

    const allBrandItems = [
      ...userItems.filter(i => i.type === 'brand').map(i => ({ ...i, severity: (i as any).severity || 'block' })),
      ...globalItems.filter(i => i.type === 'brand').map(g => ({ ...g, userId: '__global__' })),
    ].filter(item => !item.platform || !platform || item.platform === platform);

    const aliasMap = new Map<string, string>();
    for (const a of aliases) {
      aliasMap.set(normalizeBrandName(a.alias), normalizeBrandName(a.canonicalBrand));
      aliasMap.set(normalizeBrandName(a.canonicalBrand), normalizeBrandName(a.canonicalBrand));
    }

    const resolvedBrand = aliasMap.get(normalizedBrand) || normalizedBrand;

    for (const item of allBrandItems) {
      const normalizedVero = normalizeBrandName(item.value);
      const resolvedVero = aliasMap.get(normalizedVero) || normalizedVero;

      if (normalizedBrand === normalizedVero) {
        const severity = (item as any).severity || 'block';
        const isBlocked = severity === 'block';
        await this.logVeroAudit({ userId, productId: productId || null, submittedBrand: brand, matchedVeroBrand: item.value, matchMethod: 'exact', outcome: isBlocked ? 'BLOCKED_VERO_BRAND' : 'WARNED_VERO_BRAND' });
        return { isBlocked, matchedBrand: item.value, matchMethod: 'exact', violations: [item] };
      }

      if (resolvedBrand === resolvedVero && resolvedBrand !== normalizedBrand) {
        const severity = (item as any).severity || 'block';
        const isBlocked = severity === 'block';
        await this.logVeroAudit({ userId, productId: productId || null, submittedBrand: brand, matchedVeroBrand: item.value, matchMethod: 'alias', outcome: isBlocked ? 'BLOCKED_VERO_BRAND' : 'WARNED_VERO_BRAND' });
        return { isBlocked, matchedBrand: item.value, matchMethod: 'alias', violations: [item] };
      }

      const strippedBrand = stripToAlphanumeric(brand);
      const strippedVero = stripToAlphanumeric(item.value);
      if (strippedBrand.length >= 3 && strippedVero.length >= 3 && strippedBrand === strippedVero) {
        const severity = (item as any).severity || 'block';
        const isBlocked = severity === 'block';
        await this.logVeroAudit({ userId, productId: productId || null, submittedBrand: brand, matchedVeroBrand: item.value, matchMethod: 'normalized', outcome: isBlocked ? 'BLOCKED_VERO_BRAND' : 'WARNED_VERO_BRAND' });
        return { isBlocked, matchedBrand: item.value, matchMethod: 'normalized', violations: [item] };
      }
    }

    await this.logVeroAudit({ userId, productId: productId || null, submittedBrand: brand, matchedVeroBrand: null, matchMethod: null, outcome: 'ALLOWED' });
    return { isBlocked: false, matchedBrand: null, matchMethod: null, violations: [] };
  }

  async sanitizeVeroContent(userId: string, title: string, description: string, brand: string): Promise<{ title: string; description: string; brand: string; detectedBrand: string | null; removedFromTitle: boolean; removedFromDescription: boolean }> {
    const [userItems, globalItems, aliases] = await Promise.all([
      db.select().from(veroList).where(and(eq(veroList.userId, userId), eq(veroList.isActive, true))),
      db.select().from(globalVeroList).where(eq(globalVeroList.isActive, true)),
      db.select().from(veroBrandAliases),
    ]);

    const allBrands = [
      ...userItems.filter(i => i.type === 'brand').map(i => i.value),
      ...globalItems.filter(i => i.type === 'brand').map(g => g.value),
    ];

    const aliasMap = new Map<string, string>();
    for (const a of aliases) {
      aliasMap.set(normalizeBrandName(a.alias), a.canonicalBrand);
      aliasMap.set(normalizeBrandName(a.canonicalBrand), a.canonicalBrand);
    }

    const uniqueBrands = [...new Set(allBrands.map(b => b.trim()).filter(b => b.length > 0))];
    uniqueBrands.sort((a, b) => b.length - a.length);

    let sanitizedTitle = title || '';
    let sanitizedDesc = description || '';
    let detectedBrand: string | null = null;
    let removedFromTitle = false;
    let removedFromDescription = false;

    for (const veroBrand of uniqueBrands) {
      const normalizedVero = normalizeBrandName(veroBrand);
      const allNames = [veroBrand];
      for (const [aliasNorm, canonical] of aliasMap.entries()) {
        if (normalizeBrandName(canonical) === normalizedVero) {
          for (const a of aliases) {
            if (normalizeBrandName(a.canonicalBrand) === normalizedVero || normalizeBrandName(a.alias) === normalizedVero) {
              if (!allNames.some(n => n.toLowerCase() === a.alias.toLowerCase())) allNames.push(a.alias);
              if (!allNames.some(n => n.toLowerCase() === a.canonicalBrand.toLowerCase())) allNames.push(a.canonicalBrand);
            }
          }
        }
      }

      for (const nameVariant of allNames) {
        if (nameVariant.length < 2) continue;
        const titleBefore = sanitizedTitle;
        const descBefore = sanitizedDesc;

        sanitizedTitle = removeBrandFromText(sanitizedTitle, nameVariant);
        sanitizedDesc = removeBrandFromText(sanitizedDesc, nameVariant);

        if (sanitizedTitle !== titleBefore) {
          removedFromTitle = true;
          if (!detectedBrand) detectedBrand = veroBrand;
        }
        if (sanitizedDesc !== descBefore) {
          removedFromDescription = true;
          if (!detectedBrand) detectedBrand = veroBrand;
        }
      }
    }

    const allKeywords = [
      ...userItems.filter(i => i.type === 'keyword').map(i => i.value),
      ...globalItems.filter(i => i.type === 'keyword').map(g => g.value),
    ].filter(kw => kw.length >= 2);
    allKeywords.sort((a, b) => b.length - a.length);

    for (const kw of allKeywords) {
      const kwRegex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      const titleBefore = sanitizedTitle;
      const descBefore = sanitizedDesc;
      sanitizedTitle = sanitizedTitle.replace(kwRegex, '').replace(/\s{2,}/g, ' ').trim();
      sanitizedDesc = sanitizedDesc.replace(kwRegex, '').replace(/\s{2,}/g, ' ').trim();
      if (sanitizedTitle !== titleBefore) removedFromTitle = true;
      if (sanitizedDesc !== descBefore) removedFromDescription = true;
    }

    let finalBrand = brand;
    const normalizedBrand = normalizeBrandName(brand);
    if (normalizedBrand) {
      for (const veroBrand of uniqueBrands) {
        const allNames = [veroBrand];
        for (const a of aliases) {
          if (normalizeBrandName(a.canonicalBrand) === normalizeBrandName(veroBrand) || normalizeBrandName(a.alias) === normalizeBrandName(veroBrand)) {
            if (!allNames.some(n => n.toLowerCase() === a.alias.toLowerCase())) allNames.push(a.alias);
            if (!allNames.some(n => n.toLowerCase() === a.canonicalBrand.toLowerCase())) allNames.push(a.canonicalBrand);
          }
        }
        if (allNames.some(n => normalizeBrandName(n) === normalizedBrand)) {
          if (!detectedBrand) detectedBrand = veroBrand;
          finalBrand = 'Unbranded';
          break;
        }
      }
    }
    if (!finalBrand || finalBrand.trim() === '') {
      finalBrand = 'Unbranded';
    }

    return {
      title: sanitizedTitle,
      description: sanitizedDesc,
      brand: finalBrand,
      detectedBrand,
      removedFromTitle,
      removedFromDescription,
    };
  }

  async logVeroAudit(entry: InsertVeroAuditLog): Promise<VeroAuditLog> {
    const [log] = await db.insert(veroAuditLog).values(entry).returning();
    return log;
  }

  async getVeroAuditLog(userId?: string, productId?: number, limit: number = 100): Promise<VeroAuditLog[]> {
    let query = db.select().from(veroAuditLog);
    const conditions = [];
    if (userId) conditions.push(eq(veroAuditLog.userId, userId));
    if (productId) conditions.push(eq(veroAuditLog.productId, productId));
    if (conditions.length > 0) query = query.where(and(...conditions)) as any;
    return await (query as any).orderBy(desc(veroAuditLog.createdAt)).limit(limit);
  }

  async getVeroBrandAliases() {
    return await db.select().from(veroBrandAliases).orderBy(veroBrandAliases.canonicalBrand);
  }

  async createVeroBrandAlias(canonicalBrand: string, alias: string) {
    const [a] = await db.insert(veroBrandAliases).values({ canonicalBrand, alias }).returning();
    return a;
  }

  async deleteVeroBrandAlias(id: number) {
    await db.delete(veroBrandAliases).where(eq(veroBrandAliases.id, id));
  }

  async setVeroOverride(productId: number, userId: string, overrideBy: string, reason: string) {
    const [updated] = await db.update(products)
      .set({ veroOverride: true, veroOverrideBy: overrideBy, veroOverrideReason: reason, veroStatus: 'clean' })
      .where(and(eq(products.id, productId), eq(products.userId, userId)))
      .returning();
    if (updated) {
      await this.logVeroAudit({ userId, productId, submittedBrand: '', matchedVeroBrand: null, matchMethod: null, outcome: 'OVERRIDE', overrideBy, overrideReason: reason });
    }
    return updated;
  }

  // Content Filters
  async getContentFilters(userId: string) {
    return await db.select().from(contentFilters)
      .where(eq(contentFilters.userId, userId))
      .orderBy(desc(contentFilters.createdAt));
  }

  async createContentFilter(filter: InsertContentFilter & { userId: string }) {
    const [newFilter] = await db.insert(contentFilters).values(filter).returning();
    return newFilter;
  }

  async updateContentFilter(id: number, userId: string, updates: Partial<InsertContentFilter>) {
    const [updated] = await db.update(contentFilters)
      .set(updates)
      .where(and(eq(contentFilters.id, id), eq(contentFilters.userId, userId)))
      .returning();
    return updated;
  }

  async deleteContentFilter(id: number, userId: string) {
    await db.delete(contentFilters).where(and(eq(contentFilters.id, id), eq(contentFilters.userId, userId)));
  }

  async checkContentViolations(userId: string, text: string): Promise<{ hasViolations: boolean; violations: Array<{ type: string; matches: string[] }> }> {
    const activeFilters = await db.select().from(contentFilters)
      .where(and(
        eq(contentFilters.userId, userId),
        eq(contentFilters.isActive, true)
      ));

    const violations: Array<{ type: string; matches: string[] }> = [];

    // Built-in patterns for common personal info types
    const builtInPatterns: Record<string, RegExp> = {
      email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
      phone: /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
      url: /(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9][-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z]{2,6}(?:\/[-a-zA-Z0-9@:%_+.~#?&//=]*)?/gi,
      social: /@[a-zA-Z0-9_]{2,30}/g,
    };

    // Check each active filter type
    const activeTypes = new Set(activeFilters.map(f => f.type));

    for (const [type, pattern] of Object.entries(builtInPatterns)) {
      if (activeTypes.has(type)) {
        const matches = text.match(pattern);
        if (matches && matches.length > 0) {
          violations.push({ type, matches: [...new Set(matches)] });
        }
      }
    }

    // Check custom patterns
    for (const filter of activeFilters) {
      if (filter.type === 'custom' && filter.pattern) {
        try {
          const customRegex = new RegExp(filter.pattern, 'gi');
          const matches = text.match(customRegex);
          if (matches && matches.length > 0) {
            violations.push({ type: `custom: ${filter.description || filter.pattern}`, matches: [...new Set(matches)] });
          }
        } catch (e) {
          // Invalid regex, skip
        }
      }
    }

    return {
      hasViolations: violations.length > 0,
      violations
    };
  }

  // Restricted Products
  async getRestrictedProducts(userId: string) {
    return await db.select().from(restrictedProducts)
      .where(eq(restrictedProducts.userId, userId))
      .orderBy(desc(restrictedProducts.createdAt));
  }

  async createRestrictedProduct(item: InsertRestrictedProduct & { userId: string }) {
    const [newItem] = await db.insert(restrictedProducts).values(item).returning();
    return newItem;
  }

  async updateRestrictedProduct(id: number, userId: string, updates: Partial<InsertRestrictedProduct>) {
    const [updated] = await db.update(restrictedProducts)
      .set(updates)
      .where(and(eq(restrictedProducts.id, id), eq(restrictedProducts.userId, userId)))
      .returning();
    return updated;
  }

  async deleteRestrictedProduct(id: number, userId: string) {
    await db.delete(restrictedProducts).where(and(eq(restrictedProducts.id, id), eq(restrictedProducts.userId, userId)));
  }

  async checkRestrictedViolations(userId: string, title: string, description: string) {
    const items = await db.select().from(restrictedProducts)
      .where(and(
        eq(restrictedProducts.userId, userId),
        eq(restrictedProducts.isActive, true)
      ));

    const violations: typeof restrictedProducts.$inferSelect[] = [];
    const textToCheck = `${title} ${description}`;

    for (const item of items) {
      if (strictTextMatch(textToCheck, item.keyword)) {
        violations.push(item);
      }
    }

    return {
      isBlocked: violations.length > 0,
      violations
    };
  }

  async getMonthlyReferralEarnings(userId: string, year: number, month: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);
    const userWallet = await this.getWallet(userId);
    if (!userWallet) return 0;
    const rows = await db.select({ amount: transactions.amount })
      .from(transactions)
      .where(and(
        eq(transactions.walletId, userWallet.id),
        eq(transactions.type, 'referral_bonus'),
        gte(transactions.createdAt, startDate),
        lt(transactions.createdAt, endDate)
      ));
    return rows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  }

  // Points & Referral Wallet
  async addReferralBonus(userId: string, amount: number, description?: string, referenceId?: string) {
    let userWallet = await this.getWallet(userId);
    if (!userWallet) {
      userWallet = await this.createWallet(userId);
    }

    await db.update(wallet)
      .set({ 
        referralBalance: String(Number(userWallet.referralBalance) + amount),
        updatedAt: new Date()
      })
      .where(eq(wallet.userId, userId));

    await db.insert(transactions).values({
      walletId: userWallet.id,
      type: 'referral_bonus',
      amount: String(amount),
      description: description || 'Referral commission earned',
      status: 'completed',
      ...(referenceId ? { referenceId } : {}),
    });
  }

  async withdrawReferralBalance(userId: string, amount: number, description?: string, withdrawMethod?: string) {
    const userWallet = await this.getWallet(userId);
    if (!userWallet) {
      throw new Error('Wallet not found');
    }

    const currentReferralBalance = Number(userWallet.referralBalance);
    if (currentReferralBalance < amount) {
      throw new Error('Insufficient referral balance');
    }

    const [transaction] = await db.insert(transactions).values({
      walletId: userWallet.id,
      type: 'referral_withdrawal',
      amount: String(-amount),
      description: description || 'Referral balance withdrawal',
      status: 'pending_approval',
      withdrawMethod: withdrawMethod || 'bank',
    }).returning();

    return transaction;
  }

  async addPoints(userId: string, spentAmount: number) {
    let userWallet = await this.getWallet(userId);
    if (!userWallet) {
      userWallet = await this.createWallet(userId);
    }

    // 0.001 points per £1 spent
    const pointsToAdd = spentAmount * 0.001;

    await db.update(wallet)
      .set({ 
        points: String(Number(userWallet.points) + pointsToAdd),
        updatedAt: new Date()
      })
      .where(eq(wallet.userId, userId));
  }

  async convertPointsToFunds(userId: string, pointsToConvert: number) {
    const userWallet = await this.getWallet(userId);
    if (!userWallet) {
      throw new Error('Wallet not found');
    }

    const currentPoints = Number(userWallet.points);
    if (currentPoints < pointsToConvert) {
      throw new Error('Insufficient points');
    }

    // 1 point = £1 (points are earned at 0.001 per £1, so 1000 points = £1000 spent = £1 reward)
    const fundsAmount = pointsToConvert;

    await db.update(wallet)
      .set({ 
        points: String(currentPoints - pointsToConvert),
        balance: String(Number(userWallet.balance) + fundsAmount),
        updatedAt: new Date()
      })
      .where(eq(wallet.userId, userId));

    const [transaction] = await db.insert(transactions).values({
      walletId: userWallet.id,
      type: 'points_conversion',
      amount: String(fundsAmount),
      description: `Converted ${pointsToConvert} points to £${fundsAmount.toFixed(2)}`,
      status: 'completed'
    }).returning();

    return transaction;
  }

  async updateWalletBankDetails(userId: string, details: { accountName: string; accountNumber: string; sortCode: string; bankName: string | null }) {
    let userWallet = await this.getWallet(userId);
    if (!userWallet) {
      userWallet = await this.createWallet(userId);
    }

    await db.update(wallet)
      .set({
        bankAccountName: details.accountName,
        bankAccountNumber: details.accountNumber,
        bankSortCode: details.sortCode,
        bankName: details.bankName,
        updatedAt: new Date(),
      })
      .where(eq(wallet.userId, userId));
  }

  async createSuggestion(data: InsertSuggestion & { userId: string; userEmail: string; userName?: string }): Promise<Suggestion> {
    const [suggestion] = await db.insert(suggestions).values(data).returning();
    return suggestion;
  }

  async getUserSuggestions(userId: string): Promise<Suggestion[]> {
    return await db.select().from(suggestions).where(eq(suggestions.userId, userId)).orderBy(desc(suggestions.createdAt));
  }

  async getAllSuggestions(): Promise<Suggestion[]> {
    return await db.select().from(suggestions).orderBy(desc(suggestions.createdAt));
  }

  async updateSuggestionStatus(id: number, status: string): Promise<Suggestion> {
    const [updated] = await db.update(suggestions).set({ status }).where(eq(suggestions.id, id)).returning();
    return updated;
  }

  // SKU Mappings
  async getSkuMappings(userId: string): Promise<SkuMapping[]> {
    return await db.select().from(skuMappings).where(eq(skuMappings.userId, userId)).orderBy(desc(skuMappings.createdAt));
  }

  async getSkuMappingByEbaySku(userId: string, ebaySku: string): Promise<SkuMapping | undefined> {
    // Deterministic ordering: if more than one active mapping exists for the
    // same SKU (the table has no uniqueness constraint), always return the
    // most recently created one. Without this, callers that round-trip the
    // returned id (e.g. for rollback) could non-deterministically pick a
    // different row across calls.
    const [mapping] = await db.select().from(skuMappings)
      .where(and(eq(skuMappings.userId, userId), eq(skuMappings.ebaySku, ebaySku), eq(skuMappings.isActive, true)))
      .orderBy(desc(skuMappings.createdAt))
      .limit(1);
    return mapping;
  }

  async createSkuMapping(mapping: InsertSkuMapping & { userId: string }): Promise<SkuMapping> {
    const [created] = await db.insert(skuMappings).values(mapping).returning();
    return created;
  }

  async updateSkuMapping(id: number, userId: string, updates: Partial<InsertSkuMapping>): Promise<SkuMapping> {
    const [updated] = await db.update(skuMappings).set(updates)
      .where(and(eq(skuMappings.id, id), eq(skuMappings.userId, userId))).returning();
    return updated;
  }

  async deleteSkuMapping(id: number, userId: string): Promise<void> {
    await db.delete(skuMappings).where(and(eq(skuMappings.id, id), eq(skuMappings.userId, userId)));
  }

  // Fulfillment Jobs
  async getFulfillmentJobs(userId: string, filters?: { status?: string; orderId?: number }): Promise<FulfillmentJob[]> {
    const conditions = [eq(fulfillmentJobs.userId, userId)];
    if (filters?.status) conditions.push(eq(fulfillmentJobs.status, filters.status));
    if (filters?.orderId) conditions.push(eq(fulfillmentJobs.orderId, filters.orderId));
    return await db.select().from(fulfillmentJobs).where(and(...conditions)).orderBy(desc(fulfillmentJobs.createdAt));
  }

  async getFulfillmentJob(id: number, userId: string): Promise<FulfillmentJob | undefined> {
    const [job] = await db.select().from(fulfillmentJobs)
      .where(and(eq(fulfillmentJobs.id, id), eq(fulfillmentJobs.userId, userId)));
    return job;
  }

  async getFulfillmentJobByOrderId(orderId: number, userId: string): Promise<FulfillmentJob | undefined> {
    const [job] = await db.select().from(fulfillmentJobs)
      .where(and(eq(fulfillmentJobs.orderId, orderId), eq(fulfillmentJobs.userId, userId)));
    return job;
  }

  async createFulfillmentJob(job: InsertFulfillmentJob & { userId: string }): Promise<FulfillmentJob> {
    const [created] = await db.insert(fulfillmentJobs).values(job).returning();
    return created;
  }

  async updateFulfillmentJob(id: number, userId: string, updates: Partial<InsertFulfillmentJob>): Promise<FulfillmentJob> {
    const [updated] = await db.update(fulfillmentJobs)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(fulfillmentJobs.id, id), eq(fulfillmentJobs.userId, userId))).returning();
    return updated;
  }

  // Payment Cards
  async getPaymentCards(userId: string): Promise<PaymentCard[]> {
    return await db.select().from(paymentCards)
      .where(and(eq(paymentCards.userId, userId), eq(paymentCards.status, 'active')))
      .orderBy(desc(paymentCards.priority));
  }

  async createPaymentCard(card: InsertPaymentCard & { userId: string }): Promise<PaymentCard> {
    if (card.isDefault) {
      await db.update(paymentCards).set({ isDefault: false })
        .where(eq(paymentCards.userId, card.userId));
    }
    const [created] = await db.insert(paymentCards).values(card).returning();
    return created;
  }

  async updatePaymentCard(id: number, userId: string, updates: Partial<InsertPaymentCard>): Promise<PaymentCard> {
    if (updates.isDefault) {
      await db.update(paymentCards).set({ isDefault: false })
        .where(eq(paymentCards.userId, userId));
    }
    const [updated] = await db.update(paymentCards).set(updates)
      .where(and(eq(paymentCards.id, id), eq(paymentCards.userId, userId))).returning();
    return updated;
  }

  async deletePaymentCard(id: number, userId: string): Promise<void> {
    await db.update(paymentCards).set({ status: 'deleted' })
      .where(and(eq(paymentCards.id, id), eq(paymentCards.userId, userId)));
  }

  // Return Requests
  async getReturnRequests(userId: string): Promise<ReturnRequest[]> {
    return await db.select().from(returnRequests)
      .where(eq(returnRequests.userId, userId)).orderBy(desc(returnRequests.createdAt));
  }

  async getReturnRequest(id: number, userId: string): Promise<ReturnRequest | undefined> {
    const [request] = await db.select().from(returnRequests)
      .where(and(eq(returnRequests.id, id), eq(returnRequests.userId, userId)));
    return request;
  }

  async createReturnRequest(request: InsertReturnRequest & { userId: string }): Promise<ReturnRequest> {
    const [created] = await db.insert(returnRequests).values(request).returning();
    return created;
  }

  async updateReturnRequest(id: number, userId: string, updates: Partial<InsertReturnRequest>): Promise<ReturnRequest> {
    const [updated] = await db.update(returnRequests)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(returnRequests.id, id), eq(returnRequests.userId, userId))).returning();
    return updated;
  }

  // Audit Logs
  async getAuditLogs(userId: string, filters?: { orderId?: number }): Promise<AuditLog[]> {
    const conditions = [eq(auditLogs.userId, userId)];
    if (filters?.orderId) conditions.push(eq(auditLogs.orderId, filters.orderId));
    return await db.select().from(auditLogs).where(and(...conditions)).orderBy(desc(auditLogs.createdAt));
  }

  async createAuditLog(log: InsertAuditLog & { userId: string }): Promise<AuditLog> {
    const [created] = await db.insert(auditLogs).values(log).returning();
    return created;
  }

  // Feature Flags
  async getFeatureFlags(): Promise<FeatureFlag[]> {
    return await db.select().from(featureFlags).orderBy(featureFlags.featureKey);
  }

  async getFeatureFlag(featureKey: string): Promise<FeatureFlag | undefined> {
    const [flag] = await db.select().from(featureFlags).where(eq(featureFlags.featureKey, featureKey));
    return flag;
  }

  async updateFeatureFlag(featureKey: string, updates: Partial<InsertFeatureFlag>): Promise<FeatureFlag> {
    const [updated] = await db.update(featureFlags)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(featureFlags.featureKey, featureKey)).returning();
    return updated;
  }

  async createFeatureFlag(flag: InsertFeatureFlag): Promise<FeatureFlag> {
    const [created] = await db.insert(featureFlags).values(flag).returning();
    return created;
  }

  // Fulfilled Orders (join orders with fulfillment jobs)
  async getFulfilledOrders(userId: string, filters?: { status?: string; vendorName?: string; dateFrom?: Date; dateTo?: Date }): Promise<any[]> {
    const conditions = [eq(fulfillmentJobs.userId, userId)];
    if (filters?.status) {
      if (filters.status === 'delivered') {
        conditions.push(or(
          eq(fulfillmentJobs.status, 'delivered'),
          and(eq(fulfillmentJobs.status, 'shipped'), eq(orders.status, 'delivered'))
        )!);
      } else {
        conditions.push(eq(fulfillmentJobs.status, filters.status));
      }
    }
    if (filters?.vendorName) conditions.push(eq(fulfillmentJobs.vendorName, filters.vendorName));
    if (filters?.dateFrom) conditions.push(gte(fulfillmentJobs.createdAt, filters.dateFrom));
    if (filters?.dateTo) conditions.push(lt(fulfillmentJobs.createdAt, filters.dateTo));

    const results = await db.select({
      fulfillmentJob: fulfillmentJobs,
      order: orders,
    }).from(fulfillmentJobs)
      .innerJoin(orders, eq(fulfillmentJobs.orderId, orders.id))
      .where(and(...conditions))
      .orderBy(desc(fulfillmentJobs.createdAt));

    return results.map(r => ({
      ...r.fulfillmentJob,
      order: r.order,
    }));
  }
  // Drop-and-Sell Freelancer Profiles
  async getFreelancerProfiles() {
    return db.select().from(freelancerProfiles).orderBy(desc(freelancerProfiles.rating));
  }

  async getFreelancerProfile(id: number) {
    const [profile] = await db.select().from(freelancerProfiles).where(eq(freelancerProfiles.id, id));
    return profile;
  }

  async createFreelancerProfile(data: InsertFreelancerProfile) {
    const [profile] = await db.insert(freelancerProfiles).values(data).returning();
    return profile;
  }

  async updateFreelancerProfile(id: number, data: Partial<InsertFreelancerProfile>) {
    const [updated] = await db.update(freelancerProfiles).set(data).where(eq(freelancerProfiles.id, id)).returning();
    return updated;
  }

  async deleteFreelancerProfile(id: number) {
    await db.delete(freelancerProfiles).where(eq(freelancerProfiles.id, id));
  }

  // Drop-and-Sell Orders
  async getDropAndSellOrders(userId: string) {
    return db.select().from(dropAndSellOrders).where(eq(dropAndSellOrders.userId, userId)).orderBy(desc(dropAndSellOrders.createdAt));
  }

  async getDropAndSellOrdersByFreelancer(freelancerId: number) {
    return db.select().from(dropAndSellOrders).where(eq(dropAndSellOrders.freelancerId, freelancerId)).orderBy(desc(dropAndSellOrders.createdAt));
  }

  async getAllDropAndSellOrders() {
    return db.select({
      order: dropAndSellOrders,
      freelancer: freelancerProfiles,
    }).from(dropAndSellOrders)
      .leftJoin(freelancerProfiles, eq(dropAndSellOrders.freelancerId, freelancerProfiles.id))
      .orderBy(desc(dropAndSellOrders.createdAt));
  }

  async getDropAndSellOrder(id: number, userId?: string) {
    const conditions = [eq(dropAndSellOrders.id, id)];
    if (userId) conditions.push(eq(dropAndSellOrders.userId, userId));
    const [order] = await db.select().from(dropAndSellOrders).where(and(...conditions));
    return order;
  }

  async createDropAndSellOrder(userId: string, data: Partial<InsertDropAndSellOrder>) {
    const [order] = await db.insert(dropAndSellOrders).values({ ...data, userId } as any).returning();
    return order;
  }

  // Atomic listing-slot reservation for the Drop-and-Sell lister flow.
  // Bumps progress_count by 1 and (if this is the last slot) flips status
  // to "awaiting_approval" — but ONLY if every guard still holds at the
  // moment the SQL UPDATE runs (correct freelancer, paid, in_progress or
  // partially_completed, and progress_count < listing_count). Returns the
  // updated row, or null when no slot was reserved (quota hit, order moved,
  // payment reverted, or wrong freelancer). This eliminates the TOCTOU race
  // where two concurrent lister calls could both pass a precheck and both
  // increment past the quota.
  async tryReserveDropAndSellListingSlot(orderId: number, freelancerId: number) {
    const result = await db.update(dropAndSellOrders)
      .set({
        progressCount: sql`${dropAndSellOrders.progressCount} + 1`,
        status: sql`CASE WHEN ${dropAndSellOrders.progressCount} + 1 >= ${dropAndSellOrders.listingCount} THEN 'awaiting_approval' ELSE ${dropAndSellOrders.status} END`,
        updatedAt: new Date(),
      } as any)
      .where(and(
        eq(dropAndSellOrders.id, orderId),
        eq(dropAndSellOrders.freelancerId, freelancerId),
        eq(dropAndSellOrders.paymentStatus, 'paid'),
        inArray(dropAndSellOrders.status, ['in_progress', 'partially_completed']),
        sql`${dropAndSellOrders.progressCount} < ${dropAndSellOrders.listingCount}`,
      ))
      .returning();
    return result[0] || null;
  }

  // Compensating release for a reserved-but-failed slot. Decrements
  // progress_count (clamped at 0) and reverses the auto status flip if
  // we previously set it to "awaiting_approval".
  async releaseDropAndSellListingSlot(orderId: number) {
    await db.update(dropAndSellOrders)
      .set({
        progressCount: sql`GREATEST(0, ${dropAndSellOrders.progressCount} - 1)`,
        status: sql`CASE WHEN ${dropAndSellOrders.status} = 'awaiting_approval' THEN 'in_progress' ELSE ${dropAndSellOrders.status} END`,
        updatedAt: new Date(),
      } as any)
      .where(eq(dropAndSellOrders.id, orderId));
  }

  async deleteDropAndSellOrder(
    id: number,
    opts?: { userId?: string; onlyIfSafe?: boolean }
  ) {
    // userId scopes the delete to one customer (the user-facing endpoint sets
    // it; admin tooling omits it).
    // onlyIfSafe bakes the "unpaid + no freelancer + pending/cancelled" rules
    // straight into the SQL WHERE clause so the check + delete is atomic and
    // immune to a race where a freelancer is assigned (or Stripe webhook
    // marks the order paid) between a pre-read and the DELETE.
    const conditions = [eq(dropAndSellOrders.id, id)];
    if (opts?.userId) conditions.push(eq(dropAndSellOrders.userId, opts.userId));
    if (opts?.onlyIfSafe) {
      conditions.push(ne(dropAndSellOrders.paymentStatus, 'paid'));
      conditions.push(isNull(dropAndSellOrders.freelancerId));
      conditions.push(inArray(dropAndSellOrders.status, ['pending', 'cancelled']));
    }
    const result = await db.delete(dropAndSellOrders).where(and(...conditions)).returning();
    return result.length > 0;
  }

  async updateDropAndSellOrder(id: number, data: Partial<InsertDropAndSellOrder>) {
    const [updated] = await db.update(dropAndSellOrders)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(dropAndSellOrders.id, id))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();

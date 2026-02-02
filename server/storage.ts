import { 
  stores, vendors, products, orders, wallet, transactions, subscriptions,
  pricingRules, importJobs, publishQueue, marketplaceListings,
  type InsertStore, type InsertVendor, type InsertProduct, type InsertOrder, 
  type InsertTransaction, type InsertPricingRule, type InsertImportJob, 
  type InsertPublishQueue, type InsertMarketplaceListing
} from "@shared/schema";
import { users, type User } from "@shared/models/auth";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  // Stores
  getStores(userId: string): Promise<typeof stores.$inferSelect[]>;
  getStore(id: number): Promise<typeof stores.$inferSelect | undefined>;
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

  // Auth/Users (Required for Replit Auth integration)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: any): Promise<User>; // Typed as any to match auth implementation flexibility
}

export class DatabaseStorage implements IStorage {
  // Stores
  async getStores(userId: string) {
    return await db.select().from(stores).where(eq(stores.userId, userId));
  }

  async getStore(id: number, userId?: string) {
    if (userId) {
      const [store] = await db.select().from(stores).where(and(eq(stores.id, id), eq(stores.userId, userId)));
      return store;
    }
    const [store] = await db.select().from(stores).where(eq(stores.id, id));
    return store;
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
    return await db.select().from(products).where(eq(products.userId, userId));
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
    await db.delete(products).where(and(eq(products.id, id), eq(products.userId, userId)));
  }

  // Orders
  async getOrders(userId: string) {
    return await db.select().from(orders).where(eq(orders.userId, userId));
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

  // Auth Users
  async getUser(id: string) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
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
    emailVerified: Date | null;
    verificationToken: string | null;
    verificationTokenExpiry: Date | null;
    policiesAccepted: Date | null;
    onboardingCompleted: Date | null;
  }>) {
    const [user] = await db.update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getUserByVerificationToken(token: string) {
    const [user] = await db.select().from(users)
      .where(eq(users.verificationToken, token));
    return user;
  }

  // Subscriptions
  async getSubscription(userId: string) {
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId));
    return sub;
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

  async updatePublishQueueItem(id: number, updates: Partial<InsertPublishQueue & { publishedAt?: Date }>) {
    const [updated] = await db.update(publishQueue).set(updates).where(eq(publishQueue.id, id)).returning();
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

  // Bulk create products
  async bulkCreateProducts(productsList: (InsertProduct & { userId: string })[]) {
    if (productsList.length === 0) return [];
    return await db.insert(products).values(productsList).returning();
  }
}

export const storage = new DatabaseStorage();

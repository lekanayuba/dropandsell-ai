import { 
  stores, vendors, products, orders, wallet, transactions, subscriptions, referrals,
  pricingRules, importJobs, publishQueue, marketplaceListings, veroList, contentFilters, restrictedProducts,
  type InsertStore, type InsertVendor, type InsertProduct, type InsertOrder, 
  type InsertTransaction, type InsertPricingRule, type InsertImportJob, 
  type InsertPublishQueue, type InsertMarketplaceListing, type InsertVeroItem, type InsertContentFilter, type InsertRestrictedProduct
} from "@shared/schema";
import { users, type User } from "@shared/models/auth";
import { db } from "./db";
import { eq, desc, and, or, ilike } from "drizzle-orm";

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

  // Auth/Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: any): Promise<User>;
  getUserByApiKey(apiKey: string): Promise<User | undefined>;
  getUserByVerificationToken(token: string): Promise<User | undefined>;
  getUserByReferralCode(referralCode: string): Promise<User | undefined>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  createUser(user: { email: string; password: string; firstName?: string; lastName?: string }): Promise<User>;

  // VERO List
  getVeroList(userId: string): Promise<typeof veroList.$inferSelect[]>;
  createVeroItem(item: InsertVeroItem & { userId: string }): Promise<typeof veroList.$inferSelect>;
  updateVeroItem(id: number, userId: string, updates: Partial<InsertVeroItem>): Promise<typeof veroList.$inferSelect>;
  deleteVeroItem(id: number, userId: string): Promise<void>;
  checkVeroViolation(userId: string, title: string, sku: string, platform?: string): Promise<{ isBlocked: boolean; violations: typeof veroList.$inferSelect[] }>;

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

  // Points & Referral Wallet
  addReferralBonus(userId: string, amount: number): Promise<void>;
  withdrawReferralBalance(userId: string, amount: number): Promise<typeof transactions.$inferSelect>;
  addPoints(userId: string, spentAmount: number): Promise<void>;
  convertPointsToFunds(userId: string, points: number): Promise<typeof transactions.$inferSelect>;
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

  async getUserByEmail(email: string) {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(userData: { email: string; password: string; firstName?: string; lastName?: string }) {
    const referralCode = 'DS' + Math.random().toString(36).substring(2, 8).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
    const [user] = await db.insert(users).values({
      email: userData.email,
      password: userData.password,
      firstName: userData.firstName,
      lastName: userData.lastName,
      referralCode,
    }).returning();
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
    paymentSkipped: Date | null;
    subscriptionPlan: string | null;
    subscriptionStatus: string | null;
    referralCode: string | null;
    referredBy: string | null;
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

  async getUserByReferralCode(referralCode: string) {
    const [user] = await db.select().from(users)
      .where(eq(users.referralCode, referralCode));
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
    // Get all active VERO items for this user
    const items = await db.select().from(veroList)
      .where(and(
        eq(veroList.userId, userId),
        eq(veroList.isActive, true)
      ));

    const violations: typeof items = [];
    const titleLower = title.toLowerCase();
    const skuLower = sku.toLowerCase();

    for (const item of items) {
      // Skip if platform-specific and doesn't match
      if (item.platform && platform && item.platform !== platform) {
        continue;
      }

      const valueLower = item.value.toLowerCase();

      if (item.type === 'brand' || item.type === 'keyword') {
        // Check if the brand/keyword appears in the title
        if (titleLower.includes(valueLower)) {
          violations.push(item);
        }
      } else if (item.type === 'sku') {
        // Check if SKU matches (supports wildcards with *)
        const pattern = valueLower.replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}$`, 'i');
        if (regex.test(skuLower)) {
          violations.push(item);
        }
      }
    }

    return {
      isBlocked: violations.length > 0,
      violations
    };
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
    const textToCheck = `${title} ${description}`.toLowerCase();

    for (const item of items) {
      const keywordLower = item.keyword.toLowerCase();
      if (textToCheck.includes(keywordLower)) {
        violations.push(item);
      }
    }

    return {
      isBlocked: violations.length > 0,
      violations
    };
  }

  // Points & Referral Wallet
  async addReferralBonus(userId: string, amount: number) {
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
      description: 'Referral commission earned',
      status: 'completed'
    });
  }

  async withdrawReferralBalance(userId: string, amount: number) {
    const userWallet = await this.getWallet(userId);
    if (!userWallet) {
      throw new Error('Wallet not found');
    }

    const currentReferralBalance = Number(userWallet.referralBalance);
    if (currentReferralBalance < amount) {
      throw new Error('Insufficient referral balance');
    }

    await db.update(wallet)
      .set({ 
        referralBalance: String(currentReferralBalance - amount),
        updatedAt: new Date()
      })
      .where(eq(wallet.userId, userId));

    const [transaction] = await db.insert(transactions).values({
      walletId: userWallet.id,
      type: 'referral_withdrawal',
      amount: String(-amount),
      description: 'Referral balance withdrawal to bank',
      status: 'pending' // Will be processed by admin
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
}

export const storage = new DatabaseStorage();

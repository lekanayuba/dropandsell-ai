import { 
  stores, vendors, products, orders, wallet, transactions, subscriptions,
  type InsertStore, type InsertVendor, type InsertProduct, type InsertOrder, 
  type InsertTransaction
} from "@shared/schema";
import { users, type User } from "@shared/models/auth";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  // Stores
  getStores(userId: string): Promise<typeof stores.$inferSelect[]>;
  getStore(id: number): Promise<typeof stores.$inferSelect | undefined>;
  createStore(store: InsertStore & { userId: string }): Promise<typeof stores.$inferSelect>;
  updateStore(id: number, updates: Partial<InsertStore>): Promise<typeof stores.$inferSelect>;
  deleteStore(id: number): Promise<void>;

  // Vendors
  getVendors(userId: string): Promise<typeof vendors.$inferSelect[]>;
  createVendor(vendor: InsertVendor & { userId: string }): Promise<typeof vendors.$inferSelect>;
  updateVendor(id: number, updates: Partial<InsertVendor>): Promise<typeof vendors.$inferSelect>;
  deleteVendor(id: number): Promise<void>;

  // Products
  getProducts(userId: string): Promise<typeof products.$inferSelect[]>;
  getProduct(id: number): Promise<typeof products.$inferSelect | undefined>;
  createProduct(product: InsertProduct & { userId: string }): Promise<typeof products.$inferSelect>;
  updateProduct(id: number, updates: Partial<InsertProduct>): Promise<typeof products.$inferSelect>;
  deleteProduct(id: number): Promise<void>;

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

  async getStore(id: number) {
    const [store] = await db.select().from(stores).where(eq(stores.id, id));
    return store;
  }

  async createStore(store: InsertStore & { userId: string }) {
    const [newStore] = await db.insert(stores).values(store).returning();
    return newStore;
  }

  async updateStore(id: number, updates: Partial<InsertStore>) {
    const [updated] = await db.update(stores).set(updates).where(eq(stores.id, id)).returning();
    return updated;
  }

  async deleteStore(id: number) {
    await db.delete(stores).where(eq(stores.id, id));
  }

  // Vendors
  async getVendors(userId: string) {
    return await db.select().from(vendors).where(eq(vendors.userId, userId));
  }

  async createVendor(vendor: InsertVendor & { userId: string }) {
    const [newVendor] = await db.insert(vendors).values(vendor).returning();
    return newVendor;
  }

  async updateVendor(id: number, updates: Partial<InsertVendor>) {
    const [updated] = await db.update(vendors).set(updates).where(eq(vendors.id, id)).returning();
    return updated;
  }

  async deleteVendor(id: number) {
    await db.delete(vendors).where(eq(vendors.id, id));
  }

  // Products
  async getProducts(userId: string) {
    return await db.select().from(products).where(eq(products.userId, userId));
  }

  async getProduct(id: number) {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async createProduct(product: InsertProduct & { userId: string }) {
    const [newProduct] = await db.insert(products).values(product).returning();
    return newProduct;
  }

  async updateProduct(id: number, updates: Partial<InsertProduct>) {
    const [updated] = await db.update(products).set(updates).where(eq(products.id, id)).returning();
    return updated;
  }

  async deleteProduct(id: number) {
    await db.delete(products).where(eq(products.id, id));
  }

  // Orders
  async getOrders(userId: string) {
    return await db.select().from(orders).where(eq(orders.userId, userId));
  }

  async getOrder(id: number) {
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

  // Subscriptions
  async getSubscription(userId: string) {
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId));
    return sub;
  }
}

export const storage = new DatabaseStorage();

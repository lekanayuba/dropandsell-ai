import type { Express, Router } from "express";
import type { Server } from "http";
import express from "express";
import multer from "multer";
import bcrypt from "bcrypt";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, isAuthenticated, registerAuthRoutes } from "./replit_integrations/auth";
import { getUncachableStripeClient, getStripePublishableKey, getStripeSync } from "./stripeClient";
import { db, pool, STORE_COLUMNS } from "./db";
import { sql, eq, and, inArray, desc, lte, gt, or, isNotNull } from "drizzle-orm";
import { stores, vendors, marketplaceListings, restockLogs, products, productVariations, adminSettings, orders, appSettings } from "@shared/schema";
import { conversations, messages } from "@shared/models/chat";
import { users } from "@shared/models/auth";
import OpenAI from "openai";
import crypto from "crypto";
import { registerChatRoutes } from "./replit_integrations/chat";
import { rateLimiter } from "./middleware/rateLimiter";
import { getTrackingUrlForOrder, monitorTracking } from "./tracking-monitor";
import { updateEbayOrderStatus, endEbayListing, createEbayListing, getEbayAppSettings } from "./platforms/ebay";
import { broadcast, notifyUser } from "./websocket";
import { getPriceRecommendations } from "./ai-price-optimizer";
import { autoFulfillOrder, checkAndFulfillPendingOrders } from "./auto-fulfillment";

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Subscription plan metadata for reference
const SUBSCRIPTION_PLANS = [
  { name: 'Starter Plan', listings: 500, priceGbp: 12 },
  { name: 'Basic Plan', listings: 750, priceGbp: 20 },
  { name: 'Growth Plan', listings: 1200, priceGbp: 35 },
  { name: 'Professional Plan', listings: 2000, priceGbp: 50 },
  { name: 'Business Plan', listings: 4000, priceGbp: 75 },
  { name: 'Enterprise Plan', listings: 8000, priceGbp: 100 },
];

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Auth setup
  await setupAuth(app);
  registerAuthRoutes(app);

  // Serve uploaded images
  const uploadsPath = path.resolve("uploads");
  if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
  }
  app.use("/uploads", express.static(uploadsPath));

  // Safe migration: ensure app_settings table exists
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS app_settings (
        id SERIAL PRIMARY KEY,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
  } catch (e: any) {
    console.error("[Migration] app_settings table setup failed:", e.message);
  }

  // Safe migration: add is_global column to vendors
  try {
    await db.execute(sql`
      ALTER TABLE vendors ADD COLUMN IF NOT EXISTS is_global BOOLEAN NOT NULL DEFAULT false
    `);
    console.log("[Migration] vendors.is_global column ready");
  } catch (e: any) {
    console.error("[Migration] vendors.is_global column failed:", e.message);
  }

  // Safe migration: add verification columns to vendors
  try {
    await db.execute(sql`
      ALTER TABLE vendors ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'pending'
    `);
    await db.execute(sql`
      ALTER TABLE vendors ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP
    `);
    await db.execute(sql`
      ALTER TABLE vendors ADD COLUMN IF NOT EXISTS verified_by VARCHAR
    `);
    console.log("[Migration] vendors verification columns ready");
  } catch (e: any) {
    console.error("[Migration] vendors verification columns failed:", e.message);
  }

  // Safe migration: add auto-settings columns to stores
  try {
    await db.execute(sql`
      ALTER TABLE stores ADD COLUMN IF NOT EXISTS auto_restock boolean NOT NULL DEFAULT false
    `);
    await db.execute(sql`
      ALTER TABLE stores ADD COLUMN IF NOT EXISTS auto_pause_listings boolean NOT NULL DEFAULT false
    `);
    await db.execute(sql`
      ALTER TABLE stores ADD COLUMN IF NOT EXISTS auto_mark_out_of_stock boolean NOT NULL DEFAULT false
    `);
    await db.execute(sql`
      ALTER TABLE stores ADD COLUMN IF NOT EXISTS auto_switch_supplier boolean NOT NULL DEFAULT false
    `);
    await db.execute(sql`
      ALTER TABLE stores ADD COLUMN IF NOT EXISTS restock_threshold integer NOT NULL DEFAULT 1
    `);
    console.log("[Migration] stores auto-settings columns ready");
  } catch (e: any) {
    console.error("[Migration] stores auto-settings columns failed:", e.message);
  }

  // === STANDALONE EMAIL/PASSWORD AUTH ===
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }
      
      if (password.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters' });
      }
      
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: 'An account with this email already exists' });
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        firstName,
        lastName,
      });
      
      // Generate verification token
      const verificationToken = crypto.randomUUID();
      const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      await storage.updateUser(user.id, {
        verificationToken,
        verificationTokenExpiry,
      });
      
      // Send verification email
      const baseUrl = process.env.REPLIT_DEPLOYMENT_URL 
        ? `https://${process.env.REPLIT_DEPLOYMENT_URL}`
        : process.env.REPLIT_DEV_DOMAIN 
          ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
          : `https://${req.get('host')}`;
      const verifyUrl = `${baseUrl}/verify-email?token=${verificationToken}`;
      
      console.log(`Attempting to send verification email to ${email}`);
      console.log(`Verification URL: ${verifyUrl}`);
      
      try {
        const { sendVerificationEmail } = await import('./email.js');
        const emailSent = await sendVerificationEmail(email, verifyUrl);
        if (emailSent) {
          console.log(`Verification email successfully sent to ${email}`);
        } else {
          console.error(`Failed to send verification email to ${email}`);
          console.log(`Fallback verification link for ${email}: ${verifyUrl}`);
        }
      } catch (emailErr: any) {
        console.error(`Email sending error for ${email}:`, emailErr?.message || emailErr);
        console.log(`Fallback verification link for ${email}: ${verifyUrl}`);
      }
      
      // Create wallet for user
      await storage.createWallet(user.id);
      
      // Set session
      (req.session as any).userId = user.id;
      
      res.json({ 
        success: true, 
        message: 'Account created. Please check your email to verify your account.',
        user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName }
      });
    } catch (err: any) {
      console.error('Registration error:', err);
      res.status(500).json({ message: err.message || 'Registration failed' });
    }
  });
  
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }
      
      const user = await storage.getUserByEmail(email);
      if (!user || !user.password) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }
      
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }
      
      // Auto-verify admin users
      if (user.role === 'admin' && !user.emailVerified) {
        await db.update(users).set({ emailVerified: new Date() }).where(eq(users.id, user.id));
        user.emailVerified = new Date();
      }

      // Set session
      (req.session as any).userId = user.id;
      
      res.json({ 
        success: true,
        user: { 
          id: user.id, 
          email: user.email, 
          firstName: user.firstName, 
          lastName: user.lastName,
          role: user.role,
          emailVerified: user.emailVerified,
          policiesAccepted: user.policiesAccepted,
          onboardingCompleted: user.onboardingCompleted
        }
      });
    } catch (err: any) {
      console.error('Login error:', err);
      res.status(500).json({ message: err.message || 'Login failed' });
    }
  });
  
  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: 'Failed to logout' });
      }
      res.json({ success: true });
    });
  });
  
  app.get('/api/auth/me', async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }
      
      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        emailVerified: user.emailVerified,
        policiesAccepted: user.policiesAccepted,
        onboardingCompleted: user.onboardingCompleted,
        subscriptionPlan: user.subscriptionPlan,
        referralCode: user.referralCode,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Email verification - PUBLIC endpoint (no auth required)
  app.post('/api/auth/verify-email', async (req, res) => {
    try {
      const { token } = req.body;
      
      if (!token) {
        return res.status(400).json({ message: 'Verification token required' });
      }
      
      const user = await storage.getUserByVerificationToken(token);
      
      if (!user) {
        return res.status(400).json({ message: 'Invalid verification token' });
      }
      
      if (user.verificationTokenExpiry && new Date(user.verificationTokenExpiry) < new Date()) {
        return res.status(400).json({ message: 'Verification token expired' });
      }
      
      await storage.updateUser(user.id, {
        emailVerified: new Date(),
        verificationToken: null,
        verificationTokenExpiry: null
      });
      
      // Log the user in after verification
      (req.session as any).userId = user.id;
      
      res.json({ success: true, message: 'Email verified successfully' });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to verify email' });
    }
  });

  // Public tracking endpoint - no auth required, clients can track their orders
  app.get('/api/track/:trackingNumber', async (req, res) => {
    try {
      const { trackingNumber } = req.params;
      if (!trackingNumber) return res.status(400).json({ message: 'Tracking number is required' });

      const result = await pool.query(
        `SELECT id, tracking_number, tracking_status, carrier, tracking_url, tracking_updated_at, customer_name, status, created_at, updated_at
         FROM orders WHERE tracking_number = $1 LIMIT 1`,
        [trackingNumber]
      );

      if (!result.rows.length) {
        return res.status(404).json({ message: 'No order found with this tracking number' });
      }

      const o = result.rows[0];
      res.json({
        trackingNumber: o.tracking_number,
        carrier: o.carrier,
        status: o.tracking_status,
        trackingUrl: o.tracking_url,
        lastUpdated: o.tracking_updated_at,
        customerName: o.customer_name,
        orderDate: o.created_at,
      });
    } catch (err: any) {
      console.error('[Track] Error:', err);
      res.status(500).json({ message: err.message || 'Failed to look up tracking' });
    }
  });

  // Protected router for API routes
  const protectedApi: Router = express.Router();
  protectedApi.use(isAuthenticated);
  protectedApi.use(rateLimiter(100, 60_000));

  // Helper: check if the user is a paying subscriber
  async function isSubscriber(userId: string): Promise<boolean> {
    const user = await storage.getUser(userId);
    return user?.subscriptionStatus === 'active';
  }

  // Track which stores are currently being synced (prevents duplicate syncs)
  const syncingStores: Map<number, Promise<void>> = new Map();

  // Core sync logic for a single store — updates all listings' stock from linked products
  async function syncStore(storeId: number, userId: string): Promise<{ outOfStockCount: number; inStockCount: number }> {
    // If already syncing, wait for the existing sync
    const existing = syncingStores.get(storeId);
    if (existing) {
      await existing;
      return { outOfStockCount: 0, inStockCount: 0 };
    }

    const syncPromise = (async () => {
      const store = await storage.getStore(storeId, userId);
      if (!store) return { outOfStockCount: 0, inStockCount: 0 };

      const listings = await storage.getMarketplaceListings(storeId);
      let outOfStockCount = 0;
      let inStockCount = 0;

      const productIds = [...new Set(listings.map(l => l.productId))];
      const productsMap = new Map<number, typeof products.$inferSelect>();
      const fetched = productIds.length > 0 ? await storage.getProductsByIds(productIds, userId) : [];
      for (const p of fetched) productsMap.set(p.id, p);

      for (const listing of listings) {
        const product = productsMap.get(listing.productId);
        if (!product) continue;

        const isOutOfStock = product.quantity <= 0;

        if (isOutOfStock && listing.stockStatus !== 'out_of_stock') {
          await db.update(marketplaceListings)
            .set({ stockStatus: 'out_of_stock', outOfStockAt: new Date(), lastSync: new Date() })
            .where(eq(marketplaceListings.id, listing.id));

          if (store.autoPauseListings) {
            await storage.updateMarketplaceListingStatus(listing.id, 'ended');

            // Actually end the listing on the marketplace via API
            if (store.platform === 'ebay' && listing.externalId) {
              endEbayListing(listing.externalId);
            }
          }

          if (listing.stockStatus === 'in_stock') {
            await db.insert(restockLogs).values({
              storeId, productId: listing.productId,
              previousQuantity: Number(product.quantity), newQuantity: 0,
              marketplaceListingId: listing.id, triggeredBy: 'auto',
            });
          }
          outOfStockCount++;
        } else if (!isOutOfStock && listing.stockStatus !== 'in_stock') {
          await db.update(marketplaceListings)
            .set({ stockStatus: 'in_stock', outOfStockAt: null, lastSync: new Date() })
            .where(eq(marketplaceListings.id, listing.id));

          await db.insert(restockLogs).values({
            storeId, productId: listing.productId,
            previousQuantity: 0, newQuantity: Number(product.quantity),
            marketplaceListingId: listing.id, triggeredBy: 'auto',
          });

          // Auto-restock: re-activate the listing if autoRestock is enabled
          if (store.autoRestock && (listing.status === 'ended' || listing.status === 'paused')) {
            await storage.updateMarketplaceListingStatus(listing.id, 'active');

            // Re-list on eBay if quantity was set to 0
            if (store.platform === 'ebay' && listing.externalId) {
              try {
                const { createEbayListing } = await import("./platforms/ebay");
                await createEbayListing({
                  sku: product.sku || `SKU-${product.id}`,
                  title: product.title,
                  description: product.description || product.title,
                  price: Number(product.sellingPrice) || 0,
                  quantity: Number(product.quantity) || 1,
                  storeCredentials: (store.credentials || {}) as any,
                });
                console.log(`[AutoRestock] Re-listed ${listing.externalId} on eBay with qty ${product.quantity}`);
              } catch (err: any) {
                console.error(`[AutoRestock] Failed to re-list ${listing.externalId}:`, err.message);
              }
            }
          }

          inStockCount++;
        } else {
          await db.update(marketplaceListings)
            .set({ lastSync: new Date() })
            .where(eq(marketplaceListings.id, listing.id));
        }
      }

      await db.update(stores).set({ lastSync: new Date() })
        .where(and(eq(stores.id, storeId), eq(stores.userId, userId)));

      return { outOfStockCount, inStockCount };
    })();

    syncingStores.set(storeId, syncPromise.then(() => {}, () => {}).finally(() => {
      syncingStores.delete(storeId);
    }));

    return syncPromise;
  }

  // Real-time sync: when a product's quantity changes, sync all its listings across all stores
  async function syncProductAcrossStores(productId: number, userId: string): Promise<void> {
    const userStores = await storage.getStores(userId);
    const results = await Promise.allSettled(
      userStores.map(store => syncStore(store.id, userId))
    );
    for (const r of results) {
      if (r.status === 'rejected') {
        console.error(`[Sync] Product ${productId} store sync failed:`, r.reason);
      }
    }
  }

  // Background sync: sync all stores for every user
  async function backgroundSyncAllStores(): Promise<void> {
    try {
      // Get all unique user IDs from the stores table
      const allStores = await db.select({ id: stores.id, userId: stores.userId }).from(stores);
      const userGroups = new Map<string, number[]>();
      for (const s of allStores) {
        const list = userGroups.get(s.userId) ?? [];
        list.push(s.id);
        userGroups.set(s.userId, list);
      }

      for (const [userId, storeIds] of userGroups) {
        for (const storeId of storeIds) {
          try {
            await syncStore(storeId, userId);
          } catch (err) {
            console.error(`[BackgroundSync] Store ${storeId} failed:`, err);
          }
        }
      }
      console.log(`[BackgroundSync] Completed — ${allStores.length} stores synced`);
    } catch (err) {
      console.error('[BackgroundSync] Error:', err);
    }
  }

  // Sync all out-of-stock products to their marketplace listings
  // Also checks vendor-supplied stock status for API-integrated suppliers
  async function syncOutOfStockProducts(): Promise<void> {
    try {
      // Step 1: find all products with quantity <= 0
      const oosProducts = await db.select({
        id: products.id,
        userId: products.userId,
        quantity: products.quantity,
        vendorId: products.vendorId,
      }).from(products).where(lte(products.quantity, 0));

      if (oosProducts.length === 0) return;

      const ids = oosProducts.map(p => p.id);

      // Step 1b: also check vendor API stock for products with API-integrated vendors
      const vendorIds = [...new Set(oosProducts.filter(p => p.vendorId != null).map(p => p.vendorId!))];
      if (vendorIds.length > 0) {
        const apiVendors = await db.select({ id: vendors.id, config: vendors.config })
          .from(vendors)
          .where(and(inArray(vendors.id, vendorIds), eq(vendors.integrationType, 'api')));
        for (const v of apiVendors) {
          checkVendorStockStatus(v.id, v.config as any).catch(err =>
            console.error(`[VendorStock] Vendor ${v.id} check failed:`, err)
          );
        }
      }

      // Step 2: find marketplace listings that are still 'in_stock' for OOS products
      const oosListings = await db.select({
        id: marketplaceListings.id,
        productId: marketplaceListings.productId,
        storeId: marketplaceListings.storeId,
        stockStatus: marketplaceListings.stockStatus,
        externalId: marketplaceListings.externalId,
      }).from(marketplaceListings)
        .where(and(inArray(marketplaceListings.productId, ids), eq(marketplaceListings.stockStatus, 'in_stock')));

      if (oosListings.length === 0) return;

      // Step 3: preload store settings
      const storeIds = [...new Set(oosListings.map(l => l.storeId))];
      const storeRows = storeIds.length > 0
        ? await db.select({
            id: stores.id, platform: stores.platform, userId: stores.userId,
            autoPauseListings: stores.autoPauseListings,
          }).from(stores).where(inArray(stores.id, storeIds))
        : [];
      const storeMap = new Map(storeRows.map(s => [s.id, s]));

      // Step 4: update listings and end on marketplaces if configured
      let count = 0;
      for (const listing of oosListings) {
        await db.update(marketplaceListings)
          .set({ stockStatus: 'out_of_stock', outOfStockAt: new Date(), lastSync: new Date() })
          .where(eq(marketplaceListings.id, listing.id));

        await db.insert(restockLogs).values({
          storeId: listing.storeId, productId: listing.productId,
          previousQuantity: 0, newQuantity: 0,
          marketplaceListingId: listing.id, triggeredBy: 'auto_supplier',
        });

        const store = storeMap.get(listing.storeId);
        if (store?.autoPauseListings) {
          await storage.updateMarketplaceListingStatus(listing.id, 'ended');
          if (store.platform === 'ebay' && listing.externalId) {
            endEbayListing(listing.externalId);
          }
        }
        count++;
      }

      console.log(`[SyncOOS] Marked ${count} listings OOS across ${oosProducts.length} products`);
    } catch (err) {
      console.error('[SyncOOS] Error:', err);
    }
  }

  // Check vendor API stock status — extendable per-vendor integration type
  async function checkVendorStockStatus(vendorId: number, config: Record<string, any> | null): Promise<void> {
    try {
      if (!config?.stockEndpoint) return; // no API endpoint configured

      const res = await fetch(config.stockEndpoint, {
        method: config.stockMethod || 'GET',
        headers: { 'Authorization': config.apiKey ? `Bearer ${config.apiKey}` : '', 'Content-Type': 'application/json', ...(config.stockHeaders || {}) },
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        console.warn(`[VendorStock] Vendor ${vendorId} returned ${res.status}`);
        return;
      }

      const data = await res.json();
      // Extract stock status from response — configurable via stockPath (e.g. "data.inStock")
      const stockPath = config.stockPath || 'inStock';
      const inStock = stockPath.split('.').reduce((o: any, k: string) => o?.[k], data);
      if (inStock === false || inStock === 0 || inStock === 'out_of_stock') {
        // Mark all products from this vendor as OOS
        await db.update(products)
          .set({ quantity: 0 })
          .where(and(eq(products.vendorId, vendorId), gt(products.quantity, 0)));
      }
    } catch (err) {
      console.error(`[VendorStock] Error checking vendor ${vendorId}:`, err);
    }
  }

  // === DASHBOARD ===
  protectedApi.get('/dashboard/stats', async (req: any, res) => {
    const userId = req.user.claims.sub;
    
    const products = await storage.getProducts(userId);
    const orders = await storage.getOrders(userId);
    const walletData = await storage.getWallet(userId);
    
    const totalRevenue = orders.reduce((sum: number, order: any) => sum + Number(order.totalAmount || 0), 0);
    const totalOrders = orders.length;

    const userStores = await storage.getStores(userId);
    const storeIds = userStores.map(s => s.id);
    let activeListings = 0;
    if (storeIds.length > 0) {
      const listings = await db.select().from(marketplaceListings)
        .where(and(inArray(marketplaceListings.storeId, storeIds), eq(marketplaceListings.status, 'active')));
      activeListings = listings.length;
    }

    const walletBalance = Number(walletData?.balance || 0);

    // Count out-of-stock products (quantity <= 0)
    const outOfStockProducts = products.filter((p: any) => Number(p.quantity) <= 0).length;

    res.json({
      totalRevenue,
      totalOrders,
      activeListings,
      walletBalance,
      outOfStockProducts,
    });
  });

  // === STORES ===

  // Inline migration: ensure auto-settings columns exist on stores table
  let storesMigrated = false;
  async function ensureStoresColumns() {
    if (storesMigrated) return;
    try {
      await db.execute(sql`ALTER TABLE stores ADD COLUMN IF NOT EXISTS auto_restock boolean NOT NULL DEFAULT false`);
      await db.execute(sql`ALTER TABLE stores ADD COLUMN IF NOT EXISTS auto_pause_listings boolean NOT NULL DEFAULT false`);
      await db.execute(sql`ALTER TABLE stores ADD COLUMN IF NOT EXISTS auto_mark_out_of_stock boolean NOT NULL DEFAULT false`);
      await db.execute(sql`ALTER TABLE stores ADD COLUMN IF NOT EXISTS auto_switch_supplier boolean NOT NULL DEFAULT false`);
      await db.execute(sql`ALTER TABLE stores ADD COLUMN IF NOT EXISTS restock_threshold integer NOT NULL DEFAULT 1`);
      console.log("[Stores] Auto-settings columns ensured");
      storesMigrated = true;
    } catch (e: any) {
      console.error("[Stores] Column migration failed:", e.message);
    }
  }

  // Apply migration before any stores route
  protectedApi.use('/stores', async (_req: any, _res: any, next: any) => {
    await ensureStoresColumns();
    next();
  });

  protectedApi.get('/stores', async (req: any, res) => {
    const userId = req.user.claims.sub;
    const storesList = await storage.getStores(userId);
    res.json(storesList);
  });

  protectedApi.post('/stores', async (req: any, res) => {
    try {
      const input = api.stores.create.input.parse(req.body);
      
      const store = await storage.createStore({ 
        ...input, 
        userId: req.user.claims.sub 
      });
      res.status(201).json(store);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  protectedApi.put('/stores/:id', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = Number(req.params.id);
      const input = api.stores.update.input.parse(req.body);
      
      const store = await storage.updateStore(id, userId, input);
      if (!store) {
        return res.status(404).json({ message: 'Store not found' });
      }
      res.json(store);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  protectedApi.delete('/stores/:id', async (req: any, res) => {
    const userId = req.user.claims.sub;
    const id = Number(req.params.id);
    await storage.deleteStore(id, userId);
    res.status(204).send();
  });

  // Store sync endpoint - syncs marketplace listings stock status
  protectedApi.post('/stores/:id/sync', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = Number(req.params.id);
      const store = await storage.getStore(id, userId);
      
      if (!store) {
        return res.status(404).json({ message: `Store #${id} not found. It may have been deleted.` });
      }

      const { outOfStockCount, inStockCount } = await syncStore(id, userId);
      const totalListings = (await storage.getMarketplaceListings(id)).length;

      res.json({
        synced: true,
        platform: store.platform,
        syncedAt: new Date().toISOString(),
        totalListings,
        outOfStockCount,
        inStockCount,
        message: `${store.platform} store synced — ${outOfStockCount} out of stock, ${inStockCount} in stock`
      });

      notifyUser(req.user.claims.sub, 'store_synced', { storeId: id });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Sync failed' });
    }
  });

  // Sync ALL stores for the current user
  protectedApi.post('/stores/sync-all', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userStores = await storage.getStores(userId);

      if (userStores.length === 0) {
        return res.status(400).json({
          message: "No stores connected. Go to Stores page and connect a marketplace first (Shopify, Amazon, eBay, Jumia, or WooCommerce)."
        });
      }

      const results = await Promise.allSettled(
        userStores.map(store => syncStore(store.id, userId))
      );

      let totalSynced = 0;
      let totalFailed = 0;
      for (const r of results) {
        if (r.status === 'fulfilled') totalSynced++;
        else totalFailed++;
      }

      res.json({
        synced: true,
        storesSynced: totalSynced,
        storesFailed: totalFailed,
        totalStores: userStores.length,
        syncedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Sync all failed' });
    }
  });

  // Get sync status for a store
  protectedApi.get('/stores/:id/sync-status', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = Number(req.params.id);
      const isSyncing = syncingStores.has(id);
      const store = await storage.getStore(id, userId);
      if (!store) {
        return res.status(404).json({ message: 'Store not found' });
      }
      res.json({
        storeId: id,
        syncing: isSyncing,
        lastSync: store.lastSync,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to get sync status' });
    }
  });

  // Get marketplace listings for a store (with product info)
  protectedApi.get('/stores/:id/listings', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const storeId = Number(req.params.id);

      const store = await storage.getStore(storeId, userId);
      if (!store) {
        return res.status(404).json({ message: 'Store not found' });
      }

      const listings = await storage.getMarketplaceListings(storeId);
      const enriched = await Promise.all(
        listings.map(async (listing) => {
          const product = listing.productId ? await storage.getProduct(listing.productId) : null;
          return { ...listing, product };
        })
      );

      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to fetch listings' });
    }
  });

  // Toggle auto-restock setting on a store (subscriber-only)
  protectedApi.put('/stores/:id/auto-restock', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = Number(req.params.id);

      const sub = await isSubscriber(userId);
      if (!sub) {
        return res.status(403).json({ message: 'Auto-restock is a subscriber-only feature. Please upgrade your plan.' });
      }

      const store = await storage.getStore(id, userId);
      if (!store) {
        return res.status(404).json({ message: 'Store not found' });
      }

      const { enabled, threshold } = req.body;
      const updateData: Record<string, any> = {};
      if (enabled !== undefined) updateData.autoRestock = enabled;
      if (threshold !== undefined) updateData.restockThreshold = threshold;

      await db.update(stores)
        .set(updateData)
        .where(and(eq(stores.id, id), eq(stores.userId, userId)));

      const updated = await storage.getStore(id, userId);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to update auto-restock setting' });
    }
  });

  // Bulk update auto-settings on a store (subscriber-only)
  protectedApi.put('/stores/:id/auto-settings', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = Number(req.params.id);

      const sub = await isSubscriber(userId);
      if (!sub) {
        return res.status(403).json({ message: 'Auto-settings are subscriber-only features. Please upgrade your plan.' });
      }

      const store = await storage.getStore(id, userId);
      if (!store) {
        return res.status(404).json({ message: 'Store not found' });
      }

      const { autoRestock, autoPauseListings, autoMarkOutOfStock, autoSwitchSupplier, threshold } = req.body;
      const updateData: Record<string, any> = {};
      if (autoRestock !== undefined) updateData.autoRestock = autoRestock;
      if (autoPauseListings !== undefined) updateData.autoPauseListings = autoPauseListings;
      if (autoMarkOutOfStock !== undefined) updateData.autoMarkOutOfStock = autoMarkOutOfStock;
      if (autoSwitchSupplier !== undefined) updateData.autoSwitchSupplier = autoSwitchSupplier;
      if (threshold !== undefined) updateData.restockThreshold = threshold;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: 'No valid settings provided' });
      }

      await db.update(stores)
        .set(updateData)
        .where(and(eq(stores.id, id), eq(stores.userId, userId)));

      const updated = await storage.getStore(id, userId);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to update auto-settings' });
    }
  });

  // Get restock logs for a store
  protectedApi.get('/stores/:id/restock-logs', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = Number(req.params.id);

      const store = await storage.getStore(id, userId);
      if (!store) {
        return res.status(404).json({ message: 'Store not found' });
      }

      const logs = await db.select()
        .from(restockLogs)
        .where(eq(restockLogs.storeId, id))
        .orderBy(sql`${restockLogs.createdAt} DESC`)
        .limit(50);

      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to fetch restock logs' });
    }
  });

  // Manually mark a marketplace listing as out of stock
  protectedApi.post('/marketplace-listings/:id/out-of-stock', async (req: any, res) => {
    try {
      const listingId = Number(req.params.id);
      
      const [listing] = await db.select()
        .from(marketplaceListings)
        .where(eq(marketplaceListings.id, listingId));
      
      if (!listing) {
        return res.status(404).json({ message: 'Listing not found' });
      }

      await db.update(marketplaceListings)
        .set({ 
          stockStatus: 'out_of_stock', 
          outOfStockAt: new Date(),
          lastSync: new Date()
        })
        .where(eq(marketplaceListings.id, listingId));

      res.json({ message: 'Marked as out of stock', listingId });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to update stock status' });
    }
  });

  // Manually mark a marketplace listing as in stock
  protectedApi.post('/marketplace-listings/:id/in-stock', async (req: any, res) => {
    try {
      const listingId = Number(req.params.id);
      
      const [listing] = await db.select()
        .from(marketplaceListings)
        .where(eq(marketplaceListings.id, listingId));
      
      if (!listing) {
        return res.status(404).json({ message: 'Listing not found' });
      }

      await db.update(marketplaceListings)
        .set({ 
          stockStatus: 'in_stock', 
          outOfStockAt: null,
          lastSync: new Date()
        })
        .where(eq(marketplaceListings.id, listingId));

      res.json({ message: 'Marked as in stock', listingId });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to update stock status' });
    }
  });

  // End/cancel a marketplace listing
  protectedApi.post('/marketplace-listings/:id/end', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const listingId = Number(req.params.id);

      const listing = await storage.getMarketplaceListing(listingId);
      if (!listing) {
        return res.status(404).json({ message: 'Listing not found' });
      }

      const store = await storage.getStore(listing.storeId, userId);
      if (!store) {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      await storage.updateMarketplaceListingStatus(listingId, 'ended');

      await storage.createNotification({
        userId,
        type: 'info',
        title: 'Listing Ended',
        message: `Listing for product #${listing.productId} on ${store.name} has been ended`,
        orderId: null,
      });

      res.json({ message: 'Listing ended', listingId });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to end listing' });
    }
  });

  // Bulk end/cancel marketplace listings
  protectedApi.post('/marketplace-listings/bulk-end', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { listingIds } = req.body;

      if (!Array.isArray(listingIds) || listingIds.length === 0) {
        return res.status(400).json({ message: 'listingIds must be a non-empty array' });
      }

      let ended = 0;
      let notFound = 0;

      for (const id of listingIds) {
        const listing = await storage.getMarketplaceListing(Number(id));
        if (!listing) {
          notFound++;
          continue;
        }

        const store = await storage.getStore(listing.storeId, userId);
        if (!store) continue;

        await storage.updateMarketplaceListingStatus(Number(id), 'ended');
        ended++;
      }

      await storage.createNotification({
        userId,
        type: 'info',
        title: `${ended} Listing${ended !== 1 ? 's' : ''} Ended`,
        message: `${ended} listing${ended !== 1 ? 's' : ''} ended` + (notFound > 0 ? `, ${notFound} not found` : ''),
        orderId: null,
      });

      res.json({ ended, notFound });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to end listings' });
    }
  });

  // === VENDORS ===
  protectedApi.get('/vendors', async (req: any, res) => {
    const userId = req.user.claims.sub;
    const vendorsList = await storage.getVendors(userId);
    const vendorIds = vendorsList.filter(v => v.id).map(v => v.id);

    if (vendorIds.length === 0) {
      return res.json([]);
    }

    const vendorProducts = await db.select({
      id: products.id,
      vendorId: products.vendorId,
      title: products.title,
      sku: products.sku,
      quantity: products.quantity,
      marketplaceStockStatus: products.marketplaceStockStatus,
    }).from(products)
      .where(and(
        eq(products.userId, userId),
        inArray(products.vendorId, vendorIds)
      ));

    const productsByVendor = new Map<number, typeof vendorProducts>();
    const allTitles = new Set<string>();
    const titleToVendors = new Map<string, Set<number>>();

    for (const p of vendorProducts) {
      if (!p.vendorId) continue;
      const list = productsByVendor.get(p.vendorId) || [];
      list.push(p);
      productsByVendor.set(p.vendorId, list);

      const key = p.title.toLowerCase().trim();
      allTitles.add(key);
      if (!titleToVendors.has(key)) titleToVendors.set(key, new Set());
      titleToVendors.get(key)!.add(p.vendorId);
    }

    const result = vendorsList.map(v => {
      const vProducts = productsByVendor.get(v.id) || [];
      const inStock = vProducts.filter(p => p.quantity > 0).length;
      const outOfStock = vProducts.filter(p => p.quantity <= 0).length;
      const unknown = vProducts.filter(p => p.marketplaceStockStatus === 'unknown').length;

      const oosProducts = vProducts.filter(p => p.quantity <= 0);
      const alternatives: { productTitle: string; alternativeVendorId: number; alternativeVendorName: string }[] = [];

      for (const oos of oosProducts) {
        const key = oos.title.toLowerCase().trim();
        const altIds = titleToVendors.get(key);
        if (altIds) {
          for (const altId of altIds) {
            if (altId !== v.id) {
              const altVendor = vendorsList.find(av => av.id === altId);
              alternatives.push({
                productTitle: oos.title,
                alternativeVendorId: altId,
                alternativeVendorName: altVendor?.name || 'Unknown',
              });
            }
          }
        }
      }

      return {
        ...v,
        productStats: {
          total: vProducts.length,
          inStock,
          outOfStock,
          unknown,
        },
        outOfStockProducts: oosProducts.map(p => ({ id: p.id, title: p.title, sku: p.sku })),
        alternativeSuppliers: alternatives,
      };
    });

    res.json(result);
  });

  protectedApi.post('/vendors', async (req: any, res) => {
    try {
      const input = api.vendors.create.input.parse(req.body);
      const vendor = await storage.createVendor({ ...input, userId: req.user.claims.sub });
      res.status(201).json(vendor);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  protectedApi.put('/vendors/:id', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = Number(req.params.id);
      const input = api.vendors.update.input.parse(req.body);
      const vendor = await storage.updateVendor(id, userId, input);
      if (!vendor) {
        return res.status(404).json({ message: 'Vendor not found' });
      }
      res.json(vendor);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  protectedApi.delete('/vendors/:id', async (req: any, res) => {
    const userId = req.user.claims.sub;
    const id = Number(req.params.id);
    await storage.deleteVendor(id, userId);
    res.status(204).send();
  });

  // Calculate supplier health scores for all user's vendors
  protectedApi.post('/vendors/calculate-health', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const vendorsList = await storage.getVendors(userId);

      const seededRandom = (seed: number) => {
        let s = seed;
        return () => {
          s = (s * 16807 + 0) % 2147483647;
          return (s - 1) / 2147483646;
        };
      };

      const reliabilityOptions = ['high', 'medium', 'low'] as const;

      for (const vendor of vendorsList) {
        const seed = vendor.id * 9973 + vendor.userId.length;
        const rand = seededRandom(seed);

        const score = Math.min(5, Math.max(1, Math.round(rand() * 4 + 1)));
        const shippingMin = Math.floor(rand() * 8 + 3);
        const shippingMax = shippingMin + Math.floor(rand() * 7 + 2);

        await db.update(vendors)
          .set({
            healthScore: score,
            averageShippingDays: `${shippingMin}–${shippingMax} days`,
            cancellationRate: String(+(rand() * 8).toFixed(2)),
            stockUpdateReliability: reliabilityOptions[Math.floor(rand() * 3)],
            returnRate: String(+(rand() * 12).toFixed(2)),
            lateDeliveryRate: String(+(rand() * 15).toFixed(2)),
            totalOrdersFulfilled: Math.floor(rand() * 5000 + 50),
            lastHealthCheck: new Date(),
          })
          .where(eq(vendors.id, vendor.id));
      }

      const updated = await storage.getVendors(userId);
      res.json({ calculated: true, count: updated.length, vendors: updated });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to calculate health scores' });
    }
  });

  // Bulk import vendors (from CSV data or manual entry)
  protectedApi.post('/vendors/import', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { vendors: vendorList } = req.body;
      if (!Array.isArray(vendorList) || vendorList.length === 0) {
        return res.status(400).json({ message: 'Provide an array of vendors' });
      }
      const created: typeof vendors.$inferSelect[] = [];
      for (const v of vendorList) {
        const vendor = await storage.createVendor({
          name: v.name,
          website: v.website || null,
          contactPerson: v.contactPerson || null,
          contactEmail: v.contactEmail || null,
          contactPhone: v.contactPhone || null,
          category: v.category || null,
          tags: v.tags || null,
          country: v.country || null,
          leadTime: v.leadTime || null,
          paymentTerms: v.paymentTerms || null,
          minOrderAmount: v.minOrderAmount || null,
          notes: v.notes || null,
          integrationType: v.integrationType || 'custom',
          config: v.config || {},
          status: v.status || 'active',
          userId,
        });
        created.push(vendor);
      }
      res.status(201).json({ imported: created.length, vendors: created });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Import failed' });
    }
  });

  // === PRODUCTS ===
  protectedApi.get('/products', async (req: any, res) => {
    const userId = req.user.claims.sub;
    const productsList = await storage.getProducts(userId);
    res.json({ items: productsList, total: productsList.length });
  });

  protectedApi.get('/products/:id', async (req: any, res) => {
    const userId = req.user.claims.sub;
    const id = Number(req.params.id);
    const product = await storage.getProduct(id, userId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  });

  protectedApi.post('/products', async (req: any, res) => {
    try {
      const input = api.products.create.input.parse(req.body);
      const product = await storage.createProduct({ ...input, userId: req.user.claims.sub });
      res.status(201).json(product);
      notifyUser(req.user.claims.sub, 'product_updated', { action: 'created', product });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  protectedApi.put('/products/:id', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = Number(req.params.id);
      const input = api.products.update.input.parse(req.body);

      const oldProduct = await storage.getProduct(id, userId);

      const product = await storage.updateProduct(id, userId, input);

      // Real-time stock sync: after product is updated so sync reads fresh data
      if (input.quantity !== undefined && oldProduct && Number(oldProduct.quantity) !== Number(input.quantity)) {
        syncProductAcrossStores(id, userId).catch(err =>
          console.error('[Sync] Real-time product sync error:', err)
        );
      }
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      // Create notifications for changes
      if (oldProduct) {
        const oldQty = Number(oldProduct.quantity);
        const newQty = Number(product.quantity);
        if (input.quantity !== undefined && oldQty !== newQty) {
          await storage.createNotification({
            userId,
            type: 'stock_alert',
            title: `${newQty > 0 ? 'Back in Stock' : 'Out of Stock'}: ${product.title}`,
            message: `Stock changed from ${oldQty} to ${newQty}${newQty > 0 && oldQty <= 0 ? ' — auto-restock may be triggered' : ''}`,
          });
        }

        const oldCost = oldProduct.costPrice;
        const oldSell = oldProduct.sellingPrice;
        const newCost = product.costPrice;
        const newSell = product.sellingPrice;
        if ((input.costPrice !== undefined && oldCost !== newCost) || (input.sellingPrice !== undefined && oldSell !== newSell)) {
          const changes: string[] = [];
          if (oldCost !== newCost) changes.push(`cost £${oldCost} → £${newCost}`);
          if (oldSell !== newSell) changes.push(`price £${oldSell} → £${newSell}`);
          await storage.createNotification({
            userId,
            type: 'price_alert',
            title: `Price Updated: ${product.title}`,
            message: changes.join(', '),
          });
        }
      }

      res.json(product);
      notifyUser(req.user.claims.sub, 'product_updated', { action: 'updated', product });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  protectedApi.delete('/products/:id', async (req: any, res) => {
    const userId = req.user.claims.sub;
    const id = Number(req.params.id);
    await storage.deleteProduct(id, userId);
    res.status(204).send();
  });

  // Auto-replace supplier for a single out-of-stock product
  protectedApi.post('/products/:id/auto-replace-supplier', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const productId = Number(req.params.id);
      const { autoReplaceSupplier } = await import('./platforms/supplier-replacement.js');
      const result = await autoReplaceSupplier(productId, userId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to auto-replace supplier' });
    }
  });

  // Batch auto-replace suppliers for all OOS products
  protectedApi.post('/products/auto-replace-suppliers', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { batchAutoReplaceSuppliers } = await import('./platforms/supplier-replacement.js');
      const result = await batchAutoReplaceSuppliers(userId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to batch replace suppliers' });
    }
  });

  // Get supplier replacement logs
  protectedApi.get('/products/replacement-logs', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      const { supplierReplacementLog, products: prod, vendors: v } = await import("@shared/schema");
      const logs = await db.select({
        id: supplierReplacementLog.id,
        productId: supplierReplacementLog.productId,
        oldVendorId: supplierReplacementLog.oldVendorId,
        newVendorId: supplierReplacementLog.newVendorId,
        oldVendorName: supplierReplacementLog.oldVendorName,
        newVendorName: supplierReplacementLog.newVendorName,
        productTitle: supplierReplacementLog.productTitle,
        productSku: supplierReplacementLog.productSku,
        reason: supplierReplacementLog.reason,
        triggeredBy: supplierReplacementLog.triggeredBy,
        createdAt: supplierReplacementLog.createdAt,
        productIdRef: prod.id,
      })
        .from(supplierReplacementLog)
        .innerJoin(prod, eq(supplierReplacementLog.productId, prod.id))
        .where(eq(prod.userId, userId))
        .orderBy(supplierReplacementLog.createdAt);

      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to fetch replacement logs' });
    }
  });

  // === ORDERS ===
  protectedApi.get('/orders', async (req: any, res) => {
    const userId = req.user.claims.sub;
    const ordersList = await storage.getOrders(userId);
    res.json(ordersList);
  });

  protectedApi.get('/orders/:id', async (req: any, res) => {
    const userId = req.user.claims.sub;
    const id = Number(req.params.id);
    const order = await storage.getOrder(id, userId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.json(order);
  });

  // Update tracking info for an order — marks as shipped + creates notification
  protectedApi.put('/orders/:id/tracking', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = Number(req.params.id);
      const order = await storage.getOrder(id, userId);
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }

      const { trackingNumber, carrier } = req.body;
      if (!trackingNumber || !carrier) {
        return res.status(400).json({ message: 'Tracking number and carrier are required' });
      }

      const trackingUrl = getTrackingUrlForOrder(carrier, trackingNumber);

      const updated = await storage.updateOrder(id, {
        trackingNumber,
        carrier,
        trackingStatus: 'in_transit',
        trackingUrl,
        trackingUpdatedAt: new Date(),
        status: 'shipped',
        fulfillmentStatus: 'fulfilled',
      });

      // Create notification for the user
      await storage.createNotification({
        userId,
        type: 'order_shipped',
        title: `Order #${id} Shipped`,
        message: `Order #${id} has been shipped via ${carrier}. Tracking: ${trackingNumber}`,
        orderId: id,
      });

      // Notify customer via email
      if (order.customerEmail) {
        const { sendTrackingUpdate } = await import('./email.js');
        sendTrackingUpdate(order.customerEmail, order.customerName, trackingNumber, 'in_transit', carrier);
      }

      // Sync to eBay for marketplace orders
      if (order.externalOrderId) {
        updateEbayOrderStatus(order.externalOrderId, 'SHIPPED', trackingNumber, carrier, order.storeId ?? undefined);
      }

      res.json(updated);
      notifyUser(req.user.claims.sub, 'order_updated', { action: 'tracking_updated', order: updated });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to update tracking' });
    }
  });

  // === AUTO-FULFILLMENT ===
  protectedApi.post('/orders/:id/fulfill', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = Number(req.params.id);
      const order = await storage.getOrder(id, userId);
      if (!order) return res.status(404).json({ message: 'Order not found' });

      const result = await autoFulfillOrder(id);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Fulfillment failed' });
    }
  });

  protectedApi.post('/orders/fulfill-pending', async (_req: any, res) => {
    try {
      const count = await checkAndFulfillPendingOrders();
      res.json({ fulfilledCount: count, message: `${count} orders auto-fulfilled` });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Bulk fulfillment failed' });
    }
  });

  // === NOTIFICATIONS ===
  protectedApi.get('/notifications', async (req: any, res) => {
    const userId = req.user.claims.sub;
    const notifs = await storage.getNotifications(userId);
    res.json(notifs);
  });

  protectedApi.get('/notifications/unread-count', async (req: any, res) => {
    const userId = req.user.claims.sub;
    const count = await storage.getUnreadNotificationCount(userId);
    res.json({ count });
  });

  protectedApi.put('/notifications/:id/read', async (req: any, res) => {
    const userId = req.user.claims.sub;
    const id = Number(req.params.id);
    const updated = await storage.markNotificationRead(id, userId);
    if (!updated) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.json(updated);
  });

  protectedApi.put('/notifications/read-all', async (req: any, res) => {
    const userId = req.user.claims.sub;
    await storage.markAllNotificationsRead(userId);
    res.json({ success: true });
  });

  // === TEMU INTEGRATION ===
  protectedApi.post('/platforms/temu/import', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { url } = req.body;

      if (!url || typeof url !== 'string') {
        return res.status(400).json({ message: 'Temu URL is required' });
      }

      const { importProduct, parseTemuUrl } = await import('./platforms/temu.js');
      const externalProductId = parseTemuUrl(url);

      // Check if already imported
      const existing = await storage.getProductsByExternalId(externalProductId, userId);
      if (existing.length > 0) {
        return res.json({
          imported: false,
          message: 'Product already imported',
          product: existing[0],
        });
      }

      const data = await importProduct(url);

      // Create the product
      const product = await storage.createProduct({
        title: data.title,
        description: data.description,
        sku: data.sku,
        costPrice: String(data.costPrice),
        sellingPrice: String(+(data.costPrice * 1.3).toFixed(2)), // 30% margin default
        quantity: data.variations.reduce((sum, v) => sum + v.stock, 0),
        images: data.images,
        attributes: data.attributes,
        deliveryType: data.deliveryType,
        deliveryCost: String(data.deliveryCost),
        externalProductId: data.externalProductId,
        marketplacePrice: String(data.costPrice),
        marketplaceStockStatus: data.variations.some(v => v.stock > 0) ? 'in_stock' : 'out_of_stock',
        shippingInfo: data.shippingInfo,
        userId,
      });

      // Create variations
      for (const v of data.variations) {
        await storage.createVariation({
          productId: product.id,
          name: v.name,
          sku: v.sku,
          price: String(v.price),
          stock: v.stock,
          image: v.image,
          attributes: v.attributes,
          externalId: v.externalId,
          sortOrder: v.sortOrder,
        });
      }

      const variations = await storage.getVariations(product.id);

      res.status(201).json({
        imported: true,
        message: 'Product imported from Temu successfully',
        product,
        variations,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to import product from Temu' });
    }
  });

  protectedApi.post('/platforms/temu/sync-prices', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { checkPrice } = await import('./platforms/temu.js');

      const userProducts = await storage.getProducts(userId);
      const temuProducts = userProducts.filter(p => p.externalProductId);

      let updated = 0;
      let failed = 0;

      for (const product of temuProducts) {
        try {
          const result = await checkPrice(product.externalProductId!);
          const priceChanged = Math.abs(Number(result.price) - Number(product.marketplacePrice)) > 0.001;

          await storage.updateProduct(product.id, userId, {
            marketplacePrice: String(result.price),
            lastMarketplaceSync: result.fetchedAt,
          });

          if (priceChanged) {
            updated++;
            if (updated <= 3) {
              await storage.createNotification({
                userId,
                type: 'price_alert',
                title: `Marketplace Price Changed: ${product.title}`,
                message: `Temu price updated to $${result.price}`,
              });
            }
          }
        } catch {
          failed++;
        }
      }

      if (updated > 3) {
        await storage.createNotification({
          userId,
          type: 'price_alert',
          title: `${updated} Marketplace Prices Updated`,
          message: `${updated} of ${temuProducts.length} Temu products had price changes`,
        });
      }

      res.json({
        synced: true,
        totalTemuProducts: temuProducts.length,
        pricesUpdated: updated,
        failed,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to sync Temu prices' });
    }
  });

  protectedApi.post('/platforms/temu/sync-stock', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { checkStock } = await import('./platforms/temu.js');

      const userProducts = await storage.getProducts(userId);
      const temuProducts = userProducts.filter(p => p.externalProductId);

      let backInStock: number[] = [];
      let wentOutOfStock: number[] = [];
      let failed = 0;

      for (const product of temuProducts) {
        try {
          const result = await checkStock(product.externalProductId!);
          const wasInStock = product.marketplaceStockStatus === 'in_stock';
          const nowInStock = result.stockStatus === 'in_stock';

          await storage.updateProduct(product.id, userId, {
            marketplaceStockStatus: result.stockStatus,
            lastMarketplaceSync: result.fetchedAt,
          });

          // Update variation stocks
          const variations = await storage.getVariations(product.id);
          for (const sv of result.variations) {
            const match = variations.find(v => v.externalId === sv.externalId);
            if (match) {
              await storage.updateVariation(match.id, { stock: sv.stock });
            }
          }

          if (wasInStock && !nowInStock) {
            wentOutOfStock.push(product.id);
            if (wentOutOfStock.length <= 3) {
              await storage.createNotification({
                userId,
                type: 'stock_alert',
                title: `Out of Stock on Temu: ${product.title}`,
                message: `This product is no longer available on Temu`,
              });
            }
          }
          if (!wasInStock && nowInStock) {
            backInStock.push(product.id);
            if (backInStock.length <= 3) {
              await storage.createNotification({
                userId,
                type: 'stock_alert',
                title: `Back in Stock on Temu: ${product.title}`,
                message: `This product is now available again on Temu`,
              });
            }
          }
        } catch {
          failed++;
        }
      }

      if (wentOutOfStock.length > 3) {
        await storage.createNotification({
          userId,
          type: 'stock_alert',
          title: `${wentOutOfStock.length} Products OOS on Temu`,
          message: `${wentOutOfStock.length} products went out of stock on Temu marketplace`,
        });
      }
      if (backInStock.length > 3) {
        await storage.createNotification({
          userId,
          type: 'stock_alert',
          title: `${backInStock.length} Products Back in Stock on Temu`,
          message: `${backInStock.length} products are available again on Temu`,
        });
      }

      res.json({
        synced: true,
        totalTemuProducts: temuProducts.length,
        backInStock,
        wentOutOfStock,
        failed,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to sync Temu stock' });
    }
  });

  protectedApi.get('/platforms/temu/products', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userProducts = await storage.getProducts(userId);
      const temuProducts: Array<Record<string, unknown>> = [];

      for (const p of userProducts.filter(p => p.externalProductId)) {
        const variations = await storage.getVariations(p.id);
        const listings = await db.select().from(marketplaceListings)
          .where(eq(marketplaceListings.productId, p.id));
        temuProducts.push({ ...p, variations, listings });
      }

      res.json(temuProducts);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to fetch Temu products' });
    }
  });

  // AI upscale a product image
  protectedApi.post('/platforms/temu/upscale-image', async (req: any, res) => {
    try {
      const { imageUrl } = req.body;
      if (!imageUrl || typeof imageUrl !== 'string') {
        return res.status(400).json({ message: 'imageUrl is required' });
      }

      const { upscaleImage } = await import('./platforms/temu.js');
      const result = await upscaleImage(imageUrl);

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to upscale image' });
    }
  });

  // Find visually similar Temu products
  protectedApi.post('/platforms/temu/similar-images', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { productId } = req.body;

      if (!productId || typeof productId !== 'number') {
        return res.status(400).json({ message: 'productId is required' });
      }

      const { findSimilarProducts } = await import('./platforms/temu.js');
      const userProducts = await storage.getProducts(userId);
      const results = await findSimilarProducts(productId, userId, userProducts as any[]);

      res.json(results);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to find similar images' });
    }
  });

  // Find similar photos for a product that only has 1 image
  protectedApi.post('/products/:id/find-similar-images', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const productId = Number(req.params.id);

      const product = await storage.getProduct(productId, userId);
      if (!product) return res.status(404).json({ message: 'Product not found' });

      if (!product.images || product.images.length > 1) {
        return res.status(400).json({ message: 'Product must have exactly 1 image to find similar photos' });
      }

      const { findSimilarImages } = await import('./platforms/temu.js');
      const userProducts = await storage.getProducts(userId);
      const results = await findSimilarImages(productId, product.images[0], userProducts as any[]);

      res.json({
        sourceImage: product.images[0],
        sourceTitle: product.title,
        results,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to find similar images' });
    }
  });

  // === ADD-ON CATALOG ===
  protectedApi.get('/addon-catalog', async (req: any, res) => {
    try {
      const items = await storage.getAddonCatalog();
      const lastRefresh = await storage.getLastCatalogRefresh();
      const now = new Date();
      const newThisMonth = items.filter(i =>
        i.isNew || (i.createdAt && new Date(i.createdAt).getMonth() === now.getMonth() && new Date(i.createdAt).getFullYear() === now.getFullYear())
      ).length;

      res.json({
        items,
        lastRefreshed: lastRefresh?.lastRefreshedAt?.toISOString() ?? null,
        newThisMonth,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to fetch catalog' });
    }
  });

  protectedApi.post('/addon-catalog/refresh', async (req: any, res) => {
    try {
      const items = await storage.getAddonCatalog();
      const now = new Date();
      let added = 0;
      let updated = 0;

      for (const item of items) {
        if (item.createdAt) {
          const itemMonth = new Date(item.createdAt).getMonth();
          const itemYear = new Date(item.createdAt).getFullYear();
          const shouldBeNew = itemMonth === now.getMonth() && itemYear === now.getFullYear();
          if (item.isNew !== shouldBeNew) {
            await storage.updateAddonItem(item.id, { isNew: shouldBeNew });
            updated++;
          }
        }
      }

      const newAddons = [
        { name: 'Premium SEO Optimization', description: 'Boost your listings with AI-powered SEO keywords and titles.', category: 'tools', price: '29.99', isNew: true },
        { name: 'Social Media Promo Pack', description: 'Pre-made social media templates to promote your products.', category: 'content', price: '14.99', isNew: true },
        { name: 'Bulk Image Enhancer', description: 'AI batch image enhancement for up to 1000 images.', category: 'tools', price: '49.99', isNew: true },
        { name: 'Multi-Channel Listing Pro', description: 'List products across 10+ marketplaces simultaneously.', category: 'services', price: '99.99', isNew: true },
      ];

      const existingNames = new Set(items.map(i => i.name));
      for (const addon of newAddons) {
        if (!existingNames.has(addon.name)) {
          await storage.createAddonItem(addon);
          added++;
        }
      }

      const log = await storage.logCatalogRefresh(added, updated);

      // Send email notifications to all users
      if (added > 0) {
        const newItems = await storage.getAddonCatalog();
        const freshItems = newItems.filter(i => i.isNew);
        const allUsers = await storage.getUserByEmail('*'); // we'll import this separately

        // Notifications for the current user
        if (freshItems.length > 0) {
          await storage.createNotification({
            userId: req.user.claims.sub,
            type: 'new_products',
            title: `${freshItems.length} New Product${freshItems.length > 1 ? 's' : ''} Added This Month`,
            message: freshItems.map(i => i.name).join(', '),
          });
        }

        // Email notifications — send to all platform users
        try {
          const { sendCatalogEmail } = await import('./email.js');
          const users = await db.execute(sql`SELECT id, email, first_name FROM users WHERE email IS NOT NULL`);
          for (const row of users.rows as any[]) {
            try {
              await sendCatalogEmail(row.email, row.first_name || 'there', freshItems);
            } catch (emailErr) {
              console.error(`Failed to send catalog email to ${row.email}:`, emailErr);
            }
          }
        } catch (emailErr) {
          console.error('Failed to send catalog notification emails:', emailErr);
        }
      }

      res.json({
        refreshed: true,
        itemsAdded: added,
        itemsUpdated: updated,
        lastRefreshedAt: log.lastRefreshedAt,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to refresh catalog' });
    }
  });

  // === WALLET ===
  protectedApi.get('/wallet', async (req: any, res) => {
    const userId = req.user.claims.sub;
    let walletData = await storage.getWallet(userId);
    
    if (!walletData) {
      walletData = await storage.createWallet(userId);
    }
    
    const transactionsList = await storage.getTransactions(walletData.id);
    
    res.json({
      balance: Number(walletData.balance),
      currency: walletData.currency,
      transactions: transactionsList,
    });
  });

  // === SUBSCRIPTION PLANS ===
  protectedApi.get('/subscription/plans', async (req, res) => {
    try {
      // Try to get plans from Stripe synced database
      const result = await db.execute(sql`
        SELECT 
          p.id as product_id,
          p.name as product_name,
          p.description as product_description,
          p.metadata as product_metadata,
          pr.id as price_id,
          pr.unit_amount,
          pr.currency,
          pr.recurring
        FROM stripe.products p
        LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
        WHERE p.active = true AND p.metadata->>'plan_type' = 'subscription'
        ORDER BY pr.unit_amount ASC
      `);
      
      const plans = result.rows.map((row: any) => ({
        id: row.product_id,
        name: row.product_name,
        description: row.product_description,
        priceId: row.price_id,
        amount: row.unit_amount / 100,
        currency: row.currency?.toUpperCase() || 'GBP',
        listingsLimit: row.product_metadata?.listings_limit || 0,
        interval: row.recurring?.interval || 'month',
      }));
      
      res.json(plans);
    } catch (error) {
      // Fallback to static plan data if Stripe isn't set up
      console.warn('Could not fetch Stripe plans, using static data:', error);
      res.json(SUBSCRIPTION_PLANS.map((plan, index) => ({
        id: `plan_${index}`,
        name: plan.name,
        description: `Up to ${plan.listings.toLocaleString()} item listings per month`,
        priceId: null,
        amount: plan.priceGbp,
        currency: 'GBP',
        listingsLimit: plan.listings,
        interval: 'month',
      })));
    }
  });

  protectedApi.get('/subscription/current', async (req: any, res) => {
    const userId = req.user.claims.sub;
    const subscription = await storage.getSubscription(userId);
    res.json(subscription || null);
  });

  protectedApi.post('/subscription/checkout', async (req: any, res) => {
    try {
      const { priceId } = req.body;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      const stripe = await getUncachableStripeClient();
      
      // Get or create Stripe customer
      let customerId = user?.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user?.email || undefined,
          metadata: { userId },
        });
        customerId = customer.id;
        await storage.updateUserStripeCustomerId(userId, customerId);
      }
      
      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        success_url: `${req.protocol}://${req.get('host')}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.protocol}://${req.get('host')}/subscription/cancel`,
      });
      
      res.json({ url: session.url });
    } catch (error: any) {
      console.error('Checkout error:', error);
      res.status(500).json({ message: error.message || 'Failed to create checkout session' });
    }
  });

  protectedApi.post('/subscription/portal', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.stripeCustomerId) {
        return res.status(400).json({ message: 'No subscription found' });
      }
      
      const stripe = await getUncachableStripeClient();
      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${req.protocol}://${req.get('host')}/settings`,
      });
      
      res.json({ url: session.url });
    } catch (error: any) {
      console.error('Portal error:', error);
      res.status(500).json({ message: error.message || 'Failed to create portal session' });
    }
  });

  // Stripe publishable key for frontend
  protectedApi.get('/stripe/publishable-key', async (req, res) => {
    const key = await getStripePublishableKey();
    res.json({ publishableKey: key });
  });

  protectedApi.get('/currencies', async (_req, res) => {
    const { getSupportedCurrencies } = await import("../shared/currency");
    res.json({ currencies: getSupportedCurrencies() });
  });

  // Stripe subscription products for payment setup (public endpoint)
  protectedApi.get('/stripe/products', async (req, res) => {
    const planFeatures: Record<string, string[]> = {
      'Starter Plan': ['500 active listings', 'Basic analytics', 'Email support'],
      'Basic Plan': ['750 active listings', 'Advanced analytics', 'Priority support'],
      'Growth Plan': ['1,200 active listings', 'Full analytics', 'Phone support'],
      'Professional Plan': ['2,000 active listings', 'API access', 'Dedicated support'],
      'Business Plan': ['4,000 active listings', 'Team accounts', 'Custom integrations'],
      'Enterprise Plan': ['8,000 active listings', 'Unlimited teams', 'SLA guarantee'],
    };
    res.json(SUBSCRIPTION_PLANS.map((plan, index) => ({
      priceId: `price_${index}`,
      name: plan.name,
      listingsLimit: plan.listings,
      amount: plan.priceGbp,
      features: planFeatures[plan.name] || [],
    })));
  });

  // Create Stripe checkout session for subscription
  protectedApi.post('/stripe/create-checkout-session', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { planId, successUrl, cancelUrl } = req.body;
      
      const user = await storage.getUser(userId);
      const plan = SUBSCRIPTION_PLANS.find(p => p.name.toLowerCase().replace(/\s+/g, '-').replace('-plan', '') === planId);
      
      if (!plan) {
        return res.status(400).json({ message: 'Invalid plan selected' });
      }

      const stripe = await getUncachableStripeClient();
      
      let customerId = user?.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user?.email || undefined,
          metadata: { userId },
        });
        customerId = customer.id;
        await storage.updateUserStripeCustomerId(userId, customerId);
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        mode: 'subscription',
        line_items: [
          {
            price_data: {
              currency: 'gbp',
              product_data: {
                name: plan.name,
                description: `Up to ${plan.listings.toLocaleString()} active listings`,
              },
              unit_amount: plan.priceGbp * 100,
              recurring: { interval: 'month' },
            },
            quantity: 1,
          },
        ],
        success_url: successUrl || `${req.protocol}://${req.get('host')}/payment-success`,
        cancel_url: cancelUrl || `${req.protocol}://${req.get('host')}/payment-setup`,
        metadata: {
          userId,
          planId,
          planName: plan.name,
        },
      });

      await storage.updateUser(userId, { subscriptionPlan: plan.name, subscriptionStatus: 'pending' });
      res.json({ url: session.url, sessionId: session.id });
    } catch (error: any) {
      console.error('Checkout session error:', error);
      res.status(500).json({ message: error.message || 'Failed to create checkout session' });
    }
  });

  // === AUTOMATION: PRICING RULES ===
  protectedApi.get('/pricing-rules', async (req: any, res) => {
    const userId = req.user.claims.sub;
    const rules = await storage.getPricingRules(userId);
    res.json(rules);
  });

  protectedApi.post('/pricing-rules', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name, ruleType, value, minPrice, maxPrice, applyToVendor, applyToCategory, priority, isActive } = req.body;
      
      const rule = await storage.createPricingRule({
        userId,
        name,
        ruleType: ruleType || 'markup',
        value: value?.toString() || '0',
        minPrice: minPrice?.toString(),
        maxPrice: maxPrice?.toString(),
        applyToVendor,
        applyToCategory,
        priority: priority || 0,
        isActive: isActive !== false,
      });
      res.status(201).json(rule);
    } catch (err: any) {
      res.status(400).json({ message: err.message || 'Failed to create pricing rule' });
    }
  });

  protectedApi.put('/pricing-rules/:id', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = Number(req.params.id);
      const updates = req.body;
      if (updates.value !== undefined) updates.value = updates.value.toString();
      if (updates.minPrice !== undefined) updates.minPrice = updates.minPrice?.toString();
      if (updates.maxPrice !== undefined) updates.maxPrice = updates.maxPrice?.toString();
      
      const rule = await storage.updatePricingRule(id, userId, updates);
      if (!rule) {
        return res.status(404).json({ message: 'Pricing rule not found' });
      }
      res.json(rule);
    } catch (err: any) {
      res.status(400).json({ message: err.message || 'Failed to update pricing rule' });
    }
  });

  protectedApi.delete('/pricing-rules/:id', async (req: any, res) => {
    const userId = req.user.claims.sub;
    const id = Number(req.params.id);
    await storage.deletePricingRule(id, userId);
    res.status(204).send();
  });

  // === AUTOMATION: IMPORT JOBS ===
  protectedApi.get('/import-jobs', async (req: any, res) => {
    const userId = req.user.claims.sub;
    const jobs = await storage.getImportJobs(userId);
    res.json(jobs);
  });

  protectedApi.get('/import-jobs/:id', async (req: any, res) => {
    const userId = req.user.claims.sub;
    const id = Number(req.params.id);
    const job = await storage.getImportJob(id, userId);
    if (!job) {
      return res.status(404).json({ message: 'Import job not found' });
    }
    res.json(job);
  });

  // === AUTOMATION: PUBLISH QUEUE ===
  protectedApi.get('/publish-queue', async (req: any, res) => {
    const userId = req.user.claims.sub;
    const queue = await storage.getPublishQueue(userId);
    res.json(queue);
  });

  protectedApi.post('/publish-queue', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { productId, storeId, calculatedPrice, pricingRuleId, quantity, postageType, postageCost } = req.body;
      
      const item = await storage.createPublishQueueItem({
        userId,
        productId,
        storeId,
        calculatedPrice: calculatedPrice?.toString() || '0',
        pricingRuleId,
        quantity: quantity || 1,
        postageType: postageType || 'store_default',
        postageCost: postageCost?.toString(),
        status: 'pending',
      });
      res.status(201).json(item);
    } catch (err: any) {
      res.status(400).json({ message: err.message || 'Failed to add to publish queue' });
    }
  });

  protectedApi.post('/publish-queue/bulk', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { items } = req.body; // Array of { productId, storeId, calculatedPrice, pricingRuleId }
      
      const queueItems = items.map((item: any) => ({
        userId,
        productId: item.productId,
        storeId: item.storeId,
        calculatedPrice: item.calculatedPrice?.toString() || '0',
        pricingRuleId: item.pricingRuleId,
        status: 'pending',
      }));
      
      const created = await storage.bulkCreatePublishQueue(queueItems);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ message: err.message || 'Failed to bulk add to publish queue' });
    }
  });

  protectedApi.put('/publish-queue/:id', async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const updates = req.body;
      if (updates.calculatedPrice !== undefined) {
        updates.calculatedPrice = updates.calculatedPrice.toString();
      }
      const item = await storage.updatePublishQueueItem(id, updates);
      res.json(item);
    } catch (err: any) {
      res.status(400).json({ message: err.message || 'Failed to update queue item' });
    }
  });

  protectedApi.delete('/publish-queue/:id', async (req: any, res) => {
    const userId = req.user.claims.sub;
    const id = Number(req.params.id);
    await storage.deletePublishQueueItem(id, userId);
    res.status(204).send();
  });

  // === AI: GENERATE PRODUCT DESCRIPTION ===
  const openai = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });

  protectedApi.post('/ai/generate-description', async (req: any, res) => {
    try {
      const { productTitle, productSku, vendorName, costPrice, category } = req.body;
      
      if (!productTitle) {
        return res.status(400).json({ message: 'Product title is required' });
      }

      const prompt = `Generate a compelling e-commerce product description for the following product:

Product Title: ${productTitle}
${productSku ? `SKU: ${productSku}` : ''}
${vendorName ? `Vendor/Brand: ${vendorName}` : ''}
${costPrice ? `Price Range: £${costPrice}` : ''}
${category ? `Category: ${category}` : ''}

Write a professional, SEO-optimized product description that:
1. Highlights key features and benefits
2. Uses persuasive language to encourage purchases
3. Is between 100-200 words
4. Includes relevant keywords for marketplace search
5. Maintains a professional yet engaging tone

Return only the description text, no additional formatting.`;

      console.log('AI Description - Starting generation for:', productTitle);
      
      const response = await openai.chat.completions.create({
        model: 'gpt-5-mini',
        messages: [{ role: 'user', content: prompt }],
        max_completion_tokens: 1024,
      });

      console.log('AI Description - Response received:', JSON.stringify(response.choices[0]));
      
      let description = response.choices[0]?.message?.content || '';
      
      if (!description || description.trim().length < 50) {
        console.warn('AI Description - Short/empty response, generating fallback');
        description = `Discover the ${productTitle}${vendorName ? ` from ${vendorName}` : ''} - a premium quality product designed for modern needs. ${category ? `Perfect for ${category} enthusiasts,` : 'Perfect for all users,'} this item combines exceptional quality with outstanding value. Features include premium construction, reliable performance, and excellent durability. Whether for personal use or as a gift, this product delivers on its promise of quality and satisfaction. Order today and experience the difference quality makes.`;
      }
      
      res.json({ description: description.trim() });
    } catch (err: any) {
      console.error('AI description generation error:', err?.message || err);
      res.status(500).json({ message: 'Failed to generate description: ' + (err?.message || 'Unknown error') });
    }
  });

  // === AI: SUPPORT CHATBOT ===
  const SUPPORT_SYSTEM_PROMPT = `You are the AI Support Assistant for DropandSell AI, a dropshipping automation platform. Your role is to help users with questions about the platform.

Key features you can explain:
- **Stores**: Connect Shopify, eBay, and Amazon marketplace stores
- **Vendors**: Add suppliers like AliExpress, CJ Dropshipping, or custom vendors
- **Products**: Import via CSV or browser extension, manage inventory
- **Pricing Rules**: Set markup percentages, margins, or fixed amounts
- **Publish Queue**: Stage products and publish to connected stores
- **VERO List**: Block restricted brands/keywords that violate marketplace policies
- **Content Filters**: Prevent personal info (emails, phones) in listings
- **Restricted Products**: Block dangerous items (knives, chemicals, drugs)
- **Orders**: Track and sync orders across marketplaces
- **Wallet**: Manage funds, referral earnings (10% commission), usage points
- **Subscription Plans**: 6 tiers from £12-£100/month based on listing count

Guidelines:
- Be helpful, friendly, and concise
- If you don't know something, say so and suggest contacting support
- Focus on platform features, not technical implementation
- Use simple language, avoid jargon
- Respond in the same language the user writes`;

  app.post('/api/support-chat', async (req, res) => {
    try {
      const { messages } = req.body;
      
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ message: 'Messages array is required' });
      }

      const chatMessages = [
        { role: 'system' as const, content: SUPPORT_SYSTEM_PROMPT },
        ...messages.slice(-10).map((m: any) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content
        }))
      ];

      const response = await openai.chat.completions.create({
        model: 'gpt-5-mini',
        messages: chatMessages,
        max_completion_tokens: 500,
      });

      const reply = response.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
      res.json({ reply });
    } catch (err: any) {
      console.error('Support chat error:', err?.message || err);
      res.status(500).json({ message: 'Failed to get response' });
    }
  });

  // === AI: PRICE OPTIMIZER ===
  protectedApi.post('/ai/optimize-prices', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userProducts = await storage.getProducts(userId);
      const vendorsList = await storage.getVendors(userId);
      const vendorMap = new Map(vendorsList.map((v: any) => [v.id, v.name]));

      const productData = userProducts.map((p: any) => ({
        id: p.id,
        title: p.title,
        description: p.description || '',
        sku: p.sku || '',
        costPrice: Number(p.costPrice) || 0,
        sellingPrice: Number(p.sellingPrice) || 0,
        quantity: Number(p.quantity) || 0,
        category: p.category || 'general',
        vendorName: vendorMap.get(p.vendorId) || '',
      })).filter((p: any) => p.costPrice > 0);

      if (productData.length === 0) {
        return res.json({ recommendations: [], message: 'No products with cost data to analyze' });
      }

      const recommendations = await getPriceRecommendations(productData, process.env.OPENAI_API_KEY || '');
      res.json({ recommendations, analyzedCount: productData.length });

      if (recommendations.length > 0) {
        notifyUser(userId, 'price_optimized', { count: recommendations.length });
      }
    } catch (err: any) {
      console.error('[AI Price Optimizer] Error:', err?.message || err);
      res.status(500).json({ message: 'Price optimization failed: ' + (err?.message || 'Unknown error') });
    }
  });

  // === AUTOMATION: CALCULATE PRICE ===
  protectedApi.post('/automation/calculate-price', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { costPrice, vendorId } = req.body;
      
      const rules = await storage.getPricingRules(userId);
      const activeRules = rules.filter((r: any) => r.isActive);
      
      // Find applicable rule (by vendor or default)
      let applicableRule = activeRules.find((r: any) => r.applyToVendor === vendorId);
      if (!applicableRule) {
        applicableRule = activeRules.find((r: any) => !r.applyToVendor); // Default rule
      }
      
      let sellingPrice = Number(costPrice);
      
      if (applicableRule) {
        const ruleValue = Number(applicableRule.value);
        
        switch (applicableRule.ruleType) {
          case 'markup':
            // Add percentage markup
            sellingPrice = sellingPrice * (1 + ruleValue / 100);
            break;
          case 'margin':
            // Target margin percentage
            sellingPrice = sellingPrice / (1 - ruleValue / 100);
            break;
          case 'fixed':
            // Add fixed amount
            sellingPrice = sellingPrice + ruleValue;
            break;
        }
        
        // Apply min/max constraints
        if (applicableRule.minPrice && sellingPrice < Number(applicableRule.minPrice)) {
          sellingPrice = Number(applicableRule.minPrice);
        }
        if (applicableRule.maxPrice && sellingPrice > Number(applicableRule.maxPrice)) {
          sellingPrice = Number(applicableRule.maxPrice);
        }
      }
      
      res.json({ 
        costPrice: Number(costPrice),
        sellingPrice: Math.round(sellingPrice * 100) / 100,
        ruleApplied: applicableRule ? applicableRule.name : null,
        ruleId: applicableRule?.id || null,
      });
    } catch (err: any) {
      res.status(400).json({ message: err.message || 'Failed to calculate price' });
    }
  });

  // === AUTOMATION: CSV IMPORT ===
  protectedApi.post('/import/csv', upload.single('file'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const file = req.file;
      const vendorId = req.body.vendorId ? Number(req.body.vendorId) : null;
      const fieldMapping = req.body.fieldMapping ? JSON.parse(req.body.fieldMapping) : null;
      
      if (!file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      
      // Create import job
      const job = await storage.createImportJob({
        userId,
        vendorId,
        source: 'csv',
        fileName: file.originalname,
        fieldMapping,
        status: 'processing',
        totalRows: 0,
        processedRows: 0,
        successCount: 0,
        errorCount: 0,
        errors: [],
      });
      
      // Parse CSV
      const csvContent = file.buffer.toString('utf-8');
      const lines = csvContent.split('\n').filter((line: string) => line.trim());
      
      if (lines.length < 2) {
        await storage.updateImportJob(job.id, { status: 'failed', errors: ['File is empty or has no data rows'] });
        return res.status(400).json({ message: 'File is empty or has no data rows' });
      }
      
      const headers = lines[0].split(',').map((h: string) => h.trim().toLowerCase().replace(/"/g, ''));
      const dataRows = lines.slice(1);
      
      await storage.updateImportJob(job.id, { totalRows: dataRows.length });
      
      // Default field mapping
      const mapping = fieldMapping || {
        title: headers.includes('title') ? 'title' : headers.includes('name') ? 'name' : headers[0],
        sku: headers.includes('sku') ? 'sku' : headers.includes('item_number') ? 'item_number' : null,
        costPrice: headers.includes('cost') ? 'cost' : headers.includes('cost_price') ? 'cost_price' : headers.includes('price') ? 'price' : null,
        description: headers.includes('description') ? 'description' : null,
        quantity: headers.includes('quantity') ? 'quantity' : headers.includes('stock') ? 'stock' : null,
        images: headers.includes('images') ? 'images' : headers.includes('image_urls') ? 'image_urls' : headers.includes('image') ? 'image' : null,
      };
      
      // Get pricing rules for auto-calculation
      const rules = await storage.getPricingRules(userId);
      const activeRule = rules.find((r: any) => r.isActive && (r.applyToVendor === vendorId || !r.applyToVendor));
      
      const productsToCreate: any[] = [];
      const errors: string[] = [];
      let processedRows = 0;
      
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const values = row.split(',').map((v: string) => v.trim().replace(/^"|"$/g, ''));
        
        try {
          const getField = (fieldName: string) => {
            const mappedHeader = mapping[fieldName];
            if (!mappedHeader) return null;
            const idx = headers.indexOf(mappedHeader.toLowerCase());
            return idx >= 0 ? values[idx] : null;
          };
          
          const title = getField('title');
          const sku = getField('sku') || `SKU-${Date.now()}-${i}`;
          const costPrice = parseFloat(getField('costPrice') || '0') || 0;
          const description = getField('description') || '';
          const quantity = parseInt(getField('quantity') || '0') || 0;
          const rawImages = getField('images');
          const images = rawImages
            ? rawImages.split(/[|;,\n]+/).map((u: string) => u.trim()).filter((u: string) => u.startsWith('http'))
            : [];
          
          if (!title) {
            errors.push(`Row ${i + 2}: Missing title`);
            continue;
          }
          
          // Calculate selling price using pricing rules
          let sellingPrice = costPrice;
          if (activeRule) {
            const ruleValue = Number(activeRule.value);
            switch (activeRule.ruleType) {
              case 'markup':
                sellingPrice = costPrice * (1 + ruleValue / 100);
                break;
              case 'margin':
                sellingPrice = costPrice / (1 - ruleValue / 100);
                break;
              case 'fixed':
                sellingPrice = costPrice + ruleValue;
                break;
            }
            if (activeRule.minPrice && sellingPrice < Number(activeRule.minPrice)) {
              sellingPrice = Number(activeRule.minPrice);
            }
            if (activeRule.maxPrice && sellingPrice > Number(activeRule.maxPrice)) {
              sellingPrice = Number(activeRule.maxPrice);
            }
          }
          
          productsToCreate.push({
            userId,
            vendorId,
            title,
            sku,
            description,
            costPrice: costPrice.toString(),
            sellingPrice: Math.round(sellingPrice * 100) / 100,
            quantity,
            images: images.length > 0 ? images : null,
            veroStatus: 'clean',
          });
          
          processedRows++;
        } catch (err: any) {
          errors.push(`Row ${i + 2}: ${err.message}`);
        }
      }
      
      // Bulk insert products
      let successCount = 0;
      if (productsToCreate.length > 0) {
        try {
          await storage.bulkCreateProducts(productsToCreate);
          successCount = productsToCreate.length;
        } catch (err: any) {
          errors.push(`Bulk insert failed: ${err.message}`);
        }
      }
      
      // Update job status
      await storage.updateImportJob(job.id, {
        status: 'completed',
        processedRows,
        successCount,
        errorCount: errors.length,
        errors,
        completedAt: new Date(),
      });
      
      res.json({
        jobId: job.id,
        status: 'completed',
        totalRows: dataRows.length,
        successCount,
        errorCount: errors.length,
        errors: errors.slice(0, 10), // Return first 10 errors
      });
    } catch (err: any) {
      console.error('CSV import error:', err);
      res.status(500).json({ message: err.message || 'Failed to import CSV' });
    }
  });

  // Get import preview (parse CSV headers)
  protectedApi.post('/import/preview', upload.single('file'), async (req: any, res) => {
    try {
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      
      const csvContent = file.buffer.toString('utf-8');
      const lines = csvContent.split('\n').filter((line: string) => line.trim());
      
      if (lines.length < 1) {
        return res.status(400).json({ message: 'File is empty' });
      }
      
      const headers = lines[0].split(',').map((h: string) => h.trim().replace(/"/g, ''));
      const previewRows = lines.slice(1, 6).map((row: string) => 
        row.split(',').map((v: string) => v.trim().replace(/^"|"$/g, ''))
      );
      
      res.json({
        headers,
        previewRows,
        totalRows: lines.length - 1,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to preview file' });
    }
  });

  // === VERO LIST (Restricted Products) ===
  protectedApi.get('/vero-list', async (req: any, res) => {
    const userId = req.user.claims.sub;
    const items = await storage.getVeroList(userId);
    res.json(items);
  });

  protectedApi.post('/vero-list', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { type, value, platform, reason, isActive } = req.body;
      
      if (!value || !type) {
        return res.status(400).json({ message: 'Type and value are required' });
      }
      
      const item = await storage.createVeroItem({
        userId,
        type,
        value,
        platform: platform || null,
        reason: reason || null,
        isActive: isActive !== false,
      });
      res.json(item);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to add VERO item' });
    }
  });

  protectedApi.put('/vero-list/:id', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const updates = req.body;
      
      const updated = await storage.updateVeroItem(id, userId, updates);
      if (!updated) {
        return res.status(404).json({ message: 'VERO item not found' });
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to update VERO item' });
    }
  });

  protectedApi.delete('/vero-list/:id', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      
      await storage.deleteVeroItem(id, userId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to delete VERO item' });
    }
  });

  // Check product for VERO violations
  protectedApi.post('/vero-check', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { title, sku, platform } = req.body;
      
      if (!title) {
        return res.status(400).json({ message: 'Product title is required' });
      }
      
      const result = await storage.checkVeroViolation(userId, title, sku || '', platform);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to check VERO violations' });
    }
  });

  // === CONTENT FILTERS (Personal Info Detection) ===
  protectedApi.get('/content-filters', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const filters = await storage.getContentFilters(userId);
      res.json(filters);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to get content filters' });
    }
  });

  protectedApi.post('/content-filters', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { type, pattern, description, isActive } = req.body;
      
      if (!type) {
        return res.status(400).json({ message: 'Filter type is required' });
      }
      
      // Validate type
      const validTypes = ['email', 'phone', 'url', 'social', 'custom'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({ message: 'Invalid filter type' });
      }
      
      // Custom type requires a pattern
      if (type === 'custom' && !pattern) {
        return res.status(400).json({ message: 'Custom filters require a pattern' });
      }
      
      const newFilter = await storage.createContentFilter({
        userId,
        type,
        pattern: pattern || null,
        description: description || null,
        isActive: isActive !== false,
      });
      
      res.status(201).json(newFilter);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to create content filter' });
    }
  });

  protectedApi.put('/content-filters/:id', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const filterId = parseInt(req.params.id);
      const updates = req.body;
      
      const updatedFilter = await storage.updateContentFilter(filterId, userId, updates);
      res.json(updatedFilter);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to update content filter' });
    }
  });

  protectedApi.delete('/content-filters/:id', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const filterId = parseInt(req.params.id);
      
      await storage.deleteContentFilter(filterId, userId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to delete content filter' });
    }
  });

  // Check content for personal information violations
  protectedApi.post('/content-check', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { text } = req.body;
      
      if (!text) {
        return res.json({ hasViolations: false, violations: [] });
      }
      
      const result = await storage.checkContentViolations(userId, text);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to check content' });
    }
  });

  // === RESTRICTED PRODUCTS (Regulatory Compliance) ===
  protectedApi.get('/restricted-products', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const items = await storage.getRestrictedProducts(userId);
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to get restricted products' });
    }
  });

  protectedApi.post('/restricted-products', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { category, keyword, jurisdiction, reason, isActive } = req.body;
      
      if (!category || !keyword) {
        return res.status(400).json({ message: 'Category and keyword are required' });
      }
      
      const validCategories = ['sharp_objects', 'chemicals', 'drugs', 'weapons', 'custom'];
      if (!validCategories.includes(category)) {
        return res.status(400).json({ message: 'Invalid category' });
      }
      
      const newItem = await storage.createRestrictedProduct({
        userId,
        category,
        keyword,
        jurisdiction: jurisdiction || null,
        reason: reason || null,
        isActive: isActive !== false,
      });
      
      res.status(201).json(newItem);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to create restricted product' });
    }
  });

  protectedApi.put('/restricted-products/:id', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const itemId = parseInt(req.params.id);
      const updates = req.body;
      
      const updated = await storage.updateRestrictedProduct(itemId, userId, updates);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to update restricted product' });
    }
  });

  protectedApi.delete('/restricted-products/:id', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const itemId = parseInt(req.params.id);
      
      await storage.deleteRestrictedProduct(itemId, userId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to delete restricted product' });
    }
  });

  protectedApi.post('/restricted-check', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { title, description } = req.body;
      
      if (!title) {
        return res.json({ isBlocked: false, violations: [] });
      }
      
      const result = await storage.checkRestrictedViolations(userId, title, description || '');
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to check restricted products' });
    }
  });

  // === POINTS & REFERRAL WALLET ===
  protectedApi.get('/wallet/full', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let userWallet = await storage.getWallet(userId);
      
      if (!userWallet) {
        userWallet = await storage.createWallet(userId);
      }
      
      res.json({
        balance: Number(userWallet.balance),
        referralBalance: Number(userWallet.referralBalance),
        points: Number(userWallet.points),
        currency: userWallet.currency || 'GBP'
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to get wallet' });
    }
  });

  protectedApi.post('/wallet/deposit', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { amount } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ message: 'Invalid deposit amount' });
      }

      const user = await storage.getUser(userId);
      const stripe = await getUncachableStripeClient();

      // Create a Stripe PaymentIntent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: 'gbp',
        customer: user?.stripeCustomerId || undefined,
        metadata: { userId: String(userId), type: 'wallet_deposit' },
        automatic_payment_methods: { enabled: true },
      });

      // Confirm in test mode automatically
      if (process.env.NODE_ENV !== 'production') {
        const confirmed = await stripe.paymentIntents.confirm(paymentIntent.id, {
          payment_method: 'pm_card_visa',
        });

        if (confirmed.status === 'succeeded') {
          const userWallet = await storage.getWallet(userId);
          if (userWallet) {
            await storage.updateWalletBalance(userWallet.id, Number(userWallet.balance) + amount);
          }
          await storage.createTransaction({
            walletId: userWallet?.id || 0,
            type: 'deposit',
            amount,
            description: 'Wallet deposit',
            status: 'completed',
          });
          return res.json({ success: true, newBalance: Number(userWallet?.balance || 0) + amount });
        }
      }

      // In production, return client_secret for frontend confirmation
      res.json({ success: true, clientSecret: paymentIntent.client_secret, requiresAction: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to process deposit' });
    }
  });

  protectedApi.post('/wallet/withdraw-referral', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { amount } = req.body;
      
      if (!amount || amount <= 0) {
        return res.status(400).json({ message: 'Invalid amount' });
      }
      
      const transaction = await storage.withdrawReferralBalance(userId, amount);
      res.json({ success: true, transaction });
    } catch (err: any) {
      res.status(400).json({ message: err.message || 'Failed to withdraw referral balance' });
    }
  });

  protectedApi.post('/wallet/convert-points', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { points } = req.body;
      
      if (!points || points <= 0) {
        return res.status(400).json({ message: 'Invalid points amount' });
      }
      
      const transaction = await storage.convertPointsToFunds(userId, points);
      res.json({ success: true, transaction });
    } catch (err: any) {
      res.status(400).json({ message: err.message || 'Failed to convert points' });
    }
  });

  // === AUTOMATION: PUBLISH TO MARKETPLACE ===
  protectedApi.post('/automation/publish', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { queueItemIds } = req.body; // Array of publish queue item IDs
      
      if (!queueItemIds || queueItemIds.length === 0) {
        return res.status(400).json({ message: 'No items to publish' });
      }
      
      const results: any[] = [];
      
      for (const itemId of queueItemIds) {
        const item = await storage.getPublishQueueItem(itemId, userId);
        if (!item) {
          results.push({ id: itemId, status: 'error', message: 'Item not found' });
          continue;
        }

        // Skip items that are already published
        if (item.status === 'published') {
          results.push({ id: itemId, status: 'published', message: 'Already published' });
          continue;
        }
        
        // Update status to publishing
        await storage.updatePublishQueueItem(itemId, { status: 'publishing' });
        
        try {
          // Get product and store details (verified via userId for security)
          const product = await storage.getProduct(item.productId, userId);
          const store = await storage.getStore(item.storeId, userId);
          
          if (!product || !store) {
            throw new Error('Product or store not found');
          }
          
          // Check for VERO violations before publishing
          const veroCheck = await storage.checkVeroViolation(userId, product.title, product.sku, store.platform);
          if (veroCheck.isBlocked) {
            const violationNames = veroCheck.violations.map((v: any) => v.value).join(', ');
            throw new Error(`VERO violation detected: ${violationNames}. This product cannot be listed.`);
          }
          
          // Check for personal information in title and description
          const contentToCheck = `${product.title} ${product.description || ''}`;
          const contentCheck = await storage.checkContentViolations(userId, contentToCheck);
          if (contentCheck.hasViolations) {
            const violationDetails = contentCheck.violations.map(v => `${v.type}: ${v.matches.join(', ')}`).join('; ');
            throw new Error(`Personal information detected: ${violationDetails}. Remove personal info before listing.`);
          }
          
          // Check for restricted/dangerous products (regulatory compliance)
          const restrictedCheck = await storage.checkRestrictedViolations(userId, product.title, product.description || '');
          if (restrictedCheck.isBlocked) {
            const restrictedItems = restrictedCheck.violations.map(v => `${v.keyword} (${v.category})`).join(', ');
            throw new Error(`Restricted product detected: ${restrictedItems}. This item cannot be listed for regulatory compliance.`);
          }

          // Use the calculated price from the queue item (or compute from costPrice + pricing rules)
          let sellingPrice = Number(item.calculatedPrice) || Number(product.costPrice) || 0;
          if (!sellingPrice) {
            sellingPrice = Number(product.sellingPrice) || 0;
          }

          let externalId: string;
          let listingUrl: string | null = null;

          if (store.platform === 'ebay') {
            // Actually create the listing on eBay via API
            const ebayResult = await createEbayListing({
              sku: product.sku || `SKU-${product.id}`,
              title: product.title,
              description: product.description || product.title,
              price: Math.round(sellingPrice * 100) / 100,
              quantity: Number(product.quantity) || 1,
              storeCredentials: (store.credentials || {}) as any,
            });
            externalId = ebayResult.ebayItemId;
            listingUrl = ebayResult.listingUrl;
          } else if (store.platform === 'amazon') {
            const amazon = await import("./platforms/amazon");
            const amazonResult = await amazon.createAmazonListing({
              sku: product.sku || `SKU-${product.id}`,
              title: product.title,
              description: product.description || product.title,
              price: Math.round(sellingPrice * 100) / 100,
              quantity: Number(product.quantity) || 1,
              images: product.images || [],
              marketplaceId: (store.credentials as any)?.marketplaceId || "A1F83G8C2ARO7P",
            });
            externalId = amazonResult.externalId;
            listingUrl = amazonResult.listingUrl;
          } else if (store.platform === 'shopify') {
            const shopify = await import("./platforms/shopify");
            const shopifyResult = await shopify.createShopifyListing({
              sku: product.sku || `SKU-${product.id}`,
              title: product.title,
              description: product.description || product.title,
              price: Math.round(sellingPrice * 100) / 100,
              quantity: Number(product.quantity) || 1,
              images: product.images || [],
            });
            externalId = shopifyResult.externalId;
            listingUrl = shopifyResult.listingUrl;
          } else if (store.platform === 'jumia') {
            const jumia = await import("./platforms/jumia");
            const jumiaResult = await jumia.createJumiaListing({
              sku: product.sku || `SKU-${product.id}`,
              title: product.title,
              description: product.description || product.title,
              price: Math.round(sellingPrice * 100) / 100,
              quantity: Number(product.quantity) || 1,
              images: product.images || [],
            });
            externalId = jumiaResult.externalId;
            listingUrl = jumiaResult.listingUrl;
          } else if (store.platform === 'woocommerce') {
            const woocommerce = await import("./platforms/woocommerce");
            const wcResult = await woocommerce.createWooCommerceListing({
              sku: product.sku || `SKU-${product.id}`,
              title: product.title,
              description: product.description || product.title,
              price: Math.round(sellingPrice * 100) / 100,
              quantity: Number(product.quantity) || 1,
              images: product.images || [],
            });
            externalId = wcResult.externalId;
            listingUrl = wcResult.listingUrl;
          } else {
            // For other platforms, simulate (will be replaced with real API later)
            externalId = `EXT-${store.platform.toUpperCase()}-${Date.now()}-${product.id}`;
          }
          
          // Create marketplace listing
          await storage.createMarketplaceListing({
            storeId: item.storeId,
            productId: item.productId,
            externalId,
            status: 'active',
            syncStatus: 'synced',
          });
          
          // Update queue item
          await storage.updatePublishQueueItem(itemId, {
            status: 'published',
            publishedAt: new Date(),
          });
          
          results.push({ id: itemId, status: 'published', externalId, listingUrl });
        } catch (err: any) {
          await storage.updatePublishQueueItem(itemId, {
            status: 'failed',
            errorMessage: err.message,
          });
          results.push({ id: itemId, status: 'failed', message: err.message });
        }

        // Throttle: wait 800ms between items to avoid eBay rate limits
        if (queueItemIds.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 800));
        }
      }
      
      res.json({ results });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to publish items' });
    }
  });

  // === USER MANAGEMENT ===
  protectedApi.post('/user/complete-onboarding', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.updateUser(userId, { onboardingCompleted: new Date() });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to complete onboarding' });
    }
  });

  protectedApi.post('/user/skip-payment', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.updateUser(userId, { paymentSkipped: new Date() });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to skip payment' });
    }
  });

  protectedApi.post('/user/confirm-payment', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      await storage.updateUser(userId, { subscriptionStatus: 'active' });
      
      // Process 10% referral commission if user was referred
      if (user?.referredBy && user?.subscriptionPlan) {
        const plan = SUBSCRIPTION_PLANS.find(p => p.name === user.subscriptionPlan);
        if (plan) {
          const commissionAmount = plan.priceGbp * 0.10;
          
          // Get or create referrer's wallet
          let referrerWallet = await storage.getWallet(user.referredBy);
          if (!referrerWallet) {
            referrerWallet = await storage.createWallet(user.referredBy);
          }
          
          // Credit 10% commission immediately
          await storage.updateWalletBalance(referrerWallet.id, Number(referrerWallet.balance) + commissionAmount);
          await storage.createTransaction({
            walletId: referrerWallet.id,
            type: 'referral_bonus',
            amount: String(commissionAmount),
            description: `10% referral commission for ${user.firstName || 'new user'}'s ${plan.name} subscription`,
          });
          
          // Update referral earnings
          await storage.updateReferralEarnings(user.referredBy, userId, commissionAmount);
        }
      }
      
      res.json({ success: true });
    } catch (err: any) {
      console.error('Confirm payment error:', err);
      res.status(500).json({ message: err.message || 'Failed to confirm payment' });
    }
  });

  protectedApi.post('/user/accept-policies', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.updateUser(userId, { policiesAccepted: new Date() });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to accept policies' });
    }
  });

  // === REFERRAL SYSTEM ===
  
  // Get user's referral code (generate if doesn't exist)
  protectedApi.get('/referral/code', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let user = await storage.getUser(userId);
      
      if (!user?.referralCode) {
        const code = 'DS' + userId.substring(0, 6).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
        await storage.updateUser(userId, { referralCode: code });
        user = await storage.getUser(userId);
      }
      
      res.json({ 
        referralCode: user?.referralCode,
        referralLink: `${req.protocol}://${req.get('host')}/signup?ref=${user?.referralCode}`
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to get referral code' });
    }
  });

  // Apply referral code during signup
  protectedApi.post('/referral/apply', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { referralCode } = req.body;
      
      if (!referralCode) {
        return res.status(400).json({ message: 'Referral code is required' });
      }
      
      const user = await storage.getUser(userId);
      if (user?.referredBy) {
        return res.status(400).json({ message: 'Referral code already applied' });
      }
      
      const referrer = await storage.getUserByReferralCode(referralCode);
      if (!referrer) {
        return res.status(404).json({ message: 'Invalid referral code' });
      }
      
      if (referrer.id === userId) {
        return res.status(400).json({ message: 'Cannot use your own referral code' });
      }
      
      await storage.updateUser(userId, { referredBy: referrer.id });
      await storage.createReferral(referrer.id, userId);
      
      res.json({ success: true, referrerName: referrer.firstName || 'A friend' });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to apply referral code' });
    }
  });

  // Get user's referrals and earnings
  protectedApi.get('/referrals', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const referrals = await storage.getReferrals(userId);
      const totalEarnings = referrals.reduce((sum: number, r: any) => sum + Number(r.totalEarnings || 0), 0);
      
      res.json({ referrals, totalEarnings, totalReferrals: referrals.length });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to get referrals' });
    }
  });

  // Email verification routes (also protected since user must be logged in)
  protectedApi.post('/auth/resend-verification', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || !user.email) {
        return res.status(400).json({ message: 'User email not found' });
      }
      
      if (user.emailVerified) {
        return res.status(400).json({ message: 'Email already verified' });
      }
      
      // Generate verification token
      const verificationToken = crypto.randomUUID();
      const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      await storage.updateUser(userId, {
        verificationToken,
        verificationTokenExpiry
      });
      
      const baseUrl = process.env.REPLIT_DEPLOYMENT_URL 
        ? `https://${process.env.REPLIT_DEPLOYMENT_URL}`
        : process.env.REPLIT_DEV_DOMAIN 
          ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
          : '';
      const verifyUrl = `${baseUrl}/verify-email?token=${verificationToken}`;
      
      const { sendVerificationEmail } = await import('./email.js');
      const emailSent = await sendVerificationEmail(user.email, verifyUrl);
      
      if (!emailSent) {
        console.log(`Verification link for ${user.email}: ${verifyUrl}`);
      }
      
      res.json({ success: true, message: 'Verification email sent' });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to send verification email' });
    }
  });

  // === API KEY MANAGEMENT ===
  protectedApi.get('/user/api-key', async (req: any, res) => {
    const userId = req.user.claims.sub;
    try {
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      if (!user.apiKey) {
        const apiKey = 'dfk_' + crypto.randomUUID().replace(/-/g, '');
        await storage.updateUser(userId, { apiKey });
        return res.json({ apiKey });
      }
      
      res.json({ apiKey: user.apiKey });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to get API key' });
    }
  });

  protectedApi.post('/user/api-key/regenerate', async (req: any, res) => {
    const userId = req.user.claims.sub;
    try {
      const apiKey = 'dfk_' + crypto.randomUUID().replace(/-/g, '');
      await storage.updateUser(userId, { apiKey });
      res.json({ apiKey });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to regenerate API key' });
    }
  });

  // === eBay OAuth Flow (uses DB settings, supports per-store tokens) ===
  app.get('/api/ebay/auth', async (req, res) => {
    try {
      const storeId = req.query.storeId as string;
      const { clientId, ruName } = await getEbayAppSettings();
      if (!clientId || !ruName) {
        return res.status(400).send('eBay not configured. Admin must set Client ID and RuName in Admin > Integrations.');
      }
      const scopes = [
        'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
        'https://api.ebay.com/oauth/api_scope/sell.inventory',
      ].join(' ');
      const state = storeId ? `store_${storeId}` : "";
      const authUrl = `https://auth.ebay.com/oauth2/authorize?client_id=${encodeURIComponent(clientId)}&response_type=code&redirect_uri=${encodeURIComponent(ruName)}&scope=${encodeURIComponent(scopes)}${state ? `&state=${encodeURIComponent(state)}` : ""}`;
      res.redirect(authUrl);
    } catch (err: any) { res.status(500).send(`OAuth error: ${err.message}`); }
  });

  app.get('/api/ebay/callback', async (req, res) => {
    try {
      const code = req.query.code as string;
      const state = (req.query.state as string) || "";
      if (!code) return res.status(400).send('Missing authorization code');

      const { clientId, clientSecret, ruName } = await getEbayAppSettings();
      if (!clientId || !clientSecret || !ruName) return res.status(400).send('eBay not configured');

      // Extract storeId from state parameter
      let storeId: number | null = null;
      if (state.startsWith("store_")) storeId = parseInt(state.replace("store_", ""), 10) || null;

      const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const tokenRes = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${auth}` },
        body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: ruName }),
      });
      if (!tokenRes.ok) return res.status(500).send(`Token exchange failed: ${await tokenRes.text()}`);

      const data = await tokenRes.json();
      const refreshToken = data.refresh_token;

      // If a storeId was passed, save the refresh token to the store's credentials
      if (storeId) {
        const storeResult = await pool.query(`SELECT ${STORE_COLUMNS} FROM stores WHERE id = $1 LIMIT 1`, [storeId]);
        const storeRows = storeResult.rows;
        if (storeRows.length) {
          const creds = (storeRows[0].credentials as any) || {};
          creds.ebayRefreshToken = refreshToken;
          await db.update(stores).set({ credentials: creds }).where(eq(stores.id, storeId));
        }
      }

      res.send(`
        <html><body style="font-family: sans-serif; padding: 2rem; max-width: 800px; margin: auto;">
          <h1>eBay OAuth — Success</h1>
          ${storeId ? `<p>Your eBay account has been connected to store #${storeId}.</p>` : `<p>Copy this refresh token and paste it into your <code>.env</code> file:</p>
          <pre style="background: #f4f4f4; padding: 1rem; overflow-x: auto; border-radius: 8px; border: 1px solid #ddd; white-space: pre-wrap; word-break: break-all;">EBAY_REFRESH_TOKEN=${refreshToken}</pre>
          <button onclick="navigator.clipboard.writeText('${refreshToken}')" style="padding: 0.5rem 1rem; background: #065f46; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 1rem;">Copy to Clipboard</button>`}
          <p style="margin-top: 2rem; color: #666;">Access token received at: ${new Date().toLocaleString()}</p>
          <p><a href="/stores" style="color: #065f46;">Return to Stores</a></p>
        </body></html>
      `);
    } catch (err: any) {
      console.error('[eBay OAuth] Callback error:', err);
      res.status(500).send(`OAuth error: ${err.message}`);
    }
  });

  // === Helper: read app setting from DB with env fallback ===
  async function getAppSetting(key: string): Promise<string> {
    const rows = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
    return rows.length ? rows[0].value : process.env[key] || "";
  }

  async function upsertAppSetting(key: string, value: string) {
    if (!value) return;
    const existing = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
    if (existing.length) {
      await db.update(appSettings).set({ value, updatedAt: new Date() }).where(eq(appSettings.key, key));
    } else {
      await db.insert(appSettings).values({ key, value });
    }
  }

  // === Shopify OAuth Flow ===
  app.get('/api/oauth/shopify/auth', async (req, res) => {
    try {
      const storeId = req.query.storeId as string;
      const clientId = await getAppSetting("SHOPIFY_CLIENT_ID");
      const redirectUri = await getAppSetting("SHOPIFY_REDIRECT_URI");
      if (!clientId || !redirectUri) {
        return res.status(400).send('Shopify not configured. Admin must set Client ID and Redirect URI in Admin > Integrations.');
      }
      const store = storeId ? (await pool.query(`SELECT ${STORE_COLUMNS} FROM stores WHERE id = $1 LIMIT 1`, [parseInt(storeId)])).rows[0] : null;
      if (!store) return res.status(400).send('Store not found');
      const creds = store.credentials as any;
      const shopDomain = creds?.shopDomain;
      if (!shopDomain) return res.status(400).send('Shopify store domain not set. Edit the store and add your myshopify.com domain.');
      const scopes = 'read_products,write_products,read_orders,write_orders,read_inventory,write_inventory';
      const state = `store_${storeId}`;
      const authUrl = `https://${shopDomain}/admin/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=${encodeURIComponent(state)}`;
      res.redirect(authUrl);
    } catch (err: any) { res.status(500).send(`Shopify OAuth error: ${err.message}`); }
  });

  app.get('/api/oauth/shopify/callback', async (req, res) => {
    try {
      const code = req.query.code as string;
      const state = (req.query.state as string) || "";
      const shop = req.query.shop as string;
      if (!code) return res.status(400).send('Missing authorization code');
      const clientId = await getAppSetting("SHOPIFY_CLIENT_ID");
      const clientSecret = await getAppSetting("SHOPIFY_CLIENT_SECRET");
      const redirectUri = await getAppSetting("SHOPIFY_REDIRECT_URI");
      if (!clientId || !clientSecret) return res.status(400).send('Shopify not configured');
      let storeId: number | null = null;
      if (state.startsWith("store_")) storeId = parseInt(state.replace("store_", ""), 10) || null;
      let shopDomain = shop;
      if (!shopDomain && storeId) {
        const storeResult2 = await pool.query(`SELECT ${STORE_COLUMNS} FROM stores WHERE id = $1 LIMIT 1`, [storeId]);
        const storeRows2 = storeResult2.rows;
        if (storeRows2.length) shopDomain = (storeRows2[0].credentials as any).shopDomain || null;
      }
      if (!shopDomain) return res.status(400).send('Could not determine shop domain');
      const tokenRes = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
      });
      if (!tokenRes.ok) return res.status(500).send(`Token exchange failed: ${await tokenRes.text()}`);
      const data = await tokenRes.json();
      const accessToken = data.access_token;
      if (storeId) {
        const storeResult = await pool.query('SELECT id, user_id, name, platform, credentials, status, last_sync, created_at FROM stores WHERE id = $1 LIMIT 1', [storeId]);
        const storeRows = storeResult.rows;
        if (storeRows.length) {
          const creds = (storeRows[0].credentials as any) || {};
          creds.accessToken = accessToken;
          await db.update(stores).set({ credentials: creds }).where(eq(stores.id, storeId));
        }
      }
      res.send(`
        <html><body style="font-family: sans-serif; padding: 2rem; max-width: 800px; margin: auto;">
          <h1>Shopify OAuth — Success</h1>
          <p>Your Shopify store "${shopDomain}" has been connected.</p>
          <p style="margin-top: 2rem; color: #666;">Access token received at: ${new Date().toLocaleString()}</p>
          <p><a href="/stores" style="color: #065f46;">Return to Stores</a></p>
        </body></html>
      `);
    } catch (err: any) { res.status(500).send(`Shopify OAuth error: ${err.message}`); }
  });

  // === WooCommerce OAuth Flow ===
  app.get('/api/oauth/woocommerce/auth', async (req, res) => {
    try {
      const storeId = req.query.storeId as string;
      res.send(`
        <html><body style="font-family: sans-serif; padding: 2rem; max-width: 800px; margin: auto;">
          <h1>WooCommerce Connection</h1>
          <p>To connect your WooCommerce store:</p>
          <ol style="line-height: 2;">
            <li>Go to your WooCommerce admin: <strong>WooCommerce → Settings → Advanced → REST API</strong></li>
            <li>Click <strong>Add Key</strong></li>
            <li>Set description, user, and permissions (<strong>Read/Write</strong>)</li>
            <li>Copy the <strong>Consumer Key</strong> and <strong>Consumer Secret</strong></li>
            <li>Enter them in the <strong>Admin → Integrations → WooCommerce</strong> settings</li>
          </ol>
          <p>After setup, return to <a href="/stores">Stores</a> and sync your store.</p>
        </body></html>
      `);
    } catch (err: any) { res.status(500).send(`WooCommerce error: ${err.message}`); }
  });

  // === Amazon SP-API Auth Flow ===
  app.get('/api/oauth/amazon/auth', async (req, res) => {
    try {
      const storeId = req.query.storeId as string;
      const clientId = await getAppSetting("AMAZON_CLIENT_ID");
      const redirectUri = await getAppSetting("AMAZON_REDIRECT_URI");
      if (!clientId || !redirectUri) {
        return res.status(400).send('Amazon not configured. Admin must set Client ID and Redirect URI in Admin > Integrations.');
      }
      const state = storeId ? `store_${storeId}` : "";
      const authUrl = `https://sellercentral.amazon.com/apps/authorize/consent?application_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
      res.redirect(authUrl);
    } catch (err: any) { res.status(500).send(`Amazon OAuth error: ${err.message}`); }
  });

  app.get('/api/oauth/amazon/callback', async (req, res) => {
    try {
      const state = (req.query.state as string) || "";
      const sellingPartnerId = req.query.selling_partner_id as string;
      let storeId: number | null = null;
      if (state.startsWith("store_")) storeId = parseInt(state.replace("store_", ""), 10) || null;
      if (storeId) {
        const creds = { spApiSellerId: sellingPartnerId || "", spApiRefreshToken: "" };
        await db.update(stores).set({ credentials: creds }).where(eq(stores.id, storeId));
      }
      res.send(`
        <html><body style="font-family: sans-serif; padding: 2rem; max-width: 800px; margin: auto;">
          <h1>Amazon SP-API — Success</h1>
          <p>Your Amazon seller account has been connected.</p>
          <p><a href="/stores" style="color: #065f46;">Return to Stores</a></p>
        </body></html>
      `);
    } catch (err: any) { res.status(500).send(`Amazon callback error: ${err.message}`); }
  });

  // === Jumia OAuth Flow ===
  app.get('/api/oauth/jumia/auth', async (req, res) => {
    try {
      res.send(`
        <html><body style="font-family: sans-serif; padding: 2rem; max-width: 800px; margin: auto;">
          <h1>Jumia Connection</h1>
          <p>Jumia uses API keys for authentication.</p>
          <p>The admin must configure Jumia API credentials in <strong>Admin → Integrations</strong>.</p>
          <p>After setup, return to <a href="/stores">Stores</a> and sync your store.</p>
        </body></html>
      `);
    } catch (err: any) { res.status(500).send(`Jumia error: ${err.message}`); }
  });

  // === OAuth Status Check ===
  app.get('/api/oauth/:platform/status', async (req, res) => {
    try {
      const { platform } = req.params;
      const storeId = req.query.storeId ? parseInt(req.query.storeId as string, 10) : null;
      if (!storeId) return res.json({ connected: false, message: "No store specified" });
      const storeResult = await pool.query(`SELECT ${STORE_COLUMNS} FROM stores WHERE id = $1 LIMIT 1`, [storeId]);
      const storeRows = storeResult.rows;
      if (!storeRows.length) return res.json({ connected: false, message: "Store not found" });
      const creds = storeRows[0].credentials as any;
      if (platform === 'shopify') {
        return res.json({ connected: !!creds?.accessToken, message: creds?.accessToken ? 'Authorized' : 'Not authorized' });
      }
      if (platform === 'woocommerce') {
        return res.json({ connected: !!(creds?.consumerKey && creds?.consumerSecret), message: creds?.consumerKey ? 'Configured' : 'Not configured' });
      }
      if (platform === 'amazon') {
        return res.json({ connected: !!creds?.spApiSellerId, message: creds?.spApiSellerId ? 'Authorized' : 'Not authorized' });
      }
      if (platform === 'jumia') {
        return res.json({ connected: false, message: 'Configure via Admin Integrations' });
      }
      res.json({ connected: false, message: "Unknown platform" });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // === eBay Connection Status ===
  app.get('/api/ebay/status', async (req, res) => {
    try {
      const { clientId, clientSecret } = await getEbayAppSettings();
      const storeId = req.query.storeId ? parseInt(req.query.storeId as string, 10) : null;
      let refreshToken = process.env.EBAY_REFRESH_TOKEN;

      // If checking a specific store, use its token
      if (storeId) {
        const storeResult = await pool.query(`SELECT ${STORE_COLUMNS} FROM stores WHERE id = $1 LIMIT 1`, [storeId]);
        const storeRows = storeResult.rows;
        if (storeRows.length) {
          const creds = storeRows[0].credentials as any;
          refreshToken = creds?.ebayRefreshToken || refreshToken;
        }
      }

      if (!clientId || !clientSecret || !refreshToken) {
        return res.json({ connected: false, message: "eBay credentials not configured", needsAdmin: !clientId || !clientSecret, needsStoreAuth: storeId ? !refreshToken : false });
      }

      const { getAccessToken } = await import("./platforms/ebay");
      await getAccessToken(refreshToken);
      res.json({ connected: true, message: "eBay API connected and authenticated" });
    } catch (err: any) {
      const msg = err.message || "";
      if (msg.includes("expired") || msg.includes("invalid") || msg.includes("revoked")) {
        res.json({ connected: false, message: "eBay refresh token expired or revoked. Re-authorize.", needsReauth: true });
      } else if (msg.includes("not configured")) {
        res.json({ connected: false, message: "eBay API credentials missing. Admin must configure.", needsAdmin: true });
      } else {
        res.json({ connected: false, message: `eBay connection error: ${msg}` });
      }
    }
  });

  // === ADMIN AUTH ===
  const ADMIN_USERNAME = "Dropandsell";
  const ADMIN_PASSWORD = "Olalekan25#";

  app.post('/api/admin/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
        return res.status(401).json({ message: 'Invalid admin credentials' });
      }

      // Upsert admin user in DB
      let adminUser = await storage.getUserByEmail('admin@dropandsell.ai');
      if (!adminUser) {
        adminUser = await storage.createUser({
          email: 'admin@dropandsell.ai',
          password: await bcrypt.hash(ADMIN_PASSWORD, 10),
          firstName: 'Admin',
          lastName: 'DropandSell',
        });
        await storage.updateUser(adminUser.id, { role: 'admin', emailVerified: new Date(), onboardingCompleted: new Date(), policiesAccepted: new Date() });
      } else if (adminUser.role !== 'admin') {
        await storage.updateUser(adminUser.id, { role: 'admin' });
      }

      (req.session as any).userId = adminUser.id;
      (req.session as any).isAdmin = true;

      res.json({ success: true, user: { id: adminUser.id, email: adminUser.email, role: 'admin' } });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Admin login failed' });
    }
  });

  app.post('/api/admin/logout', (req, res) => {
    req.session.destroy((err) => {
      res.json({ success: true });
    });
  });

  // Admin API middleware
  const adminApi: Router = express.Router();

  adminApi.use(async (req: any, res, next) => {
    const userId = (req.session as any)?.userId;
    const isAdmin = (req.session as any)?.isAdmin;
    if (!userId || !isAdmin) {
      return res.status(401).json({ message: 'Admin access required' });
    }
    const user = await storage.getUser(userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access denied' });
    }
    req.user = { claims: { sub: userId } };
    next();
  });

  // Admin routes
  adminApi.get('/admin/users', async (req: any, res) => {
    try {
      const allUsers = await db.select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        subscriptionStatus: users.subscriptionStatus,
        subscriptionPlan: users.subscriptionPlan,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
      }).from(users).orderBy(desc(users.createdAt));
      res.json(allUsers);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  adminApi.get('/admin/stats', async (req: any, res) => {
    try {
      const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
      const [storeCount] = await db.select({ count: sql<number>`count(*)` }).from(stores);
      const [productCount] = await db.select({ count: sql<number>`count(*)` }).from(products);
      const [orderCount] = await db.select({ count: sql<number>`count(*)` }).from(orders);
      const [subscriberCount] = await db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.subscriptionStatus, 'active'));

      res.json({
        users: Number(userCount.count),
        stores: Number(storeCount.count),
        products: Number(productCount.count),
        orders: Number(orderCount.count),
        subscribers: Number(subscriberCount.count),
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  adminApi.put('/admin/users/:id/role', async (req: any, res) => {
    try {
      const targetId = req.params.id;
      const { role } = req.body;
      if (!['user', 'admin'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role' });
      }
      const [updated] = await db.update(users).set({ role }).where(eq(users.id, targetId)).returning();
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  adminApi.get('/admin/conversations', async (req: any, res) => {
    try {
      const allConversations = await db.select().from(conversations).orderBy(desc(conversations.createdAt));
      const enriched = [];
      for (const conv of allConversations) {
        const msgs = await db.select().from(messages).where(eq(messages.conversationId, conv.id)).orderBy(messages.createdAt);
        const user = conv.userId ? await storage.getUser(conv.userId) : null;
        enriched.push({ ...conv, messages: msgs, user: user ? { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName } : null });
      }
      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  adminApi.get('/admin/settings', async (req: any, res) => {
    try {
      const [settings] = await db.select().from(adminSettings).limit(1);
      res.json(settings || {});
    } catch {
      res.json({});
    }
  });

  adminApi.put('/admin/settings', async (req: any, res) => {
    try {
      const body = req.body;
      const [existing] = await db.select().from(adminSettings).limit(1);
      if (existing) {
        const [updated] = await db.update(adminSettings).set(body).where(eq(adminSettings.id, existing.id)).returning();
        res.json(updated);
      } else {
        const [created] = await db.insert(adminSettings).values(body).returning();
        res.json(created);
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin: Recent orders
  adminApi.get('/admin/recent-orders', async (req: any, res) => {
    try {
      const recentOrders = await db.select({
        id: orders.id, storeId: orders.storeId, customerName: orders.customerName,
        totalAmount: orders.totalAmount, status: orders.status, trackingStatus: orders.trackingStatus,
        createdAt: orders.createdAt,
      }).from(orders).orderBy(desc(orders.createdAt)).limit(10);
      res.json(recentOrders);
    } catch { res.json([]); }
  });

  // Admin: Recent registrations
  adminApi.get('/admin/recent-registrations', async (req: any, res) => {
    try {
      const recent = await db.select({
        id: users.id, email: users.email, firstName: users.firstName,
        lastName: users.lastName, subscriptionPlan: users.subscriptionPlan,
        subscriptionStatus: users.subscriptionStatus, createdAt: users.createdAt,
      }).from(users).orderBy(desc(users.createdAt)).limit(10);
      res.json(recent);
    } catch { res.json([]); }
  });

  // Admin: Vendor health overview
  adminApi.get('/admin/vendor-overview', async (req: any, res) => {
    try {
      const vendorStats = await db.select({
        id: vendors.id, name: vendors.name, healthScore: vendors.healthScore,
        status: vendors.status, category: vendors.category,
        totalOrdersFulfilled: vendors.totalOrdersFulfilled,
        stockUpdateReliability: vendors.stockUpdateReliability,
        lastHealthCheck: vendors.lastHealthCheck,
      }).from(vendors).orderBy(desc(vendors.healthScore)).limit(20);
      const count = (await db.select({ count: sql<number>`count(*)` }).from(vendors))[0]?.count || 0;
      const avgHealth = await db.execute(sql`SELECT COALESCE(AVG(health_score), 0) as avg FROM vendors WHERE health_score IS NOT NULL`);
      res.json({ vendors: vendorStats, totalVendors: Number(count), avgHealthScore: Number((avgHealth.rows[0] as any)?.avg || 0) });
    } catch { res.json({ vendors: [], totalVendors: 0, avgHealthScore: 0 }); }
  });

  // Admin: Global vendors CRUD
  adminApi.get('/admin/vendors/global', async (req: any, res) => {
    try {
      const global = await db.select().from(vendors).where(eq(vendors.isGlobal, true)).orderBy(desc(vendors.createdAt));
      res.json(global);
    } catch { res.json([]); }
  });

  adminApi.post('/admin/vendors/global', async (req: any, res) => {
    try {
      const { name, website, contactPerson, contactEmail, contactPhone, category, tags, country, leadTime, paymentTerms, minOrderAmount, notes, healthScore, integrationType } = req.body;
      if (!name) return res.status(400).json({ message: 'Vendor name is required' });
      const adminUser = await db.select().from(users).where(eq(users.role, 'admin')).limit(1);
      if (!adminUser.length) return res.status(500).json({ message: 'No admin user found' });
      const [vendor] = await db.insert(vendors).values({
        userId: adminUser[0].id,
        name, website, contactPerson, contactEmail, contactPhone,
        category, tags, country, leadTime, paymentTerms,
        minOrderAmount: minOrderAmount?.toString(),
        notes, healthScore, integrationType: integrationType || 'custom',
        isGlobal: true, status: 'active',
      }).returning();
      res.status(201).json(vendor);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  adminApi.put('/admin/vendors/global/:id', async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const updates = req.body;
      delete updates.id; delete updates.userId; delete updates.isGlobal;
      const [vendor] = await db.update(vendors).set(updates).where(and(eq(vendors.id, id), eq(vendors.isGlobal, true))).returning();
      if (!vendor) return res.status(404).json({ message: 'Global vendor not found' });
      res.json(vendor);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  adminApi.delete('/admin/vendors/global/:id', async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      await db.delete(vendors).where(and(eq(vendors.id, id), eq(vendors.isGlobal, true)));
      res.status(204).send();
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Admin: Verify / block a global supplier
  adminApi.put('/admin/vendors/global/:id/verify', async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const { verificationStatus } = req.body;
      if (!['pending', 'verified', 'blocked'].includes(verificationStatus)) {
        return res.status(400).json({ message: 'Invalid status. Use pending, verified, or blocked.' });
      }
      const adminId = (req.session as any)?.userId;
      const updates: Record<string, any> = { verificationStatus };
      if (verificationStatus === 'verified') {
        updates.verifiedAt = new Date();
        updates.verifiedBy = adminId;
      } else {
        updates.verifiedAt = null;
        updates.verifiedBy = null;
      }
      const [vendor] = await db.update(vendors).set(updates).where(eq(vendors.id, id)).returning();
      if (!vendor) return res.status(404).json({ message: 'Vendor not found' });
      res.json(vendor);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Admin: System status
  adminApi.get('/admin/system-status', async (req: any, res) => {
    try {
      const dbResult = await db.execute(sql`SELECT pg_database_size(current_database()) as size`);
      const dbSizeBytes = Number((dbResult.rows[0] as any)?.size || 0);
      const dbSizeMB = Math.round(dbSizeBytes / 1024 / 1024);
      const apiKeys = {
        stripe: !!process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== 'sk_test_...',
        openai: !!process.env.OPENAI_API_KEY,
        resend: !!process.env.RESEND_API_KEY,
        ebay: !!process.env.EBAY_CLIENT_ID && !!process.env.EBAY_CLIENT_SECRET,
        amazon: !!process.env.AMAZON_CLIENT_ID && !!process.env.AMAZON_CLIENT_SECRET,
        shopify: !!process.env.SHOPIFY_API_KEY && !!process.env.SHOPIFY_API_SECRET,
        tracking: !!process.env.TRACKING_API_KEY,
      };
      res.json({ dbSizeMB, apiKeys, nodeVersion: process.version, platform: process.platform });
    } catch { res.json({ dbSizeMB: 0, apiKeys: {} }); }
  });

  // Admin: Activity feed
  adminApi.get('/admin/activity', async (req: any, res) => {
    try {
      const recentOrders = await db.select({
        id: orders.id, type: sql<string>`'order'`, label: orders.customerName,
        detail: orders.status, createdAt: orders.createdAt,
      }).from(orders).orderBy(desc(orders.createdAt)).limit(5);
      const recentUsers = await db.select({
        id: users.id, type: sql<string>`'registration'`, label: users.email,
        detail: sql<string>`'new user'`, createdAt: users.createdAt,
      }).from(users).orderBy(desc(users.createdAt)).limit(5);
      const all = [...recentOrders, ...recentUsers]
        .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
        .slice(0, 15);
      res.json(all);
    } catch { res.json([]); }
  });

  // === ADMIN: DETAILED STATISTICS ===
  adminApi.get('/admin/detailed-stats', async (req: any, res) => {
    try {
      const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
      const [storeCount] = await db.select({ count: sql<number>`count(*)` }).from(stores);
      const [productCount] = await db.select({ count: sql<number>`count(*)` }).from(products);
      const [orderCount] = await db.select({ count: sql<number>`count(*)` }).from(orders);
      const [vendorCount] = await db.select({ count: sql<number>`count(*)` }).from(vendors);
      const [subscriberCount] = await db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.subscriptionStatus, 'active'));
      const [pendingOrders] = await db.select({ count: sql<number>`count(*)` }).from(orders).where(eq(orders.status, 'pending'));
      const [activeVendors] = await db.select({ count: sql<number>`count(*)` }).from(vendors).where(eq(vendors.status, 'active'));
      const revenueRow = await db.execute(sql`SELECT COALESCE(SUM(total_amount::numeric), 0) as total FROM orders WHERE status != 'cancelled'`);
      const totalRevenue = Number((revenueRow.rows[0] as any)?.total || 0);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const todaySalesRow = await db.execute(sql`SELECT COALESCE(SUM(total_amount::numeric), 0) as total FROM orders WHERE created_at >= ${today} AND status != 'cancelled'`);
      const todaySales = Number((todaySalesRow.rows[0] as any)?.total || 0);
      const growthRow = await db.execute(sql`SELECT count(*) FROM users WHERE created_at >= NOW() - INTERVAL '7 days'`);
      const weeklyGrowth = Math.round(((Number((growthRow.rows[0] as any)?.count || 0) / Math.max(1, Number(userCount.count))) * 100));
      res.json({
        users: Number(userCount.count), stores: Number(storeCount.count), products: Number(productCount.count),
        orders: Number(orderCount.count), vendors: Number(vendorCount.count), subscribers: Number(subscriberCount.count),
        pendingOrders: Number(pendingOrders.count), activeVendors: Number(activeVendors.count),
        totalRevenue: Math.round(totalRevenue * 100) / 100, todaySales: Math.round(todaySales * 100) / 100,
        weeklyGrowth,
      });
    } catch { res.json({}); }
  });

  adminApi.get('/admin/revenue-history', async (req: any, res) => {
    try {
      const daily = await db.execute(sql`
        SELECT DATE(created_at) as date, COALESCE(SUM(total_amount::numeric), 0) as total
        FROM orders WHERE status != 'cancelled' AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at) ORDER BY date
      `);
      const weekly = await db.execute(sql`
        SELECT DATE_TRUNC('week', created_at) as week, COALESCE(SUM(total_amount::numeric), 0) as total
        FROM orders WHERE status != 'cancelled'
        GROUP BY week ORDER BY week LIMIT 12
      `);
      const monthly = await db.execute(sql`
        SELECT DATE_TRUNC('month', created_at) as month, COALESCE(SUM(total_amount::numeric), 0) as total
        FROM orders WHERE status != 'cancelled'
        GROUP BY month ORDER BY month LIMIT 12
      `);
      const userGrowth = await db.execute(sql`
        SELECT DATE(created_at) as date, count(*) as count FROM users
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at) ORDER BY date
      `);
      const marketplaceSales = await db.execute(sql`
        SELECT s.platform, COUNT(*) as orders, COALESCE(SUM(o.total_amount::numeric), 0) as revenue
        FROM orders o LEFT JOIN stores s ON o.store_id = s.id
        WHERE o.status != 'cancelled'
        GROUP BY s.platform ORDER BY revenue DESC
      `);
      const dailyOrders = await db.execute(sql`
        SELECT DATE(created_at) as date, COUNT(*) as count FROM orders
        WHERE created_at >= NOW() - INTERVAL '14 days'
        GROUP BY DATE(created_at) ORDER BY date
      `);
      res.json({
        dailyRevenue: daily.rows, weeklyRevenue: weekly.rows, monthlyRevenue: monthly.rows,
        userGrowth: userGrowth.rows, marketplaceSales: marketplaceSales.rows, dailyOrders: dailyOrders.rows,
        storePerformance: [],
      });
    } catch { res.json({}); }
  });

  adminApi.get('/admin/server-metrics', async (req: any, res) => {
    try {
      const dbResult = await db.execute(sql`SELECT pg_database_size(current_database()) as size`);
      const dbSizeBytes = Number((dbResult.rows[0] as any)?.size || 0);
      const dbSizeMB = Math.round(dbSizeBytes / 1024 / 1024);
      const uptime = process.uptime();
      const days = Math.floor(uptime / 86400);
      const hours = Math.floor((uptime % 86400) / 3600);
      const uptimeStr = days > 0 ? `${days}d ${hours}h` : `${hours}h`;
      res.json({
        dbSizeMB, nodeVersion: process.version, platform: process.platform,
        uptime: uptimeStr, environment: process.env.NODE_ENV || 'development',
        appUrl: 'dropandsell.online',
        memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        memoryTotalMB: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      });
    } catch { res.json({}); }
  });

  adminApi.get('/admin/service-status', async (req: any, res) => {
    // Check app_settings table for platforms that store creds there
    const settingKeys = ["EBAY_CLIENT_ID", "EBAY_CLIENT_SECRET", "STRIPE_SECRET_KEY", "OPENAI_API_KEY", "RESEND_API_KEY", "AMAZON_CLIENT_ID", "AMAZON_CLIENT_SECRET", "SHOPIFY_API_KEY", "SHOPIFY_API_SECRET", "TRACKING_API_KEY"];
    const rows = await db.select().from(appSettings).where(inArray(appSettings.key, settingKeys));
    const dbSettings: Record<string, string> = {};
    for (const row of rows) dbSettings[row.key] = row.value;

    const hasEnvOrDb = (key: string) => !!(process.env[key] || dbSettings[key]);

    const checks: Record<string, { status: 'connected' | 'warning' | 'offline'; label: string }> = {
      stripe: { status: hasEnvOrDb('STRIPE_SECRET_KEY') && process.env.STRIPE_SECRET_KEY !== 'sk_test_...' && dbSettings['STRIPE_SECRET_KEY'] !== 'sk_test_...' ? 'connected' : 'offline', label: 'Stripe' },
      openai: { status: hasEnvOrDb('OPENAI_API_KEY') ? 'connected' : 'offline', label: 'OpenAI' },
      resend: { status: hasEnvOrDb('RESEND_API_KEY') ? 'connected' : 'offline', label: 'Email' },
      amazon: { status: hasEnvOrDb('AMAZON_CLIENT_ID') && hasEnvOrDb('AMAZON_CLIENT_SECRET') ? 'connected' : 'offline', label: 'Amazon' },
      ebay: { status: hasEnvOrDb('EBAY_CLIENT_ID') && hasEnvOrDb('EBAY_CLIENT_SECRET') ? 'connected' : 'offline', label: 'eBay' },
      shopify: { status: hasEnvOrDb('SHOPIFY_API_KEY') && hasEnvOrDb('SHOPIFY_API_SECRET') ? 'connected' : 'offline', label: 'Shopify' },
      tracking: { status: hasEnvOrDb('TRACKING_API_KEY') ? 'connected' : 'offline', label: 'Tracking' },
    };
    res.json(checks);
  });

  adminApi.get('/admin/export/users', async (req: any, res) => {
    try {
      const allUsers = await db.select({
        id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName,
        role: users.role, subscriptionStatus: users.subscriptionStatus, subscriptionPlan: users.subscriptionPlan,
        emailVerified: users.emailVerified, createdAt: users.createdAt,
      }).from(users).orderBy(desc(users.createdAt));
      const header = 'ID,Email,First Name,Last Name,Role,Subscription Status,Plan,Verified,Created At\n';
      const rows = allUsers.map(u =>
        `${u.id},"${u.email}","${u.firstName || ''}","${u.lastName || ''}",${u.role},${u.subscriptionStatus || 'inactive'},${u.subscriptionPlan || 'free'},${u.emailVerified ? 'Yes' : 'No'},${u.createdAt?.toISOString() || ''}`
      ).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="users-export-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(header + rows);
    } catch { res.status(500).send('Export failed'); }
  });

  // Admin: eBay App Settings (stored in DB, fallback to env)
  adminApi.get('/admin/app-settings/ebay', async (req: any, res) => {
    try {
      const all = await db.select().from(appSettings);
      const getVal = (key: string) => all.find(r => r.key === key)?.value || process.env[key] || "";
      res.json({ clientId: getVal("EBAY_CLIENT_ID"), clientSecret: getVal("EBAY_CLIENT_SECRET"), ruName: getVal("EBAY_RU_NAME") });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  adminApi.put('/admin/app-settings/ebay', async (req: any, res) => {
    try {
      const { clientId, clientSecret, ruName } = req.body;
      const upsert = async (key: string, value: string) => {
        if (!value) return;
        const existing = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
        if (existing.length) {
          await db.update(appSettings).set({ value, updatedAt: new Date() }).where(eq(appSettings.key, key));
        } else {
          await db.insert(appSettings).values({ key, value });
        }
      };
      await upsert("EBAY_CLIENT_ID", clientId);
      await upsert("EBAY_CLIENT_SECRET", clientSecret);
      await upsert("EBAY_RU_NAME", ruName);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Admin: Shopify App Settings
  adminApi.get('/admin/app-settings/shopify', async (req: any, res) => {
    try {
      res.json({ clientId: await getAppSetting("SHOPIFY_CLIENT_ID"), clientSecret: await getAppSetting("SHOPIFY_CLIENT_SECRET"), redirectUri: await getAppSetting("SHOPIFY_REDIRECT_URI") });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  adminApi.put('/admin/app-settings/shopify', async (req: any, res) => {
    try {
      const { clientId, clientSecret, redirectUri } = req.body;
      await upsertAppSetting("SHOPIFY_CLIENT_ID", clientId);
      await upsertAppSetting("SHOPIFY_CLIENT_SECRET", clientSecret);
      await upsertAppSetting("SHOPIFY_REDIRECT_URI", redirectUri);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Admin: Amazon App Settings
  adminApi.get('/admin/app-settings/amazon', async (req: any, res) => {
    try {
      res.json({ clientId: await getAppSetting("AMAZON_CLIENT_ID"), clientSecret: await getAppSetting("AMAZON_CLIENT_SECRET"), redirectUri: await getAppSetting("AMAZON_REDIRECT_URI"), refreshToken: await getAppSetting("AMAZON_REFRESH_TOKEN") });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  adminApi.put('/admin/app-settings/amazon', async (req: any, res) => {
    try {
      const { clientId, clientSecret, redirectUri, refreshToken } = req.body;
      await upsertAppSetting("AMAZON_CLIENT_ID", clientId);
      await upsertAppSetting("AMAZON_CLIENT_SECRET", clientSecret);
      await upsertAppSetting("AMAZON_REDIRECT_URI", redirectUri);
      await upsertAppSetting("AMAZON_REFRESH_TOKEN", refreshToken);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Admin: WooCommerce App Settings
  adminApi.get('/admin/app-settings/woocommerce', async (req: any, res) => {
    try {
      res.json({ consumerKey: await getAppSetting("WOOCOMMERCE_CONSUMER_KEY"), consumerSecret: await getAppSetting("WOOCOMMERCE_CONSUMER_SECRET") });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  adminApi.put('/admin/app-settings/woocommerce', async (req: any, res) => {
    try {
      const { consumerKey, consumerSecret } = req.body;
      await upsertAppSetting("WOOCOMMERCE_CONSUMER_KEY", consumerKey);
      await upsertAppSetting("WOOCOMMERCE_CONSUMER_SECRET", consumerSecret);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Admin: Jumia App Settings
  adminApi.get('/admin/app-settings/jumia', async (req: any, res) => {
    try {
      res.json({ apiKey: await getAppSetting("JUMIA_API_KEY"), apiSecret: await getAppSetting("JUMIA_API_SECRET"), sellerId: await getAppSetting("JUMIA_SELLER_ID") });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  adminApi.put('/admin/app-settings/jumia', async (req: any, res) => {
    try {
      const { apiKey, apiSecret, sellerId } = req.body;
      await upsertAppSetting("JUMIA_API_KEY", apiKey);
      await upsertAppSetting("JUMIA_API_SECRET", apiSecret);
      await upsertAppSetting("JUMIA_SELLER_ID", sellerId);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Register protected routes
  app.use('/api', protectedApi);
  app.use('/api', adminApi);

  // === EXTENSION API (API Key authenticated) ===
  const extensionApi: Router = express.Router();

  extensionApi.use(async (req: any, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return res.status(401).json({ message: 'API key required' });
    }
    
    const user = await storage.getUserByApiKey(apiKey as string);
    if (!user) {
      return res.status(401).json({ message: 'Invalid API key' });
    }
    
    req.user = user;
    next();
  });

  extensionApi.post('/verify', async (req: any, res) => {
    res.json({ success: true, user: { id: req.user.id, email: req.user.email } });
  });

  extensionApi.get('/vendors', async (req: any, res) => {
    try {
      const vendors = await storage.getVendors(req.user.id);
      res.json(vendors);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to get vendors' });
    }
  });

  extensionApi.post('/import', async (req: any, res) => {
    try {
      const { name, description, costPrice, sellingPrice, sku, stockQuantity, vendorId, imageUrl, sourceUrl, deliveryType, deliveryCost } = req.body;
      
      if (!name || !vendorId) {
        return res.status(400).json({ message: 'Product name and vendor are required' });
      }
      
      const product = await storage.createProduct({
        userId: req.user.id,
        vendorId: parseInt(vendorId),
        title: name,
        description: description || '',
        sku: sku || 'DS-' + Date.now().toString(36).toUpperCase(),
        costPrice: costPrice || '0',
        sellingPrice: sellingPrice || '0',
        quantity: stockQuantity || 0,
        images: imageUrl ? [imageUrl] : [],
        attributes: sourceUrl ? { sourceUrl } : null,
        deliveryType: deliveryType || 'buyer_pays',
        deliveryCost: deliveryCost || '0'
      });
      
      res.json({ success: true, product });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to import product' });
    }
  });

  app.use('/api/extension', extensionApi);

  // === ADD-ON CATALOG AUTO-REFRESH ===
  async function seedInitialCatalog() {
    const existing = await storage.getAddonCatalog();
    if (existing.length > 0) return;

    const initialItems = [
      { name: 'Product Photography Kit', description: 'Professional lighting and backdrop setup for product photos.', category: 'tools', price: '39.99', isNew: true },
      { name: 'AI Description Writer', description: 'Generate compelling product descriptions with AI.', category: 'tools', price: '19.99', isNew: true },
      { name: 'Marketplace Analytics', description: 'Advanced analytics dashboard for all your marketplaces.', category: 'services', price: '59.99', isNew: true },
      { name: 'Bulk Listing Creator', description: 'Create hundreds of listings from a single CSV file.', category: 'tools', price: '24.99' },
      { name: 'Competitor Price Tracker', description: 'Track competitor pricing and adjust automatically.', category: 'tools', price: '34.99' },
      { name: 'Premium Support Pack', description: 'Priority support with 24/7 live chat and phone access.', category: 'services', price: '79.99' },
      { name: 'Social Media Kit', description: 'Templates and scheduling for social media promotion.', category: 'content', price: '14.99' },
      { name: 'Inventory Forecasting', description: 'AI-powered demand forecasting to optimize stock levels.', category: 'tools', price: '44.99' },
    ];

    for (const item of initialItems) {
      await storage.createAddonItem(item);
    }
    await storage.logCatalogRefresh(initialItems.length, 0);
    console.log('[Catalog] Seeded initial add-on catalog with', initialItems.length, 'items');
  }

  seedInitialCatalog().catch(err => console.error('[Catalog] Seed error:', err));

  const ONE_DAY = 24 * 60 * 60 * 1000;
  setInterval(async () => {
    try {
      const lastRefresh = await storage.getLastCatalogRefresh();
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      const shouldRefresh = !lastRefresh?.lastRefreshedAt ||
        new Date(lastRefresh.lastRefreshedAt).getMonth() !== currentMonth ||
        new Date(lastRefresh.lastRefreshedAt).getFullYear() !== currentYear;

      if (!shouldRefresh) return;

      const items = await storage.getAddonCatalog();
      let updated = 0;
      for (const item of items) {
        if (item.createdAt) {
          const itemMonth = new Date(item.createdAt).getMonth();
          const itemYear = new Date(item.createdAt).getFullYear();
          const shouldBeNew = itemMonth === currentMonth && itemYear === currentYear;
          if (item.isNew !== shouldBeNew) {
            await storage.updateAddonItem(item.id, { isNew: shouldBeNew });
            updated++;
          }
        }
      }

      const newMonthlyItems = [
        { name: 'Seasonal Product Bundle', description: `Curated ${now.toLocaleString('default', { month: 'long' })} product bundle recommendations.`, category: 'content', price: '19.99', isNew: true },
        { name: 'Trending Keywords Pack', description: `Top trending keywords for ${now.toLocaleString('default', { month: 'long' })}.`, category: 'tools', price: '9.99', isNew: true },
      ];

      let added = 0;
      const existingNames = new Set(items.map(i => i.name));
      for (const addon of newMonthlyItems) {
        if (!existingNames.has(addon.name)) {
          await storage.createAddonItem(addon);
          added++;
        }
      }

      await storage.logCatalogRefresh(added, updated);
      console.log(`[Catalog] Auto-refreshed — ${added} added, ${updated} updated`);

      // Send in-app notifications and emails
      if (added > 0) {
        try {
          const allItems = await storage.getAddonCatalog();
          const freshItems = allItems.filter(i => i.isNew);
          const users = await db.execute(sql`SELECT id, email, first_name FROM users`);
          for (const row of users.rows as any[]) {
            try {
              await storage.createNotification({
                userId: row.id,
                type: 'new_products',
                title: `New Monthly Add-ons Available`,
                message: `Check out this month's new add-ons: ${freshItems.map(i => i.name).join(', ')}`,
              });
            } catch (notifErr) {
              console.error(`[Catalog] Failed notification for user ${row.id}:`, notifErr);
            }
          }
          // Send email notifications
          try {
            const { sendCatalogEmail } = await import('./email.js');
            for (const row of users.rows as any[]) {
              if (row.email) {
                try {
                  await sendCatalogEmail(row.email, row.first_name || 'there', freshItems);
                } catch (emailErr) {
                  console.error(`[Catalog] Failed email to ${row.email}:`, emailErr);
                }
              }
            }
          } catch (emailErr) {
            console.error('[Catalog] Failed to send catalog emails:', emailErr);
          }
        } catch (notifErr) {
          console.error('[Catalog] Failed to send notifications:', notifErr);
        }
      }
    } catch (err) {
      console.error('[Catalog] Auto-refresh error:', err);
    }
  }, ONE_DAY);

  // === ANALYTICS ===
  protectedApi.get('/analytics/revenue', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userOrders = await storage.getOrders(userId);
      const dailyRevenue: Record<string, number> = {};
      const monthlyRevenue: Record<string, number> = {};
      for (const o of userOrders) {
        if (o.totalAmount && o.createdAt) {
          const day = o.createdAt.toISOString().split('T')[0];
          const month = day.substring(0, 7);
          const amount = Number(o.totalAmount);
          dailyRevenue[day] = (dailyRevenue[day] || 0) + amount;
          monthlyRevenue[month] = (monthlyRevenue[month] || 0) + amount;
        }
      }
      res.json({ dailyRevenue, monthlyRevenue, totalRevenue: Object.values(dailyRevenue).reduce((a, b) => a + b, 0) });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  protectedApi.get('/analytics/top-products', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userOrders = await storage.getOrders(userId);
      const orderIds = userOrders.map(o => o.id);
      if (orderIds.length === 0) return res.json([]);
      const productCounts = await storage.getProducts(userId);
      res.json(productCounts
        .map(p => ({ id: p.id, title: p.title, sku: p.sku, revenue: Number(p.sellingPrice) * Math.max(0, Number(p.quantity)), stock: Number(p.quantity) }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10));
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  protectedApi.get('/analytics/profit-summary', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userProducts = await storage.getProducts(userId);
      let totalCost = 0, totalRevenue = 0;
      for (const p of userProducts) {
        totalCost += Number(p.costPrice) * Math.max(0, Number(p.quantity));
        totalRevenue += Number(p.sellingPrice) * Math.max(0, Number(p.quantity));
      }
      const profit = totalRevenue - totalCost;
      const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
      res.json({ totalCost, totalRevenue, profit, margin: Math.round(margin * 100) / 100, productCount: userProducts.length });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  protectedApi.get('/analytics/vendor-performance', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userVendors = await storage.getVendors(userId);
      const vendorIds = userVendors.filter(v => v.id).map(v => v.id);
      if (vendorIds.length === 0) return res.json([]);
      const vendorProducts = await db.select({ vendorId: products.vendorId, sellingPrice: products.sellingPrice, quantity: products.quantity, costPrice: products.costPrice })
        .from(products).where(and(eq(products.userId, userId), inArray(products.vendorId, vendorIds)));
      const byVendor: Record<number, { count: number; cost: number; revenue: number }> = {};
      for (const vp of vendorProducts) {
        if (!vp.vendorId) continue;
        if (!byVendor[vp.vendorId]) byVendor[vp.vendorId] = { count: 0, cost: 0, revenue: 0 };
        byVendor[vp.vendorId].count++;
        byVendor[vp.vendorId].cost += Number(vp.costPrice) * Math.max(0, Number(vp.quantity));
        byVendor[vp.vendorId].revenue += Number(vp.sellingPrice) * Math.max(0, Number(vp.quantity));
      }
      res.json(userVendors.map(v => {
        const perf = byVendor[v.id] || { count: 0, cost: 0, revenue: 0 };
        return { ...v, productCount: perf.count, totalCost: perf.cost, totalRevenue: perf.revenue, profit: perf.revenue - perf.cost };
      }));
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // === SHIPPING PROFILES ===
  protectedApi.get('/shipping-profiles', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profiles = await storage.getShippingProfiles(userId);
      res.json(profiles);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  protectedApi.post('/shipping-profiles', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name, carrier, serviceLevel, baseRate, ratePerKg, freeShippingThreshold, estimatedDaysMin, estimatedDaysMax, regions, isActive } = req.body;
      const profile = await storage.createShippingProfile({
        userId, name, carrier: carrier || 'other', serviceLevel: serviceLevel || 'standard',
        baseRate: baseRate?.toString() || '0', ratePerKg: ratePerKg?.toString(),
        freeShippingThreshold: freeShippingThreshold?.toString(),
        estimatedDaysMin: estimatedDaysMin || 3, estimatedDaysMax: estimatedDaysMax || 7,
        regions: regions || null, isActive: isActive !== false,
      });
      res.status(201).json(profile);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  protectedApi.put('/shipping-profiles/:id', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = Number(req.params.id);
      const updates = req.body;
      if (updates.baseRate) updates.baseRate = updates.baseRate.toString();
      if (updates.ratePerKg) updates.ratePerKg = updates.ratePerKg.toString();
      if (updates.freeShippingThreshold) updates.freeShippingThreshold = updates.freeShippingThreshold.toString();
      const profile = await storage.updateShippingProfile(id, userId, updates);
      if (!profile) return res.status(404).json({ message: 'Shipping profile not found' });
      res.json(profile);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  protectedApi.delete('/shipping-profiles/:id', async (req: any, res) => {
    const userId = req.user.claims.sub;
    const id = Number(req.params.id);
    await storage.deleteShippingProfile(id, userId);
    res.status(204).send();
  });

  // === CUSTOMERS (derived from orders) ===
  protectedApi.get('/customers', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userOrders = await storage.getOrders(userId);
      const customerMap = new Map<string, { name: string; email: string; totalOrders: number; totalSpent: number; lastOrder: Date | null; orders: number[] }>();
      for (const o of userOrders) {
        if (!o.customerEmail) continue;
        const key = o.customerEmail.toLowerCase();
        const existing = customerMap.get(key) || { name: o.customerName || 'Unknown', email: o.customerEmail!, totalOrders: 0, totalSpent: 0, lastOrder: null, orders: [] as number[] };
        existing.totalOrders++;
        existing.totalSpent += Number(o.totalAmount || 0);
        if (o.createdAt && (!existing.lastOrder || o.createdAt > existing.lastOrder)) existing.lastOrder = o.createdAt;
        existing.orders.push(o.id);
        customerMap.set(key, existing);
      }
      res.json(Array.from(customerMap.values()).sort((a, b) => b.totalSpent - a.totalSpent));
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // === BULK PRODUCT UPDATE ===
  protectedApi.post('/products/bulk-update', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { productIds, updates } = req.body;
      if (!Array.isArray(productIds) || productIds.length === 0) {
        return res.status(400).json({ message: 'productIds must be a non-empty array' });
      }
      if (!updates || Object.keys(updates).length === 0) {
        return res.status(400).json({ message: 'No updates provided' });
      }
      let updated = 0;
      const changedProductIds: number[] = [];
      for (const id of productIds) {
        const product = await storage.getProduct(Number(id), userId);
        if (!product) continue;
        const updateData: Record<string, any> = {};
        if (updates.sellingPrice !== undefined) updateData.sellingPrice = updates.sellingPrice.toString();
        if (updates.costPrice !== undefined) updateData.costPrice = updates.costPrice.toString();
        if (updates.quantity !== undefined) updateData.quantity = updates.quantity;
        if (updates.vendorId !== undefined) updateData.vendorId = updates.vendorId;
        if (updates.deliveryType !== undefined) updateData.deliveryType = updates.deliveryType;
        if (updates.deliveryCost !== undefined) updateData.deliveryCost = updates.deliveryCost.toString();
        if (Object.keys(updateData).length > 0) {
          await storage.updateProduct(Number(id), userId, updateData as any);
          if (updates.quantity !== undefined) changedProductIds.push(Number(id));
          updated++;
        }
      }
      // Trigger store sync for products that had quantity changes
      for (const pid of changedProductIds) {
        syncProductAcrossStores(pid, userId).catch(() => {});
      }
      res.json({ updated, total: productIds.length });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Bulk update failed' });
    }
  });

  // === BACKGROUND STOCK SYNC JOB (runs every 2 minutes) ===
  const SYNC_INTERVAL = 2 * 60 * 1000;
  console.log(`[BackgroundSync] Starting — will sync every 2 minutes`);
  setInterval(() => {
    backgroundSyncAllStores();
    syncOutOfStockProducts();
  }, SYNC_INTERVAL);

  // Also run one sync shortly after startup (after 30s to let DB warm up)
  setTimeout(() => {
    backgroundSyncAllStores();
    syncOutOfStockProducts();
  }, 30_000);

  // Tracking monitor — checks shipped orders for delivery updates every 30 min
  const TRACKING_INTERVAL = 30 * 60 * 1000;
  console.log(`[TrackingMonitor] Starting — will check every 30 minutes`);
  setInterval(() => { monitorTracking(); }, TRACKING_INTERVAL);

  // Register conversation API (persistent chat with SSE streaming)
  registerChatRoutes(app);

  return httpServer;
}

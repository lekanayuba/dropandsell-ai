import type { Express, Router } from "express";
import type { Server } from "http";
import express from "express";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, isAuthenticated, registerAuthRoutes } from "./replit_integrations/auth";
import { getUncachableStripeClient, getStripePublishableKey, getStripeSync } from "./stripeClient";
import { db } from "./db";
import { sql } from "drizzle-orm";

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

  // Protected router for API routes
  const protectedApi: Router = express.Router();
  protectedApi.use(isAuthenticated);

  // === DASHBOARD ===
  protectedApi.get('/dashboard/stats', async (req: any, res) => {
    const userId = req.user.claims.sub;
    
    const products = await storage.getProducts(userId);
    const orders = await storage.getOrders(userId);
    const walletData = await storage.getWallet(userId);
    
    const totalRevenue = orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    const totalOrders = orders.length;
    const activeListings = products.length;
    const walletBalance = Number(walletData?.balance || 0);

    res.json({
      totalRevenue,
      totalOrders,
      activeListings,
      walletBalance,
    });
  });

  // === STORES ===
  protectedApi.get('/stores', async (req: any, res) => {
    const userId = req.user.claims.sub;
    const storesList = await storage.getStores(userId);
    res.json(storesList);
  });

  protectedApi.post('/stores', async (req: any, res) => {
    try {
      const input = api.stores.create.input.parse(req.body);
      const store = await storage.createStore({ ...input, userId: req.user.claims.sub });
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
      const id = Number(req.params.id);
      const input = api.stores.update.input.parse(req.body);
      const store = await storage.updateStore(id, input);
      res.json(store);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  protectedApi.delete('/stores/:id', async (req, res) => {
    const id = Number(req.params.id);
    await storage.deleteStore(id);
    res.status(204).send();
  });

  // === VENDORS ===
  protectedApi.get('/vendors', async (req: any, res) => {
    const userId = req.user.claims.sub;
    const vendorsList = await storage.getVendors(userId);
    res.json(vendorsList);
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
      const id = Number(req.params.id);
      const input = api.vendors.update.input.parse(req.body);
      const vendor = await storage.updateVendor(id, input);
      res.json(vendor);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  protectedApi.delete('/vendors/:id', async (req, res) => {
    const id = Number(req.params.id);
    await storage.deleteVendor(id);
    res.status(204).send();
  });

  // === PRODUCTS ===
  protectedApi.get('/products', async (req: any, res) => {
    const userId = req.user.claims.sub;
    const productsList = await storage.getProducts(userId);
    res.json({ items: productsList, total: productsList.length });
  });

  protectedApi.get('/products/:id', async (req: any, res) => {
    const id = Number(req.params.id);
    const product = await storage.getProduct(id);
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
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  protectedApi.put('/products/:id', async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const input = api.products.update.input.parse(req.body);
      const product = await storage.updateProduct(id, input);
      res.json(product);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  protectedApi.delete('/products/:id', async (req, res) => {
    const id = Number(req.params.id);
    await storage.deleteProduct(id);
    res.status(204).send();
  });

  // === ORDERS ===
  protectedApi.get('/orders', async (req: any, res) => {
    const userId = req.user.claims.sub;
    const ordersList = await storage.getOrders(userId);
    res.json(ordersList);
  });

  protectedApi.get('/orders/:id', async (req: any, res) => {
    const id = Number(req.params.id);
    const order = await storage.getOrder(id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.json(order);
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

  // Register protected routes
  app.use('/api', protectedApi);

  return httpServer;
}

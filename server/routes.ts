import type { Express, Router } from "express";
import type { Server } from "http";
import express from "express";
import multer from "multer";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, isAuthenticated, registerAuthRoutes } from "./replit_integrations/auth";
import { getUncachableStripeClient, getStripePublishableKey, getStripeSync } from "./stripeClient";
import { db } from "./db";
import { sql } from "drizzle-orm";
import OpenAI from "openai";

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
      const crypto = await import('crypto');
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
      
      // Set session
      (req.session as any).userId = user.id;
      
      res.json({ 
        success: true,
        user: { 
          id: user.id, 
          email: user.email, 
          firstName: user.firstName, 
          lastName: user.lastName,
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
      const userEmail = req.user.claims.email;
      
      // Enforce store email must match user's account email
      if (input.email && input.email.toLowerCase() !== userEmail?.toLowerCase()) {
        return res.status(400).json({ 
          message: 'Store email must match your account email. Please use: ' + userEmail 
        });
      }
      
      const store = await storage.createStore({ 
        ...input, 
        email: userEmail, // Always use user's account email
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
      const userEmail = req.user.claims.email;
      const id = Number(req.params.id);
      const input = api.stores.update.input.parse(req.body);
      
      // Prevent changing store email to a different email
      if (input.email && input.email.toLowerCase() !== userEmail?.toLowerCase()) {
        return res.status(400).json({ 
          message: 'Store email must match your account email' 
        });
      }
      
      // If email is being updated, force it to user's email
      const updateData = input.email ? { ...input, email: userEmail } : input;
      
      const store = await storage.updateStore(id, userId, updateData);
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
      const product = await storage.updateProduct(id, userId, input);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      res.json(product);
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

  // Stripe subscription products for payment setup (public endpoint)
  protectedApi.get('/stripe/products', async (req, res) => {
    res.json(SUBSCRIPTION_PLANS);
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

  // === AUTOMATION: CALCULATE PRICE ===
  protectedApi.post('/automation/calculate-price', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { costPrice, vendorId } = req.body;
      
      const rules = await storage.getPricingRules(userId);
      const activeRules = rules.filter(r => r.isActive);
      
      // Find applicable rule (by vendor or default)
      let applicableRule = activeRules.find(r => r.applyToVendor === vendorId);
      if (!applicableRule) {
        applicableRule = activeRules.find(r => !r.applyToVendor); // Default rule
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
      const lines = csvContent.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        await storage.updateImportJob(job.id, { status: 'failed', errors: ['File is empty or has no data rows'] });
        return res.status(400).json({ message: 'File is empty or has no data rows' });
      }
      
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
      const dataRows = lines.slice(1);
      
      await storage.updateImportJob(job.id, { totalRows: dataRows.length });
      
      // Default field mapping
      const mapping = fieldMapping || {
        title: headers.includes('title') ? 'title' : headers.includes('name') ? 'name' : headers[0],
        sku: headers.includes('sku') ? 'sku' : headers.includes('item_number') ? 'item_number' : null,
        costPrice: headers.includes('cost') ? 'cost' : headers.includes('cost_price') ? 'cost_price' : headers.includes('price') ? 'price' : null,
        description: headers.includes('description') ? 'description' : null,
        quantity: headers.includes('quantity') ? 'quantity' : headers.includes('stock') ? 'stock' : null,
      };
      
      // Get pricing rules for auto-calculation
      const rules = await storage.getPricingRules(userId);
      const activeRule = rules.find(r => r.isActive && (r.applyToVendor === vendorId || !r.applyToVendor));
      
      const productsToCreate: any[] = [];
      const errors: string[] = [];
      let processedRows = 0;
      
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const values = row.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        
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
      const lines = csvContent.split('\n').filter(line => line.trim());
      
      if (lines.length < 1) {
        return res.status(400).json({ message: 'File is empty' });
      }
      
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const previewRows = lines.slice(1, 6).map(row => 
        row.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
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
            const violationNames = veroCheck.violations.map(v => v.value).join(', ');
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
          
          // Simulate marketplace API call (in real implementation, this would call Shopify/eBay/Amazon API)
          const externalId = `EXT-${store.platform.toUpperCase()}-${Date.now()}-${product.id}`;
          
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
          
          results.push({ id: itemId, status: 'published', externalId });
        } catch (err: any) {
          await storage.updatePublishQueueItem(itemId, {
            status: 'failed',
            errorMessage: err.message,
          });
          results.push({ id: itemId, status: 'failed', message: err.message });
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
      const totalEarnings = referrals.reduce((sum, r) => sum + Number(r.totalEarnings || 0), 0);
      
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

  // Register protected routes
  app.use('/api', protectedApi);

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

  return httpServer;
}

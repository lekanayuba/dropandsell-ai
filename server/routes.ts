import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, isAuthenticated, registerAuthRoutes } from "./replit_integrations/auth";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Auth setup
  await setupAuth(app);
  registerAuthRoutes(app);

  // Protected middleware for API routes
  const protectedApi = express.Router();
  protectedApi.use(isAuthenticated);
  app.use('/api', protectedApi);

  // === DASHBOARD ===
  protectedApi.get(api.dashboard.stats.path.replace('/api', ''), async (req: any, res) => {
    const userId = req.user.claims.sub;
    
    // Calculate stats
    const products = await storage.getProducts(userId);
    const orders = await storage.getOrders(userId);
    const wallet = await storage.getWallet(userId);
    
    // Mock calculations for now
    const totalRevenue = orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    const totalOrders = orders.length;
    const activeListings = products.length; // Simplified
    const walletBalance = Number(wallet?.balance || 0);

    res.json({
      totalRevenue,
      totalOrders,
      activeListings,
      walletBalance,
    });
  });

  // === STORES ===
  protectedApi.get(api.stores.list.path.replace('/api', ''), async (req: any, res) => {
    const userId = req.user.claims.sub;
    const stores = await storage.getStores(userId);
    res.json(stores);
  });

  protectedApi.post(api.stores.create.path.replace('/api', ''), async (req: any, res) => {
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

  protectedApi.delete(api.stores.delete.path.replace('/api', ''), async (req, res) => {
    const id = Number(req.params.id);
    await storage.deleteStore(id);
    res.status(204).send();
  });

  // === VENDORS ===
  protectedApi.get(api.vendors.list.path.replace('/api', ''), async (req: any, res) => {
    const userId = req.user.claims.sub;
    const vendors = await storage.getVendors(userId);
    res.json(vendors);
  });

  protectedApi.post(api.vendors.create.path.replace('/api', ''), async (req: any, res) => {
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

  // === PRODUCTS ===
  protectedApi.get(api.products.list.path.replace('/api', ''), async (req: any, res) => {
    const userId = req.user.claims.sub;
    const products = await storage.getProducts(userId);
    res.json({ items: products, total: products.length });
  });

  protectedApi.post(api.products.create.path.replace('/api', ''), async (req: any, res) => {
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

  // === WALLET ===
  protectedApi.get(api.wallet.get.path.replace('/api', ''), async (req: any, res) => {
    const userId = req.user.claims.sub;
    let wallet = await storage.getWallet(userId);
    
    if (!wallet) {
      wallet = await storage.createWallet(userId);
    }
    
    const transactions = await storage.getTransactions(wallet.id);
    
    res.json({
      balance: Number(wallet.balance),
      currency: wallet.currency,
      transactions,
    });
  });

  return httpServer;
}

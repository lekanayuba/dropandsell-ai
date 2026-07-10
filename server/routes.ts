import type { Express, Router } from "express";
import type { Server } from "http";
import express from "express";
import multer from "multer";
import bcrypt from "bcrypt";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { OWNER_EMAIL } from "./seedAdmin";
import { resolveInventoryOwnerId } from "./sharedInventory";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, isAuthenticated, registerAuthRoutes } from "./replit_integrations/auth";
import { getUncachableStripeClient, getStripePublishableKey, getStripeSync, constructVerifiedWebhookEvent } from "./stripeClient";
import { db } from "./db";
import { SUBSCRIPTION_PLANS, getYearlyPrice } from "./subscriptionPlans";
import { sql, eq, and, or, desc, ne } from "drizzle-orm";
import { users, wallet, transactions, referrals, stores, orders, products, vendors, publishQueue, pricingRules, skuMappings, importJobs, veroList, globalVeroList, contentFilters, restrictedProducts, addonPurchases, suggestions, subscriptions, fulfillmentJobs, paymentCards, returnRequests, auditLogs, freelancerProfiles, marketplaceListings, dropAndSellOrders, insertChangelogEntrySchema } from "@shared/schema";
import OpenAI from "openai";
import { publishToMarketplace, testMarketplaceConnection } from "./marketplaces/index";
import { getEbayUserIdentity, generateAIDescription, generateAITitle, generateAIItemSpecifics } from "./marketplaces/ebay";

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const FREE_ACCESS_EMAILS: Record<string, { isAdmin: boolean; unlimitedStores?: boolean; freeAddons?: boolean; bonusStores?: number; skipPlanOverride?: boolean }> = {
  'cyrinaudochukwu28@gmail.com': { isAdmin: false, unlimitedStores: true },
  'dropandsellauth@gmail.com': { isAdmin: true, freeAddons: true },
  'mukaila.ayuba@outlook.com': { isAdmin: false, unlimitedStores: true, freeAddons: true },
  'rtrebecca@yahoo.com': { isAdmin: false, freeAddons: true },
  'triple.u.fam@gmail.com': { isAdmin: false, bonusStores: 1, skipPlanOverride: true },
  'truecoreglobal@gmail.com': { isAdmin: false, unlimitedStores: true, freeAddons: true, bonusStores: 15 },
};

const LEGACY_STORE_BONUS_CUTOFF = new Date('2026-04-10T00:00:00Z');

const SERVICE_DISRUPTION_BONUS = 1;

function getStoreLimitForPlan(planName: string | null | undefined, subscriptionStatus: string | null | undefined, email?: string | null, createdAt?: Date | string | null): number {
  if (email && FREE_ACCESS_EMAILS[email.toLowerCase()]?.unlimitedStores) return 999;
  const bonus = (email && FREE_ACCESS_EMAILS[email.toLowerCase()]?.bonusStores) || 0;
  const isLegacyUser = createdAt ? new Date(createdAt) < LEGACY_STORE_BONUS_CUTOFF : false;
  const legacyBonus = isLegacyUser ? 1 : 0;
  if (!planName) return 2 + bonus + legacyBonus + SERVICE_DISRUPTION_BONUS;
  if (subscriptionStatus !== 'active' && subscriptionStatus !== 'trialing') return 2 + bonus + legacyBonus + SERVICE_DISRUPTION_BONUS;
  const plan = SUBSCRIPTION_PLANS.find(p => p.name.toLowerCase() === planName.toLowerCase());
  return (plan?.storeLimit || 2) + bonus + legacyBonus + SERVICE_DISRUPTION_BONUS;
}

// Helper to derive vendor name from hostname
function deriveVendorNameFromHostname(hostname: string): string {
  // Known vendor mappings
  const knownVendors: Record<string, string> = {
    'amazon.com': 'Amazon',
    'amazon.co.uk': 'Amazon UK',
    'amazon.de': 'Amazon DE',
    'amazon.fr': 'Amazon FR',
    'amazon.ca': 'Amazon CA',
    'amazon.in': 'Amazon IN',
    'aliexpress.com': 'AliExpress',
    'aliexpress.us': 'AliExpress',
    'ebay.com': 'eBay',
    'ebay.co.uk': 'eBay UK',
    'ebay.de': 'eBay DE',
    'walmart.com': 'Walmart',
    'etsy.com': 'Etsy',
  };
  
  // Check known vendors
  for (const [domain, name] of Object.entries(knownVendors)) {
    if (hostname.includes(domain.replace('www.', ''))) {
      return name;
    }
  }
  
  // Fallback: capitalize first part of hostname
  const parts = hostname.split('.');
  const brand = parts[0] || hostname;
  return brand.charAt(0).toUpperCase() + brand.slice(1);
}

// Refreshes an eBay store's OAuth access token in-place when it has expired
// (or is within 5 min of expiring). Returns the latest credentials. Used by
// both the user-facing refresh endpoint AND the Drop-and-Sell lister "list
// product on requester's behalf" endpoint, so listers never have to wait for
// the requester to manually refresh their token before they can list.
//
// `verifyIdentityFor` is an optional eBay username — when set, the helper
// performs an identity check on the freshly-issued token BEFORE persisting.
// If eBay reports a different account, we return ok:false WITHOUT writing
// the new credentials, so a mismatched token can never be saved to the
// store row.
async function refreshEbayTokenIfNeeded(
  store: typeof stores.$inferSelect,
  storeOwnerId: string,
  options?: { verifyIdentityFor?: string },
): Promise<{ ok: true; credentials: any; refreshed: boolean } | { ok: false; message: string }> {
  const creds = (store.credentials as any) || {};
  const expiry = Number(creds.tokenExpiry || 0);
  const fiveMinFromNow = Date.now() + 5 * 60 * 1000;

  // Local helper: identity verification against an access token. Used on BOTH
  // the still-valid and freshly-refreshed paths so a mismatched token persisted
  // before this check existed cannot be silently re-used until it expires.
  // Behavior: fail-closed ONLY on a confirmed username mismatch. Probe
  // unavailability (throw / null / no username — typically eBay GetUser daily
  // quota error 518) is treated as a soft pass so a routine eBay throttle
  // doesn't strand every lister into this customer's store for the day.
  const verifyTokenIdentity = async (
    accessToken: string,
    expectedUsername: string,
    context: 'cached' | 'refreshed',
  ): Promise<{ ok: true; username: string } | { ok: false; message: string }> => {
    // The identity probe (Trading API GetUser) is a SECONDARY safety check on
    // top of the OAuth refresh that already validated the token. eBay routinely
    // throttles GetUser (error 518 = daily quota exceeded), and transient
    // network blips happen. When the probe can't tell us WHO the token belongs
    // to (vs. telling us it belongs to someone different), we should NOT
    // strand the user — the OAuth exchange itself proved the token is valid.
    // Only a confirmed username MISMATCH is a reason to fail closed.
    // (This mirrors the tolerant fallback in the eBay OAuth callback.)
    let identity: { username?: string } | null = null;
    try {
      identity = await getEbayUserIdentity(accessToken);
    } catch (identityErr: any) {
      console.warn(`eBay identity probe threw for store ${store.id} (${context} token) — proceeding on the trust of the already-valid OAuth token, expected "@${expectedUsername}". Error: ${identityErr.message}`);
      return { ok: true, username: expectedUsername };
    }
    if (!identity?.username) {
      console.warn(`eBay identity probe returned no username for store ${store.id} (${context} token) — likely GetUser daily quota (eBay error 518) or transient. Proceeding on the trust of the OAuth token; expected "@${expectedUsername}".`);
      return { ok: true, username: expectedUsername };
    }
    if (identity.username.toLowerCase() !== expectedUsername.toLowerCase()) {
      console.error(`eBay token mismatch for store ${store.id} (${context} token): token belongs to "${identity.username}" but store expects "${expectedUsername}"`);
      return { ok: false, message: `Token mismatch: the token currently saved for this store belongs to eBay account "@${identity.username}" instead of "@${expectedUsername}". Please disconnect and reconnect this store.` };
    }
    return { ok: true, username: identity.username };
  };

  if (creds.authToken && expiry > fiveMinFromNow) {
    // Even on the cached-token early-return path, verify identity when caller
    // requested it. Otherwise a mismatched-but-unexpired token persisted from
    // a legacy code path could still be used until it expired.
    if (options?.verifyIdentityFor) {
      const verify = await verifyTokenIdentity(creds.authToken, options.verifyIdentityFor, 'cached');
      if (!verify.ok) return verify;
    }
    return { ok: true, credentials: creds, refreshed: false };
  }
  if (!creds.refreshToken) {
    return { ok: false, message: 'eBay store has no refresh token. The store owner must reconnect their eBay account.' };
  }

  const appId = process.env.EBAY_APP_ID;
  const certId = process.env.EBAY_CERT_ID;
  const basicAuth = Buffer.from(`${appId}:${certId}`).toString('base64');

  try {
    const tokenResponse = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: creds.refreshToken,
        scope: 'https://api.ebay.com/oauth/api_scope https://api.ebay.com/oauth/api_scope/sell.inventory https://api.ebay.com/oauth/api_scope/sell.marketing https://api.ebay.com/oauth/api_scope/sell.account https://api.ebay.com/oauth/api_scope/sell.fulfillment',
      }).toString(),
    });
    const tokenData = await tokenResponse.json() as any;
    if (!tokenResponse.ok || tokenData.error) {
      return { ok: false, message: tokenData.error_description || tokenData.error || 'Failed to refresh eBay token' };
    }
    const newCredentials: any = {
      ...creds,
      authToken: tokenData.access_token,
      tokenExpiry: Date.now() + (tokenData.expires_in * 1000),
    };

    // Identity verification BEFORE persistence. Fail-closed via the shared
    // helper: any error / missing username / mismatch aborts without writing.
    if (options?.verifyIdentityFor) {
      const verify = await verifyTokenIdentity(tokenData.access_token, options.verifyIdentityFor, 'refreshed');
      if (!verify.ok) return verify;
      // Auto-fill ebayUsername if it was missing on the store row
      if (!creds.ebayUsername) {
        newCredentials.ebayUsername = verify.username;
        console.log(`Auto-set ebayUsername for store ${store.id} to "${verify.username}" during token refresh`);
      }
    }

    await storage.updateStore(store.id, storeOwnerId, { credentials: newCredentials });
    return { ok: true, credentials: newCredentials, refreshed: true };
  } catch (err: any) {
    return { ok: false, message: err.message || 'Failed to refresh eBay token' };
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Auth setup
  await setupAuth(app);
  registerAuthRoutes(app);

  // VeRO-safe brand resolver. Returns 'Unbranded' when the incoming brand
  // matches a user-owned or global VeRO brand (or alias). Used at publish
  // time and at AI-optimisation time so a flagged brand never reaches the
  // marketplace Item Specifics / Brand field — protecting the user's store
  // from policy strikes. Empty/missing brand also returns 'Unbranded'.
  const veroSafeBrand = async (
    userId: string,
    brand: string | null | undefined,
    productId?: number,
    platform?: string,
  ): Promise<string> => {
    const trimmed = (brand || '').trim();
    if (!trimmed) return 'Unbranded';
    try {
      const check = await storage.checkVeroBrand(userId, trimmed, productId, platform);
      return check.isBlocked ? 'Unbranded' : trimmed;
    } catch (err: any) {
      // FAIL-CLOSED: if the VeRO check cannot complete (DB outage, etc.) we
      // must NOT pass through the original brand — a flagged value would
      // reach the live eBay listing and risk a policy strike. Defaulting to
      // "Unbranded" is the safe choice; it never violates VeRO.
      console.warn('[veroSafeBrand] check failed, defaulting to Unbranded:', err?.message);
      return 'Unbranded';
    }
  };

  // Sanitise the AI-extracted item-specifics map so its Brand value is
  // VeRO-safe before we persist it or hand it to a marketplace publisher.
  const sanitizeItemSpecificsBrand = async (
    userId: string,
    specifics: Record<string, any> | null | undefined,
    productId?: number,
    platform?: string,
  ): Promise<Record<string, any> | null> => {
    if (!specifics || typeof specifics !== 'object') return specifics ?? null;
    const out: Record<string, any> = { ...specifics };
    const brandKey = Object.keys(out).find(k => k.trim().toLowerCase() === 'brand');
    if (brandKey && typeof out[brandKey] === 'string' && out[brandKey].trim()) {
      out[brandKey] = await veroSafeBrand(userId, out[brandKey], productId, platform);
    }
    return out;
  };

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
      
      const updateFields: any = {
        verificationToken,
        verificationTokenExpiry,
      };
      
      const freeAccess = FREE_ACCESS_EMAILS[email.toLowerCase()];
      if (freeAccess && !freeAccess.skipPlanOverride) {
        updateFields.subscriptionPlan = 'Enterprise Plan';
        updateFields.subscriptionStatus = 'active';
        updateFields.isAdmin = freeAccess.isAdmin ? 'true' : 'false';
        console.log(`Granted free Enterprise access to ${email} (admin: ${freeAccess.isAdmin})`);
      }
      
      await storage.updateUser(user.id, updateFields);
      
      // Send verification email - use request host to ensure correct URL in both dev and production
      const baseUrl = `https://${req.get('host')}`;
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

      // Fire-and-forget: send the same extension-update / welcome email that
      // the recurring 48h blast sends, so brand-new signups get the install +
      // SYNC instructions immediately instead of waiting up to two days.
      try {
        const { sendExtensionUpdateEmailToUser } = await import('./subscriberUpdateEmailScheduler.js');
        sendExtensionUpdateEmailToUser(email, firstName, false).catch((e) =>
          console.error(`[signup-welcome] send failed for ${email}:`, e)
        );
      } catch (e) {
        console.error('[signup-welcome] import failed:', e);
      }

      // Set session and ensure it's saved before responding
      (req.session as any).userId = user.id;
      
      await new Promise<void>((resolve, reject) => {
        req.session.save((err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
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
      
      const freeAccess = FREE_ACCESS_EMAILS[email.toLowerCase()];
      if (freeAccess && !freeAccess.skipPlanOverride && (user.subscriptionPlan !== 'Enterprise Plan' || user.subscriptionStatus !== 'active')) {
        await storage.updateUser(user.id, {
          subscriptionPlan: 'Enterprise Plan',
          subscriptionStatus: 'active',
          isAdmin: freeAccess.isAdmin ? 'true' : (user.isAdmin || 'false'),
        });
        console.log(`Applied free Enterprise access on login for ${email}`);
      }
      
      // Set session and ensure it's saved before responding
      (req.session as any).userId = user.id;
      
      await new Promise<void>((resolve, reject) => {
        req.session.save((err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      res.json({ 
        success: true,
        user: { 
          id: user.id, 
          email: user.email, 
          firstName: user.firstName, 
          lastName: user.lastName,
          emailVerified: user.emailVerified,
          policiesAccepted: user.policiesAccepted,
          disclaimerAccepted: user.disclaimerAccepted,
          onboardingCompleted: user.onboardingCompleted
        }
      });
    } catch (err: any) {
      console.error('Login error:', err);
      res.status(500).json({ message: err.message || 'Login failed' });
    }
  });

  // Dedicated admin login — separate from the client login. Accepts a username
  // (or email), verifies the password, and only allows accounts with admin access.
  app.post('/api/auth/admin-login', async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
      }

      // Hard lock: only the configured admin username OR the owner's email may
      // ever log in here, regardless of whether any other account is flagged as
      // admin. The owner email is always allowed to match seedAdmin, which
      // guarantees that account keeps admin access permanently.
      const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || '').trim().toLowerCase();
      const typedUsername = String(username).trim().toLowerCase();
      const allowedAdminLogins = [ADMIN_USERNAME, OWNER_EMAIL.toLowerCase()].filter(Boolean);
      if (!allowedAdminLogins.includes(typedUsername)) {
        return res.status(403).json({ message: 'Invalid username or password' });
      }

      let user = await storage.getUserByEmail(username);
      if (!user && typeof username === 'string') {
        user = await storage.getUserByEmail(username.trim().toLowerCase());
      }
      if (!user || !user.password) {
        return res.status(401).json({ message: 'Invalid username or password' });
      }

      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ message: 'Invalid username or password' });
      }

      const isAdmin = user.isAdmin === 'true';
      if (!isAdmin) {
        return res.status(403).json({ message: 'This account does not have admin access.' });
      }

      (req.session as any).userId = user.id;

      await new Promise<void>((resolve, reject) => {
        req.session.save((err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          emailVerified: user.emailVerified,
          isAdmin: user.isAdmin,
        }
      });
    } catch (err: any) {
      console.error('Admin login error:', err);
      res.status(500).json({ message: err.message || 'Admin login failed' });
    }
  });
  
  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.json({ success: true, message: 'If an account with that email exists, a password reset link has been sent.' });
      }

      const crypto = await import('crypto');
      const resetToken = crypto.randomUUID();
      const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);

      await storage.updateUser(user.id, {
        resetPasswordToken: resetToken,
        resetPasswordTokenExpiry: resetTokenExpiry,
      });

      const baseUrl = `https://${req.get('host')}`;
      const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

      try {
        const { sendPasswordResetEmail } = await import('./email.js');
        const emailSent = await sendPasswordResetEmail(email, resetUrl);
        if (!emailSent) {
          console.error(`Failed to send password reset email to ${email}`);
        }
      } catch (emailErr: any) {
        console.error(`Email sending error for password reset ${email}:`, emailErr?.message || emailErr);
      }

      res.json({ success: true, message: 'If an account with that email exists, a password reset link has been sent.' });
    } catch (err: any) {
      console.error('Forgot password error:', err);
      res.status(500).json({ message: 'Something went wrong. Please try again.' });
    }
  });

  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { token, password } = req.body;
      if (!token || !password) {
        return res.status(400).json({ message: 'Token and new password are required' });
      }

      if (password.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters' });
      }

      const user = await storage.getUserByResetPasswordToken(token);
      if (!user || !user.resetPasswordTokenExpiry || new Date(user.resetPasswordTokenExpiry) < new Date()) {
        return res.status(400).json({ message: 'Invalid or expired reset link. Please request a new one.' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      await storage.updateUser(user.id, {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordTokenExpiry: null,
      });

      res.json({ success: true, message: 'Password has been reset successfully. You can now sign in.' });
    } catch (err: any) {
      console.error('Reset password error:', err);
      res.status(500).json({ message: 'Something went wrong. Please try again.' });
    }
  });

  app.post('/api/auth/change-password', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId || req.user?.id;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Current password and new password are required' });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ message: 'New password must be at least 8 characters' });
      }

      const user = await storage.getUser(userId);
      if (!user || !user.password) {
        return res.status(400).json({ message: 'Unable to change password for this account' });
      }

      const passwordMatch = await bcrypt.compare(currentPassword, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ message: 'Current password is incorrect' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(userId, { password: hashedPassword });

      res.json({ success: true, message: 'Password changed successfully' });
    } catch (err: any) {
      console.error('Change password error:', err);
      res.status(500).json({ message: 'Something went wrong. Please try again.' });
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
      
      let user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }
      
      const freeAccess = user.email ? FREE_ACCESS_EMAILS[user.email.toLowerCase()] : null;
      if (freeAccess && !freeAccess.skipPlanOverride && (user.subscriptionPlan !== 'Enterprise Plan' || user.subscriptionStatus !== 'active')) {
        await storage.updateUser(user.id, {
          subscriptionPlan: 'Enterprise Plan',
          subscriptionStatus: 'active',
          isAdmin: freeAccess.isAdmin ? 'true' : (user.isAdmin || 'false'),
        });
        user = (await storage.getUser(userId))!;
      }
      
      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        emailVerified: user.emailVerified,
        policiesAccepted: user.policiesAccepted,
        disclaimerAccepted: user.disclaimerAccepted,
        onboardingCompleted: user.onboardingCompleted,
        subscriptionPlan: user.subscriptionPlan,
        subscriptionStatus: user.subscriptionStatus,
        storeLimit: getStoreLimitForPlan(user.subscriptionPlan, user.subscriptionStatus, user.email, user.createdAt),
        referralCode: user.referralCode,
        currency: user.currency || 'GBP',
        isAdmin: (freeAccess?.isAdmin || user.isAdmin === 'true') ? 'true' : 'false',
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

  // === EBAY MARKETPLACE ACCOUNT DELETION NOTIFICATION ===
  app.post('/api/ebay/account-deletion', async (req, res) => {
    try {
      const notification = req.body;
      console.log('eBay account deletion notification received:', JSON.stringify(notification));

      if (notification?.metadata?.topic === 'MARKETPLACE_ACCOUNT_DELETION') {
        const userId = notification?.notification?.data?.userId;
        const username = notification?.notification?.data?.username;
        console.log(`eBay account deletion requested for eBay user: ${username || userId || 'unknown'}`);
      }

      res.status(200).json({
        status: 'OK',
        message: 'Account deletion notification received and acknowledged'
      });
    } catch (err: any) {
      console.error('Error processing eBay account deletion notification:', err);
      res.status(200).json({
        status: 'OK',
        message: 'Notification acknowledged'
      });
    }
  });

  app.get('/api/ebay/account-deletion', (req, res) => {
    const challengeCode = req.query.challenge_code as string;

    if (challengeCode) {
      const verificationToken = process.env.EBAY_VERIFICATION_TOKEN || '';
      const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
      const endpoint = `${proto}://${req.get('host')}/api/ebay/account-deletion`;

      console.log('eBay challenge verification - endpoint used:', endpoint);
      console.log('eBay challenge verification - challenge_code:', challengeCode);

      const hash = crypto
        .createHash('sha256')
        .update(challengeCode + verificationToken + endpoint)
        .digest('hex');

      console.log('eBay challenge verification - response hash:', hash);
      return res.status(200).json({ challengeResponse: hash });
    }

    res.status(200).json({
      status: 'OK',
      message: 'eBay Marketplace Account Deletion Notification endpoint is active'
    });
  });

  // === EBAY OAUTH FLOW ===
  app.get('/api/ebay/auth', isAuthenticated, (req: any, res) => {
    try {
      const storeName = req.query.storeName as string || 'My eBay Store';
      const siteId = req.query.siteId as string || '3';
      const ebayUsername = req.query.ebayUsername as string || '';
      const ebayEmail = req.query.ebayEmail as string || '';
      const userId = req.user.claims.sub;

      if (!ebayUsername.trim() || !ebayEmail.trim()) {
        return res.redirect(`/stores?error=${encodeURIComponent('eBay username and email are required to connect a store.')}`);
      }

      const appId = process.env.EBAY_APP_ID;
      const ruName = process.env.EBAY_RUNAME;
      if (!appId) {
        return res.status(500).json({ message: 'eBay App ID not configured' });
      }
      if (!ruName) {
        return res.status(500).json({ message: 'eBay RuName not configured' });
      }

      const state = Buffer.from(JSON.stringify({ userId, storeName, siteId, ebayUsername, ebayEmail })).toString('base64');

      const scopes = [
        'https://api.ebay.com/oauth/api_scope',
        'https://api.ebay.com/oauth/api_scope/sell.inventory',
        'https://api.ebay.com/oauth/api_scope/sell.marketing',
        'https://api.ebay.com/oauth/api_scope/sell.account',
        'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
      ].join(' ');

      const ebayAuthUrl = `https://auth.ebay.com/oauth2/authorize?` +
        `client_id=${encodeURIComponent(appId)}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(ruName)}` +
        `&scope=${encodeURIComponent(scopes)}` +
        `&state=${encodeURIComponent(state)}` +
        `&prompt=login` +
        `&auth_type=consent`;

      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const host = req.headers['x-forwarded-host'] || req.get('host');
      const callbackUrl = `${protocol}://${host}/api/ebay/callback`;
      console.log(`eBay OAuth redirect: appId=${appId}, ruName=${ruName}`);
      console.log(`eBay callback URL must be set to: ${callbackUrl}`);
      res.redirect(ebayAuthUrl);
    } catch (err: any) {
      console.error('eBay OAuth initiation error:', err);
      res.redirect('/stores?ebay_error=' + encodeURIComponent(err.message || 'Failed to start eBay connection'));
    }
  });

  app.get('/api/ebay/callback', async (req, res) => {
    console.log(`eBay OAuth callback received: code=${req.query.code ? 'present' : 'missing'}, state=${req.query.state ? 'present' : 'missing'}, error=${req.query.error || 'none'}, url=${req.originalUrl}`);
    const code = req.query.code as string || '';
    const stateParam = req.query.state as string || '';
    const error = req.query.error as string || '';
    res.redirect(`/ebay-callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(stateParam)}&error=${encodeURIComponent(error)}`);
  });

  app.get('/api/shopify/auth', isAuthenticated, (req: any, res) => {
    try {
      const storeName = req.query.storeName as string || 'My Shopify Store';
      const shopDomain = (req.query.shopDomain as string || '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
      const userId = req.user.claims.sub;

      if (!shopDomain) {
        return res.redirect(`/stores?error=${encodeURIComponent('Shopify shop domain is required.')}`);
      }

      const apiKey = process.env.SHOPIFY_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: 'Shopify API Key not configured' });
      }

      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const host = req.headers['x-forwarded-host'] || req.get('host');
      const redirectUri = `${protocol}://${host}/api/shopify/callback`;

      const state = Buffer.from(JSON.stringify({ userId, storeName, shopDomain })).toString('base64');

      const scopes = 'read_products,write_products,read_orders,write_orders,read_inventory,write_inventory,read_fulfillments,write_fulfillments,read_shipping,write_shipping';

      const domain = shopDomain.includes('.myshopify.com') ? shopDomain : `${shopDomain}.myshopify.com`;
      const shopifyAuthUrl = `https://${domain}/admin/oauth/authorize?` +
        `client_id=${encodeURIComponent(apiKey)}` +
        `&scope=${encodeURIComponent(scopes)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&state=${encodeURIComponent(state)}`;

      console.log(`Shopify OAuth redirect: shop=${domain}, callback=${redirectUri}`);
      res.redirect(shopifyAuthUrl);
    } catch (err: any) {
      console.error('Shopify OAuth initiation error:', err);
      res.redirect('/stores?error=' + encodeURIComponent(err.message || 'Failed to start Shopify connection'));
    }
  });

  app.get('/api/shopify/callback', async (req, res) => {
    console.log(`Shopify OAuth callback received: code=${req.query.code ? 'present' : 'missing'}, shop=${req.query.shop || 'missing'}, state=${req.query.state ? 'present' : 'missing'}`);
    const code = req.query.code as string || '';
    const shop = req.query.shop as string || '';
    const stateParam = req.query.state as string || '';
    res.redirect(`/shopify-callback?code=${encodeURIComponent(code)}&shop=${encodeURIComponent(shop)}&state=${encodeURIComponent(stateParam)}`);
  });

  app.get('/api/tiktok/auth', isAuthenticated, (req: any, res) => {
    try {
      const storeName = req.query.storeName as string || 'My TikTok Shop';
      const userId = req.user.claims.sub;

      const appKey = process.env.TIKTOK_APP_KEY;
      if (!appKey) {
        return res.status(500).json({ message: 'TikTok App Key not configured' });
      }

      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const host = req.headers['x-forwarded-host'] || req.get('host');
      const callbackUrl = `${protocol}://${host}/api/tiktok/callback`;

      const state = Buffer.from(JSON.stringify({ userId, storeName })).toString('base64');

      const tiktokAuthUrl = `https://auth.tiktok-shops.com/oauth/authorize?` +
        `app_key=${encodeURIComponent(appKey)}` +
        `&state=${encodeURIComponent(state)}`;

      console.log(`TikTok OAuth redirect: appKey=${appKey}, callback=${callbackUrl}`);
      res.redirect(tiktokAuthUrl);
    } catch (err: any) {
      console.error('TikTok OAuth initiation error:', err);
      res.redirect('/stores?tiktok_error=' + encodeURIComponent(err.message || 'Failed to start TikTok connection'));
    }
  });

  app.get('/api/tiktok/callback', async (req, res) => {
    console.log(`TikTok OAuth callback received: code=${req.query.code ? 'present' : 'missing'}, state=${req.query.state ? 'present' : 'missing'}`);
    const code = req.query.code as string || '';
    const stateParam = req.query.state as string || '';
    res.redirect(`/tiktok-callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(stateParam)}`);
  });

  app.post('/api/ebay/refresh-token', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { storeId } = req.body;

      const store = await storage.getStore(storeId, userId);
      if (!store || store.platform !== 'ebay') {
        return res.status(404).json({ message: 'eBay store not found' });
      }

      const creds = store.credentials as any;
      if (!creds.refreshToken) {
        return res.status(400).json({ message: 'No refresh token available. Please reconnect your eBay account.' });
      }

      // Force a refresh (clear expiry) and pass the expected eBay username
      // so the helper performs the identity-mismatch check BEFORE saving the
      // new credentials. This closes the prior bug where a mismatched token
      // could be persisted before the post-check rejected it.
      const result = await refreshEbayTokenIfNeeded(
        { ...store, credentials: { ...creds, tokenExpiry: 0 } } as any,
        userId,
        { verifyIdentityFor: creds.ebayUsername || undefined },
      );
      if (!result.ok) {
        return res.status(400).json({ message: result.message });
      }

      res.json({ success: true, message: 'Token refreshed successfully' });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to refresh token' });
    }
  });

  // Protected router for API routes
  const protectedApi: Router = express.Router();
  protectedApi.use(isAuthenticated);

  // === CHANGELOG ("What's New") ===
  // Any signed-in customer can read published updates.
  protectedApi.get('/changelog', async (req: any, res) => {
    try {
      const entries = await storage.getChangelogEntries(false);
      res.json(entries);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin-only management endpoints.
  const requireChangelogAdmin = async (req: any, res: any): Promise<boolean> => {
    const user = await storage.getUser(req.user.claims.sub);
    if (user?.isAdmin !== 'true') {
      res.status(403).json({ message: 'Admin access required' });
      return false;
    }
    return true;
  };

  protectedApi.get('/admin/changelog', async (req: any, res) => {
    try {
      if (!(await requireChangelogAdmin(req, res))) return;
      const entries = await storage.getChangelogEntries(true);
      res.json(entries);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.post('/admin/changelog', async (req: any, res) => {
    try {
      if (!(await requireChangelogAdmin(req, res))) return;
      const parsed = insertChangelogEntrySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid data', errors: parsed.error.flatten() });
      }
      const created = await storage.createChangelogEntry(parsed.data);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.patch('/admin/changelog/:id', async (req: any, res) => {
    try {
      if (!(await requireChangelogAdmin(req, res))) return;
      const id = Number(req.params.id);
      const parsed = insertChangelogEntrySchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid data', errors: parsed.error.flatten() });
      }
      const updated = await storage.updateChangelogEntry(id, parsed.data);
      if (!updated) return res.status(404).json({ message: 'Entry not found' });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.delete('/admin/changelog/:id', async (req: any, res) => {
    try {
      if (!(await requireChangelogAdmin(req, res))) return;
      await storage.deleteChangelogEntry(Number(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === DASHBOARD ===
  protectedApi.get('/dashboard/stats', async (req: any, res) => {
    const userId = req.user.claims.sub;
    const storeIdsParam = req.query.storeIds as string | undefined;
    const storeIds = storeIdsParam ? storeIdsParam.split(',').map(Number).filter(Boolean) : null;
    
    const products = await storage.getProducts(userId);
    const allOrders = await storage.getOrders(userId);
    const walletData = await storage.getWallet(userId);

    const filteredOrders = storeIds
      ? allOrders.filter(o => o.storeId && storeIds.includes(o.storeId))
      : allOrders;

    const userStores = await storage.getStores(userId);
    const targetStores = storeIds
      ? userStores.filter(s => storeIds.includes(s.id))
      : userStores;
    let listingProductIds = new Set<number>();
    for (const store of targetStores) {
      const listings = await storage.getMarketplaceListings(store.id);
      listings.filter(l => l.status === 'active').forEach(l => listingProductIds.add(l.productId));
    }
    const activeListings = listingProductIds.size;
    
    const totalRevenue = filteredOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    const totalOrders = filteredOrders.length;
    const walletBalance = Number(walletData?.balance || 0);

    const isNewOrder = (o: any) => {
      if (o.status === 'cancelled' || o.status === 'refunded') return false;
      if (o.fulfillmentStatus === 'fulfilled' || o.fulfillmentStatus === 'shipped') return false;
      if (o.status === 'delivered' || o.status === 'completed') return false;
      return o.fulfillmentStatus === 'unfulfilled' || o.status === 'pending' || o.status === 'processing';
    };

    const newOrders = filteredOrders.filter(isNewOrder).length;

    const recentOrders = filteredOrders
      .filter(isNewOrder)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 5)
      .map(o => ({
        id: o.id,
        customerName: o.customerName,
        totalAmount: o.totalAmount,
        status: o.status,
        fulfillmentStatus: o.fulfillmentStatus,
        createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : null,
      }));

    res.json({
      totalRevenue,
      totalOrders,
      activeListings,
      walletBalance,
      newOrders,
      recentOrders,
    });
  });

  // === ANALYTICS ===
  protectedApi.get('/analytics', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stores = await storage.getStores(userId);
      const products = await storage.getProducts(userId);
      const orders = await storage.getOrders(userId);
      const vendors = await storage.getVendors(userId);

      const allListings: any[] = [];
      for (const store of stores) {
        const listings = await storage.getMarketplaceListings(store.id);
        allListings.push(...listings.map(l => ({ ...l, platform: store.platform })));
      }

      const platformMap: Record<string, number> = {};
      for (const listing of allListings) {
        const p = listing.platform || 'unknown';
        platformMap[p] = (platformMap[p] || 0) + 1;
      }
      const platformBreakdown = Object.entries(platformMap).map(([name, value]) => ({ name, value }));

      const now = new Date();
      const last7Days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        last7Days.push(d.toISOString().split('T')[0]);
      }

      const publishingActivity = last7Days.map(date => {
        const count = allListings.filter(l => {
          const created = l.createdAt ? new Date(l.createdAt).toISOString().split('T')[0] : null;
          return created === date;
        }).length;
        return { date: date.slice(5), count };
      });

      const vendorMap: Record<string, number> = {};
      for (const product of products) {
        const vendorName = vendors.find((v: any) => v.id === product.vendorId)?.name || 'Unknown';
        vendorMap[vendorName] = (vendorMap[vendorName] || 0) + 1;
      }
      const inventoryByVendor = Object.entries(vendorMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const revenueOverTime = last7Days.map(date => {
        const dayRevenue = orders
          .filter(o => {
            const created = o.createdAt ? new Date(o.createdAt).toISOString().split('T')[0] : null;
            return created === date;
          })
          .reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
        return { date: date.slice(5), revenue: dayRevenue };
      });

      res.json({
        totalStores: stores.length,
        totalPublished: allListings.length,
        platformBreakdown,
        publishingActivity,
        inventoryByVendor,
        revenueOverTime,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
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
      const userId = req.user.claims.sub;

      if (input.platform === 'jumia') {
        const user = await storage.getUser(userId);
        const isAdmin = user?.isAdmin === 'true';
        if (!isAdmin) {
          const flag = await storage.getFeatureFlag('jumia_marketplace');
          if (!flag || !flag.isEnabled || flag.adminOnly) {
            return res.status(403).json({ message: 'Jumia marketplace is not yet available. Stay tuned!' });
          }
        }
      }
      
      const existingStores = await storage.getStores(userId);
      const user = await storage.getUser(userId);
      const storeLimit = getStoreLimitForPlan(user?.subscriptionPlan, user?.subscriptionStatus, user?.email, user?.createdAt);
      if (existingStores.length >= storeLimit) {
        return res.status(400).json({ 
          message: `You can connect a maximum of ${storeLimit} stores on your current plan.` 
        });
      }
      
      // Enforce store email must match user's account email
      if (input.email && input.email.toLowerCase() !== userEmail?.toLowerCase()) {
        return res.status(400).json({ 
          message: 'Store email must match your account email. Please use: ' + userEmail 
        });
      }
      
      const store = await storage.createStore({ 
        ...input, 
        email: userEmail, // Always use user's account email
        userId 
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

      if (input.platform === 'jumia') {
        const user = await storage.getUser(userId);
        const isAdmin = user?.isAdmin === 'true';
        if (!isAdmin) {
          const flag = await storage.getFeatureFlag('jumia_marketplace');
          if (!flag || !flag.isEnabled || flag.adminOnly) {
            return res.status(403).json({ message: 'Jumia marketplace is not yet available. Stay tuned!' });
          }
        }
      }
      
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

  protectedApi.post('/ebay/exchange-token', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { code, state: stateParam } = req.body;

      if (!code || !stateParam) {
        return res.status(400).json({ message: 'Missing authorization code or state' });
      }

      let state: { userId: string; storeName: string; siteId: string; ebayUsername?: string; ebayEmail?: string };
      try {
        state = JSON.parse(Buffer.from(stateParam, 'base64').toString());
      } catch {
        return res.status(400).json({ message: 'Invalid state parameter' });
      }

      if (state.userId !== userId) {
        return res.status(403).json({ message: 'State mismatch - unauthorized' });
      }

      const appId = process.env.EBAY_APP_ID;
      const certId = process.env.EBAY_CERT_ID;
      if (!appId || !certId) {
        return res.status(500).json({ message: 'eBay credentials not configured' });
      }

      const ruName = process.env.EBAY_RUNAME;
      if (!ruName) {
        return res.status(500).json({ message: 'eBay RuName not configured' });
      }

      const basicAuth = Buffer.from(`${appId}:${certId}`).toString('base64');

      const tokenResponse = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${basicAuth}`,
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: ruName,
        }).toString(),
      });

      const tokenData = await tokenResponse.json() as any;

      if (!tokenResponse.ok || tokenData.error) {
        console.error('eBay token exchange error:', tokenData);
        return res.status(400).json({ message: tokenData.error_description || 'Failed to exchange authorization code' });
      }

      const ebayIdentity = await getEbayUserIdentity(tokenData.access_token);
      const actualEbayUsername = (ebayIdentity?.username || '').trim();
      const expectedEbayUsername = (state.ebayUsername || '').trim();
      console.log(`eBay OAuth identity check: expected="${expectedEbayUsername}", actual="${actualEbayUsername}"`);

      // If the GetUser identity probe failed (most commonly because eBay's per-call
      // daily quota is exhausted — error 518 — or a transient network blip) we
      // fall back to the username the seller typed into the connect form. The OAuth
      // exchange itself already proved they hold a valid eBay token, so blocking
      // them entirely just because we couldn't run a secondary identity check would
      // strand legitimate users for the rest of the day. The username they typed
      // is still recorded with the store and surfaced in the UI, so any mismatch
      // is recoverable later by editing the store.
      let resolvedUsername = actualEbayUsername;
      if (!actualEbayUsername) {
        if (expectedEbayUsername) {
          console.warn(`[eBay OAuth] Identity probe failed — falling back to user-entered username "${expectedEbayUsername}". Token is valid; storing connection.`);
          resolvedUsername = expectedEbayUsername;
        } else {
          return res.status(400).json({ 
            message: 'Could not verify your eBay account identity. Please try connecting again.' 
          });
        }
      } else if (expectedEbayUsername && actualEbayUsername.toLowerCase() !== expectedEbayUsername.toLowerCase()) {
        console.error(`eBay username mismatch: entered="${expectedEbayUsername}", actual="${actualEbayUsername}" — blocking to prevent token mix-up`);
        return res.status(400).json({ 
          message: `You signed into eBay as "@${actualEbayUsername}" but entered username "@${expectedEbayUsername}". Please log out of eBay, sign into the correct account (@${expectedEbayUsername}), and try connecting again.` 
        });
      }

      const existingStores = await storage.getStores(state.userId);

      const otherStoreWithSameAccount = existingStores.find(s => {
        if (s.platform !== 'ebay') return false;
        const storedUsername = (s.credentials as any)?.ebayUsername;
        if (!storedUsername) return false;
        return storedUsername.toLowerCase() === resolvedUsername.toLowerCase();
      });
      if (otherStoreWithSameAccount && otherStoreWithSameAccount.name !== state.storeName) {
        return res.status(400).json({ 
          message: `This eBay account (${resolvedUsername}) is already connected as "${otherStoreWithSameAccount.name}". Each store must use a different eBay account. Please log out of eBay and sign into a different account.` 
        });
      }

      const credentials = {
        authToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenExpiry: Date.now() + (tokenData.expires_in * 1000),
        refreshTokenExpiry: Date.now() + (tokenData.refresh_token_expires_in * 1000),
        siteId: state.siteId,
        ebayUsername: resolvedUsername,
        ebayEmail: state.ebayEmail || '',
      };

      const storeEmail = state.ebayEmail || (await storage.getUser(state.userId))?.email || '';

      const existingEbayStore = existingStores.find(s => 
        s.platform === 'ebay' && 
        (s.credentials as any)?.ebayUsername && 
        (s.credentials as any).ebayUsername.toLowerCase() === resolvedUsername.toLowerCase()
      );

      if (existingEbayStore) {
        await storage.updateStore(existingEbayStore.id, state.userId, {
          name: state.storeName,
          credentials,
          status: 'active',
        });
        console.log(`eBay store reconnected for user ${userId}: ${state.storeName} (actual eBay user: ${resolvedUsername}, store id: ${existingEbayStore.id})`);
      } else {
        const userForLimit = await storage.getUser(userId);
        const storeLimitForUser = getStoreLimitForPlan(userForLimit?.subscriptionPlan, userForLimit?.subscriptionStatus, userForLimit?.email, userForLimit?.createdAt);
        if (existingStores.length >= storeLimitForUser) {
          console.log(`eBay store connection blocked for user ${userId}: ${storeLimitForUser} store limit reached`);
          return res.status(400).json({ message: `You can connect a maximum of ${storeLimitForUser} stores on your current plan.` });
        }
        await storage.createStore({
          name: state.storeName,
          platform: 'ebay',
          credentials,
          status: 'active',
          userId: state.userId,
        });
        console.log(`eBay store connected for user ${userId}: ${state.storeName} (actual eBay user: ${resolvedUsername})`);
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error('eBay token exchange error:', err);
      res.status(500).json({ message: err.message || 'Connection failed' });
    }
  });

  protectedApi.post('/tiktok/exchange-token', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { code, state: stateParam } = req.body;

      if (!code || !stateParam) {
        return res.status(400).json({ message: 'Missing authorization code or state' });
      }

      let state: { userId: string; storeName: string };
      try {
        state = JSON.parse(Buffer.from(stateParam, 'base64').toString());
      } catch {
        return res.status(400).json({ message: 'Invalid state parameter' });
      }

      if (state.userId !== userId) {
        return res.status(403).json({ message: 'State mismatch - unauthorized' });
      }

      const appKey = process.env.TIKTOK_APP_KEY;
      const appSecret = process.env.TIKTOK_APP_SECRET;
      if (!appKey || !appSecret) {
        return res.status(500).json({ message: 'TikTok credentials not configured on the server' });
      }

      const tokenUrl = `https://auth.tiktok-shops.com/api/v2/token/get?app_key=${encodeURIComponent(appKey)}&app_secret=${encodeURIComponent(appSecret)}&auth_code=${encodeURIComponent(code)}&grant_type=authorized_code`;

      const tokenResp = await fetch(tokenUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const tokenData = await tokenResp.json() as any;

      if (!tokenResp.ok || tokenData.code !== 0) {
        console.error('TikTok token exchange error:', tokenData);
        return res.status(400).json({ message: tokenData.message || 'Failed to exchange TikTok authorization code' });
      }

      const accessToken = tokenData.data?.access_token;
      const refreshToken = tokenData.data?.refresh_token;
      const accessTokenExpiry = tokenData.data?.access_token_expire_in;
      const refreshTokenExpiry = tokenData.data?.refresh_token_expire_in;

      if (!accessToken) {
        return res.status(400).json({ message: 'No access token returned from TikTok' });
      }

      const { tiktokShopProvider } = await import('./marketplaces/tiktokshop');
      const connectionResult = await tiktokShopProvider.testConnection({
        appKey,
        appSecret,
        accessToken,
      });

      const shopData = (connectionResult as any).shopData;

      const credentials: any = {
        appKey,
        appSecret,
        accessToken,
        refreshToken,
        tokenExpiry: Date.now() + (accessTokenExpiry * 1000),
        refreshTokenExpiry: Date.now() + (refreshTokenExpiry * 1000),
      };

      if (shopData) {
        credentials.shopId = shopData.shopId;
        credentials.shopName = shopData.shopName;
        credentials.shopCipher = shopData.shopCipher;
      }

      const existingStores = await storage.getStores(state.userId);
      const existingTiktokStore = existingStores.find(s =>
        s.platform === 'tiktokshop' && shopData?.shopId &&
        (s.credentials as any)?.shopId === shopData.shopId
      );

      if (existingTiktokStore) {
        await storage.updateStore(existingTiktokStore.id, state.userId, {
          name: state.storeName,
          credentials,
          status: 'active',
        });
        console.log(`TikTok Shop reconnected for user ${userId}: ${state.storeName} (shop: ${shopData?.shopName || 'unknown'}, store id: ${existingTiktokStore.id})`);
      } else {
        const userForLimit = await storage.getUser(userId);
        const storeLimitForUser = getStoreLimitForPlan(userForLimit?.subscriptionPlan, userForLimit?.subscriptionStatus, userForLimit?.email, userForLimit?.createdAt);
        if (existingStores.length >= storeLimitForUser) {
          return res.status(400).json({ message: `You can connect a maximum of ${storeLimitForUser} stores on your current plan.` });
        }
        await storage.createStore({
          name: state.storeName,
          platform: 'tiktokshop',
          credentials,
          status: 'active',
          userId: state.userId,
        });
        console.log(`TikTok Shop connected for user ${userId}: ${state.storeName} (shop: ${shopData?.shopName || 'unknown'})`);
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error('TikTok token exchange error:', err);
      res.status(500).json({ message: err.message || 'TikTok connection failed' });
    }
  });

  protectedApi.post('/shopify/exchange-token', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { code, shop, state: stateParam } = req.body;

      if (!code || !stateParam) {
        return res.status(400).json({ message: 'Missing authorization code or state' });
      }

      let state: { userId: string; storeName: string; shopDomain: string };
      try {
        state = JSON.parse(Buffer.from(stateParam, 'base64').toString());
      } catch {
        return res.status(400).json({ message: 'Invalid state parameter' });
      }

      if (state.userId !== userId) {
        return res.status(403).json({ message: 'State mismatch - unauthorized' });
      }

      const apiKey = process.env.SHOPIFY_API_KEY;
      const apiSecret = process.env.SHOPIFY_API_SECRET;
      if (!apiKey || !apiSecret) {
        return res.status(500).json({ message: 'Shopify credentials not configured on the server' });
      }

      const shopDomain = shop || state.shopDomain;
      const domain = shopDomain.includes('.myshopify.com') ? shopDomain : `${shopDomain}.myshopify.com`;

      const tokenResp = await fetch(`https://${domain}/admin/oauth/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: apiKey,
          client_secret: apiSecret,
          code,
        }),
      });

      const tokenData = await tokenResp.json() as any;

      if (!tokenResp.ok || !tokenData.access_token) {
        console.error('Shopify token exchange error:', tokenData);
        return res.status(400).json({ message: tokenData.error_description || tokenData.error || 'Failed to exchange Shopify authorization code' });
      }

      const accessToken = tokenData.access_token;
      const scope = tokenData.scope;

      const shopResp = await fetch(`https://${domain}/admin/api/2024-01/shop.json`, {
        headers: { 'X-Shopify-Access-Token': accessToken },
      });
      const shopInfo = shopResp.ok ? await shopResp.json() as any : null;
      const shopName = shopInfo?.shop?.name || domain;

      const credentials = {
        shopDomain: domain,
        accessToken,
        scope,
        shopName,
      };

      const existingStores = await storage.getStores(state.userId);
      const existingShopifyStore = existingStores.find(s =>
        s.platform === 'shopify' &&
        (s.credentials as any)?.shopDomain?.replace(/\/$/, '').toLowerCase() === domain.toLowerCase()
      );

      if (existingShopifyStore) {
        await storage.updateStore(existingShopifyStore.id, state.userId, {
          name: state.storeName,
          credentials,
          status: 'active',
        });
        console.log(`Shopify store reconnected for user ${userId}: ${state.storeName} (shop: ${domain}, store id: ${existingShopifyStore.id})`);
      } else {
        const userForLimit = await storage.getUser(userId);
        const storeLimitForUser = getStoreLimitForPlan(userForLimit?.subscriptionPlan, userForLimit?.subscriptionStatus, userForLimit?.email, userForLimit?.createdAt);
        if (existingStores.length >= storeLimitForUser) {
          return res.status(400).json({ message: `You can connect a maximum of ${storeLimitForUser} stores on your current plan.` });
        }
        await storage.createStore({
          name: state.storeName,
          platform: 'shopify',
          credentials,
          status: 'active',
          userId: state.userId,
        });
        console.log(`Shopify store connected for user ${userId}: ${state.storeName} (shop: ${domain})`);
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error('Shopify token exchange error:', err);
      res.status(500).json({ message: err.message || 'Shopify connection failed' });
    }
  });

  // === eBay Order Sync ===
  async function ensureValidEbayToken(store: any, userId: string): Promise<string | null> {
    const creds = store.credentials as any;

    if (creds?.authToken && creds.tokenExpiry && Date.now() < creds.tokenExpiry - 60000) {
      return creds.authToken;
    }

    if (!creds?.refreshToken) return null;

    const appId = process.env.EBAY_APP_ID;
    const certId = process.env.EBAY_CERT_ID;
    if (!appId || !certId) return null;

    const basicAuth = Buffer.from(`${appId}:${certId}`).toString('base64');
    const tokenResponse = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: creds.refreshToken,
        scope: 'https://api.ebay.com/oauth/api_scope https://api.ebay.com/oauth/api_scope/sell.inventory https://api.ebay.com/oauth/api_scope/sell.marketing https://api.ebay.com/oauth/api_scope/sell.account https://api.ebay.com/oauth/api_scope/sell.fulfillment',
      }).toString(),
    });

    const tokenData = await tokenResponse.json() as any;
    if (!tokenResponse.ok || tokenData.error) {
      console.error(`[eBay Sync] Token refresh failed for store ${store.id}:`, tokenData.error_description);
      return null;
    }

    const newCredentials = {
      ...creds,
      authToken: tokenData.access_token,
      tokenExpiry: Date.now() + (tokenData.expires_in * 1000),
    };
    await storage.updateStore(store.id, userId, { credentials: newCredentials });
    // Mutate the in-memory store so subsequent calls in the same request
    // (e.g. reviseEbayQuantity for auto-restock) use the fresh token.
    store.credentials = newCredentials;
    return tokenData.access_token;
  }

  async function fetchEbayOrders(accessToken: string, daysBack: number = 30): Promise<any[]> {
    const allOrders: any[] = [];
    const filterDate = new Date();
    filterDate.setDate(filterDate.getDate() - daysBack);
    const isoDate = filterDate.toISOString();

    let offset = 0;
    const limit = 50;
    let hasMore = true;

    while (hasMore) {
      const url = `https://api.ebay.com/sell/fulfillment/v1/order?filter=creationdate:[${isoDate}..]&limit=${limit}&offset=${offset}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[eBay Sync] Fulfillment API error (${response.status}):`, errText);
        break;
      }

      const data = await response.json() as any;
      const ebayOrders = data.orders || [];
      allOrders.push(...ebayOrders);

      if (ebayOrders.length < limit || (data.total && offset + limit >= data.total)) {
        hasMore = false;
      } else {
        offset += limit;
      }
    }

    return allOrders;
  }

  const ebayUserSyncLocks = new Set<string>();

  protectedApi.post('/ebay/sync-orders', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      if (ebayUserSyncLocks.has(userId)) {
        return res.json({ success: true, newOrders: 0, updatedOrders: 0, revenueAdded: 0, skipped: 'Sync already in progress' });
      }

      const stores = await storage.getStores(userId);
      const ebayStores = stores.filter(s => s.platform === 'ebay' && s.status === 'active');

      if (ebayStores.length === 0) {
        return res.json({ success: true, newOrders: 0, updatedOrders: 0, revenueAdded: 0, message: 'No active eBay stores' });
      }

      ebayUserSyncLocks.add(userId);

      let totalNew = 0;
      let totalUpdated = 0;
      let totalRevenue = 0;
      const errors: string[] = [];

      for (const store of ebayStores) {
        try {
          const accessToken = await ensureValidEbayToken(store, userId);
          if (!accessToken) {
            errors.push(`Store "${store.name}": token expired or missing — please reconnect`);
            continue;
          }

          const ebayOrders = await fetchEbayOrders(accessToken);
          console.log(`[eBay Sync] Fetched ${ebayOrders.length} orders from store "${store.name}"`);

          // Collect quantity updates that need to be pushed back to eBay so
          // we can send them in batched ReviseInventoryStatus calls (max 4
          // per call) once all orders for this store have been processed.
          // Map dedupes by (itemId, sku) so two orders for the same listing
          // in this sync only produce one inventory-status entry — the last
          // computed quantity wins.
          const pendingEbayUpdates = new Map<string, { itemId: string; sku: string; quantity: number }>();

          for (const ebayOrder of ebayOrders) {
            const orderId = ebayOrder.orderId;
            const orderStatus = ebayOrder.orderFulfillmentStatus || 'NOT_STARTED';

            const pricingSummary = ebayOrder.pricingSummary || {};
            const totalStr = pricingSummary.total?.value || '0';
            const totalAmount = parseFloat(totalStr);

            const buyer = ebayOrder.buyer || {};
            const buyerName = buyer.username || '';

            const fulfillmentInstructions = ebayOrder.fulfillmentStartInstructions || [];
            const shippingStep = fulfillmentInstructions[0]?.shippingStep || {};
            const shipTo = shippingStep.shipTo || {};
            const contactAddress = shipTo.contactAddress || {};

            const shippingAddress = {
              name: shipTo.fullName || buyerName,
              addressLine1: contactAddress.addressLine1 || '',
              addressLine2: contactAddress.addressLine2 || '',
              city: contactAddress.city || '',
              stateOrProvince: contactAddress.stateOrProvince || '',
              postalCode: contactAddress.postalCode || '',
              countryCode: contactAddress.countryCode || '',
            };

            let appStatus = 'pending';
            const paymentStatus = ebayOrder.orderPaymentStatus || '';
            if (paymentStatus === 'PAID' || paymentStatus === 'FULLY_REFUNDED') {
              appStatus = 'processing';
            }
            if (orderStatus === 'FULFILLED') {
              appStatus = 'shipped';
            }
            if (ebayOrder.cancelStatus?.cancelState === 'CANCELED') {
              appStatus = 'cancelled';
            }

            const lineItemDeliveries = (ebayOrder.lineItems || []).map((li: any) => li.deliveryCost?.shippingServiceCode || '');
            const isDelivered = (ebayOrder.lineItems || []).every((li: any) => {
              const status = (li.deliveredDate || li.properties?.deliveredDate) ? true : false;
              return status;
            });
            const hasDeliveryConfirmation = orderStatus === 'FULFILLED' && (
              isDelivered ||
              (ebayOrder.fulfillmentHrefs && ebayOrder.fulfillmentHrefs.length > 0 &&
               (ebayOrder.lineItems || []).some((li: any) => li.properties?.buyerProtection?.status === 'ACTIVE'))
            );

            if (hasDeliveryConfirmation && appStatus === 'shipped') {
              appStatus = 'delivered';
            }

            let fulfillmentStatus = 'unfulfilled';
            if (orderStatus === 'FULFILLED') fulfillmentStatus = 'fulfilled';
            else if (orderStatus === 'IN_PROGRESS') fulfillmentStatus = 'in_progress';

            const ebayLineItems = (ebayOrder.lineItems || []).map((li: any) => ({
              sku: li.sku || '',
              title: li.title || '',
              quantity: li.quantity || 1,
              lineItemId: li.lineItemId || '',
              price: li.total?.value || li.lineItemCost?.value || '0',
              variationAspects: li.variationAspects || [],
              imageUrl: li.image?.imageUrl || '',
            }));

            const existingOrder = await storage.getOrderByExternalId(orderId, userId);
            if (existingOrder) {
              const statusChanged = existingOrder.status !== appStatus || existingOrder.fulfillmentStatus !== fulfillmentStatus;
              const existingLineItems = (existingOrder as any).lineItems || [];
              const hasNewVariationData = ebayLineItems.some((li: any) => li.variationAspects?.length > 0) && !existingLineItems.some((li: any) => li.variationAspects?.length > 0);
              const needsLineItemUpdate = (ebayLineItems.length > 0 && existingLineItems.length === 0) || hasNewVariationData;
              if (statusChanged || needsLineItemUpdate) {
                const wasPendingNowPaid = existingOrder.status === 'pending' && (appStatus === 'processing' || appStatus === 'shipped');
                await storage.updateOrder(existingOrder.id, userId, {
                  status: appStatus,
                  fulfillmentStatus,
                  totalAmount: String(totalAmount),
                  lineItems: ebayLineItems.length > 0 ? ebayLineItems : undefined,
                });
                totalUpdated++;
                if (wasPendingNowPaid && paymentStatus === 'PAID' && totalAmount > 0) {
                  totalRevenue += totalAmount;
                }
              }

              for (const li of ebayLineItems) {
                if (li.sku) {
                  try {
                    const existingMapping = await storage.getSkuMappingByEbaySku(userId, li.sku);
                    if (!existingMapping) {
                      const product = await storage.getProductBySku(userId, li.sku);
                      if (product) {
                        const attrs = (product.attributes || {}) as Record<string, any>;
                        const vendorName = product.vendorName || 'Unknown';
                        const sourceUrl = attrs.sourceUrl || '';
                        await storage.createSkuMapping({
                          userId,
                          ebaySku: li.sku,
                          vendorId: product.vendorId,
                          vendorSku: product.sku,
                          vendorProductUrl: sourceUrl,
                          vendorName,
                          costPrice: String(product.costPrice),
                          ebayTitle: li.title || undefined,
                          ebayPrice: li.price || undefined,
                          isActive: true,
                        });
                        console.log(`[Auto-SKU] Created mapping for existing order: eBay SKU ${li.sku} → ${vendorName}`);
                      } else {
                        await storage.createSkuMapping({
                          userId,
                          ebaySku: li.sku,
                          vendorSku: '',
                          vendorName: '',
                          ebayTitle: li.title || undefined,
                          ebayPrice: li.price || undefined,
                          isActive: true,
                        });
                        console.log(`[Auto-SKU] Created placeholder mapping for external SKU ${li.sku}: "${li.title}"`);
                      }
                    } else if (!existingMapping.ebayTitle && li.title) {
                      await storage.updateSkuMapping(existingMapping.id, userId, {
                        ebayTitle: li.title,
                        ebayPrice: li.price || undefined,
                      });
                    }
                  } catch (mapErr: any) {
                    console.error(`[Auto-SKU] Error creating mapping for SKU ${li.sku}:`, mapErr.message);
                  }
                }
              }
            } else {
              await storage.createOrder({
                userId,
                storeId: store.id,
                externalOrderId: orderId,
                customerName: shippingAddress.name || buyerName,
                customerEmail: buyer.buyerRegistrationAddress?.email || '',
                shippingAddress,
                lineItems: ebayLineItems.length > 0 ? ebayLineItems : undefined,
                totalAmount: String(totalAmount),
                status: appStatus,
                fulfillmentStatus,
              });
              totalNew++;

              if (paymentStatus === 'PAID' && totalAmount > 0) {
                totalRevenue += totalAmount;
              }

              // Buffer level for the auto-restock loop. Anything > 1 stops
              // the listing flapping back to "Out of stock" the moment a
              // second order comes in. 10 covers a healthy burst between
              // sync windows; the safety-net scheduler will top up if it
              // ever drops low.
              // The user can override this on Dashboard → Store Rules; if
              // they haven't enabled the rule we fall back to the safe default.
              const ruleUser = await storage.getUser(userId);
              const RESTOCK_BUFFER = (ruleUser?.autoRestockEnabled && ruleUser.autoRestockBuffer && ruleUser.autoRestockBuffer > 0)
                ? ruleUser.autoRestockBuffer
                : 10;

              for (const li of ebayLineItems) {
                if (li.sku) {
                  try {
                    const product = await storage.getProductBySku(userId, li.sku);
                    if (product) {
                      const soldQty = li.quantity || 1;
                      const currentQty = product.quantity || 0;
                      const newQty = Math.max(0, currentQty - soldQty);
                      const finalQty = newQty === 0 ? RESTOCK_BUFFER : newQty;

                      await storage.updateProduct(product.id, userId, { quantity: finalQty });
                      if (newQty === 0) {
                        console.log(`[Auto-Restock] Product "${product.title}" (SKU: ${li.sku}) sold out → restocked to ${RESTOCK_BUFFER}`);
                      } else {
                        console.log(`[Stock Update] Product "${product.title}" (SKU: ${li.sku}): ${currentQty} → ${finalQty}`);
                      }

                      // When the listing has just hit zero on eBay, eBay has
                      // hidden it as "Out of stock — Listing is hidden until
                      // restocked". We MUST push the new quantity back so the
                      // listing becomes visible again. Also fire when the
                      // listing is running low so users don't get stuck at 1.
                      if (newQty === 0 || newQty < 3) {
                        try {
                          const listings = await storage.getMarketplaceListings(store.id);
                          const match = listings.find((l: any) => l.productId === product.id && l.externalId);
                          if (match?.externalId) {
                            const key = `${match.externalId}::${li.sku}`;
                            pendingEbayUpdates.set(key, { itemId: match.externalId, sku: li.sku, quantity: finalQty });
                          } else {
                            console.warn(`[Auto-Restock] No marketplace_listing row found for product ${product.id} on store "${store.name}" — local qty restocked to ${finalQty} but cannot push to eBay.`);
                          }
                        } catch (lookupErr: any) {
                          console.error(`[Auto-Restock] Listing lookup failed for product ${product.id}:`, lookupErr?.message || lookupErr);
                        }
                      }

                      const existingMapping = await storage.getSkuMappingByEbaySku(userId, li.sku);
                      if (!existingMapping) {
                        const attrs = (product.attributes || {}) as Record<string, any>;
                        const vendorName = product.vendorName || 'Unknown';
                        const sourceUrl = attrs.sourceUrl || '';
                        await storage.createSkuMapping({
                          userId,
                          ebaySku: li.sku,
                          vendorId: product.vendorId,
                          vendorSku: product.sku,
                          vendorProductUrl: sourceUrl,
                          vendorName,
                          costPrice: String(product.costPrice),
                          ebayTitle: li.title || undefined,
                          ebayPrice: li.price || undefined,
                          isActive: true,
                        });
                        console.log(`[Auto-SKU] Created mapping: eBay SKU ${li.sku} → ${vendorName} (${product.sku})`);
                      } else if (!existingMapping.ebayTitle && li.title) {
                        await storage.updateSkuMapping(existingMapping.id, userId, {
                          ebayTitle: li.title,
                          ebayPrice: li.price || undefined,
                        });
                      }
                    } else {
                      const existingMapping = await storage.getSkuMappingByEbaySku(userId, li.sku);
                      if (!existingMapping) {
                        await storage.createSkuMapping({
                          userId,
                          ebaySku: li.sku,
                          vendorSku: '',
                          vendorName: '',
                          ebayTitle: li.title || undefined,
                          ebayPrice: li.price || undefined,
                          isActive: true,
                        });
                        console.log(`[Auto-SKU] Created placeholder mapping for new order SKU ${li.sku}: "${li.title}"`);
                      } else if (!existingMapping.ebayTitle && li.title) {
                        await storage.updateSkuMapping(existingMapping.id, userId, {
                          ebayTitle: li.title,
                          ebayPrice: li.price || undefined,
                        });
                      }
                    }
                  } catch (mapErr: any) {
                    console.error(`[Auto-SKU] Error processing SKU ${li.sku}:`, mapErr.message);
                  }
                }
              }
            }
          }

          // Push collected restock quantities back to the live eBay listings
          // so listings that just hit zero (and were therefore hidden as
          // "Out of stock — Listing is hidden until restocked") become
          // visible to buyers again. Batched in chunks of 4 inside the
          // helper. Each listing's syncStatus is marked so the safety-net
          // sweep can retry the failures even though local DB qty is now
          // back at the buffer.
          if (pendingEbayUpdates.size > 0) {
            const updates = Array.from(pendingEbayUpdates.values());
            try {
              const { reviseEbayQuantity } = await import('./marketplaces/ebay');
              const result = await reviseEbayQuantity(store.credentials, updates);
              const failedItemIds = new Set(result.failed.map((f) => f.itemId));
              const successCount = updates.length - failedItemIds.size;
              if (successCount > 0) {
                console.log(`[Auto-Restock] Pushed quantity to eBay for ${successCount} listing(s) on store "${store.name}"`);
              }
              try {
                const allListings = await storage.getMarketplaceListings(store.id);
                for (const u of updates) {
                  const listing = allListings.find((l: any) => l.externalId === u.itemId);
                  if (!listing) continue;
                  const newStatus = failedItemIds.has(u.itemId) ? 'error' : 'synced';
                  await storage.updateMarketplaceListing(listing.id, { syncStatus: newStatus, lastSync: new Date() } as any);
                }
              } catch {}
              for (const f of result.failed) {
                console.error(`[Auto-Restock] eBay rejected restock for item ${f.itemId}: ${f.error}`);
              }
            } catch (revErr: any) {
              console.error(`[Auto-Restock] Failed to push restock to eBay for store "${store.name}":`, revErr?.message || revErr);
              try {
                const allListings = await storage.getMarketplaceListings(store.id);
                for (const u of updates) {
                  const listing = allListings.find((l: any) => l.externalId === u.itemId);
                  if (listing) {
                    await storage.updateMarketplaceListing(listing.id, { syncStatus: 'error', lastSync: new Date() } as any);
                  }
                }
              } catch {}
            }
          }
        } catch (storeErr: any) {
          console.error(`[eBay Sync] Error syncing store "${store.name}":`, storeErr.message);
          errors.push(`Store "${store.name}": ${storeErr.message}`);
        }
      }

      if (totalRevenue > 0) {
        try {
          let userWallet = await storage.getWallet(userId);
          if (!userWallet) {
            userWallet = await storage.createWallet(userId);
          }
          await storage.updateWalletBalance(userWallet.id, totalRevenue);
          await storage.createTransaction({
            walletId: userWallet.id,
            type: 'deposit',
            amount: String(totalRevenue.toFixed(2)),
            description: `eBay sales revenue (${totalNew} new order${totalNew !== 1 ? 's' : ''})`,
            status: 'completed',
          });
          console.log(`[eBay Sync] Credited £${totalRevenue.toFixed(2)} to wallet for ${totalNew} new orders`);
        } catch (walletErr: any) {
          console.error(`[eBay Sync] Wallet credit error:`, walletErr.message);
          errors.push(`Wallet update failed: ${walletErr.message}`);
        }
      }

      ebayUserSyncLocks.delete(userId);
      res.json({
        success: true,
        newOrders: totalNew,
        updatedOrders: totalUpdated,
        revenueAdded: totalRevenue,
        errors: errors.length ? errors : undefined,
      });
    } catch (err: any) {
      const userId = req.user?.claims?.sub;
      if (userId) ebayUserSyncLocks.delete(userId);
      console.error('[eBay Sync] Error:', err.message);
      res.status(500).json({ message: err.message || 'Failed to sync eBay orders' });
    }
  });

  protectedApi.delete('/stores/:id', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = Number(req.params.id);
      await storage.deleteStore(id, userId);
      res.status(204).send();
    } catch (err: any) {
      console.error(`Failed to delete store ${req.params.id}:`, err.message);
      res.status(500).json({ message: err.message || 'Failed to disconnect store' });
    }
  });

  protectedApi.post('/stores/:id/test-connection', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = Number(req.params.id);
      const store = await storage.getStore(id, userId);
      if (!store) {
        return res.status(404).json({ message: 'Store not found' });
      }

      let credentials = store.credentials as any;

      if (store.platform === 'ebay') {
        console.log(`eBay test-connection store ${id}: hasAuthToken=${!!credentials?.authToken}, hasRefreshToken=${!!credentials?.refreshToken}, tokenExpiry=${credentials?.tokenExpiry}, credKeys=${Object.keys(credentials || {}).join(',')}`);
        
        if (credentials?.refreshToken) {
          const now = Date.now();
          const tokenExpired = !credentials.authToken || !credentials.tokenExpiry || now >= credentials.tokenExpiry;
          if (tokenExpired) {
            try {
              const appId = process.env.EBAY_APP_ID;
              const certId = process.env.EBAY_CERT_ID;
              if (appId && certId) {
                const basicAuth = Buffer.from(`${appId}:${certId}`).toString('base64');
                const tokenResponse = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${basicAuth}`,
                  },
                  body: new URLSearchParams({
                    grant_type: 'refresh_token',
                    refresh_token: credentials.refreshToken,
                    scope: 'https://api.ebay.com/oauth/api_scope https://api.ebay.com/oauth/api_scope/sell.inventory https://api.ebay.com/oauth/api_scope/sell.marketing https://api.ebay.com/oauth/api_scope/sell.account https://api.ebay.com/oauth/api_scope/sell.fulfillment',
                  }).toString(),
                });
                const tokenData = await tokenResponse.json() as any;
                if (tokenResponse.ok && tokenData.access_token) {
                  const refreshedCreds = {
                    ...credentials,
                    authToken: tokenData.access_token,
                    tokenExpiry: Date.now() + (tokenData.expires_in * 1000),
                  };

                  if (credentials.ebayUsername) {
                    try {
                      const identity = await getEbayUserIdentity(refreshedCreds.authToken);
                      if (identity && identity.username && identity.username.toLowerCase() !== credentials.ebayUsername.toLowerCase()) {
                        console.error(`eBay token refresh mismatch for store ${id}: token="${identity.username}", expected="${credentials.ebayUsername}"`);
                        return res.json({ success: false, status: 'invalid', message: `Account mismatch: refreshed token belongs to "@${identity.username}" instead of "@${credentials.ebayUsername}". Please disconnect and reconnect this store.` });
                      }
                    } catch (identityErr: any) {
                      console.log(`eBay identity check skipped during test-connection refresh for store ${id}: ${identityErr.message}`);
                    }
                  }

                  credentials = refreshedCreds;
                  await storage.updateStore(id, userId, { credentials });
                  console.log(`eBay token refreshed for store ${id}`);
                } else {
                  console.error('eBay token refresh failed:', tokenData.error_description || tokenData.error || 'Unknown error');
                  return res.json({ success: false, status: 'invalid', message: 'eBay access token expired. Please reconnect your eBay account from the edit menu.' });
                }
              }
            } catch (refreshErr: any) {
              console.error('eBay token refresh error during test:', refreshErr.message);
              return res.json({ success: false, status: 'invalid', message: 'Failed to refresh eBay token. Please reconnect your eBay account.' });
            }
          }
        } else if (!credentials?.authToken) {
          return res.json({ success: false, status: 'not_connected', message: 'eBay account not connected. Please click the edit button on this store and connect your eBay account via OAuth.' });
        }
      }

      if (store.platform === 'ebay' && credentials?.authToken) {
        try {
          const identity = await getEbayUserIdentity(credentials.authToken);
          if (identity && identity.username) {
            if (credentials.ebayUsername && identity.username.toLowerCase() !== credentials.ebayUsername.toLowerCase()) {
              console.error(`eBay identity mismatch on test-connection for store ${id}: token="${identity.username}", expected="${credentials.ebayUsername}"`);
              return res.json({ 
                success: false, 
                status: 'invalid', 
                message: `Account mismatch: This store's token belongs to eBay account "@${identity.username}" but should be "@${credentials.ebayUsername}". Please disconnect and reconnect this store.` 
              });
            }
            if (!credentials.ebayUsername) {
              credentials = { ...credentials, ebayUsername: identity.username };
              await storage.updateStore(id, userId, { credentials });
              console.log(`Auto-set ebayUsername for store ${id} to "${identity.username}" during test-connection`);
            }
          }
        } catch (identityErr: any) {
          console.log(`eBay identity check skipped for store ${id}: ${identityErr.message}`);
        }
      }

      const result = await testMarketplaceConnection(store.platform, credentials);
      if (result.success || result.status === 'connected') {
        await storage.updateStore(id, userId, { status: 'active' });
        if (store.platform === 'tiktokshop' && (result as any).shopData) {
          const shopData = (result as any).shopData;
          const updatedCreds = { ...credentials, shopId: shopData.shopId, shopName: shopData.shopName, shopCipher: shopData.shopCipher };
          await storage.updateStore(id, userId, { credentials: updatedCreds });
        }
      }
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, status: 'invalid', message: err.message || 'Connection test failed' });
    }
  });

  protectedApi.get('/stores/:id/listings', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const storeId = Number(req.params.id);
      const store = await storage.getStore(storeId, userId);
      if (!store) {
        return res.status(404).json({ message: 'Store not found' });
      }
      const listings = await storage.getMarketplaceListings(storeId);
      res.json(listings);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.get('/marketplace-listings', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stores = await storage.getStores(userId);
      const allListings: any[] = [];
      for (const store of stores) {
        const listings = await storage.getMarketplaceListings(store.id);

        if (store.platform === 'ebay' && store.status === 'active') {
          const activeListings = listings.filter((l: any) => l.externalId && l.status === 'active');
          if (activeListings.length > 0) {
            try {
              const accessToken = await ensureValidEbayToken(store, userId);
              if (accessToken) {
                const { getEbayItemStatuses } = await import('./marketplaces/ebay');
                const itemIds = activeListings.map((l: any) => l.externalId!);
                const statuses = await getEbayItemStatuses({ authToken: accessToken }, itemIds);

                const removedIds = new Set<number>();
                for (const listing of activeListings) {
                  const ebayStatus = statuses.get(listing.externalId!);
                  if (!ebayStatus) continue;
                  const shouldRemove = !ebayStatus.exists || ebayStatus.status === 'Ended' || ebayStatus.status === 'Completed';
                  if (shouldRemove) {
                    await storage.deleteMarketplaceListing(listing.id);
                    removedIds.add(listing.id);
                    console.log(`[eBay Sync] Removed listing ${listing.externalId} (${ebayStatus.status}) from store "${store.name}"`);
                  }
                }
                const remainingListings = listings.filter((l: any) => !removedIds.has(l.id));
                allListings.push(...remainingListings.map((l: any) => ({ ...l, storeName: store.name, platform: store.platform })));
                continue;
              }
            } catch (syncErr: any) {
              console.warn(`[eBay Sync] Could not verify listing statuses for store "${store.name}":`, syncErr.message);
            }
          }
        }

        allListings.push(...listings.map((l: any) => ({ ...l, storeName: store.name, platform: store.platform })));
      }
      res.json(allListings);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
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
  // Inline base64 image data URLs (uploaded via /products/upload-image) are
  // ~150–400 KB each. When a product accumulates many variation images they
  // can balloon a single row past 20 MB and the whole inventory list past
  // Cloud Run's response limits — the browser then shows "Failed to fetch
  // products" even though the server returned 200. Strip large data URLs
  // from the list response only; the per-product GET still returns the
  // full payload so editing keeps working.
  const LIST_INLINE_IMAGE_MAX_BYTES = 4_000;

  function trimInlineImages(arr: unknown): unknown {
    if (!Array.isArray(arr)) return arr;
    return arr.map((u: any) =>
      typeof u === 'string' && u.startsWith('data:') && u.length > LIST_INLINE_IMAGE_MAX_BYTES
        ? ''
        : u,
    );
  }

  // The Inventory table never renders the product description (it's only
  // shown in the per-product edit dialog, which fetches GET /api/products/:id
  // and gets the full payload). Stripping descriptions from the list keeps
  // the response small and predictable — vendor-scraped HTML can balloon to
  // tens of KB per row and was the suspected cause of intermittent
  // "Failed to fetch products" errors on accounts with many listings.
  const LIST_DESCRIPTION_MAX_BYTES = 400;
  function compactProductForList(p: any): any {
    if (!p || typeof p !== 'object') return p;
    const out: any = { ...p, images: trimInlineImages(p.images) };
    if (typeof p.description === 'string' && p.description.length > LIST_DESCRIPTION_MAX_BYTES) {
      out.description = p.description.slice(0, LIST_DESCRIPTION_MAX_BYTES);
      out.descriptionTruncated = true;
    }
    if (p.attributes && typeof p.attributes === 'object' && !Array.isArray(p.attributes)) {
      const attrs: any = { ...(p.attributes as Record<string, any>) };
      if (Array.isArray(attrs.variations)) {
        attrs.variations = attrs.variations.map((v: any) => {
          if (!v || typeof v !== 'object') return v;
          const trimmed = trimInlineImages(v.images);
          const originalCount = Array.isArray(v.images) ? v.images.length : 0;
          const remainingCount = Array.isArray(trimmed) ? trimmed.filter((u: any) => u).length : 0;
          return {
            ...v,
            images: trimmed,
            ...(originalCount !== remainingCount ? { hasInlineImages: true, inlineImageCount: originalCount } : {}),
          };
        });
      }
      out.attributes = attrs;
    }
    return out;
  }

  protectedApi.get('/products', async (req: any, res) => {
    const userId = await resolveInventoryOwnerId(req.user.claims.sub);
    try {
      let productsList = await storage.getProducts(userId);

      const search = (req.query.search || '').trim().toLowerCase();
      if (search) {
        productsList = productsList.filter((p: any) => {
          const title = (p.title || '').toLowerCase();
          const sku = (p.sku || '').toLowerCase();
          const description = (p.description || '').toLowerCase();
          return title.includes(search) || sku.includes(search) || description.includes(search);
        });
      }

      const compactList = productsList.map(compactProductForList);
      res.json({ items: compactList, total: compactList.length });
    } catch (err: any) {
      console.error(`[GET /api/products] user=${userId} failed:`, err?.stack || err?.message || err);
      res.status(500).json({ message: 'Failed to load products', code: 'products_list_failed' });
    }
  });

  protectedApi.get('/products/:id', async (req: any, res) => {
    const userId = await resolveInventoryOwnerId(req.user.claims.sub);
    const id = Number(req.params.id);
    const product = await storage.getProduct(id, userId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  });

  async function autoCreateSkuMapping(userId: string, product: any) {
    try {
      if (!product.sku) return;
      const normalizedSku = product.sku.trim();
      if (!normalizedSku) return;

      const existingMappings = await storage.getSkuMappings(userId);
      const activeMatch = existingMappings.find((m: any) => m.ebaySku?.trim() === normalizedSku && m.isActive);
      if (activeMatch) return;

      const inactiveMatch = existingMappings.find((m: any) => m.ebaySku?.trim() === normalizedSku && !m.isActive);
      const attrs = (product.attributes || {}) as Record<string, any>;
      const vendorName = attrs.vendorName || (product as any).vendorName || 'Unknown';
      const sourceUrl = attrs.sourceUrl || '';

      if (inactiveMatch) {
        await storage.updateSkuMapping(inactiveMatch.id, userId, {
          isActive: true,
          vendorProductUrl: sourceUrl || inactiveMatch.vendorProductUrl,
          vendorName: vendorName !== 'Unknown' ? vendorName : inactiveMatch.vendorName,
          costPrice: product.costPrice ? String(product.costPrice) : inactiveMatch.costPrice,
        });
        console.log(`[Auto-SKU] Reactivated mapping for SKU: ${normalizedSku}`);
      } else {
        await storage.createSkuMapping({
          userId,
          ebaySku: normalizedSku,
          vendorId: product.vendorId,
          vendorSku: normalizedSku,
          vendorProductUrl: sourceUrl,
          vendorName,
          costPrice: product.costPrice ? String(product.costPrice) : undefined,
          isActive: true,
        });
        console.log(`[Auto-SKU] Created mapping for SKU: ${normalizedSku} (vendor: ${vendorName})`);
      }
    } catch (err: any) {
      console.error(`[Auto-SKU] Failed for SKU ${product.sku}:`, err.message);
    }
  }

  protectedApi.post('/products', async (req: any, res) => {
    try {
      const userId = await resolveInventoryOwnerId(req.user.claims.sub);
      const body = { ...req.body };
      delete body.veroOverride; delete body.veroOverrideBy; delete body.veroOverrideReason;
      if (body.costPrice !== undefined) body.costPrice = String(body.costPrice);
      if (body.sellingPrice !== undefined) body.sellingPrice = String(body.sellingPrice);
      if (body.deliveryCost !== undefined) body.deliveryCost = String(body.deliveryCost);
      const input = api.products.create.input.parse(body);
      
      const sanitized = await storage.sanitizeVeroContent(userId, input.title, input.description || '', input.brand || '');
      input.title = sanitized.title;
      if (input.description !== undefined) input.description = sanitized.description;
      input.brand = sanitized.brand;
      
      const brandCheck = await storage.checkVeroBrand(userId, input.brand || '', undefined);
      const restrictedCheck = await storage.checkRestrictedViolations(userId, input.title, input.description || '');
      
      let veroStatus = 'clean';
      const warnings: string[] = [];
      
      if (sanitized.removedFromTitle || sanitized.removedFromDescription) {
        warnings.push(`VeRO brand "${sanitized.detectedBrand}" auto-removed from ${sanitized.removedFromTitle ? 'title' : ''}${sanitized.removedFromTitle && sanitized.removedFromDescription ? ' and ' : ''}${sanitized.removedFromDescription ? 'description' : ''}`);
      }
      if (sanitized.detectedBrand && !body.brand) {
        warnings.push(`Brand auto-set to "${sanitized.brand}"`);
      }
      
      if (brandCheck.isBlocked) {
        veroStatus = 'blocked';
        warnings.push(`VERO Brand: ${brandCheck.matchedBrand} (${brandCheck.matchMethod} match)`);
      }
      if (restrictedCheck.isBlocked) {
        veroStatus = 'blocked';
        warnings.push(`Restricted: ${restrictedCheck.violations.map(v => v.keyword).join(', ')}`);
      }
      
      const product = await storage.createProduct({ ...input, userId, veroStatus });
      await autoCreateSkuMapping(userId, product);
      res.status(201).json({ ...product, veroWarnings: warnings.length > 0 ? warnings : undefined });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  protectedApi.post('/products/upload-image', upload.single('image'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No image file uploaded' });
      }

      const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedMimes.includes(req.file.mimetype)) {
        return res.status(400).json({ message: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP' });
      }

      if (req.file.size > 5 * 1024 * 1024) {
        return res.status(400).json({ message: 'File too large. Maximum size is 5MB' });
      }

      const magicBytes: Record<string, number[][]> = {
        'image/jpeg': [[0xFF, 0xD8, 0xFF]],
        'image/png': [[0x89, 0x50, 0x4E, 0x47]],
        'image/gif': [[0x47, 0x49, 0x46, 0x38]],
        'image/webp': [[0x52, 0x49, 0x46, 0x46]],
      };
      const buf = req.file.buffer;
      const expectedSigs = magicBytes[req.file.mimetype];
      if (expectedSigs) {
        const valid = expectedSigs.some(sig => sig.every((byte, i) => buf[i] === byte));
        if (!valid) {
          return res.status(400).json({ message: 'File content does not match declared type' });
        }
      }

      // Resize/normalise to eBay specs (longest side 500–1600 px, JPEG, white
      // background flatten) BEFORE returning a data URL. This serves three goals:
      //   1. Variation/gallery images are always inside eBay's accepted size range
      //      so publishing never fails on tiny swatches or oversize photos.
      //   2. The returned data URL is small enough to round-trip through the JSON
      //      product update endpoint without hitting body-size limits — this was
      //      the cause of the "request entity too large" error on Save Changes.
      //   3. Stored payload size in the DB stays bounded (~150–400 KB per image).
      let outBuf: Buffer = buf;
      let outMime = req.file.mimetype;
      try {
        const sharp = (await import('sharp')).default;
        const img = sharp(buf, { failOn: 'none' }).rotate();
        const meta = await img.metadata();
        const w = meta.width || 0;
        const h = meta.height || 0;
        if (w && h) {
          const longest = Math.max(w, h);
          const MIN = 500, TARGET = 1600;
          let target: number;
          if (longest < MIN) target = MIN;            // upscale tiny variation swatches
          else if (longest > TARGET) target = TARGET; // downscale large photos
          else target = longest;

          const resizeOpts = {
            width: w >= h ? target : undefined,
            height: h > w ? target : undefined,
            fit: 'inside' as const,
            withoutEnlargement: false,
            kernel: 'lanczos3' as const,
          };

          // First pass: high-quality JPEG with white background.
          let resized = await sharp(buf, { failOn: 'none' })
            .rotate()
            .resize(resizeOpts)
            .flatten({ background: { r: 255, g: 255, b: 255 } })
            .jpeg({ quality: 88, progressive: true, mozjpeg: true })
            .toBuffer();
          // Cap at 600 KB so the resulting base64 data URL stays under ~820 KB.
          // With up to 9 gallery images plus per-variation images, this keeps
          // the JSON body of a Save Changes PUT well under the 50 MB body
          // parser limit; 2 MB caps were producing ~24 MB bodies that the
          // server rejected with 413, which made the gallery appear to "lose"
          // its pictures after saving (optimistic rollback).
          const CAP = 600 * 1024;
          if (resized.length > CAP) {
            for (const q of [78, 70, 62, 55, 48]) {
              resized = await sharp(buf, { failOn: 'none' })
                .rotate()
                .resize(resizeOpts)
                .flatten({ background: { r: 255, g: 255, b: 255 } })
                .jpeg({ quality: q, progressive: true, mozjpeg: true })
                .toBuffer();
              if (resized.length <= CAP) break;
            }
          }
          outBuf = resized;
          outMime = 'image/jpeg';
        }
      } catch (resizeErr: any) {
        console.warn(`[upload-image] Resize failed, using original: ${resizeErr.message}`);
      }

      const base64 = outBuf.toString('base64');
      const dataUrl = `data:${outMime};base64,${base64}`;

      res.json({ url: dataUrl });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Image upload failed' });
    }
  });

  // AI-optimise a product description for eBay. Uses the product's title,
  // brand, attributes/specs and any existing description as context, and
  // returns a clean semantic-HTML body suitable for the eBay <Description>.
  protectedApi.post('/products/:id/ai-optimize-description', async (req: any, res) => {
    try {
      const userId = await resolveInventoryOwnerId(req.user.claims.sub);
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: 'Invalid product id' });
      const product = await storage.getProduct(id, userId);
      if (!product) return res.status(404).json({ message: 'Product not found' });

      const overrideTitle = typeof req.body?.title === 'string' && req.body.title.trim() ? req.body.title.trim() : undefined;
      const overrideDescription = typeof req.body?.description === 'string' ? req.body.description : undefined;
      const overrideBrand = typeof req.body?.brand === 'string' && req.body.brand.trim() ? req.body.brand.trim() : undefined;

      const aiInput = {
        title: overrideTitle || product.title,
        description: overrideDescription !== undefined ? overrideDescription : (product.description || ''),
        brand: overrideBrand || (product as any).brand || '',
        attributes: (product as any).attributes || {},
        categoryName: (product as any).categoryName || undefined,
      };

      // Run description + item-specifics extraction in parallel — same source data.
      const [html, specifics] = await Promise.all([
        generateAIDescription(aiInput),
        generateAIItemSpecifics(aiInput),
      ]);

      if (!html) {
        return res.status(503).json({ message: 'AI optimisation is unavailable right now. Please try again in a moment.' });
      }

      // VeRO safety: ensure the AI-extracted Brand specific (and any brand
      // backfill) is replaced with "Unbranded" when it matches the VeRO list,
      // so a flagged brand never reaches eBay's Item Specifics.
      const safeSpecifics = (await sanitizeItemSpecificsBrand(userId, specifics || null, id, 'ebay')) || null;

      // Persist item specifics immediately so they flow into the next eBay
      // publish without the user needing to re-save the product.
      if (safeSpecifics && Object.keys(safeSpecifics).length > 0) {
        try {
          const currentAttrs = ((product as any).attributes || {}) as Record<string, any>;
          const nextAttrs = { ...currentAttrs, itemSpecifics: safeSpecifics };
          const updates: any = { attributes: nextAttrs };
          // Backfill brand from AI if the product has none and AI extracted one
          // — but only after a VeRO-safety pass.
          if (!((product as any).brand || '').trim() && typeof safeSpecifics['Brand'] === 'string' && safeSpecifics['Brand'].trim()) {
            updates.brand = await veroSafeBrand(userId, safeSpecifics['Brand'], id, 'ebay');
          }
          await storage.updateProduct(id, userId, updates);
        } catch (saveErr: any) {
          console.warn('[ai-optimize-description] could not persist itemSpecifics:', saveErr?.message);
        }
      }

      res.json({ description: html, itemSpecifics: safeSpecifics });
    } catch (err: any) {
      console.error('[ai-optimize-description] error:', err);
      res.status(500).json({ message: err.message || 'AI optimisation failed' });
    }
  });

  // AI-optimise the product title for eBay search discoverability. Persists the
  // new title to the product so it flows into the next publish/sync.
  protectedApi.post('/products/:id/ai-optimize-title', async (req: any, res) => {
    try {
      const userId = await resolveInventoryOwnerId(req.user.claims.sub);
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: 'Invalid product id' });
      const product = await storage.getProduct(id, userId);
      if (!product) return res.status(404).json({ message: 'Product not found' });

      const overrideTitle = typeof req.body?.title === 'string' && req.body.title.trim() ? req.body.title.trim() : undefined;
      const overrideDescription = typeof req.body?.description === 'string' ? req.body.description : undefined;
      const overrideBrand = typeof req.body?.brand === 'string' && req.body.brand.trim() ? req.body.brand.trim() : undefined;

      const newTitle = await generateAITitle({
        title: overrideTitle || product.title,
        description: overrideDescription !== undefined ? overrideDescription : (product.description || ''),
        brand: overrideBrand || (product as any).brand || '',
        attributes: (product as any).attributes || {},
        categoryName: (product as any).categoryName || undefined,
      });

      if (!newTitle) {
        return res.status(503).json({ message: 'AI title optimisation is unavailable right now. Please try again in a moment.' });
      }

      // VeRO safety: strip any flagged brand the AI may have re-inserted into
      // the title so the new title cannot trigger a policy strike when published.
      const sanitizedTitleResult = await storage.sanitizeVeroContent(userId, newTitle, '', '');
      const safeTitle = sanitizedTitleResult.title || newTitle;

      try { await storage.updateProduct(id, userId, { title: safeTitle } as any); }
      catch (saveErr: any) {
        console.warn('[ai-optimize-title] persist failed:', saveErr?.message);
      }

      res.json({ title: safeTitle });
    } catch (err: any) {
      console.error('[ai-optimize-title] error:', err);
      res.status(500).json({ message: err.message || 'AI title optimisation failed' });
    }
  });

  protectedApi.put('/products/:id', async (req: any, res) => {
    try {
      const userId = await resolveInventoryOwnerId(req.user.claims.sub);
      const id = Number(req.params.id);
      const body = { ...req.body };
      delete body.veroOverride; delete body.veroOverrideBy; delete body.veroOverrideReason;
      const incomingVariations = body.variations;
      delete body.variations;
      if (body.costPrice !== undefined) body.costPrice = String(body.costPrice);
      if (body.sellingPrice !== undefined) body.sellingPrice = String(body.sellingPrice);
      if (body.deliveryCost !== undefined) body.deliveryCost = String(body.deliveryCost);
      const input = api.products.update.input.parse(body);
      
      const existingProduct = await storage.getProduct(id, userId);
      if (!existingProduct) {
        return res.status(404).json({ message: 'Product not found' });
      }

      if (incomingVariations !== undefined) {
        const existingAttrs = (existingProduct.attributes || {}) as Record<string, any>;
        existingAttrs.variations = Array.isArray(incomingVariations) ? incomingVariations : [];
        (input as any).attributes = { ...existingAttrs, ...(input.attributes ? (input.attributes as Record<string, any>) : {}) };
      }
      
      const checkBrand = input.brand !== undefined ? (input.brand || '') : (existingProduct.brand || '');
      const checkTitle = input.title || existingProduct.title;
      const checkDesc = input.description !== undefined ? input.description : (existingProduct.description || '');
      
      const sanitized = await storage.sanitizeVeroContent(userId, checkTitle, checkDesc, checkBrand);
      if (sanitized.removedFromTitle || input.title) input.title = sanitized.title;
      if (sanitized.removedFromDescription || input.description !== undefined) input.description = sanitized.description;
      if (input.brand !== undefined || sanitized.detectedBrand) input.brand = sanitized.brand;
      
      const brandCheck = await storage.checkVeroBrand(userId, sanitized.brand || '', id);
      const restrictedCheck = await storage.checkRestrictedViolations(userId, sanitized.title, sanitized.description);
      
      let veroStatus = 'clean';
      const warnings: string[] = [];
      
      if (sanitized.removedFromTitle || sanitized.removedFromDescription) {
        warnings.push(`VeRO brand "${sanitized.detectedBrand}" auto-removed from ${sanitized.removedFromTitle ? 'title' : ''}${sanitized.removedFromTitle && sanitized.removedFromDescription ? ' and ' : ''}${sanitized.removedFromDescription ? 'description' : ''}`);
      }
      if (sanitized.detectedBrand && !checkBrand) {
        warnings.push(`Brand auto-set to "${sanitized.brand}"`);
      }
      
      if (brandCheck.isBlocked && !existingProduct.veroOverride) {
        veroStatus = 'blocked';
        warnings.push(`VERO Brand: ${brandCheck.matchedBrand} (${brandCheck.matchMethod} match)`);
      }
      if (restrictedCheck.isBlocked) {
        veroStatus = 'blocked';
        warnings.push(`Restricted: ${restrictedCheck.violations.map(v => v.keyword).join(', ')}`);
      }
      
      const product = await storage.updateProduct(id, userId, { ...input, veroStatus });
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      res.json({ ...product, veroWarnings: warnings.length > 0 ? warnings : undefined });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  protectedApi.delete('/products/:id', async (req: any, res) => {
    const userId = await resolveInventoryOwnerId(req.user.claims.sub);
    const id = Number(req.params.id);
    await storage.deleteProduct(id, userId);
    res.status(204).send();
  });

  protectedApi.get('/products/:id/vendor-stock', async (req: any, res) => {
    try {
      const userId = await resolveInventoryOwnerId(req.user.claims.sub);
      const id = Number(req.params.id);
      const product = await storage.getProduct(id);
      if (!product || product.userId !== userId) {
        return res.status(404).json({ message: 'Product not found' });
      }
      const attrs = (product.attributes || {}) as Record<string, any>;
      const vendorStock = attrs.vendorStock || null;
      const sourceUrl = attrs.sourceUrl || null;
      res.json({
        productId: id,
        title: product.title,
        sourceUrl,
        vendorStock,
        localQuantity: product.quantity,
        variations: attrs.variations || [],
        lastChecked: vendorStock?.lastChecked || null,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to fetch vendor stock' });
    }
  });

  protectedApi.post('/products/:id/vendor-stock', async (req: any, res) => {
    try {
      const userId = await resolveInventoryOwnerId(req.user.claims.sub);
      const id = Number(req.params.id);
      const product = await storage.getProduct(id);
      if (!product || product.userId !== userId) {
        return res.status(404).json({ message: 'Product not found' });
      }
      const { quantity, inStock } = req.body;
      const attrs = (product.attributes || {}) as Record<string, any>;
      attrs.vendorStock = {
        quantity: quantity ?? attrs.vendorStock?.quantity ?? 0,
        inStock: inStock ?? (quantity > 0),
        lastChecked: new Date().toISOString(),
      };
      const updated = await storage.updateProduct(id, userId, { attributes: attrs });
      res.json({ success: true, vendorStock: attrs.vendorStock, product: updated });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to update vendor stock' });
    }
  });

  function parsePriceFromHtml(html: string, vendor: string): number | null {
    let price: number | null = null;

    const jsonLdMatch = html.match(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    if (jsonLdMatch) {
      for (const match of jsonLdMatch) {
        try {
          const content = match.replace(/<\/?script[^>]*>/gi, '');
          const data = JSON.parse(content);
          const offers = data?.offers ? (Array.isArray(data.offers) ? data.offers : [data.offers]) : [];
          for (const offer of offers) {
            const p = parseFloat(offer.price);
            if (!isNaN(p) && p > 0) { price = p; break; }
            if (offer.lowPrice) { const lp = parseFloat(offer.lowPrice); if (!isNaN(lp) && lp > 0) { price = lp; break; } }
          }
          if (price) break;
          if (data?.['@type'] === 'Product' && data.offers) {
            const o = Array.isArray(data.offers) ? data.offers[0] : data.offers;
            const p = parseFloat(o?.price);
            if (!isNaN(p) && p > 0) price = p;
          }
        } catch {}
      }
    }

    if (!price) {
      const metaPrice = html.match(/<meta[^>]*property=["'](?:og:price:amount|product:price:amount)["'][^>]*content=["']([^"']+)["']/i);
      if (metaPrice) { const p = parseFloat(metaPrice[1]); if (!isNaN(p) && p > 0) price = p; }
    }

    if (!price) {
      const pricePatterns = [
        /(?:price|sale-price|offer-price|current-price)[^>]*>[\s]*[£$€]?\s*([\d,]+\.?\d*)/gi,
        /[£$€]\s*([\d,]+\.?\d{0,2})/g,
        /data-price=["']([\d.]+)["']/i,
        /"price":\s*"?([\d.]+)"?/i,
      ];
      for (const pat of pricePatterns) {
        const m = pat.exec(html);
        if (m) { const p = parseFloat(m[1].replace(/,/g, '')); if (!isNaN(p) && p > 0 && p < 100000) { price = p; break; } }
      }
    }
    return price;
  }

  function parseStockFromHtml(html: string, vendor: string): { inStock: boolean; quantity: number | null } {
    const lower = html.toLowerCase();
    let inStock = true;
    let quantity: number | null = null;

    const jsonLdMatch = html.match(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    if (jsonLdMatch) {
      for (const match of jsonLdMatch) {
        try {
          const content = match.replace(/<\/?script[^>]*>/gi, '');
          const data = JSON.parse(content);
          const offers = data?.offers ? (Array.isArray(data.offers) ? data.offers : [data.offers]) : [];
          for (const offer of offers) {
            const avail = (offer.availability || '').toLowerCase();
            if (avail.includes('outofstock') || avail.includes('discontinued') || avail.includes('soldout')) {
              inStock = false;
            }
            if (avail.includes('instock') || avail.includes('instoreonly') || avail.includes('onlineonly')) {
              inStock = true;
            }
          }
        } catch {}
      }
    }

    if (vendor === 'amazon') {
      if (lower.includes('currently unavailable') || lower.includes('id="outofstock"') || lower.match(/availability[^>]*>[\s\S]*?out of stock/)) {
        inStock = false;
      }
      const qtyMatch = lower.match(/(\d+)\s*(?:left|in stock)/);
      if (qtyMatch) quantity = parseInt(qtyMatch[1]);
    } else if (vendor === 'ebay') {
      if (lower.includes('out of stock') || lower.includes('sold out') || lower.includes('this listing has ended')) {
        inStock = false;
      }
      const qtyMatch = lower.match(/(\d+)\s*available/);
      if (qtyMatch) quantity = parseInt(qtyMatch[1]);
    } else if (vendor === 'aliexpress') {
      if (lower.includes('out of stock') || lower.includes('no longer available') || lower.includes('item is not available')) {
        inStock = false;
      }
    } else if (vendor === 'etsy') {
      if (lower.includes('out of stock') || lower.includes('sold out') || lower.includes('no longer available')) {
        inStock = false;
      }
    } else if (vendor === 'walmart') {
      if (lower.includes('out of stock') || lower.includes('not available')) {
        inStock = false;
      }
    } else if (vendor === 'temu') {
      // Temu shows "almost sold out" for LOW stock (still buyable), so we must
      // exclude that phrase before treating "sold out" as out-of-stock.
      const soldOut = lower.includes('sold out') && !lower.includes('almost sold out');
      if (
        soldOut ||
        lower.includes('no longer available') ||
        lower.includes('currently unavailable') ||
        lower.includes('this item is unavailable') ||
        lower.includes('item is not available')
      ) {
        inStock = false;
      }
    } else {
      if (lower.includes('out of stock') || lower.includes('sold out') || lower.includes('currently unavailable') || lower.includes('no longer available') || lower.includes('not available')) {
        inStock = false;
      }
      const qtyMatch = lower.match(/(\d+)\s*(?:left|in stock|available|remaining)/);
      if (qtyMatch) quantity = parseInt(qtyMatch[1]);
    }

    return { inStock, quantity };
  }

  function calculateDeliveryType(costPrice: number): string {
    if (costPrice >= 25) return 'free';
    return 'buyer_pays';
  }

  function calculateDeliveryCost(costPrice: number): string {
    if (costPrice >= 25) return '0';
    if (costPrice >= 15) return '2.99';
    if (costPrice >= 5) return '3.49';
    return '3.99';
  }

  function isValidVendorUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
      const host = parsed.hostname.toLowerCase();
      if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1') return false;
      if (host.endsWith('.local') || host.endsWith('.internal')) return false;
      if (/^10\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || /^192\.168\./.test(host)) return false;
      if (host === '169.254.169.254' || host.startsWith('169.254.')) return false;
      if (host.includes('metadata.google') || host.includes('metadata.aws')) return false;
      if (!host.includes('.')) return false;
      return true;
    } catch {
      return false;
    }
  }

  function detectVendorFromUrl(url: string): string {
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (host.includes('amazon')) return 'amazon';
      if (host.includes('ebay')) return 'ebay';
      if (host.includes('aliexpress')) return 'aliexpress';
      if (host.includes('etsy')) return 'etsy';
      if (host.includes('walmart')) return 'walmart';
      if (host.includes('temu')) return 'temu';
      if (host.includes('tiktok')) return 'tiktok';
      if (host.includes('home.bargains')) return 'homebargains';
      if (host.includes('shein')) return 'shein';
      return 'generic';
    } catch { return 'generic'; }
  }

  function parseShippingFromHtml(html: string, vendor: string): number | null {
    let shipping: number | null = null;

    const jsonLdMatch = html.match(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    if (jsonLdMatch) {
      for (const match of jsonLdMatch) {
        try {
          const content = match.replace(/<\/?script[^>]*>/gi, '');
          const data = JSON.parse(content);
          const offers = data?.offers ? (Array.isArray(data.offers) ? data.offers : [data.offers]) : [];
          for (const offer of offers) {
            if (offer.shippingDetails) {
              const rate = offer.shippingDetails?.shippingRate;
              if (rate?.value !== undefined) {
                const v = parseFloat(rate.value);
                if (!isNaN(v) && v >= 0) { shipping = v; break; }
              }
            }
            const del = offer.deliveryCharge || offer.shipping;
            if (del) {
              const v = parseFloat(typeof del === 'object' ? del.price || del.value || '0' : del);
              if (!isNaN(v) && v >= 0) { shipping = v; break; }
            }
          }
          if (shipping !== null) break;
        } catch {}
      }
    }

    if (shipping === null) {
      const freePatterns = [
        /free\s*(?:delivery|shipping|postage)/i,
        /(?:delivery|shipping|postage)\s*:\s*free/i,
        /(?:FREE|Free)\s+(?:UK\s+)?(?:delivery|shipping|postage)/i,
      ];
      for (const pat of freePatterns) {
        if (pat.test(html)) { shipping = 0; break; }
      }
    }

    if (shipping === null) {
      const shippingPatterns = [
        /(?:shipping|delivery|postage)\s*(?:cost|price|fee|charge)?[:\s]*[£$€]\s*([\d,.]+)/i,
        /[£$€]\s*([\d,.]+)\s*(?:shipping|delivery|postage)/i,
        /data-shipping[=-]["']?([\d.]+)/i,
        /"(?:shipping|delivery|postage)(?:Cost|Price|Fee|Charge)?"\s*:\s*"?([\d.]+)/i,
      ];
      for (const pat of shippingPatterns) {
        const m = pat.exec(html);
        if (m) { const v = parseFloat(m[1].replace(/,/g, '')); if (!isNaN(v) && v >= 0 && v < 1000) { shipping = v; break; } }
      }
    }

    return shipping;
  }

  // Detects when a supplier served a bot-check / CAPTCHA / access-denied page
  // INSTEAD of the real product page. These pages return HTTP 200 but contain
  // none of our out-of-stock signals, so if we parsed them normally they would
  // look "in stock" — which silently resets the failed-scrape counter and can
  // even clear an auto-pause lock, relisting a genuinely sold-out item. That is
  // a direct cause of eBay cancellations, so we treat these as a failed scrape
  // (keep last known stock) rather than trusting them.
  function looksLikeBotBlockPage(html: string): boolean {
    if (!html || html.length < 200) return true;
    const head = html.slice(0, 8000).toLowerCase();
    const blockSignals = [
      'captcha',
      'are you a robot',
      'robot check',
      'unusual traffic',
      "verify you're a human",
      'verify you are a human',
      'enter the characters you see below',
      'to discuss automated access',
      'access to this page has been denied',
      'access denied',
      'request blocked',
      'pardon our interruption',
      'px-captcha',
      'checking your browser before',
      'just a moment...',
      'cf-browser-verification',
      'please enable javascript and cookies to continue',
      'security check to access',
    ];
    return blockSignals.some((s) => head.includes(s));
  }

  async function fetchVendorStock(sourceUrl: string, vendor: string): Promise<{ inStock: boolean; quantity: number | null; vendorPrice?: number | null; vendorShipping?: number | null; error?: string; fetchFailed?: boolean }> {
    if (!isValidVendorUrl(sourceUrl)) {
      return { inStock: true, quantity: null, error: 'Invalid URL', fetchFailed: true };
    }
    const detectedVendor = vendor || detectVendorFromUrl(sourceUrl);

    const attempt = async (): Promise<{ inStock: boolean; quantity: number | null; vendorPrice?: number | null; vendorShipping?: number | null; error?: string; fetchFailed?: boolean }> => {
      try {
        const response = await fetch(sourceUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-GB,en;q=0.9',
          },
          redirect: 'follow',
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) {
          return { inStock: true, quantity: null, error: `Vendor returned ${response.status}`, fetchFailed: true };
        }
        const html = await response.text();
        if (looksLikeBotBlockPage(html)) {
          return { inStock: true, quantity: null, error: 'Vendor served a bot-check/blocked page (kept last known value)', fetchFailed: true };
        }
        const stockResult = parseStockFromHtml(html, detectedVendor);
        const vendorPrice = parsePriceFromHtml(html, detectedVendor);
        const vendorShipping = parseShippingFromHtml(html, detectedVendor);
        return { ...stockResult, vendorPrice, vendorShipping };
      } catch (err: any) {
        return { inStock: true, quantity: null, error: err.message || 'Failed to fetch vendor page', fetchFailed: true };
      }
    };

    // One immediate retry on a transient failure (timeout, network blip, soft
    // block). This shrinks the window where a genuinely out-of-stock item stays
    // "In Stock" because a single flaky request counted as a failure and made
    // us wait for the next monitor cycle to try again.
    let result = await attempt();
    if (result.fetchFailed) {
      await new Promise((r) => setTimeout(r, 1500));
      result = await attempt();
    }
    return result;
  }

  // Builds the new vendorStock object after a fetch attempt.
  //
  // CRITICAL behaviour: if the scrape failed (network error, non-200 from
  // vendor, etc.) we DO NOT trust its "in stock" guess — we keep whatever
  // we last knew about the item's stock. This stops the long-standing bug
  // where Amazon/AliExpress blocking us would silently mark out-of-stock
  // items as "In Stock" again, leading to phantom orders.
  //
  // We still record `lastChecked` so the UI shows a fresh timestamp, and
  // we track `failedScrapeCount` + `lastError` so admins can see when a
  // product's source URL has been failing repeatedly.
  function buildVendorStockUpdate(
    previous: any,
    stockResult: { inStock: boolean; quantity: number | null; error?: string; fetchFailed?: boolean }
  ) {
    const prev = previous || {};
    if (stockResult.fetchFailed) {
      const prevFails = Number(prev.failedScrapeCount) || 0;
      return {
        // Preserve previous known stock state — do NOT overwrite with a guess.
        inStock: typeof prev.inStock === 'boolean' ? prev.inStock : true,
        quantity: prev.quantity ?? null,
        lastChecked: new Date().toISOString(),
        lastSuccessfulCheck: prev.lastSuccessfulCheck || null,
        lastScrapedPrice: prev.lastScrapedPrice ?? null,
        lastScrapedAt: prev.lastScrapedAt ?? null,
        currentPrice: prev.currentPrice ?? null,
        failedScrapeCount: prevFails + 1,
        // Any failed scrape resets the recovery streak — we need 3 in a
        // row of CONSECUTIVE successes to clear an existing autoPaused lock.
        consecutiveSuccessfulScrapes: 0,
        confidence: prevFails + 1 >= 3 ? 'low' : (prevFails + 1 >= 1 ? 'medium' : 'high'),
        error: stockResult.error || 'Stock check failed (kept last known value)',
        // Preserve any active autoPaused lock across failed scrapes.
        autoPaused: prev.autoPaused === true ? true : undefined,
        autoPausedAt: prev.autoPausedAt || undefined,
        autoPausedListingCount: prev.autoPausedListingCount || undefined,
        wasAutoPaused: prev.wasAutoPaused || undefined,
      };
    }
    // Successful scrape — reset failure tracking, store fresh values.
    //
    // STICKY LOCK CONTRACT for autoPaused:
    //   The pause lock is sticky. A single successful scrape does NOT clear
    //   it, because our scraper has a known false-positive rate (which is
    //   exactly why this whole safety net exists). If we cleared on the
    //   first success, the auto-restock sweep would refill qty to the
    //   buffer and push the listing live again — silently reversing the
    //   pause based on a single noisy data point.
    //
    //   Instead, we require N=3 consecutive successful scrapes before
    //   re-arming. At the 15-minute price-monitor cadence, that's ~45
    //   minutes of stable in-stock signal, which mirrors the symmetric
    //   3-failure threshold for entering the pause.
    //
    //   When the lock is finally cleared, we leave `wasAutoPaused` as a
    //   breadcrumb and stamp `autoPausedRecoveredAt`. We do NOT
    //   auto-relist — the qty stays at 0 and the restock sweep is
    //   responsible for refilling it. (And the restock sweep only refills
    //   non-autoPaused products, so once we clear the flag the sweep will
    //   push qty back up on its next run.)
    // CRITICAL recovery semantics: a "successful scrape" that returns
    // `inStock: false` is NOT positive evidence the supplier can fulfil.
    // We must only count IN-STOCK confirmations toward the recovery
    // threshold — otherwise three consecutive scrapes that all say "OOS"
    // would clear the lock and the restock sweep would push qty back to
    // the buffer on a product that's still out of stock at the supplier.
    const isPositiveConfirmation = stockResult.inStock === true;
    const wasAutoPaused = prev.autoPaused === true || prev.wasAutoPaused === true;
    const RECOVERY_THRESHOLD = 3;
    const prevSuccess = Number(prev.consecutiveSuccessfulScrapes) || 0;
    // Reset counter if this scrape is OOS, otherwise increment.
    const newSuccess = isPositiveConfirmation ? prevSuccess + 1 : 0;
    const shouldClearLock = prev.autoPaused === true
      && isPositiveConfirmation
      && newSuccess >= RECOVERY_THRESHOLD;
    const stillLocked = prev.autoPaused === true && !shouldClearLock;
    return {
      inStock: stockResult.inStock,
      quantity: stockResult.quantity ?? (stockResult.inStock ? null : 0),
      lastChecked: new Date().toISOString(),
      lastSuccessfulCheck: new Date().toISOString(),
      lastScrapedPrice: prev.lastScrapedPrice ?? null,
      lastScrapedAt: prev.lastScrapedAt ?? null,
      currentPrice: prev.currentPrice ?? null,
      failedScrapeCount: 0,
      consecutiveSuccessfulScrapes: newSuccess,
      confidence: 'high',
      autoPaused: stillLocked ? true : false,
      wasAutoPaused: wasAutoPaused || undefined,
      autoPausedAt: stillLocked ? prev.autoPausedAt : (prev.autoPausedAt || undefined),
      autoPausedRecoveredAt: shouldClearLock
        ? new Date().toISOString()
        : (prev.autoPausedRecoveredAt || undefined),
      autoPausedListingCount: stillLocked ? prev.autoPausedListingCount : (prev.autoPausedListingCount || undefined),
    };
  }

  // Trusted-source stock update — used when a stock signal comes from the
  // user's own Chrome extension (running in their authenticated browser
  // session on the vendor site). These signals are NOT subject to bot
  // detection or IP blocking, so we treat them as ground truth:
  //   - confidence is always "high"
  //   - failedScrapeCount resets to 0 immediately
  //   - autoPaused is lifted on the FIRST positive in-stock confirmation
  //     (no 3-strike recovery streak required, unlike server-side scrapes)
  function applyTrustedStockUpdate(
    previous: any,
    report: { inStock: boolean; quantity: number | null; currentPrice?: number | null },
  ) {
    const prev = previous || {};
    const isPositive = report.inStock === true;
    const wasAutoPaused = prev.autoPaused === true || prev.wasAutoPaused === true;
    const liftLock = prev.autoPaused === true && isPositive;
    return {
      inStock: report.inStock,
      quantity: report.quantity ?? (report.inStock ? null : 0),
      lastChecked: new Date().toISOString(),
      lastSuccessfulCheck: new Date().toISOString(),
      lastScrapedPrice: prev.lastScrapedPrice ?? null,
      lastScrapedAt: prev.lastScrapedAt ?? null,
      currentPrice: typeof report.currentPrice === 'number' && report.currentPrice > 0
        ? report.currentPrice
        : (prev.currentPrice ?? null),
      failedScrapeCount: 0,
      consecutiveSuccessfulScrapes: isPositive ? (Number(prev.consecutiveSuccessfulScrapes) || 0) + 1 : 0,
      confidence: 'high',
      source: 'extension',
      autoPaused: liftLock ? false : (prev.autoPaused === true),
      wasAutoPaused: wasAutoPaused || undefined,
      autoPausedAt: liftLock ? undefined : (prev.autoPausedAt || undefined),
      autoPausedRecoveredAt: liftLock ? new Date().toISOString() : (prev.autoPausedRecoveredAt || undefined),
      autoPausedListingCount: liftLock ? undefined : (prev.autoPausedListingCount || undefined),
      error: undefined,
    };
  }

  // Normalise a vendor product URL so the same item is matched across visits
  // even when query strings, tracking params, or SEO slugs differ.
  function normalizeVendorUrl(url: string): string {
    try {
      const u = new URL(url);
      let pathname = u.pathname.replace(/\/+$/, '');
      const asin = pathname.match(/\/dp\/([A-Z0-9]{10})/i) || pathname.match(/\/gp\/product\/([A-Z0-9]{10})/i);
      if (asin) pathname = `/dp/${asin[1].toUpperCase()}`;
      const ebay = pathname.match(/\/itm\/(?:[^/]+\/)?(\d{9,15})/i);
      if (ebay) pathname = `/itm/${ebay[1]}`;
      const ali = pathname.match(/\/item\/(\d{8,16})/i);
      if (ali) pathname = `/item/${ali[1]}.html`;
      const host = u.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
      return `${host}${pathname}`.toLowerCase();
    } catch {
      return (url || '').toLowerCase().trim();
    }
  }

  // Belt-and-braces fallback matcher: extract a vendor-specific stable
  // product ID (Amazon ASIN, eBay item ID, AliExpress item ID, etc.) so
  // we can still match when the normalised URL fails (e.g. user imported
  // /gp/product/X but extension sees /dp/X with extra path segments, or
  // a localised mirror domain like amazon.de vs amazon.co.uk for the same
  // ASIN). Returns a key like 'asin:B08N5WRWNW' or null if no ID found.
  function extractVendorProductKey(url: string): string | null {
    try {
      const u = new URL(url);
      const path = u.pathname;
      const asin = path.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i);
      if (asin) return `asin:${asin[1].toUpperCase()}`;
      const ebay = path.match(/\/itm\/(?:[^/]+\/)?(\d{9,15})/i);
      if (ebay) return `ebay:${ebay[1]}`;
      const ali = path.match(/\/item\/(\d{8,16})/i);
      if (ali) return `ali:${ali[1]}`;
      const walmart = path.match(/\/ip\/(?:[^/]+\/)?(\d{6,14})/i);
      if (walmart) return `walmart:${walmart[1]}`;
      const etsy = path.match(/\/listing\/(\d{6,14})/i);
      if (etsy) return `etsy:${etsy[1]}`;
      return null;
    } catch {
      return null;
    }
  }

  // Detects if a product has been in 'low confidence' state long enough to
  // trigger the safety-net auto-pause: ends every active eBay listing for the
  // product (sets qty=0 via ReviseInventoryStatus), tags the product so we
  // don't pause it again on the next failed cycle, and emails the user.
  //
  // Idempotency / safety guards (in order):
  //   1. User must have `autoPauseOnFailedStock` enabled (default true).
  //   2. Product must not have `vendorStockManualOverride` set — those are
  //      sellers who explicitly told us they handle stock themselves.
  //   3. Product must not already be `autoPaused: true` (don't repause).
  //   4. Variation products are skipped — same reason as the restock sweep:
  //      we don't have child SKUs at this layer.
  //
  // Mutates `attrs.vendorStock` so the caller's subsequent storage.updateProduct
  // persists the autoPaused flag in the same write.
  // Guards against two overlapping scans (e.g. the background cycle and a
  // manual "check stock" request) both trying to pause the same product at
  // once, which would fire duplicate eBay pushes and duplicate emails.
  const pausingProductIds = new Set<number>();

  async function autoPauseListingsForFailedStock(
    product: any,
    userId: string,
    attrs: Record<string, any>,
    trigger: 'failed-stock' | 'out-of-stock' = 'failed-stock',
  ): Promise<{ paused: boolean; affectedListings: number; reason?: string }> {
    if (pausingProductIds.has(product.id)) {
      return { paused: false, affectedListings: 0, reason: 'in-flight' };
    }
    pausingProductIds.add(product.id);
    try {
      const vs = attrs.vendorStock || {};
      if (vs.autoPaused === true) return { paused: false, affectedListings: 0, reason: 'already-paused' };
      if (attrs.vendorStockManualOverride === true) return { paused: false, affectedListings: 0, reason: 'manual-override' };
      const isVariation = Array.isArray(attrs.variations) && attrs.variations.length > 0;
      if (isVariation) return { paused: false, affectedListings: 0, reason: 'variation' };

      // Trust the Chrome extension over our server-side scraper. If the
      // extension recently confirmed the item in stock from the user's own
      // browser session (which can't be bot-blocked), don't auto-pause based
      // on a server-scrape failure streak — that would defeat the whole
      // point of having the extension as a trusted signal source.
      // NOTE: this bypass only applies to the 'failed-stock' trigger (weak
      // evidence from a scrape failure). A 'out-of-stock' trigger means a
      // scrape SUCCEEDED and positively confirmed the vendor is out of stock,
      // which must always pause the listing regardless of a stale extension hint.
      if (trigger === 'failed-stock' && vs.source === 'extension' && vs.lastSuccessfulCheck && vs.inStock === true) {
        const ageHours = (Date.now() - new Date(vs.lastSuccessfulCheck).getTime()) / 3600000;
        if (ageHours < 24) {
          console.log(`[auto-pause] product ${product.id} skipped: extension confirmed in-stock ${ageHours.toFixed(1)}h ago (trusted source)`);
          return { paused: false, affectedListings: 0, reason: 'extension-recently-confirmed' };
        }
      }

      const user = await storage.getUser(userId);
      if (!user) return { paused: false, affectedListings: 0, reason: 'no-user' };
      // Default ON if column hasn't been backfilled yet.
      const enabled = user.autoPauseOnFailedStock !== false;
      if (!enabled) return { paused: false, affectedListings: 0, reason: 'user-disabled' };

      // Find all eBay stores for this user, then collect every active listing
      // pointing at this product across those stores.
      const userStores = await storage.getStores(userId);
      const ebayStores = userStores.filter((s: any) => (s.platform || '').toLowerCase() === 'ebay' && (s.status || 'active') !== 'inactive');
      if (ebayStores.length === 0) return { paused: false, affectedListings: 0, reason: 'no-ebay-stores' };

      const { reviseEbayQuantity } = await import('./marketplaces/ebay.js');
      let totalAffected = 0;
      let totalAttempted = 0;
      // Counts every live listing we DISCOVERED across all eBay stores for
      // this product, regardless of whether we then successfully attempted
      // to pause it. This is the denominator for deciding whether the
      // "no live listings" lock branch is genuinely safe to take.
      let discoveredLiveListings = 0;
      // Tracks whether ANY blocking failure (token refresh, listing fetch,
      // revise throw) prevented us from acting on a discovered listing.
      // If true, we can never enter the `===0` "nothing to do" lock branch
      // — even if we somehow ended up with discoveredLiveListings===0 — and
      // we also can't lock unless at least one revise succeeded.
      let hadBlockingFailure = false;
      let apiCallSucceededAtLeastOnce = false;

      for (const store of ebayStores) {
        let listings: any[] = [];
        try {
          listings = await storage.getMarketplaceListings(store.id);
        } catch (err: any) {
          console.error(`[auto-pause] getMarketplaceListings failed for store ${store.id}:`, err?.message || err);
          hadBlockingFailure = true;
          continue;
        }
        const productListings = listings.filter((l: any) => {
          if (l.productId !== product.id || !l.externalId) return false;
          const status = (l.status || '').toLowerCase();
          return status !== 'ended' && status !== 'cancelled' && status !== 'deleted';
        });
        if (productListings.length === 0) continue;

        discoveredLiveListings += productListings.length;

        // Refresh the eBay OAuth token before calling ReviseInventoryStatus.
        // Without this, a store with an expired token would silently fail
        // every revise call and we'd mark the product as `autoPaused` while
        // the listing is actually still live to buyers — exactly the
        // false-confidence scenario this safety net is supposed to prevent.
        const refreshed = await ensureValidEbayToken(store, userId);
        if (!refreshed) {
          console.warn(`[auto-pause] could not refresh eBay token for store ${store.id} (user ${userId}); skipping pause for product ${product.id} so we can retry next cycle`);
          hadBlockingFailure = true;
          continue;
        }

        totalAttempted += productListings.length;
        const payload = productListings.map((l: any) => ({ itemId: l.externalId, quantity: 0 }));
        try {
          const result = await reviseEbayQuantity(store.credentials, payload);
          apiCallSucceededAtLeastOnce = true;
          const failedItemIds = new Set(result.failed.map((f) => f.itemId));
          for (const l of productListings) {
            const failed = failedItemIds.has(l.externalId);
            try {
              await storage.updateMarketplaceListing(l.id, {
                syncStatus: failed ? 'error' : 'synced',
                lastSync: new Date(),
              } as any);
            } catch {}
            if (!failed) totalAffected++;
          }
        } catch (err: any) {
          console.error(`[auto-pause] reviseEbayQuantity threw for store ${store.id} product ${product.id}:`, err?.message || err);
          hadBlockingFailure = true;
        }
      }

      // ---- Decide whether we may safely mark the product as auto-paused ----
      // STRICT all-or-nothing lock criterion: we only flip `autoPaused` when
      // we have positive evidence that EVERY discovered live listing is
      // confirmed paused. A partial lock is dangerous because:
      //   - the lock blocks future pause attempts (idempotency guard at
      //     the top of this helper short-circuits when autoPaused===true),
      //     so the listings we couldn't touch would stay sellable
      //     indefinitely;
      //   - the auto-restock sweep skips locked products, so the listings
      //     we couldn't touch wouldn't even get their qty refilled —
      //     they'd silently keep selling whatever stock eBay last knew
      //     about.
      //
      // Cases:
      //   A. Every discovered listing was paused successfully -> lock.
      //   B. There were truly zero discovered listings AND no blocking
      //      failure could have hidden any -> lock (record state so we
      //      don't re-scan every cycle).
      //   C. Anything else (partial success, total failure, hidden by
      //      blocking failure) -> DO NOT lock; next cycle retries.
      const allListingsConfirmed = discoveredLiveListings > 0
        && totalAffected === discoveredLiveListings
        && !hadBlockingFailure;
      const trulyEmpty = discoveredLiveListings === 0 && !hadBlockingFailure;
      const safeToLock = allListingsConfirmed || trulyEmpty;

      if (!safeToLock) {
        console.warn(`[auto-pause] product ${product.id} (user ${userId}): unsafe to lock (discovered=${discoveredLiveListings}, attempted=${totalAttempted}, succeeded=${totalAffected}, blockingFailure=${hadBlockingFailure}). Will retry next cycle.`);
        return { paused: false, affectedListings: totalAffected, reason: 'unsafe-to-lock' };
      }

      // CRITICAL: do NOT mutate the caller's `attrs` until product persistence
      // succeeds. If we mutate first and the DB write fails, the caller's
      // fallback `storage.updateProduct(product.id, userId, { attributes: attrs })`
      // path would persist the lock without the matching quantity update —
      // a worse state than just retrying next cycle. So we build a fresh
      // vendorStock object, attempt the write, and only commit `attrs` on
      // success.
      const newVendorStock = {
        ...vs,
        autoPaused: true,
        autoPausedAt: new Date().toISOString(),
        autoPausedListingCount: totalAffected,
      };
      const newAttrs = { ...attrs, vendorStock: newVendorStock };
      try {
        await storage.updateProduct(product.id, userId, { quantity: 0, attributes: newAttrs });
      } catch (err: any) {
        console.error(`[auto-pause] product update failed for ${product.id} (user ${userId}):`, err?.message || err);
        // Important: leave caller's `attrs` unmodified so the fallback write
        // path doesn't persist a half-baked lock state. eBay listings are
        // already at qty=0 (idempotent — a retry next cycle is a no-op on
        // eBay's side and re-attempts the persistence here).
        return { paused: false, affectedListings: totalAffected, reason: 'persist-failed' };
      }
      // Persistence succeeded — now commit the lock back into the caller's
      // attrs reference so subsequent reads in the cycle see the new state.
      attrs.vendorStock = newVendorStock;

      // Fire-and-forget email — don't block the cycle on Resend.
      if (totalAffected > 0 && user.email) {
        const failedCount = Number(vs.failedScrapeCount) || 3;
        try {
          const { sendStockAutoPausedEmail } = await import('./email.js');
          sendStockAutoPausedEmail(
            user.email,
            user.firstName || '',
            product.title || product.sku || 'Untitled product',
            totalAffected,
            failedCount,
            trigger,
          ).catch((e: any) => console.error('[auto-pause] email send failed:', e?.message || e));
        } catch (e: any) {
          console.error('[auto-pause] email module load failed:', e?.message || e);
        }
        const pauseReason = trigger === 'out-of-stock' ? 'vendor confirmed out of stock' : `${failedCount} failed checks`;
        console.log(`[auto-pause] product ${product.id} (user ${userId}): paused ${totalAffected} eBay listing(s) — ${pauseReason}`);
      } else if (totalAffected === 0) {
        console.log(`[auto-pause] product ${product.id} (user ${userId}): marked as paused (no live listings to update on eBay)`);
      }

      return { paused: true, affectedListings: totalAffected };
    } catch (err: any) {
      console.error(`[auto-pause] unexpected failure for product ${product?.id} user ${userId}:`, err?.message || err);
      return { paused: false, affectedListings: 0, reason: 'exception' };
    } finally {
      pausingProductIds.delete(product.id);
    }
  }

  async function syncPriceAndUpdateListings(product: any, userId: string, newVendorPrice: number, attrs: Record<string, any>, vendorShipping?: number | null) {
    const oldCostPrice = Number(product.costPrice) || 0;
    // Policy: only react to vendor price INCREASES. If the vendor price drops below
    // our initial/listed cost price, leave cost & selling unchanged (the user keeps the bigger margin).
    const priceChanged = oldCostPrice > 0 && (newVendorPrice - oldCostPrice) >= 0.01;
    if (oldCostPrice > 0 && newVendorPrice > 0 && newVendorPrice < oldCostPrice) {
      console.log(`[PRICE-SYNC] Product ${product.id}: vendor price DROPPED to £${newVendorPrice} (cost £${oldCostPrice}). Ignoring drop — keeping current cost & selling prices.`);
    }
    const currentDeliveryCost = parseFloat(product.deliveryCost || '0');
    const currentDeliveryType = product.deliveryType || 'buyer_pays';
    const shippingChanged = vendorShipping !== null && vendorShipping !== undefined && (
      (vendorShipping === 0 && currentDeliveryType !== 'free') ||
      (vendorShipping > 0 && (currentDeliveryType === 'free' || Math.abs(vendorShipping - currentDeliveryCost) >= 0.01))
    );

    if (!priceChanged && newVendorPrice > 0 && attrs.vendorStock?.lastScrapedPrice) {
      attrs.vendorStock.lastScrapedPrice = null;
      attrs.vendorStock.lastScrapedAt = null;
    }
    if (!priceChanged && !shippingChanged) return null;
    let priceSkipped = false;
    if (priceChanged) {
      if (newVendorPrice < 0.10 || newVendorPrice > 50000) return null;
      const lastScraped = attrs.vendorStock?.lastScrapedPrice;
      const lastScrapedAt = attrs.vendorStock?.lastScrapedAt;
      const now = Date.now();
      const scrapedRecently = lastScrapedAt && (now - new Date(lastScrapedAt).getTime()) < 7 * 24 * 60 * 60 * 1000;
      const confirmedByPreviousScrape = scrapedRecently && typeof lastScraped === 'number' && Math.abs(lastScraped - newVendorPrice) < 0.01;

      attrs.vendorStock = attrs.vendorStock || {};
      attrs.vendorStock.lastScrapedPrice = newVendorPrice;
      attrs.vendorStock.lastScrapedAt = new Date().toISOString();

      if (!confirmedByPreviousScrape) {
        console.log(`[PRICE-SYNC] Product ${product.id}: scraped price £${newVendorPrice} differs from cost £${oldCostPrice}, but not yet confirmed (previous scrape: £${lastScraped || 'none'}). Storing for confirmation on next check.`);
        if (!shippingChanged) {
          await storage.updateProduct(product.id, userId, { attributes: attrs });
          return { skipped: true, reason: 'awaiting_confirmation', scrapedPrice: newVendorPrice, oldCost: oldCostPrice };
        }
        priceSkipped = true;
      } else {
        console.log(`[PRICE-SYNC] Product ${product.id}: vendor price change CONFIRMED at £${newVendorPrice} (was £${oldCostPrice}). Applying update.`);
        attrs.vendorStock.lastScrapedPrice = null;
        attrs.vendorStock.lastScrapedAt = null;
      }
    }

    const applyPrice = priceChanged && !priceSkipped;
    const effectiveCost = applyPrice ? newVendorPrice : oldCostPrice;
    const oldSellingPrice = Number(product.sellingPrice) || 0;
    // Policy (2026-05-08): the user's selling price (the "Price" column on
    // Inventory) is the only price that should ever appear on their eBay
    // listing. We no longer auto-recompute selling price from vendor cost
    // changes. We still record the new vendor cost so the Inventory shows
    // an accurate margin/profit, and we leave it to the user to decide
    // whether to raise their eBay price.
    const newSellingPrice = oldSellingPrice;

    let newDeliveryType = product.deliveryType || 'buyer_pays';
    let newDeliveryCost = product.deliveryCost || '0';
    if (shippingChanged) {
      if (vendorShipping === 0) {
        newDeliveryType = 'free';
        newDeliveryCost = '0';
      } else {
        newDeliveryType = 'buyer_pays';
        newDeliveryCost = vendorShipping!.toFixed(2);
      }
      attrs.vendorShipping = vendorShipping;
    }

    if (applyPrice) {
      attrs.priceHistory = attrs.priceHistory || [];
      attrs.priceHistory.push({
        oldCost: oldCostPrice, newCost: newVendorPrice,
        oldSelling: oldSellingPrice, newSelling: newSellingPrice,
        changedAt: new Date().toISOString(),
      });
      if (attrs.priceHistory.length > 10) attrs.priceHistory = attrs.priceHistory.slice(-10);
    }

    const updateData: any = {
      deliveryType: newDeliveryType,
      deliveryCost: newDeliveryCost,
      attributes: attrs,
    };
    if (applyPrice) {
      updateData.costPrice = newVendorPrice.toString();
      // sellingPrice is intentionally NOT updated — the user is the only
      // one allowed to change their listing price (see policy note above).
    }
    await storage.updateProduct(product.id, userId, updateData);

    // Policy: ONLY push the new SELLING PRICE to active eBay listings (cost price is local-only —
    // eBay's API has no concept of cost). And we only ever push on confirmed vendor price
    // INCREASES (drops were already filtered out above), so the user's profit margin is preserved
    // automatically without ever lowering the live listing price.
    const ebayResults: { listingId: string; success: boolean; error?: string }[] = [];
    if (applyPrice && newSellingPrice > oldSellingPrice) {
      try {
        const userStores = await storage.getStores(userId);
        const ebayStores = userStores.filter((s: any) => s.platform === 'ebay' && s.status === 'active');
        const { reviseEbayListing } = await import('./marketplaces/ebay');
        for (const store of ebayStores) {
          const listings = await storage.getMarketplaceListings(store.id);
          const activeListings = listings.filter((l: any) =>
            l.productId === product.id && l.status === 'active' && l.externalId
          );
          if (activeListings.length === 0) continue;
          const accessToken = await ensureValidEbayToken(store, userId);
          if (!accessToken) {
            for (const l of activeListings) ebayResults.push({ listingId: l.externalId!, success: false, error: 'No valid eBay token' });
            continue;
          }
          const creds = { ...(store.credentials as any), authToken: accessToken };
          for (const listing of activeListings) {
            try {
              const r = await reviseEbayListing(creds, listing.externalId!, { price: newSellingPrice.toFixed(2) });
              ebayResults.push({ listingId: listing.externalId!, success: r.success, error: r.error });
              if (r.success) {
                console.log(`[PRICE-SYNC] Product ${product.id}: pushed selling price £${newSellingPrice.toFixed(2)} to eBay listing ${listing.externalId}`);
              } else {
                console.warn(`[PRICE-SYNC] Product ${product.id}: eBay revise failed for ${listing.externalId}: ${r.error}`);
              }
            } catch (revErr: any) {
              ebayResults.push({ listingId: listing.externalId!, success: false, error: revErr?.message || 'revise threw' });
            }
          }
        }
      } catch (err: any) {
        console.warn(`[PRICE-SYNC] Product ${product.id}: failed to push selling price to eBay: ${err?.message || err}`);
      }
    } else if (applyPrice) {
      console.log(`[PRICE-SYNC] Product ${product.id}: cost updated to £${newVendorPrice}, but new selling price £${newSellingPrice} is not higher than current £${oldSellingPrice} — not pushing to eBay.`);
    }

    const profitMargin = newSellingPrice > 0 ? (newSellingPrice - effectiveCost) / newSellingPrice : 0;
    return {
      oldCost: oldCostPrice, newCost: effectiveCost,
      oldSelling: oldSellingPrice, newSelling: newSellingPrice,
      marginPct: Math.round(profitMargin * 100),
      deliveryCost: newDeliveryCost, deliveryType: newDeliveryType,
      ebayUpdated: ebayResults.filter(r => r.success).length,
    };
  }

  protectedApi.post('/products/:id/check-vendor-stock', async (req: any, res) => {
    try {
      const userId = await resolveInventoryOwnerId(req.user.claims.sub);
      const id = Number(req.params.id);
      const product = await storage.getProduct(id);
      if (!product || product.userId !== userId) {
        return res.status(404).json({ message: 'Product not found' });
      }
      const attrs = (product.attributes || {}) as Record<string, any>;
      const sourceUrl = attrs.sourceUrl;
      if (!sourceUrl) {
        return res.status(400).json({ message: 'No source URL for this product' });
      }

      const vendor = (attrs.vendorType || '').toLowerCase();
      const stockResult = await fetchVendorStock(sourceUrl, vendor);

      attrs.vendorStock = buildVendorStockUpdate(attrs.vendorStock, stockResult);

      let priceUpdate = null;
      // Only act on price/shipping signals when the scrape actually succeeded.
      // A failed scrape returns `null` price — we shouldn't drive any pricing
      // logic from that.
      if (!stockResult.fetchFailed) {
        if (stockResult.vendorPrice && stockResult.vendorPrice > 0) {
          attrs.vendorStock.currentPrice = stockResult.vendorPrice;
          priceUpdate = await syncPriceAndUpdateListings(product, userId, stockResult.vendorPrice, attrs, stockResult.vendorShipping);
        } else if (stockResult.vendorShipping !== null && stockResult.vendorShipping !== undefined) {
          priceUpdate = await syncPriceAndUpdateListings(product, userId, Number(product.costPrice) || 0, attrs, stockResult.vendorShipping);
        }
      }

      // If the vendor scrape confirmed the item is out of stock, end the eBay
      // listing(s) immediately (qty 0) instead of leaving them sellable.
      let autoPaused = false;
      const confirmedOutOfStock = !stockResult.fetchFailed && stockResult.inStock === false;
      if (confirmedOutOfStock && attrs.vendorStock?.autoPaused !== true) {
        const r = await autoPauseListingsForFailedStock(product, userId, attrs, 'out-of-stock');
        autoPaused = r.paused;
      }
      if (!autoPaused) {
        await storage.updateProduct(id, userId, { attributes: attrs });
      }
      res.json({ success: true, vendorStock: attrs.vendorStock, productId: id, priceUpdate });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to check vendor stock' });
    }
  });

  protectedApi.post('/products/check-all-vendor-stock', async (req: any, res) => {
    try {
      const userId = await resolveInventoryOwnerId(req.user.claims.sub);
      const products = await storage.getProducts(userId);
      const results: { productId: number; title: string; vendorStock: any; priceUpdate?: any; error?: string }[] = [];

      for (const product of products) {
        const attrs = (product.attributes || {}) as Record<string, any>;
        const sourceUrl = attrs.sourceUrl;
        if (!sourceUrl) {
          results.push({ productId: product.id, title: product.title, vendorStock: attrs.vendorStock || null, error: 'No source URL' });
          continue;
        }
        try {
          const vendor = (attrs.vendorType || '').toLowerCase();
          const stockResult = await fetchVendorStock(sourceUrl, vendor);

          attrs.vendorStock = buildVendorStockUpdate(attrs.vendorStock, stockResult);

          let priceUpdate = null;
          if (!stockResult.fetchFailed) {
            if (stockResult.vendorPrice && stockResult.vendorPrice > 0) {
              attrs.vendorStock.currentPrice = stockResult.vendorPrice;
              priceUpdate = await syncPriceAndUpdateListings(product, userId, stockResult.vendorPrice, attrs, stockResult.vendorShipping);
            } else if (stockResult.vendorShipping !== null && stockResult.vendorShipping !== undefined) {
              priceUpdate = await syncPriceAndUpdateListings(product, userId, Number(product.costPrice) || 0, attrs, stockResult.vendorShipping);
            }
          }

          // Confirmed out of stock at the vendor → end the eBay listing(s).
          let autoPaused = false;
          const confirmedOutOfStock = !stockResult.fetchFailed && stockResult.inStock === false;
          if (confirmedOutOfStock && attrs.vendorStock?.autoPaused !== true) {
            const r = await autoPauseListingsForFailedStock(product, userId, attrs, 'out-of-stock');
            autoPaused = r.paused;
          }
          if (!autoPaused) {
            await storage.updateProduct(product.id, userId, { attributes: attrs });
          }
          results.push({ productId: product.id, title: product.title, vendorStock: attrs.vendorStock, priceUpdate });
        } catch (err: any) {
          results.push({ productId: product.id, title: product.title, vendorStock: attrs.vendorStock || null, error: err.message });
        }
      }

      const outOfStock = results.filter(r => r.vendorStock && !r.vendorStock.inStock).length;
      const inStock = results.filter(r => r.vendorStock?.inStock).length;
      const priceChanges = results.filter(r => r.priceUpdate).length;
      res.json({ total: results.length, inStock, outOfStock, priceChanges, results });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to check vendor stock' });
    }
  });

  protectedApi.post('/products/auto-sync-on-login', async (req: any, res) => {
    try {
      const userId = await resolveInventoryOwnerId(req.user.claims.sub);
      const products = await storage.getProducts(userId);
      const productsWithUrls = products.filter(p => {
        const attrs = (p.attributes || {}) as Record<string, any>;
        return attrs.sourceUrl;
      });

      if (productsWithUrls.length === 0) {
        return res.json({ synced: false, message: 'No products with vendor URLs to sync', priceChanges: 0, shippingChanges: 0, ebayUpdates: 0 });
      }

      let priceChanges = 0;
      let shippingChanges = 0;
      let ebayUpdates = 0;
      const updatedProducts: string[] = [];

      for (const product of productsWithUrls) {
        try {
          const attrs = (product.attributes || {}) as Record<string, any>;
          const sourceUrl = attrs.sourceUrl;
          const vendor = (attrs.vendorType || '').toLowerCase();
          const stockResult = await fetchVendorStock(sourceUrl, vendor);

          attrs.vendorStock = buildVendorStockUpdate(attrs.vendorStock, stockResult);

          if (!stockResult.fetchFailed && stockResult.vendorPrice && stockResult.vendorPrice > 0) {
            attrs.vendorStock.currentPrice = stockResult.vendorPrice;
          }

          // Skip price/shipping sync entirely on a failed scrape — no signal to act on.
          const hasPrice = !stockResult.fetchFailed && stockResult.vendorPrice && stockResult.vendorPrice > 0;
          const hasShipping = !stockResult.fetchFailed && stockResult.vendorShipping !== null && stockResult.vendorShipping !== undefined;

          if (hasPrice || hasShipping) {
            const priceUpdate = await syncPriceAndUpdateListings(
              product, userId,
              hasPrice ? stockResult.vendorPrice! : Number(product.costPrice) || 0,
              attrs,
              hasShipping ? stockResult.vendorShipping : undefined,
            );
            if (priceUpdate) {
              if (priceUpdate.oldCost !== priceUpdate.newCost) priceChanges++;
              if (hasShipping && priceUpdate.deliveryCost !== (product.deliveryCost || '0')) shippingChanges++;
              if (priceUpdate.ebayUpdated) ebayUpdates += priceUpdate.ebayUpdated;
              updatedProducts.push(product.title);
            }
          }

          // Confirmed out of stock at the vendor → end the eBay listing(s).
          let autoPaused = false;
          const confirmedOutOfStock = !stockResult.fetchFailed && stockResult.inStock === false;
          if (confirmedOutOfStock && attrs.vendorStock?.autoPaused !== true) {
            const r = await autoPauseListingsForFailedStock(product, userId, attrs, 'out-of-stock');
            autoPaused = r.paused;
          }
          if (!autoPaused) {
            await storage.updateProduct(product.id, userId, { attributes: attrs });
          }
        } catch (err: any) {
          console.error(`[AUTO-SYNC] Failed for product ${product.id}:`, err.message);
        }
      }

      console.log(`[AUTO-SYNC] Login sync complete: ${productsWithUrls.length} checked, ${priceChanges} price changes, ${shippingChanges} shipping changes, ${ebayUpdates} eBay updates`);
      res.json({
        synced: true,
        totalChecked: productsWithUrls.length,
        priceChanges,
        shippingChanges,
        ebayUpdates,
        updatedProducts,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Auto-sync failed' });
    }
  });

  protectedApi.post('/products/:id/sync-ebay-listing', async (req: any, res) => {
    try {
      const userId = await resolveInventoryOwnerId(req.user.claims.sub);
      const id = Number(req.params.id);
      const product = await storage.getProduct(id);
      if (!product || product.userId !== userId) {
        return res.status(404).json({ message: 'Product not found' });
      }

      const userStores = await storage.getStores(userId);
      const results: { listingId: string; success: boolean; error?: string }[] = [];
      for (const store of userStores) {
        if (store.platform !== 'ebay') continue;
        const storeListings = await storage.getMarketplaceListings(store.id);
        const activeListings = storeListings.filter((l: any) => l.productId === id && l.status === 'active' && l.externalId);
        if (activeListings.length === 0) continue;

        const creds = store.credentials as any;
        if (!creds?.authToken) continue;

        const { reviseEbayListing, convertImagesForEbayPublic } = await import('./marketplaces/ebay');
        const attrs = (product.attributes || {}) as Record<string, any>;
        const variations: any[] = Array.isArray(attrs.variations) ? attrs.variations : [];

        // Convert any newly uploaded local files (data: URLs) to publicly hosted
        // eBay Picture Service URLs once for the whole store, then push them to
        // every active listing. Without this, photos added in the inventory
        // editor would never reach the live eBay listing.
        const isAcceptable = (u: any): u is string => typeof u === 'string' && (u.startsWith('http') || u.startsWith('data:'));
        const productImagesAccepted: string[] = Array.isArray(product.images)
          ? product.images.filter(isAcceptable)
          : [];
        // Collect every per-colour picture (single + array form) so newly
        // uploaded data: URLs get hosted on eBay and pushed to the live
        // listing's <Pictures> block. Without this, swapping a colour on the
        // buyer page never changes the gallery.
        const variationImages: string[] = variations.flatMap((v: any) => {
          const out: string[] = [];
          if (Array.isArray(v?.images)) for (const u of v.images) if (isAcceptable(u)) out.push(u);
          if (isAcceptable(v?.image)) out.push(v.image);
          return out;
        });
        const allUrls = Array.from(new Set([...productImagesAccepted, ...variationImages])).slice(0, 24);
        const urlMap = new Map<string, string>();
        const failed: string[] = [];
        if (allUrls.length > 0) {
          try {
            const converted = await convertImagesForEbayPublic(creds, allUrls);
            allUrls.forEach((orig, i) => {
              const c = converted[i];
              if (typeof c === 'string' && c.startsWith('http')) {
                urlMap.set(orig, c);
              } else if (orig.startsWith('http')) {
                urlMap.set(orig, orig.replace(/^http:\/\//i, 'https://'));
              } else {
                failed.push(orig.slice(0, 60) + '…');
              }
            });
          } catch (cnvErr: any) {
            console.warn(`[SYNC-LISTING] Image conversion failed for product ${id}: ${cnvErr.message}`);
          }
        }
        const remap = (u: string): string | undefined => {
          const m = urlMap.get(u);
          return m && m.startsWith('http') ? m : undefined;
        };
        const hostedGallery: string[] = productImagesAccepted.map(remap).filter((u): u is string => !!u);
        const hostedVariationPics: string[] = [];
        const variationsWithImages = variations.map((v: any) => {
          const arr: string[] = [];
          if (Array.isArray(v?.images)) {
            for (const u of v.images) {
              const r = remap(u);
              if (r && !arr.includes(r)) arr.push(r);
            }
          }
          if (typeof v?.image === 'string') {
            const r = remap(v.image);
            if (r && !arr.includes(r)) arr.unshift(r);
          }
          for (const u of arr) if (!hostedVariationPics.includes(u)) hostedVariationPics.push(u);
          return { ...v, image: arr[0], images: arr.length > 0 ? arr : undefined };
        });
        // CRITICAL: eBay requires every URL used in <VariationSpecificPictureSet>
        // to ALSO be in <PictureDetails>. Merge variation pics into the gallery
        // we send to ReviseFixedPriceItem so the live listing's gallery actually
        // swaps when the buyer picks a colour.
        const merged: string[] = [];
        for (const u of hostedGallery) if (!merged.includes(u)) merged.push(u);
        for (const u of hostedVariationPics) if (!merged.includes(u)) merged.push(u);
        const hostedImages = merged.slice(0, 24);
        if (failed.length > 0) {
          console.warn(`[SYNC-LISTING] ${failed.length} image(s) couldn't be hosted on eBay for product ${id} and were dropped: ${failed.join(', ')}`);
        }
        console.log(`[SYNC-LISTING] Product ${id}: gallery=${hostedGallery.length}, variation pics=${hostedVariationPics.length}, merged=${hostedImages.length}/24`);

        for (const listing of activeListings) {
          const result = await reviseEbayListing(creds, listing.externalId!, {
            price: product.sellingPrice || '0',
            quantity: typeof product.quantity === 'number' ? product.quantity : undefined,
            images: hostedImages.length > 0 ? hostedImages : undefined,
            variations: variationsWithImages.length > 0 ? variationsWithImages : undefined,
          });
          results.push({ listingId: listing.externalId!, success: result.success, error: result.error });
          if (result.success) {
            console.log(`[SYNC-LISTING] Updated eBay listing ${listing.externalId} (price + qty=${product.quantity ?? 'n/a'} + ${hostedImages.length} image(s) + ${variationsWithImages.length} variation(s)) for product ${id}`);
          } else {
            console.warn(`[SYNC-LISTING] eBay revise failed for listing ${listing.externalId}: ${result.error}`);
          }
        }
      }
      res.json({ success: true, synced: results.length, results });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to sync eBay listing' });
    }
  });

  // === ORDERS ===
  function enrichLineItemsWithImages(items: any[], userProducts: any[]): any[] {
    const skuToProduct = new Map<string, any>();
    const titleToProduct = new Map<string, any>();
    for (const p of userProducts) {
      if (p.sku) skuToProduct.set(p.sku, p);
      if (p.title) titleToProduct.set(p.title.toLowerCase().trim(), p);
    }
    return items.map((li: any) => {
      if (li.imageUrl) return li;
      const matchedBySku = li.sku ? skuToProduct.get(li.sku) : null;
      if (matchedBySku?.images?.[0]) return { ...li, imageUrl: matchedBySku.images[0] };
      const matchedByTitle = li.title ? titleToProduct.get(li.title.toLowerCase().trim()) : null;
      if (matchedByTitle?.images?.[0]) return { ...li, imageUrl: matchedByTitle.images[0] };
      for (const p of userProducts) {
        if (p.images?.[0] && li.title && p.title && (li.title.toLowerCase().includes(p.title.toLowerCase().substring(0, 20)) || p.title.toLowerCase().includes(li.title.toLowerCase().substring(0, 20)))) {
          return { ...li, imageUrl: p.images[0] };
        }
      }
      return li;
    });
  }

  function enrichOrdersWithImages(ordersList: any[], userProducts: any[]): any[] {
    return ordersList.map((order: any) => {
      if (order.lineItems && Array.isArray(order.lineItems)) {
        return { ...order, lineItems: enrichLineItemsWithImages(order.lineItems, userProducts) };
      }
      return order;
    });
  }

  protectedApi.get('/orders', async (req: any, res) => {
    const userId = req.user.claims.sub;
    const ordersList = await storage.getOrders(userId);
    const userProducts = await storage.getProducts(userId);
    res.json(enrichOrdersWithImages(ordersList, userProducts));
  });

  protectedApi.get('/orders/:id', async (req: any, res) => {
    const userId = req.user.claims.sub;
    const id = Number(req.params.id);
    const order = await storage.getOrder(id, userId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    const fulfillmentJob = await storage.getFulfillmentJobByOrderId(id, userId);
    res.json({ ...order, fulfillmentJob });
  });

  protectedApi.post('/orders/:id/update-tracking', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const orderId = Number(req.params.id);
      const { trackingNumber, carrier } = req.body;
      if (!trackingNumber || !carrier) {
        return res.status(400).json({ message: 'Tracking number and carrier are required' });
      }
      const order = await storage.getOrder(orderId, userId);
      if (!order) return res.status(404).json({ message: 'Order not found' });

      let finalTrackingNumber = trackingNumber.trim();
      let finalCarrier = carrier.trim();
      let ebaySynced = false;
      let ebayError: string | null = null;

      const converted = convertToEbayTracking(finalTrackingNumber, finalCarrier);
      finalTrackingNumber = converted.trackingNumber;
      const ebayCarrierCode = converted.shippingCarrierCode;
      const autoDetected = converted.autoDetected;

      const statusUpdate: any = {
        trackingNumber: finalTrackingNumber,
        carrier: ebayCarrierCode,
      };
      if (order.status !== 'delivered' && order.status !== 'cancelled') {
        statusUpdate.status = 'shipped';
      }
      const updated = await storage.updateOrder(orderId, userId, statusUpdate);

      // Register the parcel with the live tracking provider (17track) so status is monitored.
      try {
        const { registerTracking } = await import('./tracking17track');
        const num = finalTrackingNumber.trim();
        const reg = await registerTracking([num]);
        const rejMsg = reg.rejected[num];
        // "already exists" means the parcel is already being watched — still counts as registered.
        const alreadyWatched = !!rejMsg && /exist|already/i.test(rejMsg);
        const registered = reg.accepted.includes(num) || alreadyWatched;
        await storage.updateOrder(orderId, userId, {
          trackingInfo: {
            provider: '17track',
            status: 'Pending',
            statusLabel: 'Pending',
            tone: 'gray',
            registered,
            registerError: registered ? null : (rejMsg || 'Could not register with tracking provider'),
            checkedAt: new Date().toISOString(),
          },
        } as any);
      } catch (regErr: any) {
        console.error('[Tracking] 17track register failed:', regErr.message);
      }

      let syncSkippedReason: string | null = null;

      if (!order.externalOrderId) {
        syncSkippedReason = 'Order has no external marketplace ID';
      }

      if (order.externalOrderId) {
        let ebayStore: any = null;

        if (order.storeId) {
          const store = await storage.getStore(order.storeId);
          if (store && store.platform === 'ebay') {
            ebayStore = store;
          } else if (store && store.platform !== 'ebay') {
            syncSkippedReason = `Store is ${store.platform}, not eBay`;
          } else if (!store) {
            syncSkippedReason = 'Linked store not found';
          }
        }

        if (!ebayStore && !syncSkippedReason) {
          const allEbayStores = await storage.getAllActiveStoresByPlatform('ebay');
          const userEbayStores = allEbayStores.filter((s: any) => s.userId === userId);
          if (userEbayStores.length > 0) {
            ebayStore = userEbayStores[0];
          } else {
            syncSkippedReason = 'No active eBay stores found';
          }
        }

        if (ebayStore) {
          try {
            const accessToken = await ensureValidEbayToken(ebayStore, userId);
            if (accessToken) {
              const lineItems = (order as any).lineItems || [];
              let ebayLineItems = lineItems
                .filter((li: any) => li.lineItemId && li.lineItemId !== '0' && li.lineItemId !== '')
                .map((li: any) => ({ lineItemId: li.lineItemId, quantity: li.quantity || 1 }));

              if (ebayLineItems.length === 0) {
                try {
                  const orderResp = await fetch(
                    `https://api.ebay.com/sell/fulfillment/v1/order/${order.externalOrderId}`,
                    { headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' } }
                  );
                  if (orderResp.ok) {
                    const orderData = await orderResp.json();
                    ebayLineItems = (orderData.lineItems || []).map((li: any) => ({
                      lineItemId: li.lineItemId,
                      quantity: li.quantity || 1,
                    }));
                  }
                } catch (fetchErr: any) {
                  console.error('[eBay Tracking] Failed to fetch order line items:', fetchErr.message);
                }
              }

              if (ebayLineItems.length === 0) {
                console.error('[eBay Tracking] No valid line items for order', order.externalOrderId);
                syncSkippedReason = 'Could not determine eBay line item IDs';
              } else {
                const { pushOrReplaceEbayFulfillment } = await import('./marketplaces/ebay');
                const pushResult = await pushOrReplaceEbayFulfillment(accessToken, order.externalOrderId!, {
                  trackingNumber: finalTrackingNumber,
                  shippingCarrierCode: ebayCarrierCode,
                  lineItems: ebayLineItems,
                });

                if (pushResult.success) {
                  ebaySynced = true;
                  await storage.createAuditLog({
                    userId,
                    orderId,
                    action: 'tracking_pushed_to_ebay',
                    source: 'ebay',
                    details: { trackingNumber: finalTrackingNumber, carrier: finalCarrier, ebayCarrierCode, autoDetected, ebayOrderId: order.externalOrderId, replaced: pushResult.replaced },
                  });
                } else {
                  ebayError = pushResult.error;
                  console.error('[eBay Tracking] Push failed:', pushResult.error);
                  await storage.createAuditLog({
                    userId,
                    orderId,
                    action: 'tracking_push_failed',
                    source: 'ebay',
                    details: { trackingNumber: finalTrackingNumber, carrier: finalCarrier, ebayCarrierCode, error: pushResult.error },
                  });
                }
              }
            }
          } catch (ebayErr: any) {
            ebayError = ebayErr.message;
            console.error('[eBay Tracking] Error:', ebayErr.message);
          }
        }
      }

      res.json({ ...updated, ebaySynced, ebayError, ebayCarrierCode, autoDetected, syncSkippedReason });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Fetch the latest live delivery status for one order from the tracking provider (17track).
  protectedApi.post('/orders/:id/refresh-tracking', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const orderId = Number(req.params.id);
      const order = await storage.getOrder(orderId, userId);
      if (!order) return res.status(404).json({ message: 'Order not found' });
      if (!order.trackingNumber) {
        return res.status(400).json({ message: 'This order has no tracking number yet' });
      }

      const { getTrackInfo, registerTracking, isDeliveredStatus } = await import('./tracking17track');
      const num = order.trackingNumber.trim();
      let info = (await getTrackInfo([num])).get(num);

      // If the number was never registered with the provider, register it now and retry.
      if (info && info.notFound) {
        await registerTracking([num]);
        info = (await getTrackInfo([num])).get(num);
      }

      if (!info) {
        return res.status(502).json({ message: 'Tracking provider returned no data' });
      }

      const updatePayload: any = { trackingInfo: info };
      // Auto-advance the order status when the courier confirms delivery.
      if (isDeliveredStatus(info.status) && order.status !== 'delivered' && order.status !== 'cancelled') {
        updatePayload.status = 'delivered';
      }
      const updated = await storage.updateOrder(orderId, userId, updatePayload);
      res.json({ ...updated, trackingInfo: info });
    } catch (err: any) {
      console.error('[Tracking] refresh-tracking failed:', err.message);
      res.status(500).json({ message: err.message });
    }
  });

  // Refresh live delivery status for all of the user's active (shipped, not-yet-delivered) orders.
  protectedApi.post('/orders/refresh-all-tracking', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const all = await storage.getOrders(userId);
      const active = all.filter((o) =>
        o.trackingNumber && o.status !== 'delivered' && o.status !== 'cancelled'
      );
      if (active.length === 0) {
        return res.json({ checked: 0, delivered: 0, updated: 0 });
      }

      const { getTrackInfo, registerTracking, isDeliveredStatus } = await import('./tracking17track');
      const numbers = active.map((o) => (o.trackingNumber || '').trim()).filter(Boolean);

      // Fetch first; only register (quota-consuming) the parcels the provider isn't watching yet.
      const results = await getTrackInfo(numbers);
      const unregistered = numbers.filter((n) => results.get(n)?.notFound);
      if (unregistered.length > 0) {
        await registerTracking(unregistered);
        const retry = await getTrackInfo(unregistered);
        retry.forEach((v, k) => results.set(k, v));
      }

      let deliveredCount = 0;
      let updatedCount = 0;
      for (const o of active) {
        const info = results.get((o.trackingNumber || '').trim());
        if (!info) continue;
        const payload: any = { trackingInfo: info };
        if (isDeliveredStatus(info.status) && o.status !== 'delivered') {
          payload.status = 'delivered';
          deliveredCount++;
        }
        await storage.updateOrder(o.id, userId, payload);
        updatedCount++;
      }
      res.json({ checked: active.length, delivered: deliveredCount, updated: updatedCount });
    } catch (err: any) {
      console.error('[Tracking] refresh-all-tracking failed:', err.message);
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.post('/orders/:id/mark-delivered', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const orderId = Number(req.params.id);
      const order = await storage.getOrder(orderId, userId);
      if (!order) return res.status(404).json({ message: 'Order not found' });

      if (order.status !== 'shipped' && order.status !== 'processing') {
        return res.status(400).json({ message: `Cannot mark order as delivered from "${order.status}" status` });
      }

      const updated = await storage.updateOrder(orderId, userId, { status: 'delivered' });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.post('/admin/mark-all-delivered', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const isAdmin = user?.isAdmin === 'true';
      if (!isAdmin) return res.status(403).json({ message: 'Admin access required' });

      const result = await db.update(orders)
        .set({ status: 'delivered', updatedAt: new Date() })
        .where(eq(orders.status, 'shipped'))
        .returning();

      res.json({ updated: result.length, message: `${result.length} shipped orders marked as delivered` });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  async function requireFulfillmentAccess(req: any, res: any, next: any) {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    const isAdmin = user?.isAdmin === 'true';
    if (isAdmin) return next();
    const flag = await storage.getFeatureFlag('auto_fulfillment');
    if (flag && flag.isEnabled && !flag.adminOnly) return next();
    return res.status(403).json({ message: 'This feature is not yet available' });
  }

  async function requireJumiaAccess(req: any, res: any, next: any) {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    const isAdmin = user?.isAdmin === 'true';
    if (isAdmin) return next();
    const flag = await storage.getFeatureFlag('jumia_marketplace');
    if (flag && flag.isEnabled && !flag.adminOnly) return next();
    return res.status(403).json({ message: 'Jumia marketplace is not yet available. Stay tuned!' });
  }

  // === DROP-AND-SELL LISTING SERVICE ===

  const DROP_AND_SELL_TESTERS = new Set(['rtrebecca@yahoo.com']);

  async function requireDropAndSellAccess(req: any, res: any, next: any) {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    const isAdmin = user?.isAdmin === 'true';
    if (isAdmin) return next();
    if (user?.email && DROP_AND_SELL_TESTERS.has(user.email.toLowerCase())) return next();
    const flag = await storage.getFeatureFlag('drop_and_sell');
    if (flag && flag.isEnabled && !flag.adminOnly) return next();
    return res.status(403).json({ message: 'Drop-and-Sell service is not yet available' });
  }

  protectedApi.get('/drop-and-sell/orders', requireDropAndSellAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const isAdmin = user?.isAdmin === 'true';
      if (isAdmin) {
        const allOrders = await storage.getAllDropAndSellOrders();
        const enriched = [];
        for (const row of allOrders) {
          const orderUser = await storage.getUser(row.order.userId);
          enriched.push({ ...row.order, freelancer: row.freelancer, customerName: orderUser ? `${orderUser.firstName || ''} ${orderUser.lastName || ''}`.trim() : 'Unknown', customerEmail: orderUser?.email });
        }
        return res.json(enriched);
      }
      const orders = await storage.getDropAndSellOrders(userId);
      const sanitized = orders.map((o: any) => {
        const { freelancerId, listerEarnings, platformFee, payoutStatus, ...safe } = o;
        return safe;
      });
      res.json(sanitized);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.post('/drop-and-sell/orders', requireDropAndSellAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { listingCount, storeId, categories, defaultQuantity, pricePreference, profitMarginPercent, preferredVendors } = req.body;
      if (!listingCount || listingCount < DAS_INCREMENT || listingCount % DAS_INCREMENT !== 0) {
        return res.status(400).json({ message: `Listing count must be in increments of ${DAS_INCREMENT}` });
      }
      const pricePerSet = await getDasPrice();
      const sets = listingCount / DAS_INCREMENT;
      const totalPrice = sets * pricePerSet;
      const listerEarnings = sets * DAS_LISTER_SHARE;
      const platformFee = sets * DAS_PLATFORM_SHARE;

      // Sanitise customer auto-listing preferences. Empty / missing values
      // are stored as "no preference (N/A)" so the lister knows they have a
      // free hand on that question.
      const cleanCategories: string[] = Array.isArray(categories)
        ? categories.map((c: any) => String(c || '').trim()).filter((c: string) => c.length > 0 && c.length <= 80).slice(0, 25)
        : [];
      const qtyParsed = Number(defaultQuantity);
      const cleanQty = Number.isFinite(qtyParsed) && qtyParsed >= 1 && qtyParsed <= 999 ? Math.floor(qtyParsed) : 1;
      const cleanPricePref = pricePreference === 'low' || pricePreference === 'high' ? pricePreference : null;
      // Profit margin markup — whole percentage 1..500. Anything else (null,
      // missing, out of range) is stored as null = "no preference (N/A)".
      const marginParsed = Number(profitMarginPercent);
      const cleanMargin = Number.isFinite(marginParsed) && marginParsed >= 1 && marginParsed <= 500
        ? Math.floor(marginParsed)
        : null;
      // Preferred vendors — empty array = "no preference (N/A)". Stored as
      // vendor names (matches the option labels shown in the customer popup).
      const cleanPreferredVendors: string[] = Array.isArray(preferredVendors)
        ? preferredVendors
            .map((v: any) => String(v || '').trim())
            .filter((v: string) => v.length > 0 && v.length <= 120)
            .slice(0, 50)
        : [];

      const order = await storage.createDropAndSellOrder(userId, {
        listingCount,
        totalPrice: totalPrice.toFixed(2),
        listerEarnings: listerEarnings.toFixed(2),
        platformFee: platformFee.toFixed(2),
        status: 'pending',
        paymentStatus: 'unpaid',
        storeId: storeId || null,
        categories: cleanCategories,
        defaultQuantity: cleanQty,
        pricePreference: cleanPricePref,
        profitMarginPercent: cleanMargin,
        preferredVendors: cleanPreferredVendors,
      });

      const user = await storage.getUser(userId);
      if (user?.email) {
        const { sendDropAndSellNotification } = await import('./email.js');
        sendDropAndSellNotification(user.email, 'order_created', { orderId: order.id, listingCount, totalPrice: totalPrice.toFixed(2) }).catch(() => {});
      }

      res.json(order);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  const DAS_INCREMENT = 120;
  const DAS_DEFAULT_PRICE = 40;
  const DAS_LISTER_SHARE = 30;
  const DAS_PLATFORM_SHARE = 10;
  const DAS_DEADLINE_HOURS = 168;

  async function getDasPrice(): Promise<number> {
    const flag = await storage.getFeatureFlag('drop_and_sell');
    const meta = (flag as any)?.metadata;
    if (meta && typeof meta === 'object' && (meta as any).pricePerSet) {
      return Number((meta as any).pricePerSet);
    }
    if (meta && typeof meta === 'object' && (meta as any).pricePer150) {
      return Number((meta as any).pricePer150);
    }
    return DAS_DEFAULT_PRICE;
  }

  protectedApi.get('/drop-and-sell/pricing', requireDropAndSellAccess, async (_req: any, res) => {
    try {
      const price = await getDasPrice();
      res.json({ pricePerSet: price, increment: DAS_INCREMENT, listerShare: DAS_LISTER_SHARE, platformShare: DAS_PLATFORM_SHARE, deadlineHours: DAS_DEADLINE_HOURS });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.post('/drop-and-sell/pricing', requireDropAndSellAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const isAdmin = user?.isAdmin === 'true';
      if (!isAdmin) return res.status(403).json({ message: 'Admin access required' });

      const { pricePerSet } = req.body;
      if (!pricePerSet || pricePerSet < 1) return res.status(400).json({ message: 'Price must be at least £1' });

      const flag = await storage.getFeatureFlag('drop_and_sell');
      if (flag) {
        await storage.updateFeatureFlag('drop_and_sell', { ...flag, metadata: { ...((flag as any).metadata || {}), pricePerSet: Number(pricePerSet) } } as any);
      }
      res.json({ pricePerSet: Number(pricePerSet) });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.get('/drop-and-sell/payment-cards', requireDropAndSellAccess, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const cards = await storage.getPaymentCards(userId);
    const safeCards = cards.map(c => ({ ...c, tokenizedId: '***' }));
    res.json(safeCards);
  });

  protectedApi.post('/drop-and-sell/payment-cards', requireDropAndSellAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const parsed = paymentCardCreateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: 'Invalid card data', errors: parsed.error.flatten().fieldErrors });
      const card = await storage.createPaymentCard({ ...parsed.data, userId });
      await storage.createAuditLog({ userId, action: 'payment_card_added', details: { lastFour: parsed.data.lastFour, brand: parsed.data.brand } });
      res.json({ ...card, tokenizedId: '***' });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.post('/drop-and-sell/orders/:id/pay', requireDropAndSellAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const orderId = Number(req.params.id);

      const order = await storage.getDropAndSellOrder(orderId, userId);
      if (!order) return res.status(404).json({ message: 'Order not found' });
      if (order.paymentStatus === 'paid') return res.status(400).json({ message: 'Already paid' });

      const totalPrice = parseFloat(order.totalPrice);
      if (!isFinite(totalPrice) || totalPrice <= 0) {
        return res.status(400).json({ message: 'Invalid order total' });
      }

      const user = await storage.getUser(userId);
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
        line_items: [{
          price_data: {
            currency: 'gbp',
            product_data: {
              name: 'Drop-and-Sell Listing Service',
              description: `Professional listing creation for ${order.listingCount} products. Delivered within ${Math.round(DAS_DEADLINE_HOURS / 24)} days.`,
            },
            unit_amount: Math.round(totalPrice * 100),
          },
          quantity: 1,
        }],
        mode: 'payment',
        metadata: { dropAndSellOrderId: String(orderId), userId },
        success_url: `${req.protocol}://${req.get('host')}/drop-and-sell?paid_order=${orderId}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.protocol}://${req.get('host')}/drop-and-sell?cancelled_order=${orderId}`,
      });

      await storage.updateDropAndSellOrder(orderId, { stripeSessionId: session.id });
      res.json({ url: session.url });
    } catch (err: any) {
      console.error('[DropAndSell] Checkout error:', err);
      res.status(500).json({ message: err.message || 'Failed to create checkout session' });
    }
  });

  protectedApi.post('/drop-and-sell/orders/:id/activate-payment', requireDropAndSellAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const orderId = Number(req.params.id);
      const { sessionId } = req.body || {};
      if (!sessionId) return res.status(400).json({ message: 'sessionId required' });

      const order = await storage.getDropAndSellOrder(orderId, userId);
      if (!order) return res.status(404).json({ message: 'Order not found' });
      if (order.paymentStatus === 'paid') return res.json({ success: true, alreadyPaid: true });

      const stripe = await getUncachableStripeClient();
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status !== 'paid' && session.status !== 'complete') {
        return res.status(403).json({ message: 'Payment not completed' });
      }
      if (session.metadata?.userId !== userId || session.metadata?.dropAndSellOrderId !== String(orderId)) {
        return res.status(403).json({ message: 'Session does not match this order' });
      }

      const deadline = new Date(Date.now() + DAS_DEADLINE_HOURS * 60 * 60 * 1000);
      const updated = await storage.updateDropAndSellOrder(orderId, {
        paymentStatus: 'paid',
        status: 'awaiting_assignment',
        deadline,
        stripeSessionId: session.id,
      });
      res.json({ success: true, order: updated });
    } catch (err: any) {
      console.error('[DropAndSell] Activate error:', err);
      res.status(500).json({ message: err.message || 'Failed to activate payment' });
    }
  });

  protectedApi.delete('/drop-and-sell/orders/:id', requireDropAndSellAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const orderId = Number(req.params.id);
      if (!Number.isFinite(orderId)) return res.status(400).json({ message: 'Invalid order id' });

      const requester = await storage.getUser(userId);
      const isAdmin = requester?.isAdmin === 'true';

      // Admin path: allow tidying up the All Jobs table by removing
      // cancelled orders regardless of original owner / payment / freelancer.
      // Still locked to status='cancelled' so paid in-progress work can never
      // be wiped out by a misclick.
      if (isAdmin) {
        const allOrders = await storage.getAllDropAndSellOrders();
        const row = allOrders.find(r => r.order.id === orderId);
        if (!row) return res.status(404).json({ message: 'Order not found' });
        if (row.order.status !== 'cancelled') {
          return res.status(400).json({ message: `Admin delete only works on cancelled orders. This one is "${row.order.status}".` });
        }
        const ok = await storage.deleteDropAndSellOrder(orderId);
        if (!ok) return res.status(500).json({ message: 'Delete failed' });
        console.log(`[DropAndSell] Admin ${requester?.email} deleted cancelled order ${orderId} (originally owned by ${row.order.userId})`);
        return res.json({ success: true });
      }

      // Atomic delete: the storage helper bakes the safety rails (unpaid +
      // no freelancer + status in pending/cancelled) directly into the SQL
      // WHERE clause, so check + delete happen in one statement. This closes
      // the race where Stripe could mark the order paid (or the assigner
      // could pick up the order) between a pre-read and the delete.
      const deleted = await storage.deleteDropAndSellOrder(orderId, { userId, onlyIfSafe: true });

      if (!deleted) {
        // Re-read (still scoped to the user) to give a precise error message
        // about WHY it could not be deleted, instead of a generic 404.
        const order = await storage.getDropAndSellOrder(orderId, userId);
        if (!order) return res.status(404).json({ message: 'Order not found' });
        if (order.paymentStatus === 'paid') {
          return res.status(400).json({ message: 'Cannot delete a paid order. Contact support if you need a refund.' });
        }
        if (order.freelancerId) {
          return res.status(400).json({ message: 'Cannot delete — a freelancer has already been assigned to this order.' });
        }
        return res.status(400).json({ message: `Cannot delete an order with status "${order.status}".` });
      }

      console.log(`[DropAndSell] User ${userId} deleted order ${orderId}`);
      res.json({ success: true });
    } catch (err: any) {
      console.error('[DropAndSell] Delete order error:', err);
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.post('/drop-and-sell/orders/:id/reset-payment', requireDropAndSellAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const isAdmin = user?.isAdmin === 'true';
      if (!isAdmin) return res.status(403).json({ message: 'Admin access required' });

      const orderId = Number(req.params.id);
      const allOrders = await storage.getAllDropAndSellOrders();
      const orderRow = allOrders.find(r => r.order.id === orderId);
      if (!orderRow) return res.status(404).json({ message: 'Order not found' });
      const order = orderRow.order;
      if (order.freelancerId) return res.status(400).json({ message: 'Cannot reset — order is already assigned to a freelancer.' });

      const updated = await storage.updateDropAndSellOrder(orderId, {
        paymentStatus: 'unpaid',
        status: 'pending',
        deadline: null as any,
        stripeSessionId: null as any,
      });
      console.log(`[DropAndSell] Admin ${user?.email} reset payment on order ${orderId}`);
      res.json({ success: true, order: updated });
    } catch (err: any) {
      console.error('[DropAndSell] Reset payment error:', err);
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.post('/drop-and-sell/orders/:id/assign', requireDropAndSellAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const isAdmin = user?.isAdmin === 'true';
      if (!isAdmin) return res.status(403).json({ message: 'Admin access required' });

      const orderId = Number(req.params.id);
      const { freelancerId } = req.body;
      if (!freelancerId) return res.status(400).json({ message: 'Freelancer ID required' });

      const allOrders = await storage.getAllDropAndSellOrders();
      const orderRow = allOrders.find(r => r.order.id === orderId);
      if (!orderRow) return res.status(404).json({ message: 'Order not found' });
      const order = orderRow.order;
      if (order.paymentStatus !== 'paid') return res.status(400).json({ message: 'Order must be paid first' });
      if (order.freelancerId) return res.status(400).json({ message: 'Order is already assigned' });
      if (!['awaiting_assignment', 'pending'].includes(order.status)) return res.status(400).json({ message: 'Order is not in an assignable state' });

      const freelancer = await storage.getFreelancerProfile(freelancerId);
      if (!freelancer) return res.status(404).json({ message: 'Freelancer not found' });

      const updated = await storage.updateDropAndSellOrder(orderId, {
        freelancerId,
        assignedAt: new Date(),
        status: 'in_progress',
      });

      await storage.updateFreelancerProfile(freelancerId, {
        activeJobCount: (freelancer.activeJobCount || 0) + 1,
      });

      const orderUser = await storage.getUser(updated?.userId || '');
      if (orderUser?.email && updated) {
        const { sendDropAndSellNotification } = await import('./email.js');
        sendDropAndSellNotification(orderUser.email, 'assigned', {
          orderId, listingCount: updated.listingCount, freelancerName: freelancer.name
        }).catch(() => {});
      }

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin reassignment — moves an in-progress order from one freelance lister
  // to another. Used when the current lister is not performing (slow, missed
  // deadline, quality issues, gone silent). Decrements the old lister's
  // active job count, swaps in the new lister, restarts the assignment timer,
  // and notifies the customer about who is now handling their order.
  protectedApi.post('/drop-and-sell/orders/:id/reassign', requireDropAndSellAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const isAdmin = user?.isAdmin === 'true';
      if (!isAdmin) return res.status(403).json({ message: 'Admin access required' });

      const orderId = Number(req.params.id);
      const { freelancerId, reason } = req.body;
      if (!freelancerId) return res.status(400).json({ message: 'New freelancer ID required' });

      const allOrders = await storage.getAllDropAndSellOrders();
      const orderRow = allOrders.find(r => r.order.id === orderId);
      if (!orderRow) return res.status(404).json({ message: 'Order not found' });
      const order = orderRow.order;
      if (!order.freelancerId) {
        return res.status(400).json({ message: 'Order has no current freelancer — use Assign instead of Reassign.' });
      }
      if (order.freelancerId === Number(freelancerId)) {
        return res.status(400).json({ message: 'New freelancer is the same as the current one.' });
      }
      // Reassignment is only meaningful while the lister is actively working
      // the order. Awaiting-approval / awaiting-assignment / pending are not
      // valid in-progress states and rewriting status back to in_progress
      // would regress near-complete orders.
      if (!['in_progress', 'partially_completed'].includes(order.status)) {
        return res.status(400).json({ message: `Cannot reassign — order status is "${order.status}". Only in-progress orders can be reassigned.` });
      }

      const newFreelancer = await storage.getFreelancerProfile(Number(freelancerId));
      if (!newFreelancer) return res.status(404).json({ message: 'New freelancer not found' });

      const oldFreelancerId = order.freelancerId;
      const oldFreelancer = await storage.getFreelancerProfile(oldFreelancerId);

      // Build the audit note. Always recorded — even when no reason is given —
      // so the admin trail is complete.
      const today = new Date().toISOString().slice(0, 10);
      const adminLabel = user?.email || userId;
      const oldName = oldFreelancer?.name || `freelancer #${oldFreelancerId}`;
      const auditLine = `[Reassigned by ${adminLabel} on ${today}] ${oldName} → ${newFreelancer.name}${reason ? ` — reason: ${reason}` : ''}`;
      const newNotes = order.notes ? `${order.notes}\n\n${auditLine}` : auditLine;

      // Restart the 7-day delivery clock against the new lister so they get a
      // full window. Status stays in_progress (or partially_completed) so any
      // listings the previous lister already pushed remain credited to the
      // order's progress count.
      //
      // Atomic: wrap order swap + counter math in a single DB transaction.
      // The order UPDATE is guarded by `freelancer_id = oldFreelancerId` so
      // concurrent reassigns / completions cannot lose updates. Counter
      // changes use SQL arithmetic (`active_job_count + 1` /
      // `GREATEST(0, active_job_count - 1)`) so two simultaneous reassigns
      // touching the same lister can't overwrite each other from stale reads.
      const deadlineMs = DAS_DEADLINE_HOURS * 60 * 60 * 1000;
      const newAssignedAt = new Date();
      const newDeadline = new Date(Date.now() + deadlineMs);
      const newStatus = order.status === 'partially_completed' ? 'partially_completed' : 'in_progress';

      let updated: typeof order | undefined;
      try {
        updated = await db.transaction(async (tx) => {
          const [orderRowUpdated] = await tx
            .update(dropAndSellOrders)
            .set({
              freelancerId: Number(freelancerId),
              assignedAt: newAssignedAt,
              deadline: newDeadline,
              status: newStatus,
              notes: newNotes,
              updatedAt: new Date(),
            })
            .where(and(
              eq(dropAndSellOrders.id, orderId),
              eq(dropAndSellOrders.freelancerId, oldFreelancerId),
            ))
            .returning();

          if (!orderRowUpdated) {
            // Another admin (or the system) changed the assignment between
            // our read and our write — abort the transaction so counters
            // don't drift.
            throw new Error('Order assignment changed concurrently. Please refresh and try again.');
          }

          await tx
            .update(freelancerProfiles)
            .set({ activeJobCount: sql`GREATEST(0, COALESCE(${freelancerProfiles.activeJobCount}, 0) - 1)` })
            .where(eq(freelancerProfiles.id, oldFreelancerId));

          await tx
            .update(freelancerProfiles)
            .set({ activeJobCount: sql`COALESCE(${freelancerProfiles.activeJobCount}, 0) + 1` })
            .where(eq(freelancerProfiles.id, newFreelancer.id));

          return orderRowUpdated;
        });
      } catch (txErr: any) {
        return res.status(409).json({ message: txErr.message || 'Reassignment failed due to a concurrent update.' });
      }

      // Notify the customer that their order now has a new lister (reuses the
      // existing 'assigned' email template — same shape, same fields).
      const orderUser = await storage.getUser(updated?.userId || '');
      if (orderUser?.email && updated) {
        const { sendDropAndSellNotification } = await import('./email.js');
        sendDropAndSellNotification(orderUser.email, 'assigned', {
          orderId,
          listingCount: updated.listingCount,
          freelancerName: newFreelancer.name,
        }).catch(() => {});
      }

      console.log(`[DropAndSell] Admin ${user?.email} reassigned order ${orderId} from freelancer ${oldFreelancer?.id ?? order.freelancerId} (${oldFreelancer?.name ?? '?'}) to ${newFreelancer.id} (${newFreelancer.name})${reason ? ` — reason: ${reason}` : ''}`);
      res.json({ ...updated, assignedFreelancer: newFreelancer.name });
    } catch (err: any) {
      console.error('[DropAndSell] Reassign error:', err);
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.post('/drop-and-sell/orders/:id/auto-assign', requireDropAndSellAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const isAdmin = user?.isAdmin === 'true';
      if (!isAdmin) return res.status(403).json({ message: 'Admin access required' });

      const orderId = Number(req.params.id);
      const allOrders = await storage.getAllDropAndSellOrders();
      const orderRow = allOrders.find(r => r.order.id === orderId);
      if (!orderRow) return res.status(404).json({ message: 'Order not found' });
      const order = orderRow.order;
      if (order.paymentStatus !== 'paid') return res.status(400).json({ message: 'Order must be paid first' });
      if (order.freelancerId) return res.status(400).json({ message: 'Order is already assigned' });
      if (!['awaiting_assignment', 'pending'].includes(order.status)) return res.status(400).json({ message: 'Order is not in assignable state' });

      const freelancers = await storage.getFreelancerProfiles();
      const available = freelancers.filter(f => f.isAvailable);
      if (!available.length) return res.status(400).json({ message: 'No available freelancers' });

      available.sort((a, b) => {
        const ratingDiff = parseFloat(b.rating || '0') - parseFloat(a.rating || '0');
        if (Math.abs(ratingDiff) > 0.1) return ratingDiff;
        if (a.activeJobCount !== b.activeJobCount) return a.activeJobCount - b.activeJobCount;
        return a.completedJobs - b.completedJobs;
      });

      const best = available[0];
      const updated = await storage.updateDropAndSellOrder(orderId, {
        freelancerId: best.id,
        assignedAt: new Date(),
        status: 'in_progress',
      });

      await storage.updateFreelancerProfile(best.id, {
        activeJobCount: (best.activeJobCount || 0) + 1,
      });

      const orderUser = await storage.getUser(updated?.userId || '');
      if (orderUser?.email && updated) {
        const { sendDropAndSellNotification } = await import('./email.js');
        sendDropAndSellNotification(orderUser.email, 'assigned', {
          orderId, listingCount: updated.listingCount, freelancerName: best.name
        }).catch(() => {});
      }

      res.json({ ...updated, assignedFreelancer: best.name });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin extends an order's delivery deadline by N hours (default 72 = 3 days).
  // Used when a lister needs more time and we want to keep them on the job
  // rather than reassign. Idempotent in spirit — each call adds N hours to
  // the *current* deadline, and every extension is recorded in notes for the
  // audit trail.
  protectedApi.post('/drop-and-sell/orders/:id/extend-deadline', requireDropAndSellAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const isAdmin = user?.isAdmin === 'true';
      if (!isAdmin) return res.status(403).json({ message: 'Admin access required' });

      const orderId = Number(req.params.id);
      const hoursRaw = Number(req.body?.hours);
      const hours = Number.isFinite(hoursRaw) && hoursRaw > 0 && hoursRaw <= 24 * 30
        ? Math.floor(hoursRaw)
        : 72;

      const allOrders = await storage.getAllDropAndSellOrders();
      const row = allOrders.find(r => r.order.id === orderId);
      if (!row) return res.status(404).json({ message: 'Order not found' });
      const order = row.order;
      if (!['in_progress', 'partially_completed'].includes(order.status)) {
        return res.status(400).json({ message: `Can only extend deadlines on in-progress orders. This one is "${order.status}".` });
      }
      if (!order.deadline) {
        return res.status(400).json({ message: 'Order has no current deadline to extend.' });
      }

      const newDeadline = new Date(new Date(order.deadline).getTime() + hours * 60 * 60 * 1000);
      const today = new Date().toISOString().slice(0, 10);
      const days = Math.round((hours / 24) * 10) / 10;
      const auditLine = `[Deadline extended by ${user?.email || userId} on ${today}] +${hours}h (~${days} day${days === 1 ? '' : 's'}) granted to lister.`;
      const newNotes = order.notes ? `${order.notes}\n\n${auditLine}` : auditLine;

      const updated = await storage.updateDropAndSellOrder(orderId, {
        deadline: newDeadline,
        notes: newNotes,
      });

      console.log(`[DropAndSell] Admin ${user?.email} extended order ${orderId} deadline by ${hours}h → ${newDeadline.toISOString()}`);
      res.json({ ...updated, hoursAdded: hours, newDeadline });
    } catch (err: any) {
      console.error('[DropAndSell] Extend deadline error:', err);
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.post('/drop-and-sell/orders/:id/status', requireDropAndSellAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const isAdmin = user?.isAdmin === 'true';
      if (!isAdmin) return res.status(403).json({ message: 'Admin access required' });

      const orderId = Number(req.params.id);
      const { status, notes, deliverySummary } = req.body;
      const validStatuses = ['pending', 'awaiting_assignment', 'in_progress', 'partially_completed', 'completed', 'cancelled', 'awaiting_approval'];
      if (!validStatuses.includes(status)) return res.status(400).json({ message: 'Invalid status' });

      const updateData: any = { status };
      if (notes !== undefined) updateData.notes = notes;
      if (deliverySummary !== undefined) updateData.deliverySummary = deliverySummary;
      if (status === 'completed') updateData.completedAt = new Date();

      const updated = await storage.updateDropAndSellOrder(orderId, updateData);

      if (status === 'completed' && updated?.freelancerId && updated.paymentStatus === 'paid' && (updated.payoutStatus === 'pending' || !updated.payoutStatus)) {
        const freelancer = await storage.getFreelancerProfile(updated.freelancerId);
        if (freelancer) {
          const earnings = parseFloat(updated.listerEarnings || '0');
          await storage.updateFreelancerProfile(updated.freelancerId, {
            completedJobs: freelancer.completedJobs + 1,
            activeJobCount: Math.max(0, (freelancer.activeJobCount || 0) - 1),
            walletBalance: (parseFloat(freelancer.walletBalance || '0') + earnings).toFixed(2),
            totalEarnings: (parseFloat(freelancer.totalEarnings || '0') + earnings).toFixed(2),
          });
          await storage.updateDropAndSellOrder(orderId, { payoutStatus: 'credited' });
        }
      }

      const orderUser = await storage.getUser(updated?.userId || '');
      if (orderUser?.email && updated) {
        const notifyStatuses = ['in_progress', 'partially_completed', 'completed', 'cancelled', 'awaiting_approval'];
        if (notifyStatuses.includes(status)) {
          const emailType = status === 'awaiting_approval' ? 'completed' : status;
          const { sendDropAndSellNotification } = await import('./email.js');
          sendDropAndSellNotification(orderUser.email, emailType as any, {
            orderId, listingCount: updated.listingCount, notes
          }).catch(() => {});
        }
      }

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.post('/drop-and-sell/orders/:id/approve', requireDropAndSellAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const orderId = Number(req.params.id);
      // Admins can approve on a customer's behalf (e.g. when the customer
      // never logs in to click Approve). Re-uses the same code path so the
      // lister still gets paid + notified exactly the same way.
      const requester = await storage.getUser(userId);
      const isAdmin = requester?.isAdmin === 'true';
      let order;
      if (isAdmin) {
        const allOrders = await storage.getAllDropAndSellOrders();
        order = allOrders.find(r => r.order.id === orderId)?.order;
      } else {
        order = await storage.getDropAndSellOrder(orderId, userId);
      }
      if (!order) return res.status(404).json({ message: 'Order not found' });
      if (order.status !== 'awaiting_approval') {
        return res.status(400).json({ message: 'Order is not awaiting approval' });
      }

      const updated = await storage.updateDropAndSellOrder(orderId, { status: 'completed', completedAt: new Date() });

      if (updated?.freelancerId && updated.paymentStatus === 'paid' && (updated.payoutStatus === 'pending' || !updated.payoutStatus)) {
        const freelancer = await storage.getFreelancerProfile(updated.freelancerId);
        if (freelancer) {
          const earnings = parseFloat(updated.listerEarnings || '0');
          await storage.updateFreelancerProfile(updated.freelancerId, {
            completedJobs: freelancer.completedJobs + 1,
            activeJobCount: Math.max(0, (freelancer.activeJobCount || 0) - 1),
            walletBalance: (parseFloat(freelancer.walletBalance || '0') + earnings).toFixed(2),
            totalEarnings: (parseFloat(freelancer.totalEarnings || '0') + earnings).toFixed(2),
          });
          await storage.updateDropAndSellOrder(orderId, { payoutStatus: 'credited' });
          if (freelancer.email) {
            const { sendDropAndSellNotification } = await import('./email.js');
            sendDropAndSellNotification(freelancer.email, 'delivery_approved', {
              orderId, listingCount: updated.listingCount
            }).catch(() => {});
          }
        }
      }

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.post('/drop-and-sell/orders/:id/reject', requireDropAndSellAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const orderId = Number(req.params.id);
      const order = await storage.getDropAndSellOrder(orderId, userId);
      if (!order) return res.status(404).json({ message: 'Order not found' });
      if (order.status !== 'awaiting_approval') {
        return res.status(400).json({ message: 'Order is not awaiting approval' });
      }

      const { reason } = req.body;
      const updated = await storage.updateDropAndSellOrder(orderId, { status: 'in_progress', notes: reason || 'Revision requested by user' });

      const { sendDropAndSellNotification: sendDasNotif } = await import('./email.js');
      if (order.freelancerId) {
        const freelancer = await storage.getFreelancerProfile(order.freelancerId);
        if (freelancer?.email) {
          sendDasNotif(freelancer.email, 'delivery_rejected', {
            orderId, listingCount: order.listingCount, notes: reason
          }).catch(() => {});
        }
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.post('/drop-and-sell/orders/:id/feedback', requireDropAndSellAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const orderId = Number(req.params.id);
      const order = await storage.getDropAndSellOrder(orderId, userId);
      if (!order) return res.status(404).json({ message: 'Order not found' });
      if (order.status !== 'completed') return res.status(400).json({ message: 'Order must be completed to leave feedback' });

      const { feedback, rating } = req.body;
      if (rating && (rating < 1 || rating > 5)) return res.status(400).json({ message: 'Rating must be 1-5' });

      const updated = await storage.updateDropAndSellOrder(orderId, {
        userFeedback: feedback,
        userRating: rating,
      });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.get('/drop-and-sell/freelancers', requireDropAndSellAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const isAdmin = user?.isAdmin === 'true';
      if (!isAdmin) return res.status(403).json({ message: 'Admin access required' });
      const freelancers = await storage.getFreelancerProfiles();
      res.json(freelancers);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.post('/drop-and-sell/apply', requireDropAndSellAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: 'User not found' });
      if (!user.subscriptionPlan || user.subscriptionPlan === 'none') return res.status(400).json({ message: 'You must have an active subscription to apply' });

      const email = (user.email || '').trim().toLowerCase();
      const existing = await storage.getFreelancerProfiles();
      const existingProfile = existing.find(f => f.email.toLowerCase() === email);
      if (existingProfile) {
        if (existingProfile.applicationStatus === 'pending') return res.status(400).json({ message: 'Your application is already under review' });
        if (existingProfile.applicationStatus === 'approved') return res.status(400).json({ message: 'You are already an approved lister' });
      }

      const { yearsExperience, hasCommunity, communityName, referralsMade } = req.body;
      const validYears = ['less_than_1', '1_2', '3_5', '5_plus'];
      const safeYears = validYears.includes(yearsExperience) ? yearsExperience : null;
      if (!safeYears) return res.status(400).json({ message: 'Please select your years of experience' });
      const safeCommunity = !!hasCommunity;
      const safeReferrals = Math.max(0, parseInt(referralsMade) || 0);
      const listerName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || email.split('@')[0];
      const profile = await storage.createFreelancerProfile({ userId: user.id, name: listerName, email, specialties: [], rating: "5.00", completedJobs: 0, isAvailable: false, walletBalance: "0.00", totalEarnings: "0.00", activeJobCount: 0, yearsExperience: safeYears, hasCommunity: safeCommunity, communityName: safeCommunity ? (communityName || null) : null, referralsMade: safeReferrals, applicationStatus: "pending" });
      res.json(profile);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.get('/drop-and-sell/my-assignments', requireDropAndSellAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user?.email) return res.status(400).json({ message: 'User not found' });

      const freelancers = await storage.getFreelancerProfiles();
      const profile = freelancers.find(f => f.email.toLowerCase() === user.email!.toLowerCase() && f.applicationStatus === 'approved');
      if (!profile) return res.status(403).json({ message: 'You are not an approved lister' });

      const orders = await storage.getDropAndSellOrdersByFreelancer(profile.id);

      const enriched = [];
      for (const order of orders) {
        const requester = await storage.getUser(order.userId);
        const requesterStores = requester ? await storage.getStores(order.userId) : [];
        // All CONNECTED eBay stores on the requester's account. Surfaced
        // so the lister can pick which one to publish into when there are
        // more than one (avoids the funma70 mis-routing incident). The
        // default is whichever store is pinned on the order; if none is
        // pinned, the first ready store wins (UI hint only — the server
        // still re-validates the lister's choice at publish time).
        const allEbayStores = requesterStores.filter(s => s.platform === 'ebay' && s.status !== 'disconnected');
        const orderStoreId = (order as any).storeId as number | null | undefined;
        const ebayStores = allEbayStores.map(s => {
          const creds = (s.credentials as any) || {};
          return {
            id: s.id,
            username: creds.ebayUsername || s.name || null,
            ready: !!(creds.authToken || creds.refreshToken),
            isDefault: orderStoreId ? s.id === orderStoreId : false,
          };
        });
        // Promote whichever store is the "default" so the lister sees it
        // first in the picker.
        ebayStores.sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));
        // Do NOT synthesize a default when none exists — for multi-store
        // customers with no pinned `order.storeId`, the lister must
        // pick explicitly. (Server's helper also refuses ambiguous calls.)
        const primary = ebayStores.find(s => s.isDefault) || (ebayStores.length === 1 ? ebayStores[0] : undefined);
        const ebayUsername = primary?.username || null;
        // ebayStoreReady = at least one connected eBay store has a usable
        // token. The lister sees this as a green "Linked" badge.
        const ebayStoreReady = ebayStores.some(s => s.ready);

        enriched.push({
          id: order.id,
          listingCount: order.listingCount,
          progressCount: order.progressCount,
          status: order.status,
          deadline: order.deadline,
          assignedAt: order.assignedAt,
          completedAt: order.completedAt,
          notes: order.notes,
          createdAt: order.createdAt,
          requesterName: requester ? `${requester.firstName || ''} ${requester.lastName || ''}`.trim() || 'Unknown' : 'Unknown',
          requesterEmail: requester?.email || '',
          ebayUsername: ebayUsername,
          ebayStoreId: primary?.id || null,
          ebayStoreReady,
          // Full list of choices for the dialog's store picker.
          ebayStores,
          // Surface the customer's auto-listing preferences so the lister
          // can match the work to what the buyer actually wants. All three
          // can be empty/null which means "no preference (N/A)".
          categories: Array.isArray((order as any).categories) ? (order as any).categories : [],
          defaultQuantity: (order as any).defaultQuantity ?? 1,
          pricePreference: (order as any).pricePreference ?? null,
          profitMarginPercent: (order as any).profitMarginPercent ?? null,
          preferredVendors: Array.isArray((order as any).preferredVendors) ? (order as any).preferredVendors : [],
        });
      }

      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ===== SHARED LISTER -> CUSTOMER eBay LISTING HELPER =====
  // Used by:
  //   1. POST /drop-and-sell/orders/:id/list-product  (web dialog on /drop-and-sell)
  //   2. POST /api/extension/drop-and-sell/import     (Chrome extension, mounted below)
  // Both paths funnel through this helper so the safety guarantees
  // (atomic slot reservation, fail-closed SKU mapping, publish-failure
  // rollback) are identical regardless of how the lister submitted the
  // listing. The web dialog wraps it for backwards-compatible behaviour;
  // the extension uses it to push the rich vendor scrape (variations,
  // vendor stock, multiple images) directly into the customer's eBay.
  type ListerListingInput = {
    vendorUrl: string;
    title: string;
    description?: string;
    brand?: string;
    sellingPrice: string;
    costPrice?: string;
    sku: string;
    quantity?: number;
    images: string[];
    deliveryType?: 'buyer_pays' | 'seller_pays' | 'free';
    deliveryCost?: string;
    variations?: any[];
    vendorStock?: { quantity?: number | null; inStock?: boolean } | number | null;
    // Lister's explicit choice of which connected eBay store on the
    // requester's account to publish into. Overrides the order's pinned
    // default. Set when the requester has multiple eBay stores and the
    // lister picks one from the dialog.
    storeId?: number;
  };
  type ListerListingResult =
    | { ok: true; productId: number; externalId: string; listingUrl: string | null; progress: number; total: number; complete: boolean }
    | { ok: false; status: number; message: string };

  async function performListProductIntoCustomerEbay(
    callerProfile: { id: number; name: string },
    order: { id: number; userId: string; listingCount: number; progressCount: number | null; status: string | null; paymentStatus: string | null; freelancerId: number | null },
    input: ListerListingInput,
    context: 'web_dialog' | 'extension',
  ): Promise<ListerListingResult> {
    const orderId = order.id;
    const deliveryCost = input.deliveryCost === undefined ? '0' : String(input.deliveryCost);
    const costPrice = input.costPrice !== undefined && String(input.costPrice).trim() !== ''
      ? String(input.costPrice)
      : input.sellingPrice;
    const quantity = input.quantity ?? 1;

    // Load REQUESTER's eBay store + ensure their token is fresh.
    //
    // Routing precedence (most-specific to least-specific):
    //   1. input.storeId — the lister explicitly picked this store in the
    //      dialog. Always wins, as long as it belongs to the requester
    //      and is still connected.
    //   2. order.storeId — the default pinned to the order (e.g. set by
    //      admin or chosen at order creation). Acts as the lister's
    //      pre-selected option.
    //   3. If the requester has exactly one connected eBay store, use it.
    //   4. Otherwise refuse to guess — the lister must pick one. This
    //      prevents the May-2026 funma70 incident where the helper
    //      silently routed listings to the wrong of two connected stores.
    const requesterStores = await storage.getStores(order.userId);
    const ebayStores = requesterStores.filter(s => s.platform === 'ebay' && s.status !== 'disconnected');
    const orderStoreId = (order as any).storeId as number | null | undefined;
    const requestedStoreId = typeof input.storeId === 'number' && Number.isFinite(input.storeId) ? input.storeId : undefined;

    let ebayStore = requestedStoreId ? ebayStores.find(s => s.id === requestedStoreId) : undefined;
    if (!ebayStore && requestedStoreId) {
      return { ok: false, status: 400, message: `The eBay store you selected (id ${requestedStoreId}) is not connected on the requester's account. Refresh and pick another.` };
    }
    if (!ebayStore && orderStoreId) {
      ebayStore = ebayStores.find(s => s.id === orderStoreId);
    }
    if (!ebayStore) {
      if (ebayStores.length > 1) {
        return { ok: false, status: 400, message: `The requester has ${ebayStores.length} eBay stores connected. Pick which one to publish into.` };
      }
      ebayStore = ebayStores[0];
    }
    if (!ebayStore) {
      return { ok: false, status: 400, message: 'The requester has not connected an eBay store yet. Ask them to connect one in Stores.' };
    }
    const expectedUsername = (ebayStore.credentials as any)?.ebayUsername || undefined;
    const tokenResult = await refreshEbayTokenIfNeeded(
      ebayStore,
      order.userId,
      expectedUsername ? { verifyIdentityFor: expectedUsername } : undefined,
    );
    if (!tokenResult.ok) {
      return { ok: false, status: 400, message: `Requester's eBay token problem: ${tokenResult.message}` };
    }
    const credentials = tokenResult.credentials;

    // VeRO sanitize on REQUESTER's account.
    const sanitized = await storage.sanitizeVeroContent(
      order.userId,
      input.title,
      input.description || '',
      input.brand || ''
    );
    const cleanTitle = sanitized.title;
    const cleanDesc = sanitized.description;
    const cleanBrand = sanitized.brand;

    const contentCheck = await storage.checkContentViolations(order.userId, `${cleanTitle} ${cleanDesc}`);
    if (contentCheck.hasViolations) {
      const detail = contentCheck.violations.map(v => `${v.type}: ${v.matches.join(', ')}`).join('; ');
      return { ok: false, status: 400, message: `Personal information detected (${detail}). Remove personal info before listing.` };
    }
    const restrictedCheck = await storage.checkRestrictedViolations(order.userId, cleanTitle, cleanDesc);
    if (restrictedCheck.isBlocked) {
      const items = restrictedCheck.violations.map(v => `${v.keyword} (${v.category})`).join(', ');
      return { ok: false, status: 400, message: `Restricted product (${items}). This item cannot be listed.` };
    }

    // ATOMIC RESERVATION — bumps progress_count + auto-flips status, but
    // only if every guard still holds at the moment of the SQL UPDATE.
    const reserved = await storage.tryReserveDropAndSellListingSlot(orderId, callerProfile.id);
    if (!reserved) {
      return { ok: false, status: 409, message: 'Could not reserve a listing slot — the order may have just hit its quota, been reassigned, or had its payment reverted. Refresh and try again.' };
    }
    const newProgress = reserved.progressCount;

    const releaseSlot = async () => {
      try { await storage.releaseDropAndSellListingSlot(orderId); } catch (releaseErr: any) {
        console.error(`[DropAndSell helper] Failed to release slot for order ${orderId}: ${releaseErr.message}`);
      }
    };

    // Resolve (or auto-create) vendor under REQUESTER's account.
    let vendorId: number | null = null;
    let vendorHostname = '';
    let vendorOrigin = '';
    try {
      const url = new URL(input.vendorUrl);
      vendorHostname = url.hostname.replace(/^www\./, '').toLowerCase();
      vendorOrigin = url.origin;
    } catch { /* validated upstream */ }

    const detectedVendorType = detectVendorFromUrl(input.vendorUrl);
    const derivedVendorName = deriveVendorNameFromHostname(vendorHostname);
    try {
      const existingVendors = await storage.getVendors(order.userId);
      let matchedVendor = existingVendors.find(v => {
        if (!v.website) return false;
        try {
          const existingHost = new URL(v.website).hostname.replace(/^www\./, '').toLowerCase();
          return existingHost === vendorHostname;
        } catch { return false; }
      });
      if (!matchedVendor) {
        matchedVendor = existingVendors.find(v => v.name.toLowerCase() === derivedVendorName.toLowerCase());
      }
      if (matchedVendor) {
        vendorId = matchedVendor.id;
      } else if (vendorHostname) {
        const newVendor = await storage.createVendor({
          userId: order.userId,
          name: derivedVendorName,
          website: vendorOrigin || '',
          integrationType: 'custom',
          config: { source: context === 'extension' ? 'drop_and_sell_extension' : 'drop_and_sell', vendorType: detectedVendorType },
        });
        vendorId = newVendor.id;
      }
    } catch (vendorErr: any) {
      console.error(`[DropAndSell helper] Vendor resolve failed for order ${orderId}: ${vendorErr.message}`);
    }

    const productAttributes: Record<string, any> = {
      sourceUrl: input.vendorUrl,
      vendorType: detectedVendorType,
      vendorName: derivedVendorName,
      listedVia: context === 'extension' ? 'drop_and_sell_extension' : 'drop_and_sell',
      dropAndSellOrderId: orderId,
      dropAndSellFreelancerId: callerProfile.id,
    };
    if (input.variations && Array.isArray(input.variations) && input.variations.length > 0) {
      productAttributes.variations = input.variations;
    }
    if (input.vendorStock !== undefined && input.vendorStock !== null) {
      const vs: any = input.vendorStock;
      productAttributes.vendorStock = {
        quantity: typeof vs === 'object' ? (vs.quantity ?? null) : Number(vs),
        inStock: typeof vs === 'object' ? !!vs.inStock : Number(vs) > 0,
        lastChecked: new Date().toISOString(),
      };
    }

    let product: any;
    try {
      product = await storage.createProduct({
        userId: order.userId,
        vendorId: vendorId,
        title: cleanTitle,
        description: cleanDesc,
        brand: cleanBrand,
        sku: input.sku,
        costPrice,
        sellingPrice: input.sellingPrice,
        quantity,
        images: input.images,
        attributes: productAttributes,
        deliveryType: input.deliveryType || 'buyer_pays',
        deliveryCost,
        veroStatus: 'clean',
        listedByFreelancerId: callerProfile.id,
      } as any);
    } catch (createErr: any) {
      await releaseSlot();
      return { ok: false, status: 500, message: `Could not save product: ${createErr.message}` };
    }

    // SKU mapping (fail-closed + rollback-safe — see web-dialog handler comments below).
    let preExistingMappingId: number | null = null;
    try {
      const pre = await storage.getSkuMappingByEbaySku(order.userId, input.sku);
      preExistingMappingId = pre?.id ?? null;
    } catch (lookupErr: any) {
      console.error(`[DropAndSell helper] Pre-existing SKU mapping lookup FAILED for ${input.sku} — aborting before publish: ${lookupErr.message}`);
      try { await storage.deleteProduct(product.id, order.userId); } catch {}
      await releaseSlot();
      return { ok: false, status: 500, message: 'Could not verify SKU mapping state before publishing. Please try again.' };
    }
    try {
      await autoCreateSkuMapping(order.userId, product);
    } catch (mapErr: any) {
      console.error(`[DropAndSell helper] Auto-SKU mapping threw for product ${product.id}: ${mapErr.message}`);
    }
    let activeMapping;
    try {
      activeMapping = await storage.getSkuMappingByEbaySku(order.userId, input.sku);
    } catch (lookupErr: any) {
      console.error(`[DropAndSell helper] SKU mapping lookup failed for ${input.sku}: ${lookupErr.message}`);
    }
    if (!activeMapping) {
      console.error(`[DropAndSell helper] SKU mapping NOT created for product ${product.id} sku ${input.sku} — refusing to publish`);
      try { await storage.deleteProduct(product.id, order.userId); } catch {}
      await releaseSlot();
      return { ok: false, status: 500, message: 'Could not create the SKU-to-vendor mapping needed for fulfillment. The listing was not published.' };
    }
    const mappingCreatedNow = preExistingMappingId === null || activeMapping.id !== preExistingMappingId;

    const rollbackEverythingAndFail = async (status: number, message: string): Promise<ListerListingResult> => {
      if (mappingCreatedNow) {
        try { await storage.deleteSkuMapping(activeMapping!.id, order.userId); } catch (delMapErr: any) {
          console.error(`[DropAndSell helper] Failed to clean up SKU mapping ${activeMapping!.id}: ${delMapErr.message}`);
        }
      }
      try { await storage.deleteProduct(product.id, order.userId); } catch (delErr: any) {
        console.error(`[DropAndSell helper] Failed to clean up orphan product ${product.id}: ${delErr.message}`);
      }
      await releaseSlot();
      return { ok: false, status, message };
    };

    const publishPayload = {
      title: cleanTitle,
      description: cleanDesc,
      price: input.sellingPrice,
      sku: input.sku,
      quantity,
      images: input.images,
      deliveryType: input.deliveryType || 'buyer_pays',
      deliveryCost,
      // Pass variations through to eBay so multi-variant listings (sizes,
      // colours, lengths, etc.) actually appear as a buyer-selectable
      // dropdown on the live listing instead of a single fixed item.
      variations: Array.isArray(input.variations) && input.variations.length > 0 ? input.variations : undefined,
      // Pass brand and AI-saved item specifics through so eBay's required
      // "Item Specifics" fields (Brand, Type, MPN, Colour, etc.) get pre-filled
      // with the reviewed values instead of guessed-from-title heuristics.
      // Use cleanBrand (already VeRO-sanitised → "Unbranded" on hit) instead of
      // the raw product.brand so a flagged brand cannot bypass the safety pass.
      brand: await veroSafeBrand(order.userId, cleanBrand || (product as any).brand || '', (product as any).id, 'ebay'),
      attributes: (await (async () => {
        const attrs = ((product as any).attributes || {}) as Record<string, any>;
        const safeSpecs = await sanitizeItemSpecificsBrand(order.userId, attrs.itemSpecifics, (product as any).id, 'ebay');
        return safeSpecs ? { ...attrs, itemSpecifics: safeSpecs } : attrs;
      })()),
    };
    console.log(`[DropAndSell helper] (${context}) Lister "${callerProfile.name}" listing for requester ${order.userId} (@${credentials.ebayUsername || 'unknown'}) on order ${orderId}${publishPayload.variations ? ` with ${publishPayload.variations.length} variation(s)` : ''}`);

    let publishResult;
    try {
      publishResult = await publishToMarketplace('ebay', credentials, publishPayload);
    } catch (publishThrow: any) {
      console.error(`[DropAndSell helper] Publish threw for order ${orderId}: ${publishThrow.message}`);
      return rollbackEverythingAndFail(502, `Unexpected error publishing to eBay: ${publishThrow.message}. The listing was not created.`);
    }
    if (!publishResult.success) {
      const reason = publishResult.error || 'eBay publish failed';
      console.error(`[DropAndSell helper] Publish failed for order ${orderId}: ${reason}`);
      return rollbackEverythingAndFail(502, `eBay rejected the listing: ${reason}`);
    }

    try {
      await storage.createMarketplaceListing({
        storeId: ebayStore.id,
        productId: product.id,
        externalId: publishResult.externalId,
        listingUrl: publishResult.listingUrl || null,
        status: 'active',
        syncStatus: 'synced',
      });
    } catch (listingErr: any) {
      console.error(`[DropAndSell helper] Listing live on eBay (${publishResult.externalId}) but DB write failed: ${listingErr.message}`);
    }

    console.log(`[DropAndSell helper] Listed product ${product.id} on eBay (${publishResult.externalId}) for order ${orderId} — progress ${newProgress}/${order.listingCount}`);
    return {
      ok: true,
      productId: product.id,
      externalId: publishResult.externalId,
      listingUrl: publishResult.listingUrl || null,
      progress: newProgress,
      total: order.listingCount,
      complete: newProgress >= order.listingCount,
    };
  }

  // Lister "act on requester's eBay store" — the lister submits a listing
  // through this endpoint and the server proxies the eBay call using the
  // REQUESTER's stored token. The lister never sees the token itself, can
  // only act on orders that are explicitly assigned to them, and can only
  // create listings up to the order's purchased quota (listingCount).
  protectedApi.post('/drop-and-sell/orders/:id/list-product', requireDropAndSellAccess, async (req: any, res) => {
    try {
      const callerId = req.user.claims.sub;
      const caller = await storage.getUser(callerId);
      if (!caller?.email) return res.status(403).json({ message: 'You must be signed in.' });

      const orderId = Number(req.params.id);
      if (!Number.isFinite(orderId)) return res.status(400).json({ message: 'Invalid order id' });

      // Validate the lister is approved AND is the assigned freelancer for this order
      const allFreelancers = await storage.getFreelancerProfiles();
      const callerProfile = allFreelancers.find(
        f => f.email.toLowerCase() === caller.email!.toLowerCase() && f.applicationStatus === 'approved'
      );
      if (!callerProfile) return res.status(403).json({ message: 'You are not an approved lister.' });

      const allOrders = await storage.getAllDropAndSellOrders();
      const orderRow = allOrders.find(r => r.order.id === orderId);
      if (!orderRow) return res.status(404).json({ message: 'Order not found' });
      const order = orderRow.order;

      // Friendly precheck — gives a clearer error message than the atomic
      // reservation below would. The reservation is what truly enforces the
      // guards (it bakes them into a single SQL WHERE).
      if (order.freelancerId !== callerProfile.id) {
        return res.status(403).json({ message: 'This order is not assigned to you.' });
      }
      if (order.paymentStatus !== 'paid') {
        return res.status(400).json({ message: 'Cannot list — the requester has not paid for this order yet.' });
      }
      if (!['in_progress', 'partially_completed'].includes(order.status || '')) {
        return res.status(400).json({ message: `Cannot list — order status is "${order.status}".` });
      }
      if ((order.progressCount || 0) >= order.listingCount) {
        return res.status(400).json({ message: 'This order is already fully listed.' });
      }

      // Validate the listing payload from the lister.
      //
      // ARCHITECTURE: as of 2026-05-04 every Drop-and-Sell listing must be
      // sourced from a real vendor product page (Amazon, AliExpress, Walmart,
      // Etsy, Shein, eBay, etc). This lets us:
      //   1. Auto-create a vendor row under the customer's account (so the
      //      product shows up in their inventory grouped by vendor).
      //   2. Auto-create a sku_mappings row that links eBay SKU -> vendor URL
      //      so the customer's existing fulfillment automation can place the
      //      vendor order automatically when the eBay buyer pays.
      // Without that mapping the customer would have to manually figure out
      // where to source every item — defeating the whole point of the service.
      const listProductSchema = z.object({
        vendorUrl: z.string().trim().url('Vendor product URL must be a valid URL').refine(
          (u) => isValidVendorUrl(u),
          'Vendor product URL must be a real product page (e.g. Amazon, AliExpress, Walmart, Etsy, Shein, eBay)'
        ),
        title: z.string().trim().min(1, 'Title is required').max(200),
        description: z.string().optional().default(''),
        brand: z.string().optional().default(''),
        // sellingPrice = the price to list it for on the customer's eBay.
        // costPrice = what the lister will pay the vendor (used by the
        // customer's fulfillment to know the budget for auto-ordering).
        sellingPrice: z.union([z.string(), z.number()]).transform(v => String(v)),
        costPrice: z.union([z.string(), z.number()]).optional(),
        sku: z.string().trim().min(1, 'SKU is required').max(100),
        quantity: z.coerce.number().int().min(1).default(1),
        images: z.array(z.string().url()).min(1, 'At least one image URL is required').max(24),
        deliveryType: z.enum(['buyer_pays', 'seller_pays', 'free']).optional().default('buyer_pays'),
        deliveryCost: z.union([z.string(), z.number()]).optional(),
        // Optional variations payload (size/colour/etc.) — passed straight
        // through to publishToMarketplace so the live eBay listing shows a
        // buyer-selectable dropdown.
        variations: z.array(z.any()).optional(),
        // Optional explicit eBay store to publish into. Used when the
        // requester has more than one eBay store connected and the lister
        // picked one in the dialog. Omit to fall back to the order's
        // default-pinned store or the lone connected store.
        storeId: z.coerce.number().int().positive().optional(),
      });
      const parsed = listProductSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues.map(i => i.message).join('; ') });
      }
      const input = parsed.data;
      const deliveryCost = input.deliveryCost === undefined ? '0' : String(input.deliveryCost);
      // If the lister didn't enter a separate cost price, fall back to the
      // selling price so the product still saves cleanly. The customer can
      // adjust later from their inventory.
      const costPrice = input.costPrice !== undefined && String(input.costPrice).trim() !== ''
        ? String(input.costPrice)
        : input.sellingPrice;

      // Load the REQUESTER's eBay store + ensure their token is fresh.
      // Routing precedence: explicit input.storeId → order.storeId → lone
      // connected store → ask the lister to pick. Mirrors the helper at
      // performListProductIntoCustomerEbay so the web dialog and the
      // helper-based paths behave identically.
      const requesterStores = await storage.getStores(order.userId);
      const ebayStores = requesterStores.filter(s => s.platform === 'ebay' && s.status !== 'disconnected');
      const orderStoreId = (order as any).storeId as number | null | undefined;
      const requestedStoreId = input.storeId;
      let ebayStore = requestedStoreId ? ebayStores.find(s => s.id === requestedStoreId) : undefined;
      if (!ebayStore && requestedStoreId) {
        return res.status(400).json({ message: `The eBay store you selected (id ${requestedStoreId}) is not connected on the requester's account. Refresh and pick another.` });
      }
      if (!ebayStore && orderStoreId) {
        ebayStore = ebayStores.find(s => s.id === orderStoreId);
      }
      if (!ebayStore) {
        if (ebayStores.length > 1) {
          return res.status(400).json({ message: `The requester has ${ebayStores.length} eBay stores connected. Pick which one to publish into.` });
        }
        ebayStore = ebayStores[0];
      }
      if (!ebayStore) {
        return res.status(400).json({ message: 'The requester has not connected an eBay store yet. Ask them to connect one in Stores.' });
      }
      // Pass verifyIdentityFor when the store has a known ebayUsername so a
      // refreshed token that suddenly belongs to a different eBay account is
      // rejected (fail-closed) rather than silently persisted.
      const expectedUsername = (ebayStore.credentials as any)?.ebayUsername || undefined;
      const tokenResult = await refreshEbayTokenIfNeeded(
        ebayStore,
        order.userId,
        expectedUsername ? { verifyIdentityFor: expectedUsername } : undefined,
      );
      if (!tokenResult.ok) {
        return res.status(400).json({ message: `Requester's eBay token problem: ${tokenResult.message}` });
      }
      const credentials = tokenResult.credentials;

      // Run VeRO sanitize on the requester's account (mirror the user-facing
      // publish flow at line ~7463) so any flagged brand terms are stripped
      // out before we publish to the requester's store.
      const sanitized = await storage.sanitizeVeroContent(
        order.userId,
        input.title,
        input.description || '',
        input.brand || ''
      );
      const cleanTitle = sanitized.title;
      const cleanDesc = sanitized.description;
      const cleanBrand = sanitized.brand;

      const contentCheck = await storage.checkContentViolations(order.userId, `${cleanTitle} ${cleanDesc}`);
      if (contentCheck.hasViolations) {
        const detail = contentCheck.violations.map(v => `${v.type}: ${v.matches.join(', ')}`).join('; ');
        return res.status(400).json({ message: `Personal information detected (${detail}). Remove personal info before listing.` });
      }
      const restrictedCheck = await storage.checkRestrictedViolations(order.userId, cleanTitle, cleanDesc);
      if (restrictedCheck.isBlocked) {
        const items = restrictedCheck.violations.map(v => `${v.keyword} (${v.category})`).join(', ');
        return res.status(400).json({ message: `Restricted product (${items}). This item cannot be listed.` });
      }

      // ATOMIC RESERVATION — bumps progress_count + auto-flips status, but
      // only if every guard still holds at the moment of the SQL UPDATE.
      // This eliminates the TOCTOU race where two concurrent calls could
      // both pass the precheck and over-publish past the purchased quota.
      const reserved = await storage.tryReserveDropAndSellListingSlot(orderId, callerProfile.id);
      if (!reserved) {
        return res.status(409).json({ message: 'Could not reserve a listing slot — the order may have just hit its quota, been reassigned, or had its payment reverted. Refresh and try again.' });
      }
      const newProgress = reserved.progressCount;

      // Helper to roll back the reservation on any downstream failure so a
      // failed listing doesn't waste a slot from the requester's quota.
      const releaseSlotAndFail = async (status: number, body: any) => {
        try { await storage.releaseDropAndSellListingSlot(orderId); } catch (releaseErr: any) {
          console.error(`[DropAndSell] Failed to release slot for order ${orderId}: ${releaseErr.message}`);
        }
        return res.status(status).json(body);
      };

      // Resolve (or auto-create) a vendor row under the REQUESTER's account
      // from the vendor product URL. Mirrors the logic in /api/extension/import
      // (~line 11293) so the customer ends up with a single vendor row per
      // hostname, regardless of whether they imported via extension, manual
      // entry, or this Drop-and-Sell flow.
      let vendorId: number | null = null;
      let vendorHostname = '';
      let vendorOrigin = '';
      try {
        const url = new URL(input.vendorUrl);
        vendorHostname = url.hostname.replace(/^www\./, '').toLowerCase();
        vendorOrigin = url.origin;
      } catch { /* validated above by zod, shouldn't hit */ }

      const detectedVendorType = detectVendorFromUrl(input.vendorUrl);
      const derivedVendorName = deriveVendorNameFromHostname(vendorHostname);
      try {
        const existingVendors = await storage.getVendors(order.userId);
        let matchedVendor = existingVendors.find(v => {
          if (!v.website) return false;
          try {
            const existingHost = new URL(v.website).hostname.replace(/^www\./, '').toLowerCase();
            return existingHost === vendorHostname;
          } catch { return false; }
        });
        if (!matchedVendor) {
          matchedVendor = existingVendors.find(v => v.name.toLowerCase() === derivedVendorName.toLowerCase());
        }
        if (matchedVendor) {
          vendorId = matchedVendor.id;
        } else if (vendorHostname) {
          const newVendor = await storage.createVendor({
            userId: order.userId,
            name: derivedVendorName,
            website: vendorOrigin || '',
            integrationType: 'custom',
            config: { source: 'drop_and_sell', vendorType: detectedVendorType },
          });
          vendorId = newVendor.id;
        }
      } catch (vendorErr: any) {
        // Don't block the listing on a vendor-row hiccup — we'll still create
        // the product with a null vendorId and the SKU mapping will record
        // the vendor URL directly. The customer can fix the vendor link later.
        console.error(`[DropAndSell] Vendor resolve failed for order ${orderId}: ${vendorErr.message}`);
      }

      // Create the product under the REQUESTER's account (so it shows in
      // their Inventory like any product they uploaded themselves), stamped
      // with the lister's freelancer profile id so they can find it again
      // in the "My Listings" tab.
      let product;
      try {
        product = await storage.createProduct({
          userId: order.userId,
          vendorId: vendorId,
          title: cleanTitle,
          description: cleanDesc,
          brand: cleanBrand,
          sku: input.sku,
          costPrice,
          sellingPrice: input.sellingPrice,
          quantity: input.quantity,
          images: input.images,
          attributes: {
            sourceUrl: input.vendorUrl,
            vendorType: detectedVendorType,
            vendorName: derivedVendorName,
            listedVia: 'drop_and_sell',
            dropAndSellOrderId: orderId,
            dropAndSellFreelancerId: callerProfile.id,
          },
          deliveryType: input.deliveryType,
          deliveryCost,
          veroStatus: 'clean',
          listedByFreelancerId: callerProfile.id,
        } as any);
      } catch (createErr: any) {
        return releaseSlotAndFail(500, { message: `Could not save product: ${createErr.message}` });
      }

      // Critical for fulfillment: create the eBay-SKU -> vendor-URL mapping
      // under the customer's account BEFORE we publish to eBay. Once an order
      // comes in for this listing, the customer's existing auto-fulfillment
      // looks up the SKU here to find which vendor URL to source from.
      //
      // FAIL-CLOSED + ROLLBACK-SAFE strategy:
      //  1. Snapshot whether a mapping for this (customer, SKU) already
      //     existed BEFORE this request — capture its id so we can tell the
      //     pre-existing row apart from any row this request creates.
      //  2. Call autoCreateSkuMapping (which swallows its own errors).
      //  3. Lookup again. If still nothing: abort the publish entirely.
      //  4. Set `mappingCreatedNow` ONLY if the resulting mapping is a brand
      //     new row (no pre-existing OR a different id). The rollback path
      //     will only delete the mapping when this flag is true — so we
      //     never delete a mapping that already belonged to another listing.
      let preExistingMappingId: number | null = null;
      try {
        const pre = await storage.getSkuMappingByEbaySku(order.userId, input.sku);
        preExistingMappingId = pre?.id ?? null;
      } catch (lookupErr: any) {
        // Hard-fail before publishing: if we can't read the baseline mapping
        // state, we won't be able to safely decide who owns the post-create
        // mapping (and therefore who is allowed to delete it on rollback).
        // Aborting now is far cheaper than risking a wrong-mapping deletion.
        console.error(`[DropAndSell] Pre-existing SKU mapping lookup FAILED for ${input.sku} — aborting before publish: ${lookupErr.message}`);
        try { await storage.deleteProduct(product.id, order.userId); } catch {}
        return releaseSlotAndFail(500, {
          message: 'Could not verify SKU mapping state before publishing. Please try again.',
        });
      }
      try {
        await autoCreateSkuMapping(order.userId, product);
      } catch (mapErr: any) {
        console.error(`[DropAndSell] Auto-SKU mapping threw for product ${product.id}: ${mapErr.message}`);
      }
      let activeMapping;
      try {
        activeMapping = await storage.getSkuMappingByEbaySku(order.userId, input.sku);
      } catch (lookupErr: any) {
        console.error(`[DropAndSell] SKU mapping lookup failed for ${input.sku}: ${lookupErr.message}`);
      }
      if (!activeMapping) {
        console.error(`[DropAndSell] SKU mapping NOT created for product ${product.id} sku ${input.sku} — refusing to publish (would be unfulfillable)`);
        try { await storage.deleteProduct(product.id, order.userId); } catch (delErr: any) {
          console.error(`[DropAndSell] Cleanup of orphan product ${product.id} failed: ${delErr.message}`);
        }
        return releaseSlotAndFail(500, {
          message: 'Could not create the SKU-to-vendor mapping needed for fulfillment. The listing was not published. Please try again — if this keeps happening, check that the SKU is unique.',
        });
      }
      const mappingCreatedNow = preExistingMappingId === null || activeMapping.id !== preExistingMappingId;
      if (!mappingCreatedNow) {
        console.log(`[DropAndSell] Re-using pre-existing SKU mapping ${activeMapping.id} for ${input.sku} (no rollback ownership)`);
      }

      // Helper that cleans up everything THIS request created (product + slot,
      // and the SKU mapping ONLY if we created it ourselves) and returns the
      // appropriate HTTP error. Used by both the graceful-failure
      // (publishResult.success === false) and the unexpected-throw paths so
      // neither can leak a half-listed state — and so we never delete a SKU
      // mapping that pre-dates this request and is in use elsewhere.
      const rollbackEverythingAndFail = async (status: number, body: any) => {
        if (mappingCreatedNow) {
          try { await storage.deleteSkuMapping(activeMapping!.id, order.userId); } catch (delMapErr: any) {
            console.error(`[DropAndSell] Failed to clean up SKU mapping ${activeMapping!.id}: ${delMapErr.message}`);
          }
        }
        try { await storage.deleteProduct(product.id, order.userId); } catch (delErr: any) {
          console.error(`[DropAndSell] Failed to clean up orphan product ${product.id}: ${delErr.message}`);
        }
        return releaseSlotAndFail(status, body);
      };

      const publishPayload = {
        title: cleanTitle,
        description: cleanDesc,
        price: input.sellingPrice,
        sku: input.sku,
        quantity: input.quantity,
        images: input.images,
        deliveryType: input.deliveryType,
        deliveryCost,
        // Carry variations through so the buyer sees a dropdown on eBay
        // instead of a single fixed listing.
        variations: Array.isArray((input as any).variations) && (input as any).variations.length > 0 ? (input as any).variations : undefined,
        // Pass brand + AI-saved item specifics so eBay's required Item
        // Specifics fields (Brand, Type, MPN, Colour, etc.) are pre-filled
        // with the reviewed values instead of guessed-from-title heuristics.
        // VeRO-safe: cleanBrand has already been sanitised; we also re-check
        // and sanitise the saved itemSpecifics.Brand so a flagged value
        // cannot reach eBay's <ItemSpecifics> XML.
        brand: await veroSafeBrand(order.userId, cleanBrand || (product as any).brand || '', (product as any).id, 'ebay'),
        attributes: (await (async () => {
          const attrs = ((product as any).attributes || {}) as Record<string, any>;
          const safeSpecs = await sanitizeItemSpecificsBrand(order.userId, attrs.itemSpecifics, (product as any).id, 'ebay');
          return safeSpecs ? { ...attrs, itemSpecifics: safeSpecs } : attrs;
        })()),
      };
      console.log(`[DropAndSell] Lister "${callerProfile.name}" listing product for requester ${order.userId} (@${credentials.ebayUsername || 'unknown'}) on order ${orderId}${publishPayload.variations ? ` with ${publishPayload.variations.length} variation(s)` : ''}`);

      let publishResult;
      try {
        publishResult = await publishToMarketplace('ebay', credentials, publishPayload);
      } catch (publishThrow: any) {
        // publishToMarketplace can throw on network/parse errors before
        // returning a structured {success:false} result. Without this catch
        // the slot, product, and mapping would all leak.
        console.error(`[DropAndSell] Publish threw for order ${orderId}: ${publishThrow.message}`);
        return rollbackEverythingAndFail(502, {
          message: `Unexpected error publishing to eBay: ${publishThrow.message}. The listing was not created.`,
        });
      }

      if (!publishResult.success) {
        const reason = publishResult.error || 'eBay publish failed';
        console.error(`[DropAndSell] Publish failed for order ${orderId}: ${reason}`);
        return rollbackEverythingAndFail(502, { message: `eBay rejected the listing: ${reason}` });
      }

      try {
        await storage.createMarketplaceListing({
          storeId: ebayStore.id,
          productId: product.id,
          externalId: publishResult.externalId,
          listingUrl: publishResult.listingUrl || null,
          status: 'active',
          syncStatus: 'synced',
        });
      } catch (listingErr: any) {
        // The product is live on eBay at this point — we MUST NOT roll back
        // the slot, product, or mapping. Just log and surface success so the
        // requester's progress is still credited; a sync job can backfill the
        // marketplace_listings row later.
        console.error(`[DropAndSell] Listing recorded on eBay (${publishResult.externalId}) but DB write failed: ${listingErr.message}`);
      }

      console.log(`[DropAndSell] Listed product ${product.id} on eBay (${publishResult.externalId}) for order ${orderId} — progress ${newProgress}/${order.listingCount}`);
      res.json({
        success: true,
        productId: product.id,
        externalId: publishResult.externalId,
        listingUrl: publishResult.listingUrl,
        progress: newProgress,
        total: order.listingCount,
        complete: newProgress >= order.listingCount,
      });
    } catch (err: any) {
      console.error('[DropAndSell] List-product error:', err);
      res.status(500).json({ message: err.message || 'Failed to list product' });
    }
  });

  // Lister-only: returns the customer eBay stores the lister can publish
  // into right now. Each entry is a Drop-and-Sell order that is paid,
  // assigned to this lister, in_progress/partially_completed, and still
  // has remaining listing quota. The lister sees these in the Inventory
  // "Publish to Store" dropdown alongside their own stores.
  protectedApi.get('/drop-and-sell/lister-customer-stores', requireDropAndSellAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user?.email) return res.json([]);

      const freelancers = await storage.getFreelancerProfiles();
      const profile = freelancers.find(
        f => f.email.toLowerCase() === user.email!.toLowerCase() && f.applicationStatus === 'approved'
      );
      if (!profile) return res.json([]);

      const orders = await storage.getDropAndSellOrdersByFreelancer(profile.id);
      const eligible = [];
      for (const order of orders) {
        if (order.paymentStatus !== 'paid') continue;
        if (!['in_progress', 'partially_completed'].includes(order.status || '')) continue;
        const used = order.progressCount || 0;
        if (used >= order.listingCount) continue;

        const requester = await storage.getUser(order.userId);
        const requesterStores = requester ? await storage.getStores(order.userId) : [];
        const allEbayStores = requesterStores.filter(s => s.platform === 'ebay' && s.status !== 'disconnected');
        // Keep only stores with a usable token — anything else can't be
        // published into right now.
        const usableEbayStores = allEbayStores.filter(s => {
          const c = (s.credentials as any) || {};
          return !!(c.authToken || c.refreshToken);
        });
        if (usableEbayStores.length === 0) continue;

        const orderStoreId = (order as any).storeId as number | null | undefined;
        const ebayStores = usableEbayStores.map(s => {
          const c = (s.credentials as any) || {};
          return {
            id: s.id,
            username: c.ebayUsername || s.name || null,
            isDefault: orderStoreId ? s.id === orderStoreId : false,
          };
        });
        ebayStores.sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));
        // Do NOT synthesize a default when none exists — for multi-store
        // customers with no pinned `order.storeId`, the lister must
        // pick explicitly. (Server's helper also refuses ambiguous calls.)
        const primary = ebayStores.find(s => s.isDefault) || (ebayStores.length === 1 ? ebayStores[0] : undefined);

        eligible.push({
          orderId: order.id,
          customerName: requester ? `${requester.firstName || ''} ${requester.lastName || ''}`.trim() || 'Customer' : 'Customer',
          ebayUsername: primary?.username || null,
          remaining: order.listingCount - used,
          total: order.listingCount,
          // Full list of choices so the Inventory "Publish to Store"
          // dropdown can let the lister pick when there are multiple.
          ebayStores,
        });
      }
      res.json(eligible);
    } catch (err: any) {
      console.error('[DropAndSell] lister-customer-stores error:', err);
      res.status(500).json({ message: err.message || 'Failed to load customer stores' });
    }
  });

  // Lister-only: publish a product from the lister's OWN inventory into
  // a customer's eBay store via Drop-and-Sell. Internally this calls the
  // same `performListProductIntoCustomerEbay` helper used by the in-page
  // "List Product" dialog, so the resulting product appears in the
  // lister's "My Listings" tab on /drop-and-sell, the SKU mapping is
  // created on the customer's account for auto-fulfillment, and the slot
  // reservation prevents over-publishing past the purchased quota.
  protectedApi.post('/drop-and-sell/lister-publish-from-inventory', requireDropAndSellAccess, async (req: any, res) => {
    try {
      const callerId = req.user.claims.sub;
      const caller = await storage.getUser(callerId);
      if (!caller?.email) return res.status(403).json({ message: 'You must be signed in.' });

      const body = z.object({
        productId: z.coerce.number().int().positive(),
        orderId: z.coerce.number().int().positive(),
        // Optional explicit eBay store. When the customer has multiple
        // connected eBay stores, the lister picks one here. Omit to use
        // the order's pinned default.
        storeId: z.coerce.number().int().positive().optional(),
      }).safeParse(req.body);
      if (!body.success) return res.status(400).json({ message: 'productId and orderId are required.' });
      const { productId, orderId, storeId } = body.data;

      const allFreelancers = await storage.getFreelancerProfiles();
      const callerProfile = allFreelancers.find(
        f => f.email.toLowerCase() === caller.email!.toLowerCase() && f.applicationStatus === 'approved'
      );
      if (!callerProfile) return res.status(403).json({ message: 'You are not an approved lister.' });

      const allOrders = await storage.getAllDropAndSellOrders();
      const orderRow = allOrders.find(r => r.order.id === orderId);
      if (!orderRow) return res.status(404).json({ message: 'Order not found' });
      const order = orderRow.order;
      if (order.freelancerId !== callerProfile.id) {
        return res.status(403).json({ message: 'This order is not assigned to you.' });
      }

      // Load the lister's product (must be owned by the lister).
      const [product] = await db.select().from(products).where(
        and(eq(products.id, productId), eq(products.userId, callerId))
      );
      if (!product) return res.status(404).json({ message: 'Product not found in your inventory.' });

      // Resolve a vendor URL — required so the customer's auto-fulfillment
      // can place the vendor order when the eBay buyer pays. Try the
      // product's stored sourceUrl first (set on import), then fall back
      // to the linked vendor's website.
      const attrs = (product.attributes as any) || {};
      let vendorUrl: string | undefined = attrs.sourceUrl;
      if (!vendorUrl && product.vendorId) {
        try {
          const vendors = await storage.getVendors(callerId);
          const v = vendors.find(x => x.id === product.vendorId);
          if (v?.website) vendorUrl = v.website;
        } catch {}
      }
      if (!vendorUrl || !isValidVendorUrl(vendorUrl)) {
        return res.status(400).json({
          message: 'This product needs a vendor URL before it can be published to a customer\'s store. Open the product and add the vendor product page URL.',
        });
      }

      const images: string[] = Array.isArray(product.images)
        ? (product.images as string[]).filter(u => typeof u === 'string' && /^https?:\/\//i.test(u))
        : [];
      if (images.length === 0) {
        return res.status(400).json({ message: 'This product has no public image URLs to publish.' });
      }

      const helperInput = {
        vendorUrl,
        title: product.title || '',
        description: product.description || '',
        brand: product.brand || '',
        sellingPrice: String(product.sellingPrice ?? '0'),
        costPrice: product.costPrice != null ? String(product.costPrice) : undefined,
        sku: product.sku || `INV-${product.id}-${Date.now().toString(36)}`,
        quantity: typeof product.quantity === 'number' ? product.quantity : 1,
        images,
        deliveryType: (product.deliveryType as any) || 'buyer_pays',
        deliveryCost: product.deliveryCost != null ? String(product.deliveryCost) : '0',
        variations: Array.isArray(attrs.variations) ? attrs.variations : undefined,
        storeId,
      };

      const result = await performListProductIntoCustomerEbay(
        { id: callerProfile.id, name: callerProfile.name },
        order,
        helperInput,
        'web_dialog',
      );
      if (!result.ok) return res.status(result.status).json({ message: result.message });
      res.json({
        success: true,
        productId: result.productId,
        externalId: result.externalId,
        listingUrl: result.listingUrl,
        progress: result.progress,
        total: result.total,
        complete: result.complete,
      });
    } catch (err: any) {
      console.error('[DropAndSell] lister-publish-from-inventory error:', err);
      res.status(500).json({ message: err.message || 'Failed to publish to customer\'s store' });
    }
  });

  // Lister-only: every product this lister has published into customers'
  // inventories via Drop-and-Sell, with the resulting eBay listing link so
  // they can click through to the live listing. Customer email and auth
  // tokens are intentionally NOT exposed — only their public eBay username.
  protectedApi.get('/drop-and-sell/my-listings', requireDropAndSellAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user?.email) return res.status(400).json({ message: 'User not found' });

      const freelancers = await storage.getFreelancerProfiles();
      const profile = freelancers.find(f => f.email.toLowerCase() === user.email!.toLowerCase() && f.applicationStatus === 'approved');
      if (!profile) return res.status(403).json({ message: 'You are not an approved lister' });

      const rows = await storage.getProductsListedByFreelancer(profile.id);
      // Attach the originating Drop-and-Sell order id (if any) so the lister
      // can group their listings by order in the UI. We pull it from the
      // attributes blob the list-product endpoint stamps on.
      const enriched = rows.map((r: any) => ({
        ...r,
        orderId: null as number | null,
      }));
      // Fetch raw products once more to pick orderId out of attributes.
      // (We could SELECT it inline but keeping the storage method generic
      // and doing this small hop here is simpler and still O(1) queries.)
      const orderIds = await db.select({
        id: products.id,
        attributes: products.attributes,
      }).from(products).where(eq(products.listedByFreelancerId, profile.id));
      const idToOrder = new Map<number, number | null>();
      for (const row of orderIds) {
        const attrs = (row.attributes as any) || {};
        idToOrder.set(row.id, typeof attrs.dropAndSellOrderId === 'number' ? attrs.dropAndSellOrderId : null);
      }
      for (const e of enriched) {
        e.orderId = idToOrder.get(e.productId) ?? null;
      }

      res.json(enriched);
    } catch (err: any) {
      console.error('[DropAndSell] my-listings error:', err);
      res.status(500).json({ message: err.message || 'Failed to load listings' });
    }
  });

  // === MY LISTINGS — edit/delete/AI/vendor lookup for the lister ===
  // Auth model: caller must be an approved freelancer profile AND the
  // product's listed_by_freelancer_id must equal their profile.id. We do
  // NOT scope by the caller's userId because the product's owner is the
  // CUSTOMER, not the lister. All writes go through storage.* using the
  // CUSTOMER's userId so the existing ownership checks at the storage
  // layer still hold.
  async function getMyListingProductForLister(req: any): Promise<
    | { ok: false; status: number; message: string }
    | { ok: true; product: any; profile: any; user: any }
  > {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user?.email) return { ok: false, status: 400, message: 'User not found' };
    const freelancers = await storage.getFreelancerProfiles();
    const profile = freelancers.find((f: any) => f.email.toLowerCase() === user.email!.toLowerCase() && f.applicationStatus === 'approved');
    if (!profile) return { ok: false, status: 403, message: 'You are not an approved lister' };
    const productId = Number(req.params.productId);
    if (!Number.isFinite(productId)) return { ok: false, status: 400, message: 'Invalid product id' };
    const [product] = await db.select().from(products).where(eq(products.id, productId));
    if (!product) return { ok: false, status: 404, message: 'Listing not found' };
    if (product.listedByFreelancerId !== profile.id) {
      return { ok: false, status: 403, message: 'You did not create this listing.' };
    }
    return { ok: true, product, profile, user };
  }

  // === LISTER → CUSTOMER CATALOG ===
  // Lets an approved lister browse ALL of a customer's products (not just
  // the ones they personally listed) and edit selling prices that push to
  // eBay. Access is gated by the existence of at least one
  // drop_and_sell_orders row where the lister was assigned to that
  // customer — so listers can only touch customers they actually serve.
  async function assertListerHasCustomerAccess(profileId: number, customerUserId: string): Promise<boolean> {
    const [row] = await db.select({ id: dropAndSellOrders.id })
      .from(dropAndSellOrders)
      .where(and(
        eq(dropAndSellOrders.freelancerId, profileId),
        eq(dropAndSellOrders.userId, customerUserId),
      ))
      .limit(1);
    return !!row;
  }

  async function getListerProfileFromReq(req: any): Promise<
    | { ok: false; status: number; message: string }
    | { ok: true; profile: any }
  > {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user?.email) return { ok: false, status: 400, message: 'User not found' };
    const freelancers = await storage.getFreelancerProfiles();
    const profile = freelancers.find((f: any) => f.email.toLowerCase() === user.email!.toLowerCase() && f.applicationStatus === 'approved');
    if (!profile) return { ok: false, status: 403, message: 'You are not an approved lister' };
    return { ok: true, profile };
  }

  // List the lister's assigned customers (deduped from drop_and_sell_orders).
  protectedApi.get('/drop-and-sell/customers', requireDropAndSellAccess, async (req: any, res) => {
    try {
      const ctx = await getListerProfileFromReq(req);
      if (!ctx.ok) return res.status(ctx.status).json({ message: ctx.message });
      const { profile } = ctx;

      const rows = await db.select({
        customerUserId: dropAndSellOrders.userId,
        firstName: users.firstName,
        lastName: users.lastName,
        orderId: dropAndSellOrders.id,
        orderCreatedAt: dropAndSellOrders.createdAt,
      })
        .from(dropAndSellOrders)
        .leftJoin(users, eq(users.id, dropAndSellOrders.userId))
        .where(eq(dropAndSellOrders.freelancerId, profile.id))
        .orderBy(desc(dropAndSellOrders.createdAt));

      const byCustomer = new Map<string, { customerUserId: string; customerName: string; orderCount: number; lastOrderAt: any }>();
      for (const r of rows) {
        if (!r.customerUserId) continue;
        const existing = byCustomer.get(r.customerUserId);
        if (existing) {
          existing.orderCount += 1;
        } else {
          byCustomer.set(r.customerUserId, {
            customerUserId: r.customerUserId,
            customerName: `${r.firstName || ''} ${r.lastName || ''}`.trim() || 'Customer',
            orderCount: 1,
            lastOrderAt: r.orderCreatedAt,
          });
        }
      }
      res.json(Array.from(byCustomer.values()));
    } catch (err: any) {
      console.error('[DropAndSell customers] list error:', err);
      res.status(500).json({ message: err.message || 'Failed to load customers' });
    }
  });

  // Full catalog of products owned by a customer the lister has access to.
  protectedApi.get('/drop-and-sell/customers/:customerUserId/products', requireDropAndSellAccess, async (req: any, res) => {
    try {
      const ctx = await getListerProfileFromReq(req);
      if (!ctx.ok) return res.status(ctx.status).json({ message: ctx.message });
      const { profile } = ctx;
      const customerUserId = String(req.params.customerUserId);

      const allowed = await assertListerHasCustomerAccess(profile.id, customerUserId);
      if (!allowed) return res.status(403).json({ message: 'You are not assigned to this customer.' });

      // Customer's full product catalog with live eBay listing context.
      const rows = await db.select({
        product: products,
        vendorName: vendors.name,
        listing: marketplaceListings,
        storePlatform: stores.platform,
      })
        .from(products)
        .leftJoin(vendors, eq(products.vendorId, vendors.id))
        .leftJoin(marketplaceListings, eq(marketplaceListings.productId, products.id))
        .leftJoin(stores, eq(stores.id, marketplaceListings.storeId))
        .where(eq(products.userId, customerUserId))
        .orderBy(desc(products.createdAt));

      // Collapse multiple listing rows per product into the most relevant one
      // (prefer an active eBay listing for the action context).
      const byProductId = new Map<number, any>();
      for (const r of rows) {
        const existing = byProductId.get(r.product.id);
        const isEbayActive = r.storePlatform === 'ebay' && r.listing?.status === 'active' && !!r.listing?.externalId;
        if (!existing) {
          byProductId.set(r.product.id, {
            productId: r.product.id,
            title: r.product.title,
            sku: r.product.sku,
            sellingPrice: r.product.sellingPrice,
            costPrice: r.product.costPrice,
            quantity: r.product.quantity,
            image: Array.isArray(r.product.images) && r.product.images[0] ? r.product.images[0] : null,
            vendorName: r.vendorName || null,
            ebayListingId: isEbayActive ? r.listing!.externalId : null,
            ebayListingUrl: isEbayActive ? r.listing!.listingUrl : null,
            listedByThisFreelancer: r.product.listedByFreelancerId === profile.id,
            createdAt: r.product.createdAt,
          });
        } else if (isEbayActive && !existing.ebayListingId) {
          existing.ebayListingId = r.listing!.externalId;
          existing.ebayListingUrl = r.listing!.listingUrl;
        }
      }

      res.json(Array.from(byProductId.values()));
    } catch (err: any) {
      console.error('[DropAndSell customers] products error:', err);
      res.status(500).json({ message: err.message || 'Failed to load customer products' });
    }
  });

  // Update a customer product's selling price (and optionally quantity) and
  // push the change to the live eBay listing. Mirrors the my-listings PATCH
  // sync logic but is scoped by the lister↔customer assignment rather than
  // who originally listed the product.
  protectedApi.patch('/drop-and-sell/customers/:customerUserId/products/:productId', requireDropAndSellAccess, async (req: any, res) => {
    try {
      const ctx = await getListerProfileFromReq(req);
      if (!ctx.ok) return res.status(ctx.status).json({ message: ctx.message });
      const { profile } = ctx;
      const customerUserId = String(req.params.customerUserId);
      const productId = Number(req.params.productId);
      if (!Number.isFinite(productId)) return res.status(400).json({ message: 'Invalid product id' });

      const allowed = await assertListerHasCustomerAccess(profile.id, customerUserId);
      if (!allowed) return res.status(403).json({ message: 'You are not assigned to this customer.' });

      const [product] = await db.select().from(products).where(eq(products.id, productId));
      if (!product) return res.status(404).json({ message: 'Product not found' });
      if (product.userId !== customerUserId) {
        // Defence-in-depth: product must belong to the customer named in the URL.
        return res.status(404).json({ message: 'Product not found for this customer' });
      }

      const editSchema = z.object({
        sellingPrice: z.union([z.string(), z.number()]).transform(v => String(v)),
        quantity: z.coerce.number().int().min(0).optional(),
      });
      const parsed = editSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues.map(i => i.message).join('; ') });
      }
      const priceNum = Number(parsed.data.sellingPrice);
      if (!Number.isFinite(priceNum) || priceNum <= 0) {
        return res.status(400).json({ message: 'Selling price must be greater than 0' });
      }

      const update: any = { sellingPrice: parsed.data.sellingPrice };
      if (parsed.data.quantity !== undefined) update.quantity = parsed.data.quantity;
      const updated = await storage.updateProduct(product.id, customerUserId, update);

      const priceChanged = String(parsed.data.sellingPrice) !== String(product.sellingPrice ?? '');
      const qtyChanged = parsed.data.quantity !== undefined && Number(parsed.data.quantity) !== Number(product.quantity ?? 0);

      let ebaySync: { synced: number; failed: number; errors: string[] } | undefined;
      if (updated && (priceChanged || qtyChanged)) {
        try {
          const { reviseEbayListing } = await import('./marketplaces/ebay');
          const customerStores = await storage.getStores(customerUserId);
          const attrs = (updated.attributes || {}) as Record<string, any>;
          const variations: any[] = Array.isArray(attrs.variations) ? attrs.variations : [];
          const syncResults: { listingId: string; success: boolean; error?: string }[] = [];
          for (const store of customerStores) {
            if (store.platform !== 'ebay') continue;
            const storeListings = await storage.getMarketplaceListings(store.id);
            const activeListings = storeListings.filter((l: any) =>
              l.productId === product.id && l.status === 'active' && l.externalId
            );
            if (activeListings.length === 0) continue;
            // eBay access tokens expire ~2h after issue. Without a fresh
            // token, ReviseFixedPriceItem silently returns "invalid token"
            // and the customer's listing keeps the old price.
            const accessToken = await ensureValidEbayToken(store, customerUserId);
            if (!accessToken) {
              for (const l of activeListings) {
                syncResults.push({ listingId: l.externalId!, success: false, error: "Customer's eBay token is invalid — they need to reconnect their store." });
              }
              continue;
            }
            const creds = { ...(store.credentials as any), authToken: accessToken };
            for (const listing of activeListings) {
              const r = await reviseEbayListing(creds, listing.externalId!, {
                price: String(updated.sellingPrice || '0'),
                quantity: typeof updated.quantity === 'number' ? updated.quantity : undefined,
                variations: variations.length > 0 ? variations : undefined,
              });
              syncResults.push({ listingId: listing.externalId!, success: r.success, error: r.error });
              if (r.success) {
                console.log(`[DropAndSell customer-catalog] Lister ${profile.id} pushed price=${updated.sellingPrice} qty=${updated.quantity ?? 'n/a'} to eBay listing ${listing.externalId} (store ${store.id}, customer ${customerUserId}) for product ${product.id}`);
              } else {
                console.warn(`[DropAndSell customer-catalog] eBay revise failed for ${listing.externalId}: ${r.error}`);
              }
            }
          }
          const ok = syncResults.filter(r => r.success).length;
          const bad = syncResults.length - ok;
          ebaySync = {
            synced: ok,
            failed: bad,
            errors: syncResults.filter(r => !r.success).map(r => r.error || 'Unknown error').slice(0, 3),
          };
        } catch (syncErr: any) {
          console.error(`[DropAndSell customer-catalog] eBay sync exception for product ${product.id}: ${syncErr.message}`);
          ebaySync = { synced: 0, failed: 1, errors: [syncErr.message || 'Sync exception'] };
        }
      }

      res.json({ success: true, product: updated, ebaySync });
    } catch (err: any) {
      console.error('[DropAndSell customer-catalog] edit error:', err);
      res.status(500).json({ message: err.message || 'Failed to update product' });
    }
  });

  protectedApi.get('/drop-and-sell/my-listings/:productId', requireDropAndSellAccess, async (req: any, res) => {
    const ctx = await getMyListingProductForLister(req);
    if (!ctx.ok) return res.status(ctx.status).json({ message: ctx.message });
    res.json(ctx.product);
  });

  protectedApi.patch('/drop-and-sell/my-listings/:productId', requireDropAndSellAccess, async (req: any, res) => {
    try {
      const ctx = await getMyListingProductForLister(req);
      if (!ctx.ok) return res.status(ctx.status).json({ message: ctx.message });
      const { product, profile } = ctx;
      const customerUserId = product.userId as string;

      const editSchema = z.object({
        title: z.string().trim().min(1).max(200).optional(),
        description: z.string().optional(),
        brand: z.string().optional(),
        sellingPrice: z.union([z.string(), z.number()]).transform(v => String(v)).optional(),
        costPrice: z.union([z.string(), z.number()]).transform(v => String(v)).optional(),
        sku: z.string().trim().min(1).max(100).optional(),
        quantity: z.coerce.number().int().min(0).optional(),
        images: z.array(z.string().url()).max(24).optional(),
        variations: z.array(z.any()).optional(),
        deliveryType: z.enum(['buyer_pays', 'seller_pays', 'free']).optional(),
        deliveryCost: z.union([z.string(), z.number()]).transform(v => String(v)).optional(),
      });
      const parsed = editSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues.map(i => i.message).join('; ') });
      }
      const update: any = { ...parsed.data };

      // VeRO sanitize against the CUSTOMER's account whenever the lister
      // touched any text field (title / description / brand).
      if (update.title !== undefined || update.description !== undefined || update.brand !== undefined) {
        const sanitized = await storage.sanitizeVeroContent(
          customerUserId,
          update.title ?? product.title,
          update.description ?? product.description ?? '',
          update.brand ?? product.brand ?? '',
        );
        update.title = sanitized.title;
        update.description = sanitized.description;
        update.brand = sanitized.brand;
      }

      // Merge variations into attributes (preserving other attribute keys).
      if (Array.isArray(parsed.data.variations)) {
        const existingAttrs = (product.attributes as any) || {};
        update.attributes = { ...existingAttrs, variations: parsed.data.variations };
      }
      delete update.variations;

      const updated = await storage.updateProduct(product.id, customerUserId, update);

      // If the lister changed costPrice, mirror it onto the SKU mapping so
      // the customer's auto-fulfillment honours the new budget.
      if (parsed.data.costPrice && updated) {
        try {
          const mapping = await storage.getSkuMappingByEbaySku(customerUserId, updated.sku);
          if (mapping) {
            await db.update(skuMappings).set({ costPrice: String(parsed.data.costPrice) }).where(eq(skuMappings.id, mapping.id));
          }
        } catch (mErr: any) {
          console.error(`[DropAndSell my-listings] cost mapping update failed: ${mErr.message}`);
        }
      }

      // Push price / quantity changes to the live eBay listing on the
      // CUSTOMER's store. Without this, the lister's edit would only sit in
      // our DB while the buyer-facing eBay listing keeps the old price.
      // We use the customer's stored OAuth credentials (the lister never
      // sees them) and a minimal ReviseFixedPriceItem call so the eBay
      // daily quota isn't burned on image rehosting for a price tweak.
      let ebaySync: { synced: number; failed: number; errors: string[] } | undefined;
      const priceChanged = parsed.data.sellingPrice !== undefined
        && String(parsed.data.sellingPrice) !== String(product.sellingPrice ?? '');
      const qtyChanged = parsed.data.quantity !== undefined
        && Number(parsed.data.quantity) !== Number(product.quantity ?? 0);
      if (updated && (priceChanged || qtyChanged)) {
        try {
          const { reviseEbayListing } = await import('./marketplaces/ebay');
          const customerStores = await storage.getStores(customerUserId);
          const attrs = (updated.attributes || {}) as Record<string, any>;
          const variations: any[] = Array.isArray(attrs.variations) ? attrs.variations : [];
          const syncResults: { listingId: string; success: boolean; error?: string }[] = [];
          for (const store of customerStores) {
            if (store.platform !== 'ebay') continue;
            const storeListings = await storage.getMarketplaceListings(store.id);
            const activeListings = storeListings.filter((l: any) =>
              l.productId === product.id && l.status === 'active' && l.externalId
            );
            if (activeListings.length === 0) continue;
            // Refresh the customer's eBay access token before pushing —
            // stale tokens silently fail and leave the live listing
            // unchanged. Mirrors the pricing-engine sync path.
            const accessToken = await ensureValidEbayToken(store, customerUserId);
            if (!accessToken) {
              for (const l of activeListings) {
                syncResults.push({ listingId: l.externalId!, success: false, error: "Customer's eBay token is invalid — they need to reconnect their store." });
              }
              continue;
            }
            const creds = { ...(store.credentials as any), authToken: accessToken };
            for (const listing of activeListings) {
              const r = await reviseEbayListing(creds, listing.externalId!, {
                price: String(updated.sellingPrice || '0'),
                quantity: typeof updated.quantity === 'number' ? updated.quantity : undefined,
                // Re-send variations so per-variation prices stay aligned
                // with the new base price on variation listings.
                variations: variations.length > 0 ? variations : undefined,
              });
              syncResults.push({ listingId: listing.externalId!, success: r.success, error: r.error });
              if (r.success) {
                console.log(`[DropAndSell my-listings] Lister ${profile.id} pushed price=${updated.sellingPrice} qty=${updated.quantity ?? 'n/a'} to eBay listing ${listing.externalId} (store ${store.id}, customer ${customerUserId}) for product ${product.id}`);
              } else {
                console.warn(`[DropAndSell my-listings] eBay revise failed for ${listing.externalId}: ${r.error}`);
              }
            }
          }
          const ok = syncResults.filter(r => r.success).length;
          const bad = syncResults.length - ok;
          ebaySync = {
            synced: ok,
            failed: bad,
            errors: syncResults.filter(r => !r.success).map(r => r.error || 'Unknown error').slice(0, 3),
          };
        } catch (syncErr: any) {
          console.error(`[DropAndSell my-listings] eBay sync exception for product ${product.id}: ${syncErr.message}`);
          // failed:1 so the client toast clearly tells the lister the eBay
          // push didn't complete and they should retry. Without this the
          // generic "Listing updated" toast would falsely imply success.
          ebaySync = { synced: 0, failed: 1, errors: [syncErr.message || 'Sync exception'] };
        }
      }

      res.json({ success: true, product: updated, ebaySync });
    } catch (err: any) {
      console.error('[DropAndSell my-listings] edit error:', err);
      res.status(500).json({ message: err.message || 'Failed to update listing' });
    }
  });

  protectedApi.delete('/drop-and-sell/my-listings/:productId', requireDropAndSellAccess, async (req: any, res) => {
    try {
      const ctx = await getMyListingProductForLister(req);
      if (!ctx.ok) return res.status(ctx.status).json({ message: ctx.message });
      const { product } = ctx;
      const customerUserId = product.userId as string;

      // We don't have a unified end-listing helper for eBay yet, so we log
      // any live externalId — the customer can manually end them on eBay
      // (the local product record being gone stops auto-fulfillment).
      const liveListingIds: string[] = [];
      try {
        const listings = await db.select().from(marketplaceListings).where(eq(marketplaceListings.productId, product.id));
        for (const listing of listings) {
          if (listing.externalId) {
            liveListingIds.push(listing.externalId);
            console.log(`[DropAndSell my-listings] Lister deleted product ${product.id}; eBay listing ${listing.externalId} (store ${listing.storeId}) is still live — customer should end it manually.`);
          }
        }
      } catch (logErr: any) {
        console.error(`[DropAndSell my-listings] could not enumerate eBay listings for log: ${logErr.message}`);
      }

      // Delete SKU mapping ONLY if no OTHER active product on the customer's
      // account shares this SKU. The mapping is keyed by SKU and used by the
      // customer's auto-fulfillment to source items — blindly deleting it
      // would break fulfillment for any sibling product still using the
      // same SKU. (Per architect review.)
      if (product.sku) {
        try {
          const sibling = await db
            .select({ id: products.id })
            .from(products)
            .where(and(
              eq(products.userId, customerUserId),
              eq(products.sku, product.sku),
              ne(products.id, product.id),
            ))
            .limit(1);
          if (sibling.length === 0) {
            const mapping = await storage.getSkuMappingByEbaySku(customerUserId, product.sku);
            if (mapping) await storage.deleteSkuMapping(mapping.id, customerUserId);
          } else {
            console.log(`[DropAndSell my-listings] preserved SKU mapping for ${product.sku} on user ${customerUserId} — sibling product ${sibling[0].id} still uses it.`);
          }
        } catch (mDelErr: any) {
          console.error(`[DropAndSell my-listings] sku mapping delete failed: ${mDelErr.message}`);
        }
      }

      await storage.deleteProduct(product.id, customerUserId);
      res.json({ success: true, liveListingIds });
    } catch (err: any) {
      console.error('[DropAndSell my-listings] delete error:', err);
      res.status(500).json({ message: err.message || 'Failed to delete listing' });
    }
  });

  protectedApi.post('/drop-and-sell/my-listings/:productId/ai-optimize-description', requireDropAndSellAccess, async (req: any, res) => {
    try {
      const ctx = await getMyListingProductForLister(req);
      if (!ctx.ok) return res.status(ctx.status).json({ message: ctx.message });
      const { product } = ctx;
      const { title, description, brand } = req.body || {};
      const finalTitle = (typeof title === 'string' && title.trim()) ? title : product.title;
      const finalDesc = typeof description === 'string' ? description : (product.description || '');
      const finalBrand = (typeof brand === 'string' && brand.trim()) ? brand : (product.brand || '');
      const aiInput = {
        title: finalTitle,
        description: finalDesc,
        brand: finalBrand,
        attributes: (product.attributes as any) || {},
        categoryName: undefined,
      };
      const [html, specifics] = await Promise.all([
        generateAIDescription(aiInput as any),
        generateAIItemSpecifics(aiInput as any),
      ]);
      if (!html) {
        return res.status(503).json({ message: 'AI optimisation is unavailable right now. Please try again in a moment.' });
      }
      // VeRO safety: sanitise against the REQUESTER's account VeRO list so a
      // flagged brand from the lister's AI run never reaches the customer's eBay store.
      const safeSpecifics = (await sanitizeItemSpecificsBrand((product as any).userId, specifics || null, (product as any).id, 'ebay')) || null;
      if (safeSpecifics && Object.keys(safeSpecifics).length > 0) {
        try {
          const currentAttrs = ((product.attributes as any) || {}) as Record<string, any>;
          const nextAttrs = { ...currentAttrs, itemSpecifics: safeSpecifics };
          const updates: any = { attributes: nextAttrs };
          if (!((product as any).brand || '').trim() && typeof safeSpecifics['Brand'] === 'string' && safeSpecifics['Brand'].trim()) {
            updates.brand = await veroSafeBrand((product as any).userId, safeSpecifics['Brand'], (product as any).id, 'ebay');
          }
          await storage.updateProduct((product as any).id, (product as any).userId, updates);
        } catch (saveErr: any) {
          console.warn('[DropAndSell my-listings] could not persist itemSpecifics:', saveErr?.message);
        }
      }
      res.json({ description: html, itemSpecifics: safeSpecifics });
    } catch (err: any) {
      console.error('[DropAndSell my-listings] AI optimize error:', err);
      res.status(500).json({ message: err.message || 'AI optimize failed' });
    }
  });

  protectedApi.post('/drop-and-sell/my-listings/:productId/ai-optimize-title', requireDropAndSellAccess, async (req: any, res) => {
    try {
      const ctx = await getMyListingProductForLister(req);
      if (!ctx.ok) return res.status(ctx.status).json({ message: ctx.message });
      const { product } = ctx;
      const { title, description, brand } = req.body || {};
      const finalTitle = (typeof title === 'string' && title.trim()) ? title : product.title;
      const finalDesc = typeof description === 'string' ? description : (product.description || '');
      const finalBrand = (typeof brand === 'string' && brand.trim()) ? brand : (product.brand || '');
      const newTitle = await generateAITitle({
        title: finalTitle,
        description: finalDesc,
        brand: finalBrand,
        attributes: (product.attributes as any) || {},
        categoryName: undefined,
      } as any);
      if (!newTitle) {
        return res.status(503).json({ message: 'AI title optimisation is unavailable right now. Please try again in a moment.' });
      }
      // VeRO safety: strip flagged brands from the AI title using the
      // REQUESTER's VeRO list (it's their store at risk).
      const sanitizedTitleResult = await storage.sanitizeVeroContent((product as any).userId, newTitle, '', '');
      const safeTitle = sanitizedTitleResult.title || newTitle;
      try {
        await storage.updateProduct((product as any).id, (product as any).userId, { title: safeTitle } as any);
      } catch (saveErr: any) {
        console.warn('[DropAndSell my-listings] persist title failed:', saveErr?.message);
      }
      res.json({ title: safeTitle });
    } catch (err: any) {
      console.error('[DropAndSell my-listings] AI title error:', err);
      res.status(500).json({ message: err.message || 'AI title optimisation failed' });
    }
  });

  protectedApi.get('/drop-and-sell/orders/:orderId/vendors', requireDropAndSellAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user?.email) return res.status(400).json({ message: 'User not found' });
      const freelancers = await storage.getFreelancerProfiles();
      const profile = freelancers.find((f: any) => f.email.toLowerCase() === user.email!.toLowerCase() && f.applicationStatus === 'approved');
      if (!profile) return res.status(403).json({ message: 'You are not an approved lister' });
      const orderId = Number(req.params.orderId);
      if (!Number.isFinite(orderId)) return res.status(400).json({ message: 'Invalid order id' });
      const allOrders = await storage.getAllDropAndSellOrders();
      const orderRow = allOrders.find((r: any) => r.order.id === orderId);
      if (!orderRow) return res.status(404).json({ message: 'Order not found' });
      if (orderRow.order.freelancerId !== profile.id) {
        return res.status(403).json({ message: 'This order is not assigned to you.' });
      }
      const customerVendors = await storage.getVendors(orderRow.order.userId);
      const sanitized = customerVendors.map((v: any) => ({
        id: v.id,
        name: v.name,
        website: v.website,
        integrationType: v.integrationType,
      }));
      res.json(sanitized);
    } catch (err: any) {
      console.error('[DropAndSell my-listings] vendors error:', err);
      res.status(500).json({ message: err.message || 'Failed to load vendors' });
    }
  });

  protectedApi.get('/drop-and-sell/my-application', requireDropAndSellAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user?.email) return res.json({ application: null });
      const existing = await storage.getFreelancerProfiles();
      const profile = existing.find(f => f.email.toLowerCase() === user.email!.toLowerCase());
      res.json({ application: profile || null });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.post('/drop-and-sell/freelancers/:id/approve', requireDropAndSellAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const isAdmin = user?.isAdmin === 'true';
      if (!isAdmin) return res.status(403).json({ message: 'Admin access required' });
      const profileId = Number(req.params.id);
      const profiles = await storage.getFreelancerProfiles();
      const profile = profiles.find(f => f.id === profileId);
      if (!profile) return res.status(404).json({ message: 'Application not found' });
      await db.update(freelancerProfiles).set({ applicationStatus: 'approved', isAvailable: true }).where(eq(freelancerProfiles.id, profileId));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.post('/drop-and-sell/freelancers/:id/reject', requireDropAndSellAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const isAdmin = user?.isAdmin === 'true';
      if (!isAdmin) return res.status(403).json({ message: 'Admin access required' });
      const profileId = Number(req.params.id);
      await db.update(freelancerProfiles).set({ applicationStatus: 'rejected' }).where(eq(freelancerProfiles.id, profileId));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.delete('/drop-and-sell/freelancers/:id', requireDropAndSellAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const isAdmin = user?.isAdmin === 'true';
      if (!isAdmin) return res.status(403).json({ message: 'Admin access required' });

      await storage.deleteFreelancerProfile(Number(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.post('/drop-and-sell/orders/:id/progress', requireDropAndSellAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const isAdmin = user?.isAdmin === 'true';
      if (!isAdmin) return res.status(403).json({ message: 'Admin access required' });

      const orderId = Number(req.params.id);
      const { progressCount } = req.body;
      if (progressCount === undefined || progressCount < 0) return res.status(400).json({ message: 'Invalid progress count' });

      const allOrders = await storage.getAllDropAndSellOrders();
      const orderRow = allOrders.find(r => r.order.id === orderId);
      if (!orderRow) return res.status(404).json({ message: 'Order not found' });

      const order = orderRow.order;
      const clamped = Math.min(progressCount, order.listingCount);
      const updateData: any = { progressCount: clamped };

      if (clamped >= order.listingCount) {
        updateData.status = 'awaiting_approval';
        updateData.progressCount = order.listingCount;
      }

      const updated = await storage.updateDropAndSellOrder(orderId, updateData);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.post('/drop-and-sell/freelancers/:id/withdraw', requireDropAndSellAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const isAdmin = user?.isAdmin === 'true';
      if (!isAdmin) return res.status(403).json({ message: 'Admin access required' });

      const freelancerId = Number(req.params.id);
      const freelancer = await storage.getFreelancerProfile(freelancerId);
      if (!freelancer) return res.status(404).json({ message: 'Freelancer not found' });

      const { amount } = req.body;
      const balance = parseFloat(freelancer.walletBalance || '0');
      if (!amount || amount <= 0 || amount > balance) {
        return res.status(400).json({ message: 'Invalid withdrawal amount' });
      }

      await storage.updateFreelancerProfile(freelancerId, {
        walletBalance: (balance - amount).toFixed(2),
      });

      res.json({ success: true, newBalance: (balance - amount).toFixed(2) });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === SKU MAPPINGS ===
  protectedApi.get('/sku-mappings', requireFulfillmentAccess, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const mappings = await storage.getSkuMappings(userId);
    res.json(mappings);
  });

  const skuMappingCreateSchema = z.object({
    ebaySku: z.string().min(1),
    vendorSku: z.string(),
    vendorName: z.string().optional(),
    vendorProductUrl: z.string().optional(),
    costPrice: z.string().optional(),
    priceThreshold: z.string().optional(),
    ebayTitle: z.string().optional(),
    ebayPrice: z.string().optional(),
    vendorId: z.number().optional(),
    isActive: z.boolean().optional(),
  });

  const paymentCardCreateSchema = z.object({
    lastFour: z.string().length(4),
    brand: z.string().min(1),
    expiryMonth: z.number().min(1).max(12),
    expiryYear: z.number().min(2024),
    tokenizedId: z.string().min(1),
    isDefault: z.boolean().optional(),
    priority: z.number().optional(),
  });

  protectedApi.post('/sku-mappings', requireFulfillmentAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const parsed = skuMappingCreateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: 'Invalid data', errors: parsed.error.flatten().fieldErrors });
      const mapping = await storage.createSkuMapping({ ...parsed.data, userId });
      await storage.createAuditLog({ userId, action: 'sku_mapping_created', details: { ebaySku: parsed.data.ebaySku, vendorSku: parsed.data.vendorSku } });
      res.json(mapping);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.post('/sku-mappings/auto-generate', requireFulfillmentAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const allProducts = await storage.getProducts(userId);
      const existingMappings = await storage.getSkuMappings(userId);
      const existingSkus = new Set(existingMappings.map((m: any) => m.ebaySku));

      let created = 0;
      let skipped = 0;

      const processedSkus = new Set(existingSkus);
      for (const product of allProducts) {
        if (!product.sku) { skipped++; continue; }
        if (processedSkus.has(product.sku)) { skipped++; continue; }

        const attrs = (product.attributes || {}) as Record<string, any>;
        const vendorName = (product as any).vendorName || 'Unknown';
        const sourceUrl = attrs.sourceUrl || '';

        await storage.createSkuMapping({
          userId,
          ebaySku: product.sku,
          vendorId: product.vendorId,
          vendorSku: product.sku,
          vendorProductUrl: sourceUrl,
          vendorName,
          costPrice: product.costPrice ? String(product.costPrice) : undefined,
          isActive: true,
        });
        processedSkus.add(product.sku);
        created++;
      }

      await storage.createAuditLog({
        userId,
        action: 'sku_mappings_auto_generated',
        details: { created, skipped, totalProducts: allProducts.length },
      });

      res.json({ created, skipped, total: allProducts.length });
    } catch (err: any) {
      console.error('[Auto-SKU] Bulk generation error:', err.message);
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.put('/sku-mappings/:id', requireFulfillmentAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = Number(req.params.id);
      const parsed = skuMappingCreateSchema.partial().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: 'Invalid data', errors: parsed.error.flatten().fieldErrors });
      const mapping = await storage.updateSkuMapping(id, userId, parsed.data);
      if (!mapping) return res.status(404).json({ message: 'SKU mapping not found' });
      res.json(mapping);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.delete('/sku-mappings/:id', requireFulfillmentAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = Number(req.params.id);
      await storage.deleteSkuMapping(id, userId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === FULFILLMENT JOBS ===
  protectedApi.get('/fulfillment-jobs', requireFulfillmentAccess, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const status = req.query.status as string | undefined;
    const orderId = req.query.orderId ? Number(req.query.orderId) : undefined;
    const jobs = await storage.getFulfillmentJobs(userId, { status, orderId });
    res.json(jobs);
  });

  protectedApi.get('/fulfillment-jobs/:id', requireFulfillmentAccess, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const id = Number(req.params.id);
    const job = await storage.getFulfillmentJob(id, userId);
    if (!job) return res.status(404).json({ message: 'Fulfillment job not found' });
    res.json(job);
  });

  protectedApi.post('/fulfillment-jobs/trigger', requireFulfillmentAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { orderId } = req.body;
      if (!orderId) return res.status(400).json({ message: 'orderId required' });

      const order = await storage.getOrder(orderId, userId);
      if (!order) return res.status(404).json({ message: 'Order not found' });

      const existingJob = await storage.getFulfillmentJobByOrderId(orderId, userId);
      if (existingJob && existingJob.status !== 'failed') {
        return res.status(400).json({ message: 'Fulfillment job already exists for this order', job: existingJob });
      }

      const lineItems = (order as any).lineItems || [];
      const sku = lineItems[0]?.sku || (order as any).sku || '';

      let skuMapping;
      if (sku) {
        skuMapping = await storage.getSkuMappingByEbaySku(userId, sku);
      }

      const isMappedReady = skuMapping && (skuMapping.vendorSku || skuMapping.vendorProductUrl);

      const job = await storage.createFulfillmentJob({
        userId,
        orderId,
        skuMappingId: isMappedReady ? skuMapping.id : null,
        vendorId: isMappedReady ? skuMapping.vendorId : null,
        vendorName: isMappedReady ? skuMapping.vendorName : null,
        status: 'pending',
        sourcingType: isMappedReady ? 'primary' : 'manual',
        retryCount: 0,
      });

      await storage.createAuditLog({
        userId,
        orderId,
        action: 'fulfillment_triggered',
        source: 'ebay',
        vendorUsed: skuMapping?.vendorName || 'unassigned',
        fulfillmentStatus: 'pending',
        details: { jobId: job.id, sku, skuMappingFound: !!skuMapping },
      });

      await storage.updateOrder(orderId, userId, { fulfillmentStatus: 'in_progress' });

      res.json(job);
    } catch (err: any) {
      console.error('[Fulfillment] Trigger error:', err.message);
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.get('/fulfillment-jobs/prepare/:orderId', requireFulfillmentAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const orderId = Number(req.params.orderId);

      const order = await storage.getOrder(orderId, userId);
      if (!order) return res.status(404).json({ message: 'Order not found' });

      const lineItems = (order as any).lineItems || [];
      const sku = lineItems[0]?.sku || (order as any).sku || '';
      const productTitle = lineItems[0]?.title || lineItems[0]?.name || (order as any).title || 'Unknown Product';
      const quantity = lineItems[0]?.quantity || 1;
      const variationAspects = lineItems[0]?.variationAspects || [];

      let skuMapping = null;
      if (sku) {
        skuMapping = await storage.getSkuMappingByEbaySku(userId, sku);
      }

      const addr = (order as any).shippingAddress || {};
      const shippingLines = [
        addr.name,
        addr.addressLine1,
        addr.addressLine2,
        [addr.city, addr.stateOrProvince, addr.postalCode].filter(Boolean).join(', '),
        addr.countryCode,
      ].filter(Boolean);
      const shippingFormatted = shippingLines.join('\n');

      const existingJob = await storage.getFulfillmentJobByOrderId(orderId, userId);

      res.json({
        order: {
          id: order.id,
          externalOrderId: (order as any).externalOrderId,
          customerName: (order as any).customerName,
          totalAmount: (order as any).totalAmount,
          status: (order as any).status,
          fulfillmentStatus: (order as any).fulfillmentStatus,
          lineItems,
        },
        product: {
          title: productTitle,
          sku,
          quantity,
          variationAspects,
        },
        vendor: skuMapping && (skuMapping.vendorSku || skuMapping.vendorProductUrl) ? {
          name: skuMapping.vendorName,
          sku: skuMapping.vendorSku,
          productUrl: skuMapping.vendorProductUrl,
          costPrice: skuMapping.costPrice,
        } : null,
        shipping: {
          raw: addr,
          formatted: shippingFormatted,
        },
        existingJob: existingJob ? {
          id: existingJob.id,
          status: existingJob.status,
          trackingNumber: existingJob.trackingNumber,
          carrier: existingJob.carrier,
        } : null,
        skuMapped: !!(skuMapping && (skuMapping.vendorSku || skuMapping.vendorProductUrl)),
        skuMappingExists: !!skuMapping,
        needsVendorMapping: !!(skuMapping && !skuMapping.vendorSku && !skuMapping.vendorProductUrl),
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Basic sanity validation for a carrier tracking number before we push it to eBay.
  // Carrier-specific format detection is handled separately by convertToEbayTracking.
  function validateTrackingNumber(raw: string): { valid: boolean; cleaned: string; reason?: string } {
    // Normalize away common display separators (spaces, hyphens) so a valid number
    // typed as "1Z 999 AA1 012 345 675" or "12-34567-89012" is accepted.
    const cleaned = (raw || '').trim().replace(/[\s\-]+/g, '');
    if (!cleaned) return { valid: false, cleaned, reason: 'Please enter a tracking number.' };
    if (cleaned.length < 6) return { valid: false, cleaned, reason: 'That tracking number looks too short (needs at least 6 characters).' };
    if (cleaned.length > 40) return { valid: false, cleaned, reason: 'That tracking number looks too long (max 40 characters).' };
    if (!/^[A-Za-z0-9]+$/.test(cleaned)) return { valid: false, cleaned, reason: 'A tracking number can only contain letters and numbers.' };
    if (!/\d/.test(cleaned)) return { valid: false, cleaned, reason: 'A valid tracking number must contain at least one number.' };
    return { valid: true, cleaned };
  }

  function convertToEbayTracking(rawTrackingNumber: string, selectedCarrier: string): { trackingNumber: string; shippingCarrierCode: string; autoDetected: boolean } {
    const cleaned = rawTrackingNumber.trim().replace(/\s+/g, '');
    let trackingNumber = cleaned;
    let shippingCarrierCode = selectedCarrier;
    let autoDetected = false;

    // eBay Sell Fulfillment API uses the ShippingCarrierEnum, which is PascalCase
    // (e.g. "AmazonLogistics", "RoyalMail", "Hermes"). Sending the uppercase
    // SNAKE_CASE codes ("AMAZON", "ROYAL_MAIL", "HERMES") is treated by eBay as
    // an unknown carrier — eBay still records the tracking number, but it can no
    // longer POLL the carrier for delivery scans, so the order is stuck at
    // "Shipped" forever and never advances to "Delivered". Mapping every alias
    // back to the exact PascalCase enum value lets eBay subscribe to delivery
    // events and update the order status automatically.
    const EBAY_CARRIER_MAP: Record<string, string> = {
      AMAZON_LOGISTICS: 'AmazonLogistics',
      AMAZON: 'AmazonLogistics',
      AMAZON_LOGISTICS_UK: 'AmazonLogistics',
      AMAZON_LOGISTICS_US: 'AmazonLogistics',
      ROYAL_MAIL: 'RoyalMail',
      ROYALMAIL: 'RoyalMail',
      DPD: 'DPD',
      DPD_UK: 'DPD',
      DPD_LOCAL: 'DPD',
      HERMES: 'Hermes',
      EVRI: 'Hermes',
      DHL: 'DHL',
      DHL_EXPRESS: 'DHL',
      DHL_GLOBAL_MAIL: 'DHLeCommerce',
      DHL_ECOMMERCE: 'DHLeCommerce',
      DHLECOMMERCE: 'DHLeCommerce',
      FEDEX: 'FedEx',
      UPS: 'UPS',
      USPS: 'USPS',
      YODEL: 'Yodel',
      PARCELFORCE: 'ParcelForce',
      TNT: 'TNT',
      COLLECT_PLUS: 'CollectPlus',
      COLLECTPLUS: 'CollectPlus',
      YANWEN: 'Yanwen',
      CHINA_POST: 'ChinaPost',
      CHINAPOST: 'ChinaPost',
      CAINIAO: 'Cainiao',
      ALIEXPRESS: 'Cainiao',
      ALIEXPRESS_STANDARD: 'Cainiao',
      '4PX': '4PX',
      CJPACKET: 'CJPacket',
      CJ_PACKET: 'CJPacket',
      SF_EXPRESS: 'SFExpress',
      SFEXPRESS: 'SFExpress',
      CANADA_POST: 'CanadaPost',
      CANADAPOST: 'CanadaPost',
      AUSTRALIA_POST: 'AustraliaPost',
      AUSPOST: 'AustraliaPost',
      JAPAN_POST: 'JapanPost',
      JAPANPOST: 'JapanPost',
      ONTRAC: 'OnTrac',
      LASERSHIP: 'LaserShip',
      OTHER: 'Other',
    };

    // Auto-detection sets the eBay-format code directly so it always matches
    // the ShippingCarrierEnum eBay expects.
    if (/^TBA\d{12,}$/i.test(cleaned)) {
      shippingCarrierCode = 'AmazonLogistics';
      autoDetected = true;
    }
    else if (/^1Z[A-Z0-9]{16}$/i.test(cleaned)) {
      shippingCarrierCode = 'UPS';
      autoDetected = true;
    }
    else if (/^\d{12,22}$/.test(cleaned) && (cleaned.startsWith('94') || cleaned.startsWith('92') || cleaned.startsWith('93') || cleaned.startsWith('420'))) {
      shippingCarrierCode = 'USPS';
      autoDetected = true;
    }
    else if (/^\d{12,15}$/.test(cleaned) && cleaned.length === 12) {
      shippingCarrierCode = 'FedEx';
      autoDetected = true;
    }
    else if (/^\d{10}$/.test(cleaned) && selectedCarrier === 'DHL') {
      shippingCarrierCode = 'DHL';
      autoDetected = true;
    }
    else if (/^[A-Z]{2}\d{9}[A-Z]{2}$/i.test(cleaned)) {
      if (/CN$/i.test(cleaned)) {
        shippingCarrierCode = 'ChinaPost';
        autoDetected = true;
      } else if (/GB$/i.test(cleaned)) {
        shippingCarrierCode = 'RoyalMail';
        autoDetected = true;
      }
    }
    else if (/^LP\d{14,}$/i.test(cleaned) || /^CJPAK/i.test(cleaned)) {
      shippingCarrierCode = 'Cainiao';
      autoDetected = true;
    }
    else if (/^YT\d{16}$/i.test(cleaned) || /^YP\d+$/i.test(cleaned)) {
      shippingCarrierCode = 'Yanwen';
      autoDetected = true;
    }
    else if (/^4PX/i.test(cleaned)) {
      shippingCarrierCode = '4PX';
      autoDetected = true;
    }
    else if (/^JD\d{13,18}$/i.test(cleaned) || /^JJD\d{12,18}$/i.test(cleaned)) {
      shippingCarrierCode = 'DPD';
      autoDetected = true;
    }
    else if (/^H\d{14,}$/i.test(cleaned)) {
      shippingCarrierCode = 'Hermes';
      autoDetected = true;
    }

    if (!autoDetected) {
      const upperCarrier = selectedCarrier.toUpperCase().replace(/[\s\-]/g, '_');
      shippingCarrierCode = EBAY_CARRIER_MAP[upperCarrier] || EBAY_CARRIER_MAP['OTHER'];
    }

    return { trackingNumber, shippingCarrierCode, autoDetected };
  }

  // Live carrier tracking URLs — used to give the user (and ultimately the buyer)
  // an instant link to the real-time tracking page on the actual carrier's site.
  // Returned by both /tracking/convert and /tracking/push-to-ebay so the UI can
  // surface a "Track Live" button regardless of where the order originated.
  function getCarrierTrackingUrl(carrierCode: string, trackingNumber: string): { url: string | null; label: string } {
    if (!trackingNumber) return { url: null, label: 'Carrier' };
    const code = (carrierCode || '').toUpperCase().replace(/[\s-]/g, '_');
    const num = encodeURIComponent(trackingNumber.trim());
    const map: Record<string, { url: string; label: string }> = {
      AMAZON: { url: `https://track.amazon.com/tracking/${num}`, label: 'Amazon Logistics' },
      AMAZON_LOGISTICS: { url: `https://track.amazon.com/tracking/${num}`, label: 'Amazon Logistics' },
      ROYAL_MAIL: { url: `https://www.royalmail.com/track-your-item#/tracking-results/${num}`, label: 'Royal Mail' },
      ROYALMAIL: { url: `https://www.royalmail.com/track-your-item#/tracking-results/${num}`, label: 'Royal Mail' },
      DPD: { url: `https://track.dpd.co.uk/parcels/${num}`, label: 'DPD' },
      HERMES: { url: `https://www.evri.com/track/parcel/${num}`, label: 'Evri (Hermes)' },
      EVRI: { url: `https://www.evri.com/track/parcel/${num}`, label: 'Evri (Hermes)' },
      DHL: { url: `https://www.dhl.com/gb-en/home/tracking/tracking-express.html?tracking-id=${num}`, label: 'DHL' },
      DHLGM: { url: `https://webtrack.dhlglobalmail.com/?trackingnumber=${num}`, label: 'DHL Global Mail' },
      FEDEX: { url: `https://www.fedex.com/fedextrack/?trknbr=${num}`, label: 'FedEx' },
      UPS: { url: `https://www.ups.com/track?tracknum=${num}`, label: 'UPS' },
      USPS: { url: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${num}`, label: 'USPS' },
      YODEL: { url: `https://www.yodel.co.uk/tracking?trackingNumber=${num}`, label: 'Yodel' },
      PARCELFORCE: { url: `https://www.parcelforce.com/track-trace?trackNumber=${num}`, label: 'Parcelforce' },
      TNT: { url: `https://www.tnt.com/express/en_gb/site/shipping-tools/tracking.html?searchType=con&cons=${num}`, label: 'TNT' },
      CAINIAO: { url: `https://global.cainiao.com/detail.htm?mailNoList=${num}`, label: 'Cainiao' },
      ALIEXPRESS: { url: `https://global.cainiao.com/detail.htm?mailNoList=${num}`, label: 'Cainiao / AliExpress' },
      YANWEN: { url: `https://track.yw56.com.cn/en/querydel?nums=${num}`, label: 'Yanwen' },
      CHINA_POST: { url: `https://track.chinapost.com.cn/result.html?searchType=1&queryCode=${num}`, label: 'China Post' },
      CHINAPOST: { url: `https://track.chinapost.com.cn/result.html?searchType=1&queryCode=${num}`, label: 'China Post' },
      '4PX': { url: `https://track.4px.com/#/result/0/${num}/`, label: '4PX' },
      CANADA_POST: { url: `https://www.canadapost-postescanada.ca/track-reperage/en#/details/${num}`, label: 'Canada Post' },
      CANPAR: { url: `https://www.canpar.com/en/track/TrackingAction.do?reference=${num}`, label: 'Canpar' },
      AUSPOST: { url: `https://auspost.com.au/mypost/track/details/${num}`, label: 'Australia Post' },
      AUSTRALIA_POST: { url: `https://auspost.com.au/mypost/track/details/${num}`, label: 'Australia Post' },
      JAPAN_POST: { url: `https://trackings.post.japanpost.jp/services/srv/search/?reqCodeNo1=${num}&locale=en`, label: 'Japan Post' },
    };
    const entry = map[code];
    if (entry) return entry;
    // Universal fallback — works for any number on any carrier.
    return {
      url: `https://www.17track.net/en/track?nums=${num}`,
      label: '17track (universal)',
    };
  }

  function getEbayOrderUrl(ebayOrderId: string): string {
    // Use the Seller Hub Orders SEARCH URL instead of the order-details deep link.
    // The /sh/ord/details?orderid=… page only accepts certain order ID formats
    // (and the buyer-side /mesh/ord/details errors with "Unfortunately there has
    // been an error retrieving your order" for sellers). The search URL is a
    // universal fallback: it lands on Seller Hub Orders filtered by the exact
    // order/sales-record ID, so the seller can click straight through to view
    // the order, the synced tracking, and the buyer details — works for legacy
    // and new order ID formats alike.
    const id = encodeURIComponent(ebayOrderId);
    return `https://www.ebay.com/sh/ord?q=${id}&filter=status:ALL_ORDERS`;
  }

  protectedApi.post('/tracking/convert', async (req: any, res) => {
    try {
      const { trackingNumber, carrier } = req.body;
      if (!trackingNumber) return res.status(400).json({ message: 'trackingNumber required' });
      const result = convertToEbayTracking(trackingNumber, carrier || 'OTHER');
      const live = getCarrierTrackingUrl(result.shippingCarrierCode, result.trackingNumber);
      res.json({
        ...result,
        carrierTrackingUrl: live.url,
        carrierLabel: live.label,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.post('/tracking/push-to-ebay', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { trackingNumber, carrier, ebayOrderId, storeId } = req.body;

      if (!trackingNumber || !ebayOrderId) {
        return res.status(400).json({ message: 'trackingNumber and ebayOrderId are required' });
      }

      // Validate the tracking number before doing anything with eBay.
      const validation = validateTrackingNumber(trackingNumber);
      if (!validation.valid) {
        return res.status(400).json({ message: validation.reason });
      }

      const converted = convertToEbayTracking(validation.cleaned, (carrier || 'OTHER').trim());

      let ebayStore: any = null;
      if (storeId) {
        ebayStore = await storage.getStore(Number(storeId));
        if (!ebayStore || ebayStore.platform !== 'ebay' || ebayStore.userId !== userId) {
          return res.status(400).json({ message: 'Invalid eBay store selected' });
        }
      } else {
        const allEbayStores = await storage.getAllActiveStoresByPlatform('ebay');
        const userEbayStores = allEbayStores.filter((s: any) => s.userId === userId);
        if (userEbayStores.length === 0) {
          return res.status(400).json({ message: 'No active eBay stores found. Please connect an eBay store first.' });
        }
        ebayStore = userEbayStores[0];
      }

      const accessToken = await ensureValidEbayToken(ebayStore, userId);
      if (!accessToken) {
        return res.status(401).json({ message: 'Failed to authenticate with eBay. Please reconnect your store.' });
      }

      let ebayLineItems: { lineItemId: string; quantity: number }[] = [];
      const localOrder = await storage.getOrderByExternalId(ebayOrderId, userId);
      const storedLineItems = (localOrder as any)?.lineItems || [];
      if (storedLineItems.length > 0 && storedLineItems[0]?.lineItemId) {
        ebayLineItems = storedLineItems
          .filter((li: any) => li.lineItemId && li.lineItemId !== '0')
          .map((li: any) => ({ lineItemId: li.lineItemId, quantity: li.quantity || 1 }));
      }

      let ebayOrderFetchStatus: number | null = null;
      if (ebayLineItems.length === 0) {
        try {
          const orderResp = await fetch(
            `https://api.ebay.com/sell/fulfillment/v1/order/${ebayOrderId}`,
            { headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' } }
          );
          ebayOrderFetchStatus = orderResp.status;
          if (orderResp.ok) {
            const orderData = await orderResp.json();
            ebayLineItems = (orderData.lineItems || []).map((li: any) => ({
              lineItemId: li.lineItemId,
              quantity: li.quantity || 1,
            }));
          }
        } catch (fetchErr: any) {
          console.error('[eBay Tracking] Failed to fetch order line items:', fetchErr.message);
        }
      }

      if (ebayLineItems.length === 0) {
        // Give the seller a precise reason so they can fix the input.
        if (ebayOrderFetchStatus === 404) {
          return res.status(404).json({ message: 'This order was not found in your connected eBay account. Double-check the eBay Order ID, and if you have more than one store make sure the correct one is selected.' });
        }
        if (ebayOrderFetchStatus === 401 || ebayOrderFetchStatus === 403) {
          return res.status(401).json({ message: 'eBay denied access to this order. Please reconnect your eBay store in Settings and try again.' });
        }
        return res.status(400).json({ message: 'Could not determine eBay line item IDs for this order. Please ensure the order exists in your eBay account and try again.' });
      }

      const { pushOrReplaceEbayFulfillment } = await import('./marketplaces/ebay');
      const pushResult = await pushOrReplaceEbayFulfillment(accessToken, ebayOrderId, {
        trackingNumber: converted.trackingNumber,
        shippingCarrierCode: converted.shippingCarrierCode,
        lineItems: ebayLineItems,
      });

      if (pushResult.success) {
        const live = getCarrierTrackingUrl(converted.shippingCarrierCode, converted.trackingNumber);
        const ebayOrderUrl = getEbayOrderUrl(ebayOrderId);
        await storage.createAuditLog({
          userId,
          action: 'tracking_pushed_to_ebay',
          source: 'ebay',
          details: {
            trackingNumber: converted.trackingNumber,
            carrier: converted.shippingCarrierCode,
            autoDetected: converted.autoDetected,
            ebayOrderId,
            standalone: true,
            replaced: pushResult.replaced,
            carrierTrackingUrl: live.url,
            ebayOrderUrl,
          },
        });

        // If this eBay order also exists locally, keep it in sync: mark it shipped,
        // save the tracking, and start live monitoring — same as the per-order flow.
        let localOrderSynced = false;
        try {
          const localOrder = await storage.getOrderByExternalId(ebayOrderId, userId);
          if (localOrder) {
            const statusUpdate: any = {
              trackingNumber: converted.trackingNumber,
              carrier: converted.shippingCarrierCode,
            };
            if (localOrder.status !== 'delivered' && localOrder.status !== 'cancelled') {
              statusUpdate.status = 'shipped';
            }
            await storage.updateOrder(localOrder.id, userId, statusUpdate);
            localOrderSynced = true;

            try {
              const { registerTracking } = await import('./tracking17track');
              const num = converted.trackingNumber.trim();
              const reg = await registerTracking([num]);
              const rejMsg = reg.rejected[num];
              const alreadyWatched = !!rejMsg && /exist|already/i.test(rejMsg);
              const registered = reg.accepted.includes(num) || alreadyWatched;
              await storage.updateOrder(localOrder.id, userId, {
                trackingInfo: {
                  provider: '17track',
                  status: 'Pending',
                  statusLabel: 'Pending',
                  tone: 'gray',
                  registered,
                  registerError: registered ? null : (rejMsg || 'Could not register with tracking provider'),
                  checkedAt: new Date().toISOString(),
                },
              } as any);
            } catch (regErr: any) {
              console.error('[Tracking] 17track register (push-to-ebay) failed:', regErr.message);
            }
          }
        } catch (syncErr: any) {
          console.error('[eBay Tracking Push] Local order sync failed:', syncErr.message);
        }

        res.json({
          success: true,
          trackingNumber: converted.trackingNumber,
          shippingCarrierCode: converted.shippingCarrierCode,
          autoDetected: converted.autoDetected,
          ebayOrderId,
          replaced: pushResult.replaced,
          carrierTrackingUrl: live.url,
          carrierLabel: live.label,
          ebayOrderUrl,
          localOrderSynced,
        });
      } else {
        console.error('[eBay Tracking Push] Failed:', pushResult.error);
        await storage.createAuditLog({
          userId,
          action: 'tracking_push_failed',
          source: 'ebay',
          details: {
            trackingNumber: converted.trackingNumber,
            carrier: converted.shippingCarrierCode,
            ebayOrderId,
            standalone: true,
            error: pushResult.error,
          },
        });
        res.status(400).json({ message: `eBay rejected the tracking: ${pushResult.error}` });
      }
    } catch (err: any) {
      console.error('[eBay Tracking Push] Error:', err.message);
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.post('/fulfillment-jobs/:id/update-tracking', requireFulfillmentAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = Number(req.params.id);
      const { trackingNumber: rawTracking, carrier: rawCarrier } = req.body;

      if (!rawTracking || !rawCarrier) {
        return res.status(400).json({ message: 'trackingNumber and carrier are required' });
      }

      const converted = convertToEbayTracking(rawTracking, rawCarrier);
      const trackingNumber = converted.trackingNumber;
      const carrier = rawCarrier;
      const ebayCarrierCode = converted.shippingCarrierCode;

      const job = await storage.getFulfillmentJob(id, userId);
      if (!job) return res.status(404).json({ message: 'Fulfillment job not found' });

      const updatedJob = await storage.updateFulfillmentJob(id, userId, {
        trackingNumber,
        carrier,
        status: 'shipped',
        fulfilledAt: new Date(),
      });

      await storage.updateOrder(job.orderId, userId, {
        trackingNumber,
        carrier,
        fulfillmentStatus: 'fulfilled',
        status: 'shipped',
      });

      console.log(`[Tracking] Converted: "${rawTracking}" + "${rawCarrier}" → eBay carrier "${ebayCarrierCode}"${converted.autoDetected ? ' (auto-detected)' : ''}`);

      const order = await storage.getOrder(job.orderId, userId);
      if (order?.externalOrderId && order?.storeId) {
        const store = await storage.getStore(order.storeId);
        if (store && store.platform === 'ebay') {
          try {
            const accessToken = await ensureValidEbayToken(store, userId);
            if (accessToken) {
              const lineItems = (order as any).lineItems || [];
              let ebayLineItems = lineItems
                .filter((li: any) => li.lineItemId && li.lineItemId !== '0' && li.lineItemId !== '')
                .map((li: any) => ({ lineItemId: li.lineItemId, quantity: li.quantity || 1 }));

              if (ebayLineItems.length === 0) {
                try {
                  const orderResp = await fetch(
                    `https://api.ebay.com/sell/fulfillment/v1/order/${order.externalOrderId}`,
                    { headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' } }
                  );
                  if (orderResp.ok) {
                    const orderData = await orderResp.json();
                    ebayLineItems = (orderData.lineItems || []).map((li: any) => ({
                      lineItemId: li.lineItemId,
                      quantity: li.quantity || 1,
                    }));
                  }
                } catch (fetchErr: any) {
                  console.error('[eBay Tracking] Failed to fetch order line items:', fetchErr.message);
                }
              }

              if (ebayLineItems.length === 0) {
                console.error('[eBay Tracking] No valid line items for order', order.externalOrderId);
              }

              if (ebayLineItems.length > 0) {
                const { pushOrReplaceEbayFulfillment } = await import('./marketplaces/ebay');
                const pushResult = await pushOrReplaceEbayFulfillment(accessToken, order.externalOrderId!, {
                  trackingNumber,
                  shippingCarrierCode: ebayCarrierCode,
                  lineItems: ebayLineItems,
                });

                if (pushResult.success) {
                  await storage.createAuditLog({
                    userId,
                    orderId: job.orderId,
                    action: 'tracking_pushed_to_ebay',
                    source: 'ebay',
                    details: { trackingNumber, carrier: rawCarrier, ebayCarrierCode, autoDetected: converted.autoDetected, ebayOrderId: order.externalOrderId, replaced: pushResult.replaced },
                  });
                } else {
                  console.error('[eBay Tracking] Push failed:', pushResult.error);
                  await storage.createAuditLog({
                    userId,
                    orderId: job.orderId,
                    action: 'tracking_push_failed',
                    source: 'ebay',
                    details: { trackingNumber, carrier: rawCarrier, ebayCarrierCode, error: pushResult.error },
                  });
                }
              }
            }
          } catch (ebayErr: any) {
            console.error('[eBay Tracking] Error:', ebayErr.message);
          }
        }

        if (store && store.platform === 'tiktokshop') {
          try {
            const creds = store.credentials as any;
            if (creds?.accessToken && creds?.appKey && creds?.appSecret) {
              const { uploadTikTokTracking } = await import('./marketplaces/tiktokshop');
              const ttResult = await uploadTikTokTracking(creds, order.externalOrderId!, trackingNumber, carrier);
              if (ttResult.success) {
                await storage.createAuditLog({
                  userId,
                  orderId: job.orderId,
                  action: 'tracking_pushed_to_tiktok',
                  source: 'tiktokshop',
                  details: { trackingNumber, carrier, tiktokOrderId: order.externalOrderId },
                });
              } else {
                console.error('[TikTok Tracking] Push failed:', ttResult.error);
                await storage.createAuditLog({
                  userId,
                  orderId: job.orderId,
                  action: 'tracking_push_failed',
                  source: 'tiktokshop',
                  details: { trackingNumber, carrier, error: ttResult.error },
                });
              }
            }
          } catch (ttErr: any) {
            console.error('[TikTok Tracking] Error:', ttErr.message);
          }
        }
      }

      await storage.createAuditLog({
        userId,
        orderId: job.orderId,
        action: 'tracking_updated',
        vendorUsed: job.vendorName || undefined,
        fulfillmentStatus: 'shipped',
        details: { trackingNumber, carrier, jobId: id },
      });

      res.json(updatedJob);
    } catch (err: any) {
      console.error('[Fulfillment] Update tracking error:', err.message);
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.post('/fulfillment-jobs/:id/complete', requireFulfillmentAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = Number(req.params.id);
      const { vendorOrderId, amountCharged, paymentMethod } = req.body;

      const updatedJob = await storage.updateFulfillmentJob(id, userId, {
        vendorOrderId,
        amountCharged: amountCharged ? String(amountCharged) : undefined,
        paymentMethod,
        paymentStatus: 'completed',
        status: 'processing',
      });

      await storage.createAuditLog({
        userId,
        orderId: updatedJob.orderId,
        action: 'vendor_order_placed',
        vendorUsed: updatedJob.vendorName || undefined,
        paymentMethod,
        fulfillmentStatus: 'processing',
        details: { vendorOrderId, amountCharged, jobId: id },
      });

      res.json(updatedJob);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.post('/fulfillment-jobs/:id/retry', requireFulfillmentAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = Number(req.params.id);
      const job = await storage.getFulfillmentJob(id, userId);
      if (!job) return res.status(404).json({ message: 'Fulfillment job not found' });

      const updatedJob = await storage.updateFulfillmentJob(id, userId, {
        status: 'pending',
        errorMessage: null,
        retryCount: job.retryCount + 1,
      });

      await storage.createAuditLog({
        userId,
        orderId: job.orderId,
        action: 'fulfillment_retried',
        details: { jobId: id, retryCount: job.retryCount + 1 },
      });

      res.json(updatedJob);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === FULFILLED ORDERS ===
  protectedApi.get('/fulfilled-orders', requireFulfillmentAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const status = req.query.status as string | undefined;
      const vendorName = req.query.vendorName as string | undefined;
      const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined;
      const dateTo = req.query.dateTo ? new Date(req.query.dateTo as string) : undefined;
      const results = await storage.getFulfilledOrders(userId, { status, vendorName, dateFrom, dateTo });
      const userProducts = await storage.getProducts(userId);
      const enriched = results.map((item: any) => {
        let enrichedItem = item;
        if (item.order?.status === 'delivered' && item.status === 'shipped') {
          enrichedItem = { ...enrichedItem, status: 'delivered' };
        }
        if (enrichedItem.order?.lineItems && Array.isArray(enrichedItem.order.lineItems)) {
          return { ...enrichedItem, order: { ...enrichedItem.order, lineItems: enrichLineItemsWithImages(enrichedItem.order.lineItems, userProducts) } };
        }
        return enrichedItem;
      });
      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.get('/cancelled-orders', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const allOrders = await storage.getOrders(userId);
      const cancelled = allOrders.filter((o: any) => o.status === 'cancelled');
      const userProducts = await storage.getProducts(userId);
      res.json(enrichOrdersWithImages(cancelled, userProducts));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.post('/orders/:id/accept-cancellation', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const orderId = Number(req.params.id);
      const order = await storage.getOrder(orderId, userId);
      if (!order) return res.status(404).json({ message: 'Order not found' });
      if (order.status !== 'cancelled') return res.status(400).json({ message: 'Order is not cancelled' });

      await storage.updateOrder(orderId, userId, { fulfillmentStatus: 'cancelled' });
      await storage.createAuditLog({
        userId,
        orderId,
        action: 'cancellation_accepted',
        source: 'manual',
        details: { externalOrderId: order.externalOrderId },
      });

      let ebayWarning: string | null = null;
      if (order.externalOrderId && order.storeId) {
        const store = await storage.getStore(order.storeId);
        if (store && store.platform === 'ebay') {
          try {
            const accessToken = await ensureValidEbayToken(store, userId);
            if (accessToken) {
              const ebayRes = await fetch(
                `https://api.ebay.com/sell/fulfillment/v1/order/${order.externalOrderId}/issue_refund`,
                {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    reasonForRefund: 'BUYER_CANCEL',
                    orderLevelRefundAmount: {
                      value: order.totalAmount?.toString() || '0',
                      currency: 'GBP',
                    },
                  }),
                }
              );
              if (!ebayRes.ok) {
                const errText = await ebayRes.text().catch(() => '');
                ebayWarning = `eBay refund request failed (${ebayRes.status}). Please issue refund manually on eBay.`;
                console.error('[eBay Refund] Failed:', ebayRes.status, errText);
              }
              await storage.createAuditLog({
                userId,
                orderId,
                action: ebayRes.ok ? 'ebay_refund_issued' : 'ebay_refund_failed',
                source: 'ebay',
                details: { externalOrderId: order.externalOrderId, status: ebayRes.status },
              });
            }
          } catch (ebayErr: any) {
            console.error('[eBay Refund] Error:', ebayErr.message);
            ebayWarning = 'Could not connect to eBay to issue refund. Please process refund manually.';
          }
        }
      }

      res.json({ success: true, message: 'Cancellation accepted', ebayWarning });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.post('/orders/:id/dispute-cancellation', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const orderId = Number(req.params.id);
      const { reason } = req.body;
      const order = await storage.getOrder(orderId, userId);
      if (!order) return res.status(404).json({ message: 'Order not found' });
      if (order.status !== 'cancelled') return res.status(400).json({ message: 'Order is not cancelled' });

      await storage.updateOrder(orderId, userId, { status: 'processing', fulfillmentStatus: 'unfulfilled' });
      await storage.createAuditLog({
        userId,
        orderId,
        action: 'cancellation_disputed',
        source: 'manual',
        details: { reason: reason || 'Seller dispute', externalOrderId: order.externalOrderId },
      });

      let ebayWarning: string | null = null;
      if (order.externalOrderId && order.storeId) {
        const store = await storage.getStore(order.storeId);
        if (store && store.platform === 'ebay') {
          try {
            const accessToken = await ensureValidEbayToken(store, userId);
            if (accessToken) {
              const ebayRes = await fetch(
                `https://api.ebay.com/post-order/v2/cancellation/${order.externalOrderId}/reject`,
                {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'X-EBAY-C-MARKETPLACE-ID': 'EBAY_GB',
                  },
                  body: JSON.stringify({
                    shipmentDate: { value: new Date().toISOString() },
                    trackingNumber: order.trackingNumber || '',
                  }),
                }
              );
              if (!ebayRes.ok) {
                const errText = await ebayRes.text().catch(() => '');
                ebayWarning = `eBay dispute request failed (${ebayRes.status}). You may need to dispute the cancellation manually on eBay.`;
                console.error('[eBay Dispute] Failed:', ebayRes.status, errText);
              }
              await storage.createAuditLog({
                userId,
                orderId,
                action: ebayRes.ok ? 'ebay_cancellation_rejected' : 'ebay_dispute_failed',
                source: 'ebay',
                details: { externalOrderId: order.externalOrderId, status: ebayRes.status },
              });
            }
          } catch (ebayErr: any) {
            console.error('[eBay Dispute] Error:', ebayErr.message);
            ebayWarning = 'Could not connect to eBay to dispute cancellation. Please dispute manually on eBay.';
          }
        }
      }

      res.json({ success: true, message: 'Cancellation disputed — order restored to processing', ebayWarning });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === PAYMENT CARDS ===
  protectedApi.get('/payment-cards', requireFulfillmentAccess, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const cards = await storage.getPaymentCards(userId);
    const safeCards = cards.map(c => ({ ...c, tokenizedId: '***' }));
    res.json(safeCards);
  });

  protectedApi.post('/payment-cards', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const parsed = paymentCardCreateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: 'Invalid card data', errors: parsed.error.flatten().fieldErrors });
      const card = await storage.createPaymentCard({ ...parsed.data, userId });
      await storage.createAuditLog({ userId, action: 'payment_card_added', details: { lastFour: parsed.data.lastFour, brand: parsed.data.brand } });
      res.json({ ...card, tokenizedId: '***' });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.put('/payment-cards/:id', requireFulfillmentAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = Number(req.params.id);
      const card = await storage.updatePaymentCard(id, userId, req.body);
      res.json({ ...card, tokenizedId: '***' });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.delete('/payment-cards/:id', requireFulfillmentAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = Number(req.params.id);
      await storage.deletePaymentCard(id, userId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === RETURN REQUESTS ===
  protectedApi.get('/return-requests', requireFulfillmentAccess, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const requests = await storage.getReturnRequests(userId);
    res.json(requests);
  });

  const returnRequestSchema = z.object({
    orderId: z.number(),
    reason: z.string().min(1).max(1000),
    fulfillmentJobId: z.number().optional().nullable(),
  });

  protectedApi.post('/return-requests', requireFulfillmentAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const parsed = returnRequestSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: 'Invalid data', errors: parsed.error.flatten().fieldErrors });
      const { orderId, reason, fulfillmentJobId } = parsed.data;

      const order = await storage.getOrder(orderId, userId);
      if (!order) return res.status(404).json({ message: 'Order not found' });

      const request = await storage.createReturnRequest({
        userId,
        orderId,
        fulfillmentJobId: fulfillmentJobId || null,
        reason,
        status: 'pending',
      });

      await storage.createAuditLog({
        userId,
        orderId,
        action: 'return_requested',
        details: { returnId: request.id, reason },
      });

      res.json(request);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.put('/return-requests/:id', requireFulfillmentAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = Number(req.params.id);
      const updated = await storage.updateReturnRequest(id, userId, req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === AUDIT LOGS ===
  protectedApi.get('/audit-logs', requireFulfillmentAccess, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const orderId = req.query.orderId ? Number(req.query.orderId) : undefined;
    const logs = await storage.getAuditLogs(userId, { orderId });
    res.json(logs);
  });

  // === FEATURE FLAGS ===
  protectedApi.get('/feature-flags', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const flags = await storage.getFeatureFlags();
      const isAdmin = user?.isAdmin === 'true';
      const isTester = user?.email && DROP_AND_SELL_TESTERS.has(user.email.toLowerCase());
      const visibleFlags = flags.map(f => ({
        ...f,
        accessible: isAdmin || (!f.adminOnly && f.isEnabled) || (isTester && f.featureKey === 'drop_and_sell'),
      }));
      if (isTester && !visibleFlags.some(f => f.featureKey === 'drop_and_sell')) {
        visibleFlags.push({ id: 0, featureKey: 'drop_and_sell', name: 'Drop-and-Sell Listing Service', description: '', isEnabled: true, adminOnly: true, metadata: null, createdAt: new Date(), updatedAt: new Date(), accessible: true } as any);
      }
      res.json(visibleFlags);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.put('/feature-flags/:key', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const isAdmin = user?.isAdmin === 'true';
      if (!isAdmin) return res.status(403).json({ message: 'Admin access required' });

      const featureKey = req.params.key;
      let flag = await storage.getFeatureFlag(featureKey);
      if (!flag) {
        flag = await storage.createFeatureFlag({
          featureKey,
          name: featureKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          description: '',
          isEnabled: req.body.isEnabled ?? false,
          adminOnly: req.body.adminOnly ?? true,
        });
      } else {
        flag = await storage.updateFeatureFlag(featureKey, req.body);
      }
      
      await storage.createAuditLog({
        userId,
        action: 'feature_flag_updated',
        details: { featureKey, changes: req.body },
      });

      res.json(flag || { featureKey, ...req.body, success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.post('/feature-flags/:key/publish', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const isAdmin = user?.isAdmin === 'true';
      if (!isAdmin) return res.status(403).json({ message: 'Admin access required' });

      const featureKey = req.params.key;
      const updated = await storage.updateFeatureFlag(featureKey, { isEnabled: true, adminOnly: false });

      await storage.createAuditLog({
        userId,
        action: 'feature_published',
        details: { featureKey },
      });

      const featureGuides: Record<string, { name: string; guide: string }> = {
        jumia_marketplace: {
          name: 'Jumia Marketplace Integration',
          guide: `
            <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 20px; margin-bottom: 16px;">
              <p style="color: #9a3412; font-size: 15px; font-weight: 600; margin: 0 0 12px 0;">Sell Across Africa with Jumia</p>
              <p style="color: #9a3412; font-size: 14px; line-height: 1.6; margin: 0 0 12px 0;">
                DropandSell now supports Jumia — Africa's largest online marketplace! Connect your Jumia Seller Center account and manage orders from Nigeria, Kenya, Ghana, Egypt, and 8 more African countries, all from one dashboard.
              </p>
            </div>
            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin-bottom: 16px;">
              <p style="color: #1e40af; font-size: 15px; font-weight: 600; margin: 0 0 12px 0;">Quick Start Guide</p>
              <ol style="color: #1e40af; font-size: 14px; line-height: 2; margin: 0; padding-left: 20px;">
                <li><strong>Get Your API Key</strong> — Log in to <em>Jumia Seller Center</em> → Settings → Integration Management → API tab. Copy your API Key.</li>
                <li><strong>Connect Your Store</strong> — Go to Stores page → click <em>"Add Store"</em> → select <em>Jumia</em> → choose your country, enter your Seller Email and API Key.</li>
                <li><strong>Sync Orders</strong> — Go to Orders page and click <em>"Sync Jumia"</em> to pull in your latest orders automatically.</li>
                <li><strong>Publish Products</strong> — List your products on Jumia directly from the Publish Queue, just like eBay or Amazon.</li>
              </ol>
            </div>
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
              <p style="color: #166534; font-size: 14px; margin: 0;">
                <strong>Supported Countries:</strong> Nigeria, Kenya, Ghana, Egypt, Côte d'Ivoire, Senegal, Cameroon, Uganda, Tanzania, Morocco, Tunisia, Algeria
              </p>
            </div>
          `,
        },
        auto_fulfillment: {
          name: 'Automated Fulfillment System',
          guide: `
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 16px;">
              <p style="color: #166534; font-size: 15px; font-weight: 600; margin: 0 0 12px 0;">How It Works</p>
              <p style="color: #166534; font-size: 14px; line-height: 1.6; margin: 0 0 12px 0;">
                When an eBay order comes in, DropandSell matches it to the original vendor product automatically. You then follow a simple 3-step guided process to place the vendor order and sync tracking back to eBay.
              </p>
            </div>
            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin-bottom: 16px;">
              <p style="color: #1e40af; font-size: 15px; font-weight: 600; margin: 0 0 12px 0;">Quick Start Guide</p>
              <ol style="color: #1e40af; font-size: 14px; line-height: 2; margin: 0; padding-left: 20px;">
                <li><strong>Set Up SKU Mappings</strong> — Go to Fulfillment page → SKU Mappings tab → click <em>"Sync from Inventory"</em> to auto-generate mappings from your imported products. This links each eBay SKU to its original vendor product, URL, and cost price.</li>
                <li><strong>Sync Your Orders</strong> — Go to Orders page and sync your eBay orders. The system captures line items and auto-creates any missing SKU mappings.</li>
                <li><strong>Fulfill Orders</strong> — Click <em>"Fulfill"</em> on any unfulfilled order. Step 1 shows order details, vendor product match, and profit calculation. Step 2 copies the shipping address and opens the vendor page. Step 3 lets you enter the tracking number, which syncs to eBay automatically.</li>
                <li><strong>Monitor Progress</strong> — Track all fulfillment jobs, returns, and activity in the Fulfillment page tabs.</li>
              </ol>
            </div>
            <div style="background: #fefce8; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
              <p style="color: #92400e; font-size: 14px; margin: 0;">
                <strong>Tip:</strong> Products imported via the Chrome extension already have vendor URLs and cost prices — the system uses this data to auto-match everything. The more complete your product data, the smoother fulfillment runs.
              </p>
            </div>
          `,
        },
      };

      const featureInfo = featureGuides[featureKey];
      if (featureInfo) {
        try {
          const allSubscribers = await storage.getAllSubscribers();
          const activeSubscribers = allSubscribers.filter((s: any) => s.email && s.subscriptionStatus === 'active');
          const { sendFeatureAnnouncementEmail } = await import('./email.js');

          let sent = 0;
          for (const subscriber of activeSubscribers) {
            try {
              await sendFeatureAnnouncementEmail(
                subscriber.email!,
                subscriber.firstName || '',
                featureInfo.name,
                featureInfo.guide
              );
              sent++;
            } catch (emailErr: any) {
              console.error(`[Feature Publish] Failed to email ${subscriber.email}:`, emailErr.message);
            }
          }
          console.log(`[Feature Publish] Announcement emails sent to ${sent}/${activeSubscribers.length} active subscribers`);
        } catch (emailErr: any) {
          console.error(`[Feature Publish] Email batch error:`, emailErr.message);
        }
      }

      res.json({ ...updated, published: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
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
      
      const plans = result.rows.map((row: any) => {
        const matchedPlan = SUBSCRIPTION_PLANS.find(p => 
          p.name.toLowerCase() === row.product_name?.toLowerCase() || 
          p.id === row.product_metadata?.plan_id
        );
        const monthlyAmount = row.unit_amount / 100;
        return {
          id: row.product_id,
          planId: matchedPlan?.id || row.product_metadata?.plan_id || null,
          name: row.product_name,
          description: row.product_description,
          priceId: row.price_id,
          amount: monthlyAmount,
          yearlyAmount: getYearlyPrice(monthlyAmount),
          yearlyMonthly: Math.round(getYearlyPrice(monthlyAmount) / 12 * 100) / 100,
          currency: row.currency?.toUpperCase() || 'GBP',
          listingsLimit: row.product_metadata?.listings_limit || 0,
          storeLimit: matchedPlan?.storeLimit || 2,
          interval: row.recurring?.interval || 'month',
        };
      });
      
      res.json(plans);
    } catch (error) {
      console.warn('Could not fetch Stripe plans, using static data:', error);
      res.json(SUBSCRIPTION_PLANS.map((plan) => ({
        id: plan.id,
        name: plan.name,
        description: `Up to ${plan.listings.toLocaleString()} item listings per month`,
        priceId: plan.id,
        amount: plan.priceGbp,
        yearlyAmount: getYearlyPrice(plan.priceGbp),
        yearlyMonthly: Math.round(getYearlyPrice(plan.priceGbp) / 12 * 100) / 100,
        currency: 'GBP',
        listingsLimit: plan.listings,
        storeLimit: plan.storeLimit,
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
      const { priceId, planName: clientPlanName, billingInterval: clientInterval } = req.body;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
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
      
      const planName = clientPlanName || SUBSCRIPTION_PLANS.find(p => p.id === priceId)?.name || '';
      const interval = clientInterval === 'year' ? 'year' : 'month';
      
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        success_url: `${req.protocol}://${req.get('host')}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.protocol}://${req.get('host')}/payment-setup`,
        metadata: {
          userId,
          planName,
          billingInterval: interval,
        },
      });
      
      res.json({ url: session.url });
    } catch (error: any) {
      console.error('Checkout error:', error);
      res.status(500).json({ message: error.message || 'Failed to create checkout session' });
    }
  });

  protectedApi.post('/subscription/verify', async (req: any, res) => {
    try {
      const { sessionId } = req.body;
      const userId = req.user.claims.sub;
      if (!sessionId) {
        return res.status(400).json({ message: 'Session ID required' });
      }
      const stripe = await getUncachableStripeClient();
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      
      if (session.metadata?.userId !== userId) {
        return res.status(403).json({ message: 'Session does not belong to this user' });
      }
      
      if (session.payment_status === 'paid' || session.status === 'complete') {
        const planName = session.metadata?.planName;
        if (planName) {
          const interval = session.metadata?.billingInterval || 'month';
          await storage.updateUser(userId, { subscriptionPlan: planName, subscriptionStatus: 'active', billingInterval: interval });
          console.log(`[Subscription] Immediately activated plan '${planName}' (${interval}ly) for user ${userId} via verify`);

          if (session.subscription) {
            try {
              const stripeSub: any = await stripe.subscriptions.retrieve(session.subscription as string);
              const periodEndTs = stripeSub.current_period_end ?? stripeSub.items?.data?.[0]?.current_period_end;
              const periodEnd = periodEndTs ? new Date(periodEndTs * 1000) : null;
              const existingSub = await storage.getSubscription(userId);
              if (existingSub) {
                await db.update(subscriptions).set({
                  planName,
                  status: 'active',
                  stripeSubscriptionId: session.subscription as string,
                  ...(periodEnd ? { currentPeriodEnd: periodEnd } : {}),
                }).where(eq(subscriptions.userId, userId));
              } else {
                await db.insert(subscriptions).values({
                  userId,
                  planName,
                  status: 'active',
                  stripeSubscriptionId: session.subscription as string,
                  currentPeriodEnd: periodEnd || new Date(Date.now() + (interval === 'year' ? 365.25 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000)),
                });
              }
              console.log(`[Subscription] Updated subscription record with period end: ${periodEnd?.toISOString() || 'estimated'}`);
            } catch (subErr: any) {
              console.error('[Subscription] Failed to retrieve Stripe subscription details:', subErr.message);
            }
          }
        }
        
        const addonId = session.metadata?.addonId;
        if (addonId) {
          const existing = await storage.getUserAddonPurchases(userId);
          if (!existing.some(p => p.addonId === addonId && p.status === 'active')) {
            await storage.createAddonPurchase(userId, addonId, session.subscription as string || session.id);
            console.log(`[Addon] Activated '${addonId}' for user ${userId} via verify`);
          }
        }
        
        const user = await storage.getUser(userId);
        res.json({
          activated: true,
          plan: planName,
          status: 'active',
          storeLimit: getStoreLimitForPlan(user?.subscriptionPlan, user?.subscriptionStatus, user?.email, user?.createdAt),
        });
      } else {
        res.json({ activated: false, status: session.payment_status });
      }
    } catch (error: any) {
      console.error('Verify subscription error:', error);
      res.status(500).json({ message: error.message || 'Failed to verify subscription' });
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

  protectedApi.post('/stripe/create-checkout-session', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { planId, billingInterval, successUrl, cancelUrl } = req.body;
      
      const user = await storage.getUser(userId);
      const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId || p.name.toLowerCase() === planId?.toLowerCase());
      
      if (!plan) {
        return res.status(400).json({ message: 'Invalid plan selected' });
      }

      const interval = billingInterval === 'year' ? 'year' : 'month';
      const isYearly = interval === 'year';
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

      const unitAmount = isYearly
        ? Math.round(getYearlyPrice(plan.priceGbp) * 100)
        : plan.priceGbp * 100;

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
                description: isYearly
                  ? `Up to ${plan.listings.toLocaleString()} active listings — Yearly (10% off)`
                  : `Up to ${plan.listings.toLocaleString()} active listings`,
              },
              unit_amount: unitAmount,
              recurring: { interval: isYearly ? 'year' : 'month' },
            },
            quantity: 1,
          },
        ],
        success_url: successUrl
          ? (successUrl.includes('?') ? `${successUrl}&session_id={CHECKOUT_SESSION_ID}` : `${successUrl}?session_id={CHECKOUT_SESSION_ID}`)
          : `${req.protocol}://${req.get('host')}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl || `${req.protocol}://${req.get('host')}/payment-setup`,
        metadata: {
          userId,
          planId,
          planName: plan.name,
          billingInterval: isYearly ? 'year' : 'month',
        },
      });

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
    const userId = await resolveInventoryOwnerId(req.user.claims.sub);
    const queue = await storage.getPublishQueue(userId);
    res.json(queue);
  });

  protectedApi.post('/publish-queue', async (req: any, res) => {
    try {
      const userId = await resolveInventoryOwnerId(req.user.claims.sub);
      const { productId, storeId, calculatedPrice, pricingRuleId, quantity, postageType, postageCost } = req.body;
      
      const product = await storage.getProduct(productId, userId);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      
      const store = await storage.getStore(storeId, userId);
      
      const sanitized = await storage.sanitizeVeroContent(userId, product.title, product.description || '', product.brand || '');
      if (sanitized.removedFromTitle || sanitized.removedFromDescription || sanitized.detectedBrand) {
        await storage.updateProduct(product.id, userId, {
          title: sanitized.title,
          description: sanitized.description,
          brand: sanitized.brand,
          veroStatus: 'clean',
        });
        console.log(`[QUEUE] VeRO auto-sanitized product ${product.id} before queueing: brand="${sanitized.detectedBrand}" removed`);
      }
      
      const restrictedCheck = await storage.checkRestrictedViolations(userId, sanitized.title, sanitized.description);
      if (restrictedCheck.isBlocked) {
        const restrictedItems = restrictedCheck.violations.map(v => `${v.keyword} (${v.category})`).join(', ');
        return res.status(400).json({ message: `Restricted product detected: ${restrictedItems}. This item cannot be queued for publishing.` });
      }
      
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
      const userId = await resolveInventoryOwnerId(req.user.claims.sub);
      const { items } = req.body;
      
      console.log('[PUBLISH-QUEUE DEBUG] Received items from frontend:', JSON.stringify(items?.map((i: any) => ({ productId: i.productId, storeId: i.storeId }))));
      
      const blockedProducts: string[] = [];
      const validItems: any[] = [];
      
      for (const item of items) {
        const product = await storage.getProduct(item.productId, userId);
        if (!product) continue;
        
        const sanitized = await storage.sanitizeVeroContent(userId, product.title, product.description || '', product.brand || '');
        if (sanitized.removedFromTitle || sanitized.removedFromDescription || sanitized.detectedBrand) {
          await storage.updateProduct(product.id, userId, {
            title: sanitized.title,
            description: sanitized.description,
            brand: sanitized.brand,
            veroStatus: 'clean',
          });
          console.log(`[QUEUE-BULK] VeRO auto-sanitized product ${product.id}: brand="${sanitized.detectedBrand}" removed`);
        }
        
        const restrictedCheck = await storage.checkRestrictedViolations(userId, sanitized.title, sanitized.description);
        
        if (restrictedCheck.isBlocked) {
          await storage.updateProduct(product.id, userId, { veroStatus: 'blocked' });
          const reasons = restrictedCheck.violations.map(v => `Restricted: ${v.keyword}`);
          blockedProducts.push(`"${sanitized.title}" (${reasons.join(', ')})`);
          continue;
        }
        
        validItems.push({
          userId,
          productId: item.productId,
          storeId: item.storeId,
          calculatedPrice: item.calculatedPrice?.toString() || '0',
          pricingRuleId: item.pricingRuleId,
          quantity: item.quantity || 1,
          postageType: item.postageType || 'buyer_pays',
          postageCost: item.postageCost?.toString() || null,
          status: 'pending',
        });
      }
      
      let created: any[] = [];
      if (validItems.length > 0) {
        created = await storage.bulkCreatePublishQueue(validItems);
      }
      
      if (blockedProducts.length > 0) {
        return res.status(created.length > 0 ? 207 : 400).json({
          created,
          blocked: blockedProducts,
          message: `${blockedProducts.length} product(s) blocked by VERO/restricted checks: ${blockedProducts.join('; ')}`,
        });
      }
      
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ message: err.message || 'Failed to bulk add to publish queue' });
    }
  });

  protectedApi.put('/publish-queue/:id', async (req: any, res) => {
    try {
      const userId = await resolveInventoryOwnerId(req.user.claims.sub);
      const id = Number(req.params.id);
      const updates = req.body;
      if (updates.calculatedPrice !== undefined) {
        updates.calculatedPrice = updates.calculatedPrice.toString();
      }
      const item = await storage.updatePublishQueueItem(id, updates, userId);
      if (!item) {
        return res.status(404).json({ message: 'Queue item not found' });
      }
      res.json(item);
    } catch (err: any) {
      res.status(400).json({ message: err.message || 'Failed to update queue item' });
    }
  });

  protectedApi.delete('/publish-queue/:id', async (req: any, res) => {
    const userId = await resolveInventoryOwnerId(req.user.claims.sub);
    const id = Number(req.params.id);
    await storage.deletePublishQueueItem(id, userId);
    res.status(204).send();
  });

  // === AI: GENERATE PRODUCT DESCRIPTION ===
  const openai = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });

  // === UI TRANSLATION ===
  // In-memory cache shared across requests for the lifetime of the process.
  // Keyed by `${targetLang}::${sourceText}`. Bounded to keep memory in check.
  const translationCache = new Map<string, string>();
  const MAX_TRANSLATION_CACHE = 50000;

  app.post('/api/translate', async (req, res) => {
    try {
      const { texts, target } = req.body || {};
      if (!Array.isArray(texts) || typeof target !== 'string' || !target) {
        return res.status(400).json({ message: 'texts (array) and target (string) required' });
      }
      if (target === 'en') {
        return res.json({ translations: texts });
      }
      // Cap batch size for safety.
      const batch = texts.slice(0, 200).map((t) => (typeof t === 'string' ? t : String(t ?? '')));

      const results: string[] = new Array(batch.length);
      const toTranslate: { idx: number; text: string }[] = [];
      for (let i = 0; i < batch.length; i++) {
        const txt = batch[i];
        if (!txt || !txt.trim()) {
          results[i] = txt;
          continue;
        }
        const cacheKey = `${target}::${txt}`;
        const cached = translationCache.get(cacheKey);
        if (cached !== undefined) {
          results[i] = cached;
        } else {
          toTranslate.push({ idx: i, text: txt });
        }
      }

      if (toTranslate.length === 0) {
        return res.json({ translations: results });
      }

      if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
        // No AI available — return originals so the UI doesn't break.
        for (const item of toTranslate) results[item.idx] = item.text;
        return res.json({ translations: results });
      }

      // Build a numbered list so the model returns aligned output.
      const numbered = toTranslate.map((item, i) => `${i + 1}. ${item.text.replace(/\n/g, ' ⏎ ')}`).join('\n');

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0,
        messages: [
          {
            role: 'system',
            content:
              'You are a precise UI translator. Translate each numbered line into the requested language. Preserve product names, brand names, code, numbers, units, emojis and punctuation exactly. Do not add commentary. Return ONLY a JSON object: {"translations":[{"i":<number>,"t":"<translated text>"}, ...]} with one entry per input line, in the same order. The "⏎" character represents a line break and must be preserved in the output as "⏎".',
          },
          {
            role: 'user',
            content: `Target language code: ${target}\n\nLines to translate:\n${numbered}`,
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 4000,
      });

      const raw = completion.choices?.[0]?.message?.content || '{}';
      let parsed: any = {};
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = {};
      }
      const arr: Array<{ i: number; t: string }> = Array.isArray(parsed.translations) ? parsed.translations : [];
      const byIdx = new Map<number, string>();
      for (const entry of arr) {
        if (entry && typeof entry.i === 'number' && typeof entry.t === 'string') {
          byIdx.set(entry.i, entry.t.replace(/⏎/g, '\n'));
        }
      }

      for (let j = 0; j < toTranslate.length; j++) {
        const item = toTranslate[j];
        const translated = byIdx.get(j + 1) ?? item.text;
        results[item.idx] = translated;
        const cacheKey = `${target}::${item.text}`;
        if (translationCache.size >= MAX_TRANSLATION_CACHE) {
          // Drop oldest entry (Map preserves insertion order).
          const oldestKey = translationCache.keys().next().value;
          if (oldestKey !== undefined) translationCache.delete(oldestKey);
        }
        translationCache.set(cacheKey, translated);
      }

      res.json({ translations: results });
    } catch (err: any) {
      console.error('[translate] error:', err.message);
      // Fail open: return originals so the UI keeps working.
      const texts = Array.isArray(req.body?.texts) ? req.body.texts : [];
      res.json({ translations: texts });
    }
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
  const SUPPORT_SYSTEM_PROMPT = `You are the AI Support Assistant for DropandSell Automation App, a dropshipping automation platform. Your role is to help users with questions about the platform. Answer based on the FAQ knowledge below.

## FAQ Knowledge Base

### Getting Started
- Connect stores: Go to Stores page > Connect Store > select marketplace (Shopify, eBay, Amazon)
- For eBay: Enter your eBay username, email address linked to the eBay account, a store name, and select your eBay site (UK, US, etc.). Click "Connect to eBay" to authorise via secure OAuth — no API keys needed
- For Shopify/Amazon: Enter API credentials from your seller settings
- Supported marketplaces: Shopify, eBay, and Amazon
- Multi-store: Store limits depend on your subscription plan (Starter: 2, Basic: 4, Growth: 6, Professional: 8, Business: 12, Enterprise: 15). Each eBay store needs a unique username and email to identify it as a separate account
- To add a second store: Click "Connect Store" again and enter the details for your other eBay account
- Add products: (1) Chrome Browser Extension from vendor sites (2) CSV upload via Manual > Import (3) Manual entry
- Browser Extension: Import from Amazon, AliExpress, eBay, Walmart, Etsy and more with one click. Install from the Chrome Web Store (link on Settings > Browser Extension and on the Getting Started page)
- Extension setup (recommended one-click flow): (1) Open the official DropandSell listing on the Chrome Web Store and click "Add to Chrome" (2) Pin the DropandSell icon in your browser toolbar (3) Click the icon and tap "Sign in with DropandSell" — a tab opens, links the extension to your account automatically. No API key, URL code or developer mode needed
- Manual setup (Advanced only, if you can't use the Chrome Web Store): Download the ZIP from Settings > Advanced — Manual Setup, unzip, open chrome://extensions, enable Developer Mode, click "Load unpacked", select the unzipped folder, then enter your URL code and API key from the same Advanced section

### Products & Inventory
- CSV import: Manual > Import > select vendor > upload CSV > map columns > preview > confirm
- Delivery settings: Free Delivery, Buyer Pays, or Seller Pays with configurable cost
- Vendors: Product suppliers. Add via Vendors page or auto-detected by Browser Extension
- AI descriptions: Click "AI Generate Description" when adding products manually or via extension

### Publishing
- Publish flow: Inventory > select products > Publish to Store > choose a specific store OR "All Stores" to publish to every connected store at once
- "All Stores" option appears when 2+ active stores are connected. It publishes to each store sequentially using each store's own credentials
- This also works from Manual > Publish tab (Automation page) when adding products to the queue
- Publish queue: Staging area with VERO compliance checks, content filters, pricing rules applied
- Marketplace APIs: Shopify creates product listing, eBay creates fixed-price listing, Amazon submits product feed
- Blocked products: VERO violation, personal info detected, or restricted product category

### Pricing Rules
- Three types: Markup % (adds percentage), Margin % (sets profit margin), Fixed Amount (adds fixed value)
- Rules in Manual > Pricing tab, can target specific vendors or apply globally
- Priority-based: higher priority rules take precedence
- Optional min/max price constraints

### VERO & Content Protection
- VERO: Blocks trademarked/restricted products. Manage in Manual > VERO tab
- Content filters: Block personal info (emails, phones, URLs, social handles). Manual > Filters tab
- VERO supports brands, keywords, SKU patterns with wildcards (*)

### Orders & Wallet
- Orders from connected eBay stores are automatically synced with customer details, shipping address, and fulfillment status (Pending/Processing/Shipped/Cancelled)
- eBay sales revenue is automatically credited to your wallet when orders sync
- Wallet: Tracks earnings, referral balance, and funds. Deposit via Stripe card payment. Your saved Stripe subscription card is automatically available as a payment method
- Referral programme: 10% monthly commission on referred users' subscription amounts. Earnings tracked in wallet referral balance and on the Referrals page with per-referral details

### Semi-Automated Fulfillment
- Guided fulfillment workflow: click "Fulfill" on any unfulfilled order to start a 3-step process:
  Step 1: System shows order details, matched vendor product (via SKU mapping), profit calculation, and pre-formatted shipping address with one-click copy
  Step 2: Click "Copy Address & Open Vendor Page" — shipping address is copied to clipboard and the vendor product page opens in a new tab. Place the order on the vendor site using the copied address
  Step 3: After placing the vendor order, enter the tracking number and carrier. The system syncs tracking back to eBay automatically
- If no SKU mapping exists, the dialog shows a warning and suggests setting one up on the Fulfillment page
- Orders with "in_progress" status show a "Continue" button to resume the tracking step
- SKU Mapping tab (Fulfillment page): Link eBay SKUs to vendor SKUs with vendor name, product URL, cost price, and price threshold. Click "Sync from Inventory" to auto-generate mappings from your imported products. Mappings are also auto-created when eBay orders sync and the SKU matches a product in inventory
- Payment Methods tab: Your saved Stripe wallet card is shown automatically (with "Wallet Card" badge). Add additional cards for vendor checkout
- Fulfillment Jobs tab: Monitor all orders with status (pending/processing/shipped/failed), cost, tracking numbers
- Returns tab: Submit and track return requests
- Audit Log tab: Full audit trail of all fulfillment actions

### Subscription Plans
- Starter: £12/month (500 listings), Basic: £20/month (750), Growth: £35/month (1,200)
- Professional: £50/month (2,000), Business: £75/month (4,000), Enterprise: £100/month (8,000)
- Billing starts immediately upon subscription. Cancel anytime
- Upgrade/downgrade anytime from Subscription page

### Security & Settings
- Industry-standard encryption, credentials never exposed in plain text, HTTPS only
- eBay uses secure OAuth — your marketplace credentials are never entered into DropandSell Automation App
- Email verification required before dashboard access
- Unique URL: personalised account link shown in Settings and Dashboard
- API key regeneration in Settings > Browser Extension section

### Support
- Contact: support@dropandsell.com (24hr response on business days)
- Extension "Import Failed" (one-click sign-in flow): Make sure you are signed in to your DropandSell dashboard in the same browser as the extension, then click the DropandSell icon and tap "Sign in with DropandSell" again. If you used the Advanced manual setup: check the API URL is your base dashboard URL only (no extra path), verify the API Key and Unique URL code from Settings > Advanced — Manual Setup

Guidelines:
- Be helpful, friendly, and concise
- If you don't know something, suggest contacting support@dropandsell.com
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

  // === LIVE SUPPORT CHAT (user <-> admin) ===
  const supportStartRateLimit = new Map<string, number>();

  // Start a new support conversation (user side)
  protectedApi.post('/support/start', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const last = supportStartRateLimit.get(userId) || 0;
      if (Date.now() - last < 30 * 1000) {
        return res.status(429).json({ message: 'Please wait a moment before starting another chat.' });
      }

      const { name, email, phone, message } = req.body;
      if (!name || !email || !message) {
        return res.status(400).json({ message: 'Name, email, and message are required' });
      }

      const support = await import('./supportStorage');
      const conversation = await support.createSupportConversation({
        userId,
        name: String(name).substring(0, 100),
        email: String(email).substring(0, 200),
        phone: (phone ? String(phone) : '').substring(0, 30),
        message: String(message).substring(0, 5000),
      });
      supportStartRateLimit.set(userId, Date.now());

      res.json({ conversationId: conversation.id });
    } catch (err: any) {
      console.error('Support start error:', err?.message || err);
      res.status(500).json({ message: 'Failed to start chat' });
    }
  });

  // Get the current user's latest conversation with messages (user side, polled)
  protectedApi.get('/support/mine', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const support = await import('./supportStorage');
      const conversation = await support.getLatestUserConversation(userId);
      if (!conversation) {
        return res.json({ conversation: null, messages: [] });
      }
      const messages = await support.getSupportMessages(conversation.id);
      if (conversation.unreadForUser) {
        await support.markConversationRead(conversation.id, 'user');
      }
      res.json({ conversation, messages });
    } catch (err: any) {
      console.error('Support mine error:', err?.message || err);
      res.status(500).json({ message: 'Failed to load chat' });
    }
  });

  // User adds a follow-up message to their own conversation
  protectedApi.post('/support/:id/message', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversationId = Number(req.params.id);
      if (!Number.isFinite(conversationId)) return res.status(400).json({ message: 'Invalid conversation id' });
      const { content } = req.body;
      if (!content || !String(content).trim()) return res.status(400).json({ message: 'Message is required' });

      const support = await import('./supportStorage');
      const conversation = await support.getSupportConversationById(conversationId);
      if (!conversation || conversation.userId !== userId) {
        return res.status(404).json({ message: 'Conversation not found' });
      }

      const msg = await support.addSupportMessage(conversationId, 'user', String(content).substring(0, 5000));
      res.json(msg);
    } catch (err: any) {
      console.error('Support message error:', err?.message || err);
      res.status(500).json({ message: 'Failed to send message' });
    }
  });

  // Admin: list all conversations
  protectedApi.get('/support/admin/conversations', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const adminUser = await storage.getUser(userId);
      if (!adminUser || adminUser.isAdmin !== 'true') {
        return res.status(403).json({ message: 'Admin access required' });
      }
      const support = await import('./supportStorage');
      const conversations = await support.listSupportConversations();
      res.json(conversations);
    } catch (err: any) {
      console.error('Support admin list error:', err?.message || err);
      res.status(500).json({ message: 'Failed to load conversations' });
    }
  });

  // Admin: unread badge count
  protectedApi.get('/support/admin/unread-count', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const adminUser = await storage.getUser(userId);
      if (!adminUser || adminUser.isAdmin !== 'true') {
        return res.status(403).json({ message: 'Admin access required' });
      }
      const support = await import('./supportStorage');
      const count = await support.countAdminUnread();
      res.json({ count });
    } catch (err: any) {
      console.error('Support unread count error:', err?.message || err);
      res.status(500).json({ message: 'Failed to load count' });
    }
  });

  // Admin: get one conversation with messages (marks admin-read)
  protectedApi.get('/support/admin/conversations/:id', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const adminUser = await storage.getUser(userId);
      if (!adminUser || adminUser.isAdmin !== 'true') {
        return res.status(403).json({ message: 'Admin access required' });
      }
      const conversationId = Number(req.params.id);
      if (!Number.isFinite(conversationId)) return res.status(400).json({ message: 'Invalid conversation id' });
      const support = await import('./supportStorage');
      const conversation = await support.getSupportConversationById(conversationId);
      if (!conversation) return res.status(404).json({ message: 'Conversation not found' });
      const messages = await support.getSupportMessages(conversationId);
      if (conversation.unreadForAdmin) {
        await support.markConversationRead(conversationId, 'admin');
      }
      res.json({ conversation, messages });
    } catch (err: any) {
      console.error('Support admin get error:', err?.message || err);
      res.status(500).json({ message: 'Failed to load conversation' });
    }
  });

  // Admin: reply to a conversation
  protectedApi.post('/support/admin/conversations/:id/reply', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const adminUser = await storage.getUser(userId);
      if (!adminUser || adminUser.isAdmin !== 'true') {
        return res.status(403).json({ message: 'Admin access required' });
      }
      const conversationId = Number(req.params.id);
      if (!Number.isFinite(conversationId)) return res.status(400).json({ message: 'Invalid conversation id' });
      const { content } = req.body;
      if (!content || !String(content).trim()) return res.status(400).json({ message: 'Message is required' });

      const support = await import('./supportStorage');
      const conversation = await support.getSupportConversationById(conversationId);
      if (!conversation) return res.status(404).json({ message: 'Conversation not found' });
      const msg = await support.addSupportMessage(conversationId, 'admin', String(content).substring(0, 5000));
      res.json(msg);
    } catch (err: any) {
      console.error('Support admin reply error:', err?.message || err);
      res.status(500).json({ message: 'Failed to send reply' });
    }
  });

  // Admin: close a conversation
  protectedApi.post('/support/admin/conversations/:id/close', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const adminUser = await storage.getUser(userId);
      if (!adminUser || adminUser.isAdmin !== 'true') {
        return res.status(403).json({ message: 'Admin access required' });
      }
      const conversationId = Number(req.params.id);
      if (!Number.isFinite(conversationId)) return res.status(400).json({ message: 'Invalid conversation id' });
      const support = await import('./supportStorage');
      await support.setConversationStatus(conversationId, 'closed');
      res.json({ success: true });
    } catch (err: any) {
      console.error('Support admin close error:', err?.message || err);
      res.status(500).json({ message: 'Failed to close conversation' });
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

      // Fallback: if no pricing rule matched but the user has set a "Default
      // profit %" on Dashboard → Store Rules, apply that as a markup so every
      // new listing gets a consistent margin without having to author rules.
      if (!applicableRule) {
        try {
          const ruleUser = await storage.getUser(userId);
          if (ruleUser?.defaultProfitEnabled && ruleUser.defaultProfitPercentage && ruleUser.defaultProfitPercentage > 0) {
            applicableRule = {
              id: 0,
              userId,
              name: `Default profit (${ruleUser.defaultProfitPercentage}%)`,
              ruleType: 'markup',
              value: String(ruleUser.defaultProfitPercentage),
              minPrice: null,
              maxPrice: null,
              applyToVendor: null,
              applyToCategory: null,
              priority: 0,
              isActive: true,
              createdAt: new Date(),
            } as any;
          }
        } catch {}
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
          
          let title = getField('title');
          const sku = getField('sku') || `SKU-${Date.now()}-${i}`;
          const costPrice = parseFloat(getField('costPrice') || '0') || 0;
          let description = getField('description') || '';
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
          
          const productBrand = (row as any).brand || '';
          const sanitized = await storage.sanitizeVeroContent(userId, title, description || '', productBrand);
          title = sanitized.title;
          description = sanitized.description;
          
          const brandCheck = await storage.checkVeroBrand(userId, sanitized.brand);
          const restrictedCheck = await storage.checkRestrictedViolations(userId, sanitized.title, sanitized.description);
          let veroStatus = 'clean';
          
          if (sanitized.removedFromTitle || sanitized.removedFromDescription) {
            errors.push(`Row ${i + 2}: VeRO brand "${sanitized.detectedBrand}" auto-removed from text; brand set to "${sanitized.brand}"`);
          }
          
          if (brandCheck.isBlocked || restrictedCheck.isBlocked) {
            veroStatus = 'blocked';
            const reasons = [
              ...(brandCheck.isBlocked ? [`VERO Brand: ${brandCheck.matchedBrand}`] : []),
              ...restrictedCheck.violations.map(v => `Restricted: ${v.keyword}`)
            ];
            errors.push(`Row ${i + 2}: VERO/Restricted violation - ${reasons.join(', ')} (product will be flagged)`);
          }
          
          productsToCreate.push({
            userId,
            vendorId,
            title: sanitized.title,
            brand: sanitized.brand,
            sku,
            description: sanitized.description,
            costPrice: costPrice.toString(),
            sellingPrice: (Math.round(sellingPrice * 100) / 100).toString(),
            quantity,
            veroStatus,
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

  protectedApi.post('/vero-check', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { brand, platform } = req.body;
      
      const result = await storage.checkVeroBrand(userId, brand || '', undefined, platform);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to check VERO violations' });
    }
  });

  protectedApi.get('/global-vero-list', async (req: any, res) => {
    try {
      const items = await db.select().from(globalVeroList).orderBy(desc(globalVeroList.createdAt));
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.get('/global-vero-list/stats', async (req: any, res) => {
    try {
      const [totalResult] = await db.select({ count: sql<number>`count(*)` }).from(globalVeroList);
      const [activeResult] = await db.select({ count: sql<number>`count(*)` }).from(globalVeroList).where(eq(globalVeroList.isActive, true));
      const [brandResult] = await db.select({ count: sql<number>`count(*)` }).from(globalVeroList).where(and(eq(globalVeroList.type, 'brand'), eq(globalVeroList.isActive, true)));
      const [keywordResult] = await db.select({ count: sql<number>`count(*)` }).from(globalVeroList).where(and(eq(globalVeroList.type, 'keyword'), eq(globalVeroList.isActive, true)));
      res.json({
        total: Number(totalResult.count),
        active: Number(activeResult.count),
        brands: Number(brandResult.count),
        keywords: Number(keywordResult.count),
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.post('/admin/global-vero-list', async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      const isAdmin = user?.isAdmin === 'true';
      if (!isAdmin) return res.status(403).json({ message: 'Admin access required' });
      const { type, value, platform, reason, category, severity, isActive } = req.body;
      if (!value || !type) return res.status(400).json({ message: 'Type and value are required' });
      const [item] = await db.insert(globalVeroList).values({
        type, value, platform: platform || null, reason: reason || null,
        category: category || null, severity: severity || 'block', isActive: isActive !== false,
      }).returning();
      res.json(item);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.put('/admin/global-vero-list/:id', async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      const isAdmin = user?.isAdmin === 'true';
      if (!isAdmin) return res.status(403).json({ message: 'Admin access required' });
      const id = Number(req.params.id);
      const { type, value, platform, reason, category, severity, isActive } = req.body;
      const updateData: Record<string, any> = {};
      if (type !== undefined) updateData.type = type;
      if (value !== undefined) updateData.value = value;
      if (platform !== undefined) updateData.platform = platform || null;
      if (reason !== undefined) updateData.reason = reason;
      if (category !== undefined) updateData.category = category;
      if (severity !== undefined) updateData.severity = severity;
      if (isActive !== undefined) updateData.isActive = isActive;
      const [updated] = await db.update(globalVeroList).set(updateData).where(eq(globalVeroList.id, id)).returning();
      if (!updated) return res.status(404).json({ message: 'Not found' });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.delete('/admin/global-vero-list/:id', async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      const isAdmin = user?.isAdmin === 'true';
      if (!isAdmin) return res.status(403).json({ message: 'Admin access required' });
      const id = Number(req.params.id);
      await db.delete(globalVeroList).where(eq(globalVeroList.id, id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.post('/vero-scan-products', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const allProducts = await storage.getProducts(userId);
      let blocked = 0;
      let clean = 0;
      let sanitized = 0;
      const blockedProducts: Array<{ id: number; title: string; violations: string[] }> = [];
      const sanitizedProducts: Array<{ id: number; title: string; brand: string; detectedBrand: string }> = [];

      for (const product of allProducts) {
        if (product.veroOverride) { clean++; continue; }

        const sanitizeResult = await storage.sanitizeVeroContent(userId, product.title, product.description || '', product.brand || '');
        const updates: Record<string, any> = {};

        if (sanitizeResult.removedFromTitle) updates.title = sanitizeResult.title;
        if (sanitizeResult.removedFromDescription) updates.description = sanitizeResult.description;
        if (sanitizeResult.detectedBrand && (!product.brand || product.brand.trim() === '')) {
          updates.brand = sanitizeResult.brand;
        }

        if (Object.keys(updates).length > 0) {
          sanitized++;
          sanitizedProducts.push({
            id: product.id,
            title: sanitizeResult.title,
            brand: sanitizeResult.brand,
            detectedBrand: sanitizeResult.detectedBrand || '',
          });
        }

        const brandCheck = await storage.checkVeroBrand(userId, sanitizeResult.brand || '', product.id);
        if (brandCheck.isBlocked) {
          updates.veroStatus = 'blocked';
          await storage.updateProduct(product.id, userId, updates);
          blocked++;
          blockedProducts.push({
            id: product.id,
            title: sanitizeResult.title,
            violations: [brandCheck.matchedBrand || 'Unknown brand'],
          });
        } else {
          if ((product as any).veroStatus !== 'clean') updates.veroStatus = 'clean';
          if (Object.keys(updates).length > 0) {
            await storage.updateProduct(product.id, userId, updates);
          }
          clean++;
        }
      }

      res.json({
        scanned: allProducts.length,
        blocked,
        clean,
        sanitized,
        blockedProducts,
        sanitizedProducts,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.post('/admin/vero-scan-all-users', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user || (user.isAdmin !== 'true')) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const allUsers = await storage.getAllSubscribers();
      const { sendVeroRemovalNotification } = await import('./email.js');

      const results: Array<{
        userId: string;
        email: string;
        name: string;
        productsScanned: number;
        productsRemoved: number;
        removedProducts: Array<{ title: string; violations: string[] }>;
        emailSent: boolean;
      }> = [];

      let totalScanned = 0;
      let totalRemoved = 0;
      let totalEmailsSent = 0;

      for (const u of allUsers) {
        const userProducts = await storage.getProducts(u.id);
        if (userProducts.length === 0) continue;

        const removedProducts: Array<{ id: number; title: string; violations: string[] }> = [];

        for (const product of userProducts) {
          if (product.veroOverride) continue;

          const sanitizeResult = await storage.sanitizeVeroContent(u.id, product.title, product.description || '', product.brand || '');
          const updates: Record<string, any> = {};
          if (sanitizeResult.removedFromTitle) updates.title = sanitizeResult.title;
          if (sanitizeResult.removedFromDescription) updates.description = sanitizeResult.description;
          if (sanitizeResult.detectedBrand && (!product.brand || product.brand.trim() === '')) {
            updates.brand = sanitizeResult.brand;
          }
          if (Object.keys(updates).length > 0) {
            await storage.updateProduct(product.id, u.id, updates);
          }

          const brandCheck = await storage.checkVeroBrand(u.id, sanitizeResult.brand || '', product.id);
          if (brandCheck.isBlocked) {
            removedProducts.push({
              id: product.id,
              title: product.title,
              violations: [brandCheck.matchedBrand || 'Unknown brand'],
            });
          }
        }

        totalScanned += userProducts.length;

        if (removedProducts.length > 0) {
          for (const rp of removedProducts) {
            await storage.deleteProduct(rp.id, u.id);
          }
          totalRemoved += removedProducts.length;

          let emailSent = false;
          if (u.email) {
            try {
              emailSent = await sendVeroRemovalNotification(
                u.email,
                u.firstName || u.email.split('@')[0],
                removedProducts.map(rp => ({ title: rp.title, violations: rp.violations })),
              );
              if (emailSent) totalEmailsSent++;
            } catch (emailErr: any) {
              console.error(`[VeRO Scan] Email failed for ${u.email}:`, emailErr?.message);
            }
          }

          results.push({
            userId: u.id,
            email: u.email || '',
            name: u.firstName || '',
            productsScanned: userProducts.length,
            productsRemoved: removedProducts.length,
            removedProducts: removedProducts.map(rp => ({ title: rp.title, violations: rp.violations })),
            emailSent,
          });
        }
      }

      console.log(`[VeRO Scan] Complete: ${totalScanned} scanned, ${totalRemoved} removed, ${totalEmailsSent} emails sent`);

      res.json({
        success: true,
        totalUsersScanned: allUsers.length,
        totalProductsScanned: totalScanned,
        totalProductsRemoved: totalRemoved,
        totalEmailsSent,
        affectedUsers: results,
      });
    } catch (err: any) {
      console.error('[VeRO Scan] Error:', err);
      res.status(500).json({ message: err.message });
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

  protectedApi.get('/wallet/payment-methods', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const userWallet = await storage.getWallet(userId);
      
      let subscriptionCard = null;
      if (user?.stripeCustomerId) {
        try {
          const stripe = await getUncachableStripeClient();
          const methods = await stripe.paymentMethods.list({
            customer: user.stripeCustomerId,
            type: 'card',
          });
          if (methods.data.length > 0) {
            const pm = methods.data[0];
            subscriptionCard = {
              id: pm.id,
              brand: pm.card?.brand || 'unknown',
              last4: pm.card?.last4 || '****',
              expMonth: pm.card?.exp_month,
              expYear: pm.card?.exp_year,
            };
          }
        } catch (stripeErr: any) {
          console.warn('Could not fetch Stripe payment methods:', stripeErr.message);
        }
      }
      
      const hasBankDetails = !!(userWallet?.bankAccountName && userWallet?.bankAccountNumber && userWallet?.bankSortCode);
      const bankDetails = userWallet ? {
        accountName: userWallet.bankAccountName || null,
        accountNumberMasked: userWallet.bankAccountNumber ? `****${userWallet.bankAccountNumber.slice(-4)}` : null,
        sortCode: userWallet.bankSortCode || null,
        bankName: userWallet.bankName || null,
        hasBankDetails,
      } : { accountName: null, accountNumberMasked: null, sortCode: null, bankName: null, hasBankDetails: false };
      
      res.json({ subscriptionCard, bankDetails, hasSubscription: !!user?.stripeCustomerId });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to fetch payment methods' });
    }
  });

  protectedApi.post('/wallet/bank-details', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { accountName, accountNumber, sortCode, bankName } = req.body;
      
      if (!accountName || !accountNumber || !sortCode) {
        return res.status(400).json({ message: 'Account name, account number, and sort code are required' });
      }
      
      const trimmedName = String(accountName).trim();
      const trimmedNumber = String(accountNumber).trim().replace(/\s/g, '');
      const trimmedSort = String(sortCode).trim().replace(/[-\s]/g, '');
      
      if (trimmedName.length < 2 || trimmedName.length > 100) {
        return res.status(400).json({ message: 'Account name must be between 2 and 100 characters' });
      }
      if (!/^\d{6,8}$/.test(trimmedNumber)) {
        return res.status(400).json({ message: 'Account number must be 6-8 digits' });
      }
      if (!/^\d{6}$/.test(trimmedSort)) {
        return res.status(400).json({ message: 'Sort code must be 6 digits (e.g., 00-00-00)' });
      }
      
      let userWallet = await storage.getWallet(userId);
      if (!userWallet) {
        userWallet = await storage.createWallet(userId);
      }
      
      await storage.updateWalletBankDetails(userId, { accountName: trimmedName, accountNumber: trimmedNumber, sortCode: trimmedSort, bankName: bankName ? String(bankName).trim() : null });
      
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ message: err.message || 'Failed to save bank details' });
    }
  });

  protectedApi.post('/wallet/withdraw-referral', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const {
        amount,
        withdrawMethod,
        paymentMethodId,
        bankAccountName,
        bankAccountNumber,
        bankSortCode,
        bankName,
      } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ message: 'Invalid amount' });
      }

      if (!withdrawMethod || !['card', 'bank'].includes(withdrawMethod)) {
        return res.status(400).json({ message: 'Please select a withdrawal method (card or bank account)' });
      }

      const user = await storage.getUser(userId);
      let description = 'Referral withdrawal';

      if (withdrawMethod === 'card') {
        if (!user?.stripeCustomerId) {
          return res.status(400).json({ message: 'No subscription card on file. Please subscribe to a plan first.' });
        }
        const stripe = await getUncachableStripeClient();
        if (paymentMethodId) {
          const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
          if (pm.customer !== user.stripeCustomerId) {
            return res.status(400).json({ message: 'Selected payment method does not belong to your account' });
          }
          description = `Referral withdrawal to ${pm.card?.brand || 'card'} ending ${pm.card?.last4 || '****'}`;
        } else {
          const methods = await stripe.paymentMethods.list({ customer: user.stripeCustomerId, type: 'card' });
          if (methods.data.length === 0) {
            return res.status(400).json({ message: 'No card on file. Please subscribe to a plan first.' });
          }
          const card = methods.data[0];
          description = `Referral withdrawal to ${card.card?.brand || 'card'} ending ${card.card?.last4 || '****'}`;
        }
      } else {
        // MANUAL BANK PAYOUT FLOW
        // Accept bank details inline so the user can update them right at the
        // moment of withdrawal (they may want a different account than the
        // one on file). If provided inline, validate, persist to the wallet
        // record, and snapshot them onto the withdrawal request so the
        // admin always sees the exact details to pay manually — even if the
        // user later edits their default wallet bank.
        let acctName: string | null = null;
        let acctNumber: string | null = null;
        let sort: string | null = null;
        let bank: string | null = null;

        const hasInline = bankAccountName || bankAccountNumber || bankSortCode || bankName;
        if (hasInline) {
          acctName = String(bankAccountName || '').trim();
          acctNumber = String(bankAccountNumber || '').trim().replace(/\s/g, '');
          sort = String(bankSortCode || '').trim().replace(/[-\s]/g, '');
          bank = bankName ? String(bankName).trim() : null;

          if (acctName.length < 2 || acctName.length > 100) {
            return res.status(400).json({ message: 'Account name must be between 2 and 100 characters' });
          }
          if (!/^\d{6,8}$/.test(acctNumber)) {
            return res.status(400).json({ message: 'Account number must be 6-8 digits' });
          }
          if (!/^\d{6}$/.test(sort)) {
            return res.status(400).json({ message: 'Sort code must be 6 digits (e.g., 00-00-00)' });
          }

          // Persist as the user's default bank details for future withdrawals.
          await storage.updateWalletBankDetails(userId, {
            accountName: acctName,
            accountNumber: acctNumber,
            sortCode: sort,
            bankName: bank,
          });
        } else {
          const w = await storage.getWallet(userId);
          if (!w?.bankAccountName || !w?.bankAccountNumber || !w?.bankSortCode) {
            return res.status(400).json({ message: 'Please add your bank details before withdrawing to a bank account' });
          }
          acctName = w.bankAccountName;
          acctNumber = w.bankAccountNumber;
          sort = w.bankSortCode;
          bank = w.bankName || null;
        }

        // Snapshot the bank details onto the request so admin can pay
        // manually. Account number masked to last 4. Full number is still
        // on the wallet record for the admin view.
        const fmtSort = sort!.length === 6 ? `${sort!.slice(0,2)}-${sort!.slice(2,4)}-${sort!.slice(4,6)}` : sort!;
        const masked = `****${acctNumber!.slice(-4)}`;
        description = `Manual bank payout — ${bank || 'Bank'} | ${acctName} | Sort ${fmtSort} | Acc ${masked}`;
      }

      const transaction = await storage.withdrawReferralBalance(userId, amount, description, withdrawMethod);

      // Confirmation email to the user (fire-and-forget).
      try {
        const apiKey = process.env.RESEND_API_KEY;
        if (apiKey && user?.email) {
          const { Resend } = await import('resend');
          const resend = new Resend(apiKey);
          const fname = (user.firstName && user.firstName.trim()) || user.email.split('@')[0];
          const updateLink = `https://dropandsell.online/wallet?update_request=${transaction.id}`;
          await resend.emails.send({
            from: 'DropandSell Automation App <noreply@dropandsell.online>',
            to: user.email,
            replyTo: 'support@dropandsell.online',
            subject: 'We received your withdrawal request',
            html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#18181b;">
              <div style="background:#285261;color:#fff;display:inline-block;padding:8px 16px;border-radius:8px;font-weight:700;">DropandSell</div>
              <h2 style="color:#285261;margin:18px 0 10px;">Hi ${fname}, your withdrawal request is in</h2>
              <p>We've received your request to withdraw <strong>£${Number(amount).toFixed(2)}</strong> from your referral balance.</p>
              <p>Your funds will be deposited <strong>manually into your bank account</strong> after admin approval. Please allow <strong>5 to 10 working days</strong> for the deposit to reflect in your account.</p>
              <p>If you need to change the bank details on this request, you can update them here:</p>
              <p style="text-align:center;margin:18px 0;"><a href="${updateLink}" style="background:#285261;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block;">Update bank details</a></p>
              <p style="font-size:13px;color:#52525b;">Questions? Just reply to this email.</p>
              <p style="font-size:13px;color:#52525b;">— The DropandSell team</p>
            </div>`,
            text: `Hi ${fname},\n\nWe've received your request to withdraw £${Number(amount).toFixed(2)} from your referral balance.\n\nYour funds will be deposited manually into your bank account after admin approval. Please allow 5 to 10 working days for the deposit to reflect.\n\nIf you need to update the bank details on this request: ${updateLink}\n\n— The DropandSell team`,
          });
        }
      } catch (mailErr) {
        console.error('[withdraw-referral] confirmation email failed:', mailErr);
      }

      res.json({
        success: true,
        transaction,
        withdrawMethod,
        message: 'Withdrawal request submitted. Funds will be deposited manually into your bank within 5–10 working days after admin approval.',
      });
    } catch (err: any) {
      res.status(400).json({ message: err.message || 'Failed to withdraw referral balance' });
    }
  });

  // List the current user's referral withdrawal requests.
  protectedApi.get('/wallet/withdrawal-requests/mine', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const w = await storage.getWallet(userId);
      if (!w) return res.json([]);
      const rows = await db.select({
        id: transactions.id,
        amount: transactions.amount,
        description: transactions.description,
        status: transactions.status,
        withdrawMethod: transactions.withdrawMethod,
        adminNote: transactions.adminNote,
        processedAt: transactions.processedAt,
        createdAt: transactions.createdAt,
      })
        .from(transactions)
        .where(and(eq(transactions.walletId, w.id), eq(transactions.type, 'referral_withdrawal')))
        .orderBy(desc(transactions.createdAt));
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to load requests' });
    }
  });

  // Update the bank details attached to one of the user's own pending
  // withdrawal requests. Only allowed while status === 'pending_approval'.
  protectedApi.patch('/wallet/withdrawal-requests/:id/bank', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const txId = parseInt(req.params.id);
      if (!txId) return res.status(400).json({ message: 'Invalid request id' });

      const { bankAccountName, bankAccountNumber, bankSortCode, bankName } = req.body || {};
      const acctName = String(bankAccountName || '').trim();
      const acctNumber = String(bankAccountNumber || '').trim().replace(/\s/g, '');
      const sort = String(bankSortCode || '').trim().replace(/[-\s]/g, '');
      const bank = bankName ? String(bankName).trim() : null;

      if (acctName.length < 2 || acctName.length > 100) {
        return res.status(400).json({ message: 'Account name must be between 2 and 100 characters' });
      }
      if (!/^\d{6,8}$/.test(acctNumber)) {
        return res.status(400).json({ message: 'Account number must be 6-8 digits' });
      }
      if (!/^\d{6}$/.test(sort)) {
        return res.status(400).json({ message: 'Sort code must be 6 digits' });
      }

      const w = await storage.getWallet(userId);
      if (!w) return res.status(404).json({ message: 'Wallet not found' });

      const [tx] = await db.select({
        id: transactions.id,
        walletId: transactions.walletId,
        amount: transactions.amount,
        status: transactions.status,
        type: transactions.type,
      })
        .from(transactions)
        .where(eq(transactions.id, txId));

      if (!tx || tx.walletId !== w.id || tx.type !== 'referral_withdrawal') {
        return res.status(404).json({ message: 'Withdrawal request not found' });
      }
      if (tx.status !== 'pending_approval') {
        return res.status(400).json({ message: `Cannot update — this request has already been ${tx.status}.` });
      }

      // Persist as user's default and snapshot onto the request.
      await storage.updateWalletBankDetails(userId, {
        accountName: acctName,
        accountNumber: acctNumber,
        sortCode: sort,
        bankName: bank,
      });

      const fmtSort = `${sort.slice(0,2)}-${sort.slice(2,4)}-${sort.slice(4,6)}`;
      const masked = `****${acctNumber.slice(-4)}`;
      const newDescription = `Manual bank payout — ${bank || 'Bank'} | ${acctName} | Sort ${fmtSort} | Acc ${masked}`;
      // Race-safe: only update if it's still pending. Eliminates the gap
      // between our earlier check and this write.
      const upd = await db.update(transactions)
        .set({ description: newDescription, withdrawMethod: 'bank' })
        .where(and(
          eq(transactions.id, txId),
          eq(transactions.status, 'pending_approval'),
        ));
      const updRows = (upd as any).rowCount ?? (upd as any).count ?? 0;
      if (updRows === 0) {
        return res.status(400).json({ message: 'This request has just been processed by an admin — bank details can no longer be changed.' });
      }

      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ message: err.message || 'Failed to update bank details' });
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

          if (store.platform === 'jumia') {
            const user = await storage.getUser(userId);
            const isAdmin = user?.isAdmin === 'true';
            if (!isAdmin) {
              const flag = await storage.getFeatureFlag('jumia_marketplace');
              if (!flag || !flag.isEnabled || flag.adminOnly) {
                throw new Error('Jumia marketplace is not yet available');
              }
            }
          }

          let storeCredentials = store.credentials as any;
          if (store.platform === 'ebay') {
            if (!storeCredentials?.authToken) {
              throw new Error(`eBay store "${store.name}" has no auth token. Please reconnect your eBay account.`);
            }

            if (storeCredentials.refreshToken) {
              const now = Date.now();
              const tokenExpired = !storeCredentials.tokenExpiry || now >= storeCredentials.tokenExpiry;
              if (tokenExpired) {
                const appId = process.env.EBAY_APP_ID;
                const certId = process.env.EBAY_CERT_ID;
                if (appId && certId) {
                  const basicAuth = Buffer.from(`${appId}:${certId}`).toString('base64');
                  const tokenResponse = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/x-www-form-urlencoded',
                      'Authorization': `Basic ${basicAuth}`,
                    },
                    body: new URLSearchParams({
                      grant_type: 'refresh_token',
                      refresh_token: storeCredentials.refreshToken,
                      scope: 'https://api.ebay.com/oauth/api_scope https://api.ebay.com/oauth/api_scope/sell.inventory https://api.ebay.com/oauth/api_scope/sell.marketing https://api.ebay.com/oauth/api_scope/sell.account https://api.ebay.com/oauth/api_scope/sell.fulfillment',
                    }).toString(),
                  });
                  const tokenData = await tokenResponse.json() as any;
                  if (tokenResponse.ok && tokenData.access_token) {
                    storeCredentials = {
                      ...storeCredentials,
                      authToken: tokenData.access_token,
                      tokenExpiry: Date.now() + (tokenData.expires_in * 1000),
                    };
                    await storage.updateStore(store.id, userId, { credentials: storeCredentials });
                    console.log(`eBay token refreshed for store ${store.id} during publish`);
                  } else {
                    throw new Error('eBay access token expired. Please reconnect your eBay account.');
                  }
                }
              }
            }

            const identity = await getEbayUserIdentity(storeCredentials.authToken);
            if (identity && identity.username) {
              console.log(`[PUBLISH] eBay identity verified for store ${store.id} "${store.name}": token belongs to @${identity.username}, expected @${storeCredentials.ebayUsername || 'unknown'}`);
              if (storeCredentials.ebayUsername && identity.username.toLowerCase() !== storeCredentials.ebayUsername.toLowerCase()) {
                console.error(`[PUBLISH] eBay token mismatch for store ${store.id} "${store.name}": token belongs to "@${identity.username}" but store expects "@${storeCredentials.ebayUsername}"`);
                throw new Error(`Token mismatch: This store's credentials belong to eBay account "@${identity.username}" instead of "@${storeCredentials.ebayUsername}". Please disconnect and reconnect "${store.name}" to fix this.`);
              }
              if (!storeCredentials.ebayUsername) {
                storeCredentials = { ...storeCredentials, ebayUsername: identity.username };
                await storage.updateStore(store.id, userId, { credentials: storeCredentials });
                console.log(`[PUBLISH] Auto-set ebayUsername for store ${store.id} to "${identity.username}"`);
              }
            } else {
              // GetUser can transiently fail (eBay 500s, throttling, momentary token IAF
              // hiccups). Don't block the publish on this — the actual AddFixedPriceItem
              // call will surface a clear, actionable error if the token is truly bad.
              // We only hard-block on a *confirmed* username mismatch above.
              console.warn(`[PUBLISH] eBay identity check returned null for store ${store.id} "${store.name}" — proceeding with publish; will rely on AddFixedPriceItem to surface any auth error.`);
            }
          }
          
          // Check if product is already listed on this store
          const existingListings = await storage.getMarketplaceListings(item.storeId);
          const alreadyListed = existingListings.find(l => l.productId === item.productId && l.status === 'active');
          if (alreadyListed) {
            await storage.updatePublishQueueItem(itemId, { status: 'published', publishedAt: new Date() });
            results.push({ id: itemId, status: 'skipped', message: `Already listed on ${store.name}` });
            continue;
          }

          const sanitized = await storage.sanitizeVeroContent(userId, product.title, product.description || '', product.brand || '');
          const cleanTitle = sanitized.title;
          const cleanDesc = sanitized.description;
          const cleanBrand = sanitized.brand;

          if (sanitized.removedFromTitle || sanitized.removedFromDescription || sanitized.detectedBrand) {
            console.log(`[PUBLISH] VeRO auto-sanitized product ${product.id}: removed "${sanitized.detectedBrand}" from ${sanitized.removedFromTitle ? 'title' : ''}${sanitized.removedFromTitle && sanitized.removedFromDescription ? '+' : ''}${sanitized.removedFromDescription ? 'description' : ''}, brand set to "${cleanBrand}"`);
            await storage.updateProduct(product.id, userId, {
              title: cleanTitle,
              description: cleanDesc,
              brand: cleanBrand,
              veroStatus: 'clean',
            });
          }

          const contentToCheck = `${cleanTitle} ${cleanDesc}`;
          const contentCheck = await storage.checkContentViolations(userId, contentToCheck);
          if (contentCheck.hasViolations) {
            const violationDetails = contentCheck.violations.map(v => `${v.type}: ${v.matches.join(', ')}`).join('; ');
            throw new Error(`Personal information detected: ${violationDetails}. Remove personal info before listing.`);
          }
          
          const restrictedCheck = await storage.checkRestrictedViolations(userId, cleanTitle, cleanDesc);
          if (restrictedCheck.isBlocked) {
            const restrictedItems = restrictedCheck.violations.map(v => `${v.keyword} (${v.category})`).join(', ');
            throw new Error(`Restricted product detected: ${restrictedItems}. This item cannot be listed for regulatory compliance.`);
          }
          
          const productAttrs = (product.attributes || {}) as Record<string, any>;
          const productVariations = Array.isArray(productAttrs.variations) ? productAttrs.variations : [];
          const publishPayload = {
            title: cleanTitle,
            description: cleanDesc || '',
            // Always use the live Inventory "Price" column (sellingPrice).
            // The queue's calculatedPrice can become stale if the user edits
            // the price after queuing — using sellingPrice keeps the eBay
            // listing in lockstep with what the user sees in their software.
            price: product.sellingPrice,
            sku: product.sku,
            quantity: item.quantity || product.quantity || 1,
            images: product.images || [],
            deliveryType: product.deliveryType || 'buyer_pays',
            deliveryCost: product.deliveryCost || '0',
            variations: productVariations.length > 0 ? productVariations : undefined,
            // Brand + AI-saved item specifics flow into the eBay <ItemSpecifics>
            // so the searchable buyer-facing fields (Brand, Type, MPN, Colour…)
            // use the values the user reviewed instead of guessed-from-title.
            // VeRO safety: replace flagged brands with "Unbranded" on both the
            // top-level brand and the saved itemSpecifics.Brand so a flagged
            // value cannot reach the live eBay listing and trigger a strike.
            brand: await veroSafeBrand(userId, cleanBrand || (product as any).brand || '', product.id, 'ebay'),
            attributes: (await (async () => {
              const safeSpecs = await sanitizeItemSpecificsBrand(userId, productAttrs.itemSpecifics, product.id, 'ebay');
              return safeSpecs ? { ...productAttrs, itemSpecifics: safeSpecs } : productAttrs;
            })()),
          };
          const ebayAccount = storeCredentials.ebayUsername || 'unknown';
          console.log(`[PUBLISH] Publishing product ${product.id} to ${store.platform} store ${store.id} "${store.name}" (eBay: @${ebayAccount}): price=${publishPayload.price}, sku=${publishPayload.sku}, images=${publishPayload.images.length}`);
          
          const publishResult = await publishToMarketplace(
            store.platform,
            storeCredentials,
            publishPayload,
          );

          if (!publishResult.success) {
            const reason = publishResult.error || (publishResult as any).message || 'Marketplace publishing failed (no reason returned by marketplace)';
            console.error(`[PUBLISH] Failed for product ${product.id} on store "${store.name}" (@${ebayAccount}): ${reason}`);
            throw new Error(reason);
          }
          console.log(`[PUBLISH] Succeeded for product ${product.id} on store "${store.name}" (@${ebayAccount}): externalId=${publishResult.externalId}, url=${publishResult.listingUrl}`);
          
          await storage.createMarketplaceListing({
            storeId: item.storeId,
            productId: item.productId,
            externalId: publishResult.externalId,
            listingUrl: publishResult.listingUrl || null,
            status: 'active',
            syncStatus: 'synced',
          });
          
          await storage.updatePublishQueueItem(itemId, {
            status: 'published',
            publishedAt: new Date(),
          });
          
          results.push({ id: itemId, status: 'published', externalId: publishResult.externalId, listingUrl: publishResult.listingUrl, storeName: store.name, ebayAccount: storeCredentials.ebayUsername || undefined });
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
  protectedApi.post('/user/verify-password', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { password } = req.body;

      if (!password) {
        return res.status(400).json({ message: 'Password is required' });
      }

      const user = await storage.getUser(userId);
      if (!user || !user.password) {
        return res.status(400).json({ message: 'User not found or no password set' });
      }

      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ message: 'Incorrect password' });
      }

      res.json({ verified: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Password verification failed' });
    }
  });

  protectedApi.patch('/user/profile', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { firstName, lastName, email, phone, password } = req.body;

      if (!password) {
        return res.status(400).json({ message: 'Password is required to confirm changes' });
      }

      const user = await storage.getUser(userId);
      if (!user || !user.password) {
        return res.status(400).json({ message: 'User not found' });
      }

      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ message: 'Incorrect password. Please try again.' });
      }

      const emailChanged = email && email !== user.email;
      const phoneChanged = phone !== undefined && phone !== (user.phone || '');

      if (emailChanged || phoneChanged) {
        if (emailChanged) {
          const existingUser = await storage.getUserByEmail(email);
          if (existingUser && existingUser.id !== userId) {
            return res.status(409).json({ 
              message: 'Another account is already registered with this email address. Please delete the other account first or use a different email.',
              conflictingAccountId: existingUser.id,
              canDelete: true,
            });
          }
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = new Date(Date.now() + 10 * 60 * 1000);

        const pendingChanges: any = {};
        if (firstName !== undefined) pendingChanges.firstName = firstName;
        if (lastName !== undefined) pendingChanges.lastName = lastName;
        if (emailChanged) pendingChanges.email = email;
        if (phoneChanged) pendingChanges.phone = phone;

        await storage.updateUser(userId, {
          profileChangeCode: code,
          profileChangeCodeExpiry: expiry,
          profileChangePending: pendingChanges,
        } as any);

        const changes: string[] = [];
        if (emailChanged) changes.push(`email to ${email}`);
        if (phoneChanged) changes.push(`phone number`);
        const changeDescription = changes.join(' and ');

        let emailSent = false;
        try {
          const { sendProfileChangeOTP } = await import('./email.js');
          emailSent = await sendProfileChangeOTP(user.email!, code, changeDescription);
        } catch (emailErr: any) {
          console.error('Failed to send profile change OTP:', emailErr.message);
        }

        if (!emailSent) {
          await storage.updateUser(userId, {
            profileChangeCode: null,
            profileChangeCodeExpiry: null,
            profileChangePending: null,
          } as any);
          return res.status(500).json({
            message: 'Failed to send verification email. Please try again later.',
          });
        }

        return res.json({
          requiresVerification: true,
          message: `A verification code has been sent to your email (${user.email}). Enter it to confirm your changes.`,
        });
      }

      const updates: any = {};
      if (firstName !== undefined) updates.firstName = firstName;
      if (lastName !== undefined) updates.lastName = lastName;

      const updatedUser = await storage.updateUser(userId, updates);
      res.json({
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        phone: updatedUser.phone,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to update profile' });
    }
  });

  protectedApi.post('/user/profile/delete-conflicting', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }

      const currentUser = await storage.getUser(userId);
      if (!currentUser || !currentUser.password) {
        return res.status(400).json({ message: 'User not found' });
      }

      const passwordMatch = await bcrypt.compare(password, currentUser.password);
      if (!passwordMatch) {
        return res.status(401).json({ message: 'Incorrect password' });
      }

      const conflictingUser = await storage.getUserByEmail(email);
      if (!conflictingUser) {
        return res.json({ message: 'No conflicting account found with that email' });
      }

      if (conflictingUser.id === userId) {
        return res.status(400).json({ message: 'Cannot delete your own account' });
      }

      const cid = conflictingUser.id;
      const tables = [
        'restricted_products', 'content_filters', 'vero_list',
        'publish_queue', 'import_jobs', 'pricing_rules',
        'transactions', 'wallet', 'marketplace_listings',
        'orders', 'products', 'stores', 'vendors', 'subscriptions'
      ];
      for (const table of tables) {
        try {
          await db.execute(sql`DELETE FROM ${sql.identifier(table)} WHERE user_id = ${cid}`);
        } catch (e: any) {
          console.log(`Skipping ${table} deletion (may not exist): ${e.message}`);
        }
      }
      try {
        await db.execute(sql`DELETE FROM referrals WHERE referrer_id = ${cid} OR referred_user_id = ${cid}`);
      } catch (e: any) {
        console.log(`Skipping referrals deletion: ${e.message}`);
      }
      await db.execute(sql`DELETE FROM users WHERE id = ${cid}`);
      console.log(`Deleted conflicting account ${cid} (${email}) at request of user ${userId}`);

      res.json({ message: 'Conflicting account has been deleted. You can now change your email.' });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to delete conflicting account' });
    }
  });

  protectedApi.post('/user/profile/verify-code', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { code } = req.body;

      if (!code) {
        return res.status(400).json({ message: 'Verification code is required' });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(400).json({ message: 'User not found' });
      }

      if (!user.profileChangeCode || !user.profileChangeCodeExpiry) {
        return res.status(400).json({ message: 'No pending profile change. Please try again.' });
      }

      if (new Date() > new Date(user.profileChangeCodeExpiry)) {
        await storage.updateUser(userId, {
          profileChangeCode: null,
          profileChangeCodeExpiry: null,
          profileChangePending: null,
        } as any);
        return res.status(400).json({ message: 'Verification code has expired. Please try again.' });
      }

      if (user.profileChangeCode !== code) {
        return res.status(401).json({ message: 'Invalid verification code' });
      }

      const pendingChanges = user.profileChangePending as any;
      if (!pendingChanges || Object.keys(pendingChanges).length === 0) {
        return res.status(400).json({ message: 'No pending changes found' });
      }

      if (pendingChanges.email) {
        const existingUser = await storage.getUserByEmail(pendingChanges.email);
        if (existingUser && existingUser.id !== userId) {
          return res.status(409).json({ message: 'This email address is already in use' });
        }
      }

      const updatedUser = await storage.updateUser(userId, {
        ...pendingChanges,
        profileChangeCode: null,
        profileChangeCodeExpiry: null,
        profileChangePending: null,
      } as any);

      res.json({
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        phone: updatedUser.phone,
        message: 'Profile updated successfully',
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to verify code' });
    }
  });

  protectedApi.post('/user/complete-onboarding', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const updates: any = { onboardingCompleted: new Date() };
      if (req.body.currency) {
        updates.currency = req.body.currency;
      }
      await storage.updateUser(userId, updates);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to complete onboarding' });
    }
  });

  // Set the user's phone number directly (used by the compulsory phone gate).
  // Unlike the profile editor, this does NOT require email OTP verification — it
  // is the initial collection of a missing phone number and is saved immediately.
  protectedApi.post('/user/phone', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      // Initial collection only: if a phone is already on file, changes must go
      // through the OTP-verified profile editor — never this direct-set route.
      const existing = await storage.getUser(userId);
      if (existing?.phone && existing.phone.trim()) {
        return res.status(409).json({ message: 'A phone number is already set. Update it from your profile.' });
      }
      const raw = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
      const digitCount = raw.replace(/[^0-9]/g, '').length;
      if (raw.length < 6 || digitCount < 7) {
        return res.status(400).json({ message: 'Please enter a valid phone number.' });
      }
      if (raw.length > 20) {
        return res.status(400).json({ message: 'Phone number is too long.' });
      }
      const updated = await storage.updateUser(userId, { phone: raw });
      res.json({ success: true, phone: updated.phone });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to save phone number' });
    }
  });

  // Add-ons
  protectedApi.get('/addons/purchases', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const freeAccess = user?.email ? FREE_ACCESS_EMAILS[user.email.toLowerCase()] : null;
      if (freeAccess?.freeAddons) {
        const existing = await storage.getUserAddonPurchases(userId);
        const freeAddonIds = ['trending-products', 'price-comparison'];
        for (const addonId of freeAddonIds) {
          if (!existing.some(p => p.addonId === addonId && p.status === 'active')) {
            await storage.createAddonPurchase(userId, addonId, 'free_access');
          }
        }
      }
      const purchases = await storage.getUserAddonPurchases(userId);
      res.json({ purchases });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to fetch add-on purchases' });
    }
  });

  protectedApi.post('/addons/purchase', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { addonId } = req.body;
      if (!addonId) {
        return res.status(400).json({ message: 'Add-on ID is required' });
      }
      const existing = await storage.getUserAddonPurchases(userId);
      if (existing.some(p => p.addonId === addonId && p.status === 'active')) {
        return res.status(400).json({ message: 'Add-on already purchased' });
      }

      const user = await storage.getUser(userId);
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

      const addonConfig: Record<string, { name: string; description: string; amount: number }> = {
        'trending-products': { name: 'Trending Products Add-on', description: 'Monthly best-selling products database across all e-commerce platforms', amount: 399 },
        'price-comparison': { name: 'Price Comparison Add-on', description: 'Cross-platform price comparison for best-selling products with real-time data', amount: 199 },
      };
      const config = addonConfig[addonId];
      if (!config) {
        return res.status(400).json({ message: 'Unknown add-on' });
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'gbp',
            product_data: {
              name: config.name,
              description: config.description,
            },
            unit_amount: config.amount,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        }],
        mode: 'subscription',
        metadata: { addonId, userId },
        success_url: `${req.protocol}://${req.get('host')}/addons?purchased=${addonId}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.protocol}://${req.get('host')}/addons`,
      });

      res.json({ url: session.url });
    } catch (err: any) {
      console.error('Add-on checkout error:', err);
      res.status(500).json({ message: err.message || 'Failed to create checkout session' });
    }
  });

  protectedApi.post('/addons/activate', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { addonId, sessionId } = req.body;
      if (!addonId || !sessionId) {
        return res.status(400).json({ message: 'Add-on ID and session ID are required' });
      }
      const existing = await storage.getUserAddonPurchases(userId);
      if (existing.some(p => p.addonId === addonId && p.status === 'active')) {
        return res.json({ success: true, message: 'Already active' });
      }

      const stripe = await getUncachableStripeClient();
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status !== 'paid' && session.status !== 'complete') {
        return res.status(403).json({ message: 'Payment not completed' });
      }
      if (session.metadata?.userId !== userId || session.metadata?.addonId !== addonId) {
        return res.status(403).json({ message: 'Session does not match' });
      }

      await storage.createAddonPurchase(userId, addonId, session.subscription as string || session.id);
      res.json({ success: true });
    } catch (err: any) {
      console.error('Addon activation error:', err);
      res.status(500).json({ message: err.message || 'Failed to activate add-on' });
    }
  });

  protectedApi.get('/addons/trending-products', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const freeAccess = user?.email ? FREE_ACCESS_EMAILS[user.email.toLowerCase()] : null;
      if (freeAccess?.freeAddons) {
        const existing = await storage.getUserAddonPurchases(userId);
        if (!existing.some(p => p.addonId === 'trending-products' && p.status === 'active')) {
          await storage.createAddonPurchase(userId, 'trending-products', 'free_access');
        }
      }
      const purchases = await storage.getUserAddonPurchases(userId);
      const hasTrending = purchases.some(p => p.addonId === 'trending-products' && p.status === 'active');
      if (!hasTrending) {
        return res.status(403).json({ message: 'Add-on not purchased', locked: true });
      }
      const monthYear = req.query.month as string | undefined;
      const products = await storage.getTrendingProducts(monthYear || undefined);
      res.json({ products });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to fetch trending products' });
    }
  });

  // Suggestions — accepts optional image attachments (up to 4) via multipart
  // form upload. Each image is auto-resized + compressed with sharp and
  // stored as a data URL on the suggestion row, so admin/user can view them
  // inline without any extra storage infra.
  // Wrap multer so we can convert its quirky errors (file too large,
  // unexpected field, etc.) into clean 4xx JSON responses instead of the
  // generic 500 the global error middleware would otherwise emit.
  const suggestionImagesUpload = (req: any, res: any, next: any) => {
    upload.array('images', 4)(req, res, (err: any) => {
      if (!err) return next();
      if (err && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'One of your pictures is too large. Each image must be under 10MB.' });
      }
      if (err && err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ message: 'Too many pictures attached. You can attach up to 4 per suggestion.' });
      }
      return res.status(400).json({ message: err.message || 'Failed to read uploaded pictures.' });
    });
  };

  protectedApi.post('/suggestions', suggestionImagesUpload, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const { category, subject, message } = req.body;
      const validCategories = ['feature_request', 'improvement', 'ui_feedback', 'integration', 'other'];
      if (!subject || typeof subject !== 'string' || subject.trim().length === 0 || subject.trim().length > 200) {
        return res.status(400).json({ message: 'Subject is required (max 200 characters)' });
      }
      if (!message || typeof message !== 'string' || message.trim().length === 0 || message.trim().length > 2000) {
        return res.status(400).json({ message: 'Message is required (max 2000 characters)' });
      }
      const safeCategory = validCategories.includes(category) ? category : 'feature_request';

      // Compress any uploaded images down to a sensible size so the DB row
      // doesn't balloon. We target ~1600px on the longest edge and JPEG q80
      // — produces ~80–250KB per typical screenshot. We validate each file
      // by actually decoding its metadata with sharp (signature-based) rather
      // than trusting the client-provided MIME header.
      const files: Express.Multer.File[] = Array.isArray(req.files) ? req.files : [];
      const imageDataUrls: string[] = [];
      const rejected: string[] = [];
      if (files.length > 0) {
        const sharp = (await import('sharp')).default;
        for (const f of files.slice(0, 4)) {
          try {
            const pipeline = sharp(f.buffer, { failOn: 'none' });
            const meta = await pipeline.metadata();
            if (!meta.format || !['jpeg', 'png', 'webp', 'gif', 'heif', 'avif', 'tiff'].includes(meta.format)) {
              rejected.push(f.originalname || 'unnamed');
              continue;
            }
            const out = await pipeline
              .rotate()
              .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
              .jpeg({ quality: 80, mozjpeg: true })
              .toBuffer();
            imageDataUrls.push(`data:image/jpeg;base64,${out.toString('base64')}`);
          } catch (e) {
            console.warn('[suggestions] image rejected:', f.originalname, (e as Error).message);
            rejected.push(f.originalname || 'unnamed');
          }
        }
        if (rejected.length > 0 && imageDataUrls.length === 0) {
          return res.status(400).json({ message: `None of the uploaded files were valid images: ${rejected.join(', ')}` });
        }
      }

      const suggestion = await storage.createSuggestion({
        userId,
        userEmail: user?.email || 'unknown',
        userName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || undefined,
        category: safeCategory,
        subject: subject.trim(),
        message: message.trim(),
        imageUrls: imageDataUrls,
      } as any);
      res.json(suggestion);
    } catch (err: any) {
      console.error('[suggestions] submit error:', err);
      res.status(500).json({ message: err.message || 'Failed to submit suggestion' });
    }
  });

  protectedApi.get('/suggestions', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userSuggestions = await storage.getUserSuggestions(userId);
      res.json({ suggestions: userSuggestions });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to fetch suggestions' });
    }
  });

  protectedApi.get('/admin/suggestions', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const adminUser = await storage.getUser(userId);
      const freeAccess = adminUser?.email ? FREE_ACCESS_EMAILS[adminUser.email.toLowerCase()] : null;
      if (adminUser?.isAdmin !== 'true' && !freeAccess?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }
      const allSuggestions = await storage.getAllSuggestions();
      res.json({ suggestions: allSuggestions });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to fetch suggestions' });
    }
  });

  protectedApi.patch('/admin/suggestions/:id/status', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const adminUser = await storage.getUser(userId);
      const freeAccess = adminUser?.email ? FREE_ACCESS_EMAILS[adminUser.email.toLowerCase()] : null;
      if (adminUser?.isAdmin !== 'true' && !freeAccess?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }
      const { status } = req.body;
      const validStatuses = ['new', 'reviewed', 'planned', 'implemented', 'declined'];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status. Must be one of: ' + validStatuses.join(', ') });
      }
      const updated = await storage.updateSuggestionStatus(Number(req.params.id), status);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to update suggestion status' });
    }
  });

  protectedApi.patch('/admin/fix-subscription', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const adminUser = await storage.getUser(userId);
      const freeAccess = adminUser?.email ? FREE_ACCESS_EMAILS[adminUser.email.toLowerCase()] : null;
      if (adminUser?.isAdmin !== 'true' && !freeAccess?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }
      const { email, subscriptionStatus, subscriptionPlan } = req.body;
      if (!email || !subscriptionStatus) {
        return res.status(400).json({ message: 'email and subscriptionStatus are required' });
      }
      const targetUser = await storage.getUserByEmail(email);
      if (!targetUser) {
        return res.status(404).json({ message: `User not found: ${email}` });
      }
      const updateFields: any = { subscriptionStatus };
      if (subscriptionPlan) updateFields.subscriptionPlan = subscriptionPlan;
      await storage.updateUser(targetUser.id, updateFields);
      console.log(`[Admin] Fixed subscription for ${email}: status=${subscriptionStatus}, plan=${subscriptionPlan || targetUser.subscriptionPlan}`);
      res.json({ success: true, email, subscriptionStatus, subscriptionPlan: subscriptionPlan || targetUser.subscriptionPlan });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to fix subscription' });
    }
  });

  protectedApi.post('/admin/seed-trending', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const adminUser = await storage.getUser(userId);
      const freeAccess = adminUser?.email ? FREE_ACCESS_EMAILS[adminUser.email.toLowerCase()] : null;
      if (adminUser?.isAdmin !== 'true' && !freeAccess?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }
      const { refreshTrendingProducts } = await import('./trendingScheduler');
      const result = await refreshTrendingProducts();
      res.json({ success: true, count: result.count, monthYear: result.weekLabel });
    } catch (err: any) {
      console.error('Seed trending error:', err);
      res.status(500).json({ message: err.message || 'Failed to seed trending products' });
    }
  });

  protectedApi.get('/addons/trending-products/download', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const purchases = await storage.getUserAddonPurchases(userId);
      const hasTrending = purchases.some(p => p.addonId === 'trending-products' && p.status === 'active');
      if (!hasTrending) {
        return res.status(403).json({ message: 'Add-on not purchased', locked: true });
      }
      const products = await storage.getTrendingProducts();
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      const platforms = [...new Set(products.map(p => p.platform))];

      const allData = products.map(p => ({
        'Rank': p.rank,
        'Product': p.title,
        'Platform': p.platform,
        'Category': p.category || '',
        'Price (GBP)': p.price ? Number(p.price) : '',
        'Sales Volume': p.salesVolume || 0,
        'Week': p.monthYear || '',
      }));
      const allSheet = XLSX.utils.json_to_sheet(allData);
      XLSX.utils.book_append_sheet(wb, allSheet, 'All Products');

      for (const platform of platforms) {
        const platformData = products
          .filter(p => p.platform === platform)
          .map(p => ({
            'Rank': p.rank,
            'Product': p.title,
            'Category': p.category || '',
            'Price (GBP)': p.price ? Number(p.price) : '',
            'Sales Volume': p.salesVolume || 0,
          }));
        const sheetName = platform.length > 31 ? platform.substring(0, 31) : platform;
        const sheet = XLSX.utils.json_to_sheet(platformData);
        XLSX.utils.book_append_sheet(wb, sheet, sheetName);
      }

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      const dateStr = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="BestSelling_Products_${dateStr}.xlsx"`);
      res.send(buffer);
    } catch (err: any) {
      console.error('Excel download error:', err);
      res.status(500).json({ message: err.message || 'Failed to generate Excel file' });
    }
  });

  protectedApi.get('/addons/price-comparison', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const freeAccess = user?.email ? FREE_ACCESS_EMAILS[user.email.toLowerCase()] : null;
      if (freeAccess?.freeAddons) {
        const existing = await storage.getUserAddonPurchases(userId);
        if (!existing.some(p => p.addonId === 'price-comparison' && p.status === 'active')) {
          await storage.createAddonPurchase(userId, 'price-comparison', 'free_access');
        }
      }
      const purchases = await storage.getUserAddonPurchases(userId);
      const hasAccess = purchases.some(p => p.addonId === 'price-comparison' && p.status === 'active');
      if (!hasAccess) {
        return res.status(403).json({ message: 'Add-on not purchased', locked: true });
      }
      const { generatePriceComparisonData } = await import('./priceComparisonData');
      const products = generatePriceComparisonData();
      res.json({ products });
    } catch (err: any) {
      console.error('Price comparison error:', err);
      res.status(500).json({ message: err.message || 'Failed to fetch price comparison data' });
    }
  });

  protectedApi.post('/addons/price-comparison/search', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const freeAccess = user?.email ? FREE_ACCESS_EMAILS[user.email.toLowerCase()] : null;
      if (freeAccess?.freeAddons) {
        const existing = await storage.getUserAddonPurchases(userId);
        if (!existing.some(p => p.addonId === 'price-comparison' && p.status === 'active')) {
          await storage.createAddonPurchase(userId, 'price-comparison', 'free_access');
        }
      }
      const purchases = await storage.getUserAddonPurchases(userId);
      const hasAccess = purchases.some(p => p.addonId === 'price-comparison' && p.status === 'active');
      if (!hasAccess) {
        return res.status(403).json({ message: 'Add-on not purchased', locked: true });
      }
      const { query, country, category, limit } = req.body;
      if (!query || typeof query !== 'string' || query.trim().length < 2) {
        return res.status(400).json({ message: 'Please enter a product name to search' });
      }
      const countryCode = (typeof country === 'string' && country.trim().length > 0)
        ? country.trim().toUpperCase()
        : 'GB';
      const cat = typeof category === 'string' && category.trim().length > 0 ? category.trim() : 'all';
      const lim = typeof limit === 'number' && limit > 0 && limit <= 500 ? limit : 200;
      const { generateSearchComparison } = await import('./priceComparisonData');
      const { resolvedCountry, resolvedCategory, results, totalAvailable } = generateSearchComparison(query.trim(), countryCode, cat, lim);
      res.json({
        query: query.trim(),
        country: resolvedCountry,
        category: resolvedCategory,
        resolvedCountry,
        resolvedCategory,
        platforms: results,
        totalAvailable,
      });
    } catch (err: any) {
      console.error('Price comparison search error:', err);
      res.status(500).json({ message: err.message || 'Failed to search' });
    }
  });

  protectedApi.get('/addons/price-comparison/countries', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const freeAccess = user?.email ? FREE_ACCESS_EMAILS[user.email.toLowerCase()] : null;
      if (freeAccess?.freeAddons) {
        const existing = await storage.getUserAddonPurchases(userId);
        if (!existing.some(p => p.addonId === 'price-comparison' && p.status === 'active')) {
          await storage.createAddonPurchase(userId, 'price-comparison', 'free_access');
        }
      }
      const purchases = await storage.getUserAddonPurchases(userId);
      const hasAccess = purchases.some(p => p.addonId === 'price-comparison' && p.status === 'active');
      if (!hasAccess) {
        return res.status(403).json({ message: 'Add-on not purchased', locked: true });
      }
      const { getSupportedCountries } = await import('./priceComparisonData');
      res.json({ countries: getSupportedCountries() });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to load countries' });
    }
  });

  protectedApi.post('/admin/notify-new-addon', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const freeAccess = user?.email ? FREE_ACCESS_EMAILS[user.email.toLowerCase()] : null;
      if (user?.isAdmin !== 'true' && !freeAccess?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }
      const { addonName, addonPrice, addonDescription } = req.body;
      if (!addonName) return res.status(400).json({ message: 'Addon name is required' });

      const verifiedUsers = await storage.getAllVerifiedUsers();
      const { sendNewAddonNotificationEmail } = await import('./email');
      let sent = 0;
      let failed = 0;
      for (const u of verifiedUsers) {
        if (!u.email) continue;
        try {
          const success = await sendNewAddonNotificationEmail(u.email, u.username || u.email.split('@')[0], addonName, addonPrice || '£1.99/month', addonDescription || '');
          if (success) { sent++; } else { failed++; }
        } catch (e) {
          failed++;
        }
      }
      res.json({ success: true, sent, failed, total: verifiedUsers.length });
    } catch (err: any) {
      console.error('Addon notification error:', err);
      res.status(500).json({ message: err.message || 'Failed to send notifications' });
    }
  });

  // ---------- PayPal payout accruals (admin) ----------
  // Recurring £0.10p tithe per active subscription per month to PayPal.Me/OLADIRANOJO.
  // Admin sees the pending total per (recipient × month), opens PayPal.Me to send
  // the batched amount manually, then marks the batch settled.
  protectedApi.get('/admin/paypal-payouts', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const adminUser = await storage.getUser(userId);
      if (!adminUser || (adminUser.isAdmin !== 'true')) {
        return res.status(403).json({ message: 'Access denied' });
      }
      const { paypalPayoutAccruals } = await import('@shared/schema');
      const { PAYPAL_RECIPIENT_HANDLE, accruePaypalPayoutsForCurrentMonth } = await import('./paypalPayoutScheduler');
      // Top up current month before reporting so the UI is always fresh.
      await accruePaypalPayoutsForCurrentMonth();
      const rows = await db.select().from(paypalPayoutAccruals);
      type Group = {
        recipientHandle: string;
        monthYear: string;
        status: 'pending' | 'settled';
        count: number;
        amountPence: number;
        settledAt: string | null;
      };
      const groupsMap = new Map<string, Group>();
      for (const r of rows) {
        const key = `${r.recipientHandle}|${r.monthYear}|${r.status}`;
        const existing = groupsMap.get(key);
        if (existing) {
          existing.count += 1;
          existing.amountPence += r.amountPence;
          const ts = r.settledAt ? new Date(r.settledAt as any).toISOString() : null;
          if (ts && (!existing.settledAt || ts > existing.settledAt)) existing.settledAt = ts;
        } else {
          groupsMap.set(key, {
            recipientHandle: r.recipientHandle,
            monthYear: r.monthYear,
            status: r.status as 'pending' | 'settled',
            count: 1,
            amountPence: r.amountPence,
            settledAt: r.settledAt ? new Date(r.settledAt as any).toISOString() : null,
          });
        }
      }
      const groups = Array.from(groupsMap.values()).sort((a, b) => {
        if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
        if (a.monthYear !== b.monthYear) return b.monthYear.localeCompare(a.monthYear);
        return a.recipientHandle.localeCompare(b.recipientHandle);
      });
      const pendingTotalPence = groups
        .filter((g) => g.status === 'pending')
        .reduce((s, g) => s + g.amountPence, 0);
      res.json({
        recipientHandle: PAYPAL_RECIPIENT_HANDLE,
        pendingTotalPence,
        groups,
      });
    } catch (err: any) {
      console.error('GET /admin/paypal-payouts error:', err);
      res.status(500).json({ message: err.message || 'Failed to load PayPal payouts' });
    }
  });

  protectedApi.post('/admin/paypal-payouts/settle', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const adminUser = await storage.getUser(userId);
      if (!adminUser || (adminUser.isAdmin !== 'true')) {
        return res.status(403).json({ message: 'Access denied' });
      }
      const schema = z.object({
        recipientHandle: z.string().min(1).max(64),
        monthYear: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
        note: z.string().max(500).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid request', errors: parsed.error.errors });
      }
      const { recipientHandle, monthYear, note } = parsed.data;
      const { paypalPayoutAccruals } = await import('@shared/schema');
      const updated = await db
        .update(paypalPayoutAccruals)
        .set({
          status: 'settled',
          settledAt: new Date(),
          settledByUserId: userId,
          settledNote: note ?? null,
        })
        .where(and(
          eq(paypalPayoutAccruals.recipientHandle, recipientHandle),
          eq(paypalPayoutAccruals.monthYear, monthYear),
          eq(paypalPayoutAccruals.status, 'pending'),
        ))
        .returning({ id: paypalPayoutAccruals.id, amountPence: paypalPayoutAccruals.amountPence });
      const settledCount = updated.length;
      const settledPence = updated.reduce((s, r) => s + r.amountPence, 0);
      console.log(`[paypal-payouts] Admin ${adminUser.email} marked ${settledCount} accruals settled for ${recipientHandle} ${monthYear} (£${(settledPence / 100).toFixed(2)})`);
      res.json({ success: true, settledCount, settledPence });
    } catch (err: any) {
      console.error('POST /admin/paypal-payouts/settle error:', err);
      res.status(500).json({ message: err.message || 'Failed to settle PayPal payouts' });
    }
  });

  protectedApi.get('/admin/subscribers', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const adminUser = await storage.getUser(userId);
      if (!adminUser || (adminUser.isAdmin !== 'true')) {
        return res.status(403).json({ message: 'Access denied' });
      }
      const [allUsers, allAddonPurchases, allReferrals, allFreelancers] = await Promise.all([
        storage.getAllSubscribers(),
        storage.getAllAddonPurchases(),
        db.select().from(referrals),
        storage.getFreelancerProfiles(),
      ]);
      const freelancerEmailSet = new Set(allFreelancers.map(f => f.email.toLowerCase()));
      const activeAddonsByUser: Record<string, { addonId: string; purchasedAt: string | null }[]> = {};
      for (const ap of allAddonPurchases) {
        if (ap.status === 'active') {
          if (!activeAddonsByUser[ap.userId]) activeAddonsByUser[ap.userId] = [];
          activeAddonsByUser[ap.userId].push({
            addonId: ap.addonId,
            purchasedAt: ap.purchasedAt ? ap.purchasedAt.toISOString() : null,
          });
        }
      }

      const userMap = new Map(allUsers.map(u => [u.id, u]));
      const referralsByReferrer: Record<string, any[]> = {};
      for (const ref of allReferrals) {
        if (!referralsByReferrer[ref.referrerId]) referralsByReferrer[ref.referrerId] = [];
        const referredUser = userMap.get(ref.referredUserId);
        const plan = referredUser?.subscriptionPlan
          ? SUBSCRIPTION_PLANS.find(p => p.id === referredUser.subscriptionPlan || p.name === referredUser.subscriptionPlan)
          : null;
        referralsByReferrer[ref.referrerId].push({
          id: ref.id,
          referredEmail: referredUser?.email || '',
          referredName: [referredUser?.firstName, referredUser?.lastName].filter(Boolean).join(' ') || '',
          status: ref.status,
          subscriptionStatus: referredUser?.subscriptionStatus || '',
          subscriptionPlan: referredUser?.subscriptionPlan || '',
          totalEarnings: ref.totalEarnings || '0',
          commission: plan ? (plan.priceGbp * 0.10) : 0,
          createdAt: ref.createdAt,
        });
      }

      const subscribers = allUsers.map(u => {
        const freeEntry = u.email ? FREE_ACCESS_EMAILS[u.email.toLowerCase()] : null;
        const isFreeAccess = freeEntry ? !freeEntry.skipPlanOverride : false;
        const isFreeAddons = u.email ? !!FREE_ACCESS_EMAILS[u.email.toLowerCase()]?.freeAddons : false;
        const userReferrals = referralsByReferrer[u.id] || [];
        return {
          id: u.id,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          phone: u.phone,
          subscriptionPlan: u.subscriptionPlan,
          subscriptionStatus: u.subscriptionStatus,
          billingInterval: u.billingInterval || 'month',
          currency: u.currency,
          createdAt: u.createdAt,
          onboardingCompleted: u.onboardingCompleted,
          paymentSkipped: u.paymentSkipped,
          freeAccess: isFreeAccess,
          activeAddons: activeAddonsByUser[u.id] || [],
          freeAddons: isFreeAddons,
          referralCode: u.referralCode || '',
          referralLink: u.referralCode ? `https://dropandsell.online/signup?ref=${u.referralCode}` : '',
          referredUsers: userReferrals,
          referredByEmail: u.referredBy ? (userMap.get(u.referredBy)?.email || '') : '',
          isFreelanceLister: u.email ? freelancerEmailSet.has(u.email.toLowerCase()) : false,
        };
      });
      res.json({ subscribers });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to fetch subscribers' });
    }
  });

  protectedApi.patch('/admin/subscribers/:userId/plan', async (req: any, res) => {
    try {
      const adminId = req.user.claims.sub;
      const adminUser = await storage.getUser(adminId);
      if (!adminUser || (adminUser.isAdmin !== 'true')) {
        return res.status(403).json({ message: 'Access denied' });
      }
      const targetUserId = req.params.userId;
      const { plan, status } = req.body;
      if (!plan) return res.status(400).json({ message: 'Plan name is required' });
      await storage.updateUser(targetUserId, {
        subscriptionPlan: plan,
        subscriptionStatus: status || 'active',
      });
      console.log(`[ADMIN] Plan updated for user ${targetUserId}: ${plan} (${status || 'active'}) by ${adminUser.email}`);
      res.json({ success: true, message: `Plan updated to ${plan}` });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to update plan' });
    }
  });

  protectedApi.delete('/admin/subscribers/:userId', async (req: any, res) => {
    try {
      const adminId = req.user.claims.sub;
      const adminUser = await storage.getUser(adminId);
      if (!adminUser || (adminUser.isAdmin !== 'true')) {
        return res.status(403).json({ message: 'Access denied' });
      }
      const targetUserId = req.params.userId;
      if (targetUserId === adminId) {
        return res.status(400).json({ message: 'Cannot delete your own account' });
      }
      await db.delete(referrals).where(or(eq(referrals.referrerId, targetUserId), eq(referrals.referredUserId, targetUserId)));
      await db.delete(auditLogs).where(eq(auditLogs.userId, targetUserId));
      await db.delete(returnRequests).where(eq(returnRequests.userId, targetUserId));
      await db.delete(fulfillmentJobs).where(eq(fulfillmentJobs.userId, targetUserId));
      await db.delete(paymentCards).where(eq(paymentCards.userId, targetUserId));
      await db.delete(publishQueue).where(eq(publishQueue.userId, targetUserId));
      await db.delete(importJobs).where(eq(importJobs.userId, targetUserId));
      await db.delete(veroList).where(eq(veroList.userId, targetUserId));
      await db.delete(contentFilters).where(eq(contentFilters.userId, targetUserId));
      await db.delete(restrictedProducts).where(eq(restrictedProducts.userId, targetUserId));
      await db.delete(addonPurchases).where(eq(addonPurchases.userId, targetUserId));
      await db.delete(suggestions).where(eq(suggestions.userId, targetUserId));
      await db.delete(subscriptions).where(eq(subscriptions.userId, targetUserId));
      await db.delete(skuMappings).where(eq(skuMappings.userId, targetUserId));
      await db.delete(pricingRules).where(eq(pricingRules.userId, targetUserId));
      await db.delete(orders).where(eq(orders.userId, targetUserId));
      await db.delete(dropAndSellOrders).where(eq(dropAndSellOrders.userId, targetUserId));
      const userStores = await db.select({ id: stores.id }).from(stores).where(eq(stores.userId, targetUserId));
      for (const s of userStores) {
        await db.delete(marketplaceListings).where(eq(marketplaceListings.storeId, s.id));
      }
      await db.delete(products).where(eq(products.userId, targetUserId));
      await db.delete(freelancerProfiles).where(eq(freelancerProfiles.userId, targetUserId));
      await db.delete(stores).where(eq(stores.userId, targetUserId));
      await db.delete(vendors).where(eq(vendors.userId, targetUserId));
      const userWallets = await db.select({ id: wallet.id }).from(wallet).where(eq(wallet.userId, targetUserId));
      for (const w of userWallets) {
        await db.delete(transactions).where(eq(transactions.walletId, w.id));
      }
      await db.delete(wallet).where(eq(wallet.userId, targetUserId));
      await db.delete(users).where(eq(users.id, targetUserId));
      console.log(`[ADMIN] User ${targetUserId} deleted by admin ${adminUser.email}`);
      res.json({ success: true, message: `User ${targetUserId} deleted` });
    } catch (err: any) {
      console.error('[ADMIN] Delete user error:', err);
      res.status(500).json({ message: err.message || 'Failed to delete user' });
    }
  });

  let cachedRates: { rates: Record<string, number>; fetchedAt: number } | null = null;
  const RATE_CACHE_TTL = 60 * 60 * 1000; // 1 hour

  async function getExchangeRates(): Promise<Record<string, number>> {
    if (cachedRates && Date.now() - cachedRates.fetchedAt < RATE_CACHE_TTL) {
      return cachedRates.rates;
    }
    try {
      const response = await fetch('https://open.er-api.com/v6/latest/GBP');
      const data = await response.json() as any;
      if (data.result === 'success' && data.rates) {
        cachedRates = { rates: data.rates, fetchedAt: Date.now() };
        return data.rates;
      }
    } catch (err) {
      console.error('Failed to fetch exchange rates:', err);
    }
    if (cachedRates) return cachedRates.rates;
    return { GBP: 1 };
  }

  protectedApi.get('/exchange-rates', async (_req: any, res) => {
    try {
      const rates = await getExchangeRates();
      res.json({ base: 'GBP', rates });
    } catch (err: any) {
      res.status(500).json({ message: 'Failed to fetch exchange rates' });
    }
  });

  protectedApi.patch('/user/currency', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { currency } = req.body;
      if (!currency || typeof currency !== 'string' || currency.length !== 3) {
        return res.status(400).json({ message: 'Invalid currency code' });
      }
      await storage.updateUser(userId, { currency: currency.toUpperCase() });
      res.json({ success: true, currency: currency.toUpperCase() });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to update currency' });
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
      
      if (user?.email && user?.subscriptionPlan) {
        try {
          const { sendSubscriptionConfirmationEmail } = await import('./email.js');
          await sendSubscriptionConfirmationEmail(user.email, user.subscriptionPlan, user.firstName || undefined);
        } catch (emailErr: any) {
          console.error('[Email] Failed to send subscription confirmation:', emailErr?.message || emailErr);
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
      await storage.updateUser(userId, { policiesAccepted: new Date(), disclaimerAccepted: new Date() });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to accept policies' });
    }
  });

  protectedApi.post('/user/accept-disclaimer', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.updateUser(userId, { disclaimerAccepted: new Date() });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to accept disclaimer' });
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
        referralLink: `https://dropandsell.online/signup?ref=${user?.referralCode}`
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

  // Get user's referrals and earnings (with referred-user details)
  protectedApi.get('/referrals', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const rows = await storage.getReferralsWithUserDetails(userId);
      const referrals = rows.map(r => ({
        id: r.id,
        status: r.status,
        totalEarnings: r.totalEarnings,
        createdAt: r.createdAt,
        referredName: [r.referredFirstName, r.referredLastName].filter(Boolean).join(' ') || null,
        referredEmail: r.referredEmail,
        referredPlan: r.referredPlan,
        referredSubStatus: r.referredSubStatus,
      }));
      const totalEarnings = referrals.reduce((sum, r) => sum + Number(r.totalEarnings || 0), 0);

      res.json({ referrals, totalEarnings, totalReferrals: referrals.length });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to get referrals' });
    }
  });

  // Send monthly referral earnings report to a user's email
  protectedApi.post('/referrals/send-report', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user?.email) {
        return res.status(400).json({ message: 'No email on account' });
      }

      const rows = await storage.getReferralsWithUserDetails(userId);
      if (!rows.length) {
        return res.status(400).json({ message: 'No referrals to report' });
      }

      const now = new Date();
      const reportMonth = now.toLocaleString('en-GB', { month: 'long', year: 'numeric' });

      const monthlyEarnings = await storage.getMonthlyReferralEarnings(userId, now.getFullYear(), now.getMonth() + 1);
      const totalEarnings = rows.reduce((sum, r) => sum + Number(r.totalEarnings || 0), 0);

      const excelRows = rows.map(r => ({
        'Referred User': [r.referredFirstName, r.referredLastName].filter(Boolean).join(' ') || '—',
        'Email': r.referredEmail || '—',
        'Status': (r.status || 'pending').charAt(0).toUpperCase() + (r.status || 'pending').slice(1),
        'Plan': r.referredPlan || '—',
        'Subscription Status': (r.referredSubStatus || '—'),
        'Total Earnings (£)': Number(r.totalEarnings || 0).toFixed(2),
        'Referred Since': r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-GB') : '—',
      }));

      const XLSX = await import('xlsx');
      const worksheet = XLSX.utils.json_to_sheet(excelRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Referral Earnings');
      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

      const { sendMonthlyReferralReportEmail } = await import('./email.js');
      const sent = await sendMonthlyReferralReportEmail(
        user.email,
        user.firstName || '',
        totalEarnings,
        monthlyEarnings,
        reportMonth,
        excelBuffer
      );

      if (!sent) {
        return res.status(500).json({ message: 'Failed to send report email' });
      }

      res.json({ success: true, message: `Report sent to ${user.email}` });
    } catch (err: any) {
      console.error('[Referral Report]', err.message);
      res.status(500).json({ message: err.message || 'Failed to send referral report' });
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
      
      // Use request host to ensure correct URL in both dev and production
      const baseUrl = `https://${req.get('host')}`;
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

  // === UNIQUE URL MANAGEMENT ===
  protectedApi.get('/user/unique-url', async (req: any, res) => {
    const userId = req.user.claims.sub;
    try {
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      if (!user.uniqueUrl) {
        const uniqueUrl = await storage.regenerateUserUniqueUrl(userId);
        return res.json({ uniqueUrl });
      }
      
      res.json({ uniqueUrl: user.uniqueUrl });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to get unique URL' });
    }
  });

  // One-shot endpoint used by the /extension-link page to fetch the
  // signed-in user's credentials and forward them to the Chrome extension
  // in the background. Removes the need for users to copy/paste URL,
  // unique code, and API key into the popup.
  protectedApi.get('/user/extension-credentials', async (req: any, res) => {
    const userId = req.user.claims.sub;
    try {
      // Allowlist: only hand credentials to extension IDs we trust. The
      // env var ALLOWED_EXTENSION_IDS holds a comma-separated list of
      // chrome extension ids (32 chars, a-p). If unset, we still require
      // the caller to send a syntactically valid id, but we accept any
      // (useful while the extension is being developed/published).
      const requestedExtId = (req.query?.ext as string | undefined)?.trim() || '';
      const extIdPattern = /^[a-p]{32}$/;
      if (!requestedExtId || !extIdPattern.test(requestedExtId)) {
        return res.status(400).json({
          message: 'A valid extension id is required to fetch credentials.',
        });
      }

      const allowlistRaw = (process.env.ALLOWED_EXTENSION_IDS || '').trim();
      // We must enforce the allowlist for any internet-facing deployment.
      // Three independent triggers: NODE_ENV=production, an explicit
      // REQUIRE_EXTENSION_ALLOWLIST=true override, or the request being
      // served from the brand domain. Any of them is enough to fail closed
      // when the env var is not configured.
      const requestHost = String(req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase();
      const isBrandHost = requestHost === 'dropandsell.online' || requestHost.endsWith('.dropandsell.online');
      const explicitRequire = String(process.env.REQUIRE_EXTENSION_ALLOWLIST || '').toLowerCase() === 'true';
      const enforceAllowlist =
        explicitRequire || process.env.NODE_ENV === 'production' || isBrandHost;
      if (allowlistRaw.length === 0) {
        if (enforceAllowlist) {
          console.warn('[extension-credentials] ALLOWED_EXTENSION_IDS is not set — rejecting request from', requestHost);
          return res.status(403).json({
            message:
              'Extension sign-in is not configured for this environment. Please contact support.',
          });
        }
      } else {
        const allowed = allowlistRaw
          .split(',')
          .map(s => s.trim().toLowerCase())
          .filter(Boolean);
        if (!allowed.includes(requestedExtId.toLowerCase())) {
          return res.status(403).json({
            message:
              'This extension is not authorized to connect to your DropandSell account.',
          });
        }
      }

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: 'User not found' });

      const updates: any = {};
      let apiKey = user.apiKey;
      let uniqueUrl = user.uniqueUrl;

      if (!apiKey) {
        apiKey = 'dfk_' + crypto.randomUUID().replace(/-/g, '');
        updates.apiKey = apiKey;
      }
      if (!uniqueUrl) {
        uniqueUrl = await storage.regenerateUserUniqueUrl(userId);
      }
      if (Object.keys(updates).length > 0) {
        await storage.updateUser(userId, updates);
      }

      const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const apiUrl = `${protocol}://${host}`;

      res.json({ apiUrl, uniqueUrl, apiKey });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to load extension credentials' });
    }
  });

  // Per-user store rules (auto-restock buffer, default profit %).
  // Read by the Dashboard "Store Rules" tab and applied across all the
  // user's stores by the order/restock schedulers and the price calculator.
  protectedApi.get('/user/store-rules', async (req: any, res) => {
    const userId = req.user.claims.sub;
    try {
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: 'User not found' });
      res.json({
        autoRestockEnabled: !!user.autoRestockEnabled,
        autoRestockBuffer: user.autoRestockBuffer ?? 10,
        defaultProfitEnabled: !!user.defaultProfitEnabled,
        defaultProfitPercentage: user.defaultProfitPercentage ?? 30,
        // Default true: column may be NULL on legacy rows, treat as enabled.
        autoPauseOnFailedStock: user.autoPauseOnFailedStock !== false,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to load store rules' });
    }
  });

  protectedApi.patch('/user/store-rules', async (req: any, res) => {
    const userId = req.user.claims.sub;
    try {
      const body = req.body || {};
      const updates: any = {};

      if (typeof body.autoRestockEnabled === 'boolean') {
        updates.autoRestockEnabled = body.autoRestockEnabled;
      }
      if (body.autoRestockBuffer !== undefined && body.autoRestockBuffer !== null) {
        const n = Number(body.autoRestockBuffer);
        if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > 1000) {
          return res.status(400).json({ message: 'Auto-restock buffer must be a whole number between 1 and 1000.' });
        }
        updates.autoRestockBuffer = n;
      }
      if (typeof body.defaultProfitEnabled === 'boolean') {
        updates.defaultProfitEnabled = body.defaultProfitEnabled;
      }
      if (body.defaultProfitPercentage !== undefined && body.defaultProfitPercentage !== null) {
        const n = Number(body.defaultProfitPercentage);
        if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > 1000) {
          return res.status(400).json({ message: 'Profit percentage must be a whole number between 1 and 1000.' });
        }
        updates.defaultProfitPercentage = n;
      }
      if (typeof body.autoPauseOnFailedStock === 'boolean') {
        updates.autoPauseOnFailedStock = body.autoPauseOnFailedStock;
      }

      const updated = await storage.updateUser(userId, updates);

      // If the user just turned the auto-restock rule on, or changed the
      // buffer while it was already on, push the new target to their eBay
      // stores immediately instead of waiting for the next 30-min sweep
      // or the next sale. Runs in the background so the save response
      // returns instantly; errors are logged but never block the save.
      const restockChanged = 'autoRestockEnabled' in updates || 'autoRestockBuffer' in updates;
      if (restockChanged && updated?.autoRestockEnabled) {
        (async () => {
          try {
            const { applyRestockRuleForUser } = await import('./ebayRestockScheduler.js');
            await applyRestockRuleForUser(userId);
          } catch (err: any) {
            console.error('[Store Rules] Immediate restock apply failed:', err?.message || err);
          }
        })();
      }

      res.json({
        autoRestockEnabled: !!updated.autoRestockEnabled,
        autoRestockBuffer: updated.autoRestockBuffer ?? 10,
        defaultProfitEnabled: !!updated.defaultProfitEnabled,
        defaultProfitPercentage: updated.defaultProfitPercentage ?? 30,
        autoPauseOnFailedStock: updated.autoPauseOnFailedStock !== false,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to save store rules' });
    }
  });

  protectedApi.post('/user/unique-url/regenerate', async (req: any, res) => {
    const userId = req.user.claims.sub;
    try {
      const uniqueUrl = await storage.regenerateUserUniqueUrl(userId);
      res.json({ uniqueUrl });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to regenerate unique URL' });
    }
  });

  // ===== Amazon SP-API OAuth flow =====
  const AMAZON_SP_API_APP_ID = process.env.AMAZON_APP_ID || 'amzn1.sp.solution.5a8ac72c-9085-4a9b-9055-42ea6aeb3a42';
  const AMAZON_LWA_CLIENT_ID = process.env.AMAZON_CLIENT_ID || '';
  const AMAZON_LWA_CLIENT_SECRET = process.env.AMAZON_CLIENT_SECRET || '';

  const AMAZON_MARKETPLACES: Record<string, { domain: string; sellerCentral: string; marketplaceId: string; region: string; endpoint: string }> = {
    uk: { domain: 'amazon.co.uk', sellerCentral: 'sellercentral.amazon.co.uk', marketplaceId: 'A1F83G8C2ARO7P', region: 'eu-west-1', endpoint: 'https://sellingpartnerapi-eu.amazon.com' },
    us: { domain: 'amazon.com', sellerCentral: 'sellercentral.amazon.com', marketplaceId: 'ATVPDKIKX0DER', region: 'us-east-1', endpoint: 'https://sellingpartnerapi-na.amazon.com' },
    de: { domain: 'amazon.de', sellerCentral: 'sellercentral.amazon.de', marketplaceId: 'A1PA6795UKMFR9', region: 'eu-west-1', endpoint: 'https://sellingpartnerapi-eu.amazon.com' },
    fr: { domain: 'amazon.fr', sellerCentral: 'sellercentral.amazon.fr', marketplaceId: 'A13V1IB3VIYZZH', region: 'eu-west-1', endpoint: 'https://sellingpartnerapi-eu.amazon.com' },
    ca: { domain: 'amazon.ca', sellerCentral: 'sellercentral.amazon.ca', marketplaceId: 'A2EUQ1WTGCTBG2', region: 'us-east-1', endpoint: 'https://sellingpartnerapi-na.amazon.com' },
    it: { domain: 'amazon.it', sellerCentral: 'sellercentral.amazon.it', marketplaceId: 'APJ6JRA9NG5V4', region: 'eu-west-1', endpoint: 'https://sellingpartnerapi-eu.amazon.com' },
    es: { domain: 'amazon.es', sellerCentral: 'sellercentral.amazon.es', marketplaceId: 'A1RKKUPIHCS9HS', region: 'eu-west-1', endpoint: 'https://sellingpartnerapi-eu.amazon.com' },
  };

  function getAmazonRedirectUri(req: any): string {
    const host = req.get('host') || process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000';
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    return `${protocol}://${host}/api/amazon/callback`;
  }

  async function refreshAmazonAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number } | null> {
    try {
      const response = await fetch('https://api.amazon.com/auth/o2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: AMAZON_LWA_CLIENT_ID,
          client_secret: AMAZON_LWA_CLIENT_SECRET,
        }).toString(),
      });
      const data = await response.json() as any;
      if (data.error || !data.access_token) return null;
      return { accessToken: data.access_token, expiresIn: data.expires_in };
    } catch {
      return null;
    }
  }

  app.get('/api/amazon/auth', isAuthenticated, (req: any, res) => {
    if (!AMAZON_LWA_CLIENT_ID || !AMAZON_LWA_CLIENT_SECRET) {
      return res.status(500).json({ message: 'Amazon API credentials not configured. Please contact support.' });
    }
    const userId = req.user.claims.sub;
    const marketplace = (req.query.marketplace as string) || 'uk';
    const storeName = (req.query.storeName as string) || 'My Amazon Store';
    const mp = AMAZON_MARKETPLACES[marketplace] || AMAZON_MARKETPLACES.uk;
    const redirectUri = getAmazonRedirectUri(req);

    const state = Buffer.from(JSON.stringify({ userId, storeName, marketplace })).toString('base64');
    // While the Amazon app is still in Draft (not yet published for public/customer use),
    // only the developer's own seller account can authorize, and the consent URL must
    // include version=beta. Set AMAZON_APP_PUBLISHED=true once Amazon approves the app.
    const isAppPublished = String(process.env.AMAZON_APP_PUBLISHED || '').toLowerCase() === 'true';
    const betaParam = isAppPublished ? '' : '&version=beta';
    const authUrl = `https://${mp.sellerCentral}/apps/authorize/consent?application_id=${encodeURIComponent(AMAZON_SP_API_APP_ID)}&state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(redirectUri)}${betaParam}`;
    res.redirect(authUrl);
  });

  app.get('/api/amazon/callback', async (req, res) => {
    const { spapi_oauth_code, selling_partner_id, state, error, error_description } = req.query as any;
    if (error || !spapi_oauth_code) {
      return res.redirect(`/amazon-callback?error=${encodeURIComponent(error_description || error || 'Authorization failed')}`);
    }
    const params = new URLSearchParams({
      code: spapi_oauth_code as string,
      selling_partner_id: (selling_partner_id as string) || '',
      state: (state as string) || '',
    });
    res.redirect(`/amazon-callback?${params.toString()}`);
  });

  protectedApi.post('/amazon/exchange-token', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { code, sellingPartnerId, state: stateParam } = req.body;

      if (!code || !stateParam) {
        return res.status(400).json({ message: 'Missing authorization code or state' });
      }

      let state: { userId: string; storeName: string; marketplace: string };
      try {
        state = JSON.parse(Buffer.from(stateParam, 'base64').toString());
      } catch {
        return res.status(400).json({ message: 'Invalid state parameter' });
      }

      if (state.userId !== userId) {
        return res.status(403).json({ message: 'State mismatch - unauthorized' });
      }

      const tokenResponse = await fetch('https://api.amazon.com/auth/o2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: AMAZON_LWA_CLIENT_ID,
          client_secret: AMAZON_LWA_CLIENT_SECRET,
        }).toString(),
      });
      const tokenData = await tokenResponse.json() as any;

      if (tokenData.error || !tokenData.access_token) {
        console.error('[AMAZON] Token exchange error:', tokenData);
        return res.status(400).json({ message: `Amazon token exchange failed: ${tokenData.error_description || tokenData.error || 'Unknown error'}` });
      }

      console.log('[AMAZON] Token exchange successful for seller:', sellingPartnerId);

      const mp = AMAZON_MARKETPLACES[state.marketplace] || AMAZON_MARKETPLACES.uk;
      const credentials = {
        sellerId: sellingPartnerId || '',
        refreshToken: tokenData.refresh_token,
        accessToken: tokenData.access_token,
        tokenExpiry: Date.now() + (tokenData.expires_in * 1000),
        marketplace: state.marketplace,
        marketplaceId: mp.marketplaceId,
        region: mp.region,
        endpoint: mp.endpoint,
      };

      const existingStores = await storage.getStores(userId);
      const existingAmazon = existingStores.find(
        s => s.platform === 'amazon' && (s.credentials as any)?.sellerId === sellingPartnerId
      );

      if (!existingAmazon) {
        const userForLimit = await storage.getUser(userId);
        const storeLimitForUser = getStoreLimitForPlan(userForLimit?.subscriptionPlan, userForLimit?.subscriptionStatus, userForLimit?.email, userForLimit?.createdAt);
        if (existingStores.length >= storeLimitForUser) {
          console.log(`[AMAZON] Store connection blocked for user ${userId}: ${storeLimitForUser} store limit reached`);
          return res.status(400).json({ message: `You can connect a maximum of ${storeLimitForUser} stores on your current plan.` });
        }
      }

      let store;
      if (existingAmazon) {
        store = await storage.updateStore(existingAmazon.id, userId, {
          credentials,
          status: 'active',
          name: state.storeName || existingAmazon.name,
        });
      } else {
        store = await storage.createStore({
          userId,
          name: state.storeName || 'My Amazon Store',
          platform: 'amazon',
          credentials,
          status: 'active',
        });
      }

      res.json({ success: true, store, sellingPartnerId });
    } catch (err: any) {
      console.error('[AMAZON] Exchange token error:', err);
      res.status(500).json({ message: err.message || 'Failed to connect Amazon store' });
    }
  });

  protectedApi.post('/amazon/sync-orders', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stores = await storage.getStores(userId);
      const amazonStores = stores.filter(s => s.platform === 'amazon' && s.status === 'active');

      if (amazonStores.length === 0) {
        return res.status(400).json({ message: 'No active Amazon stores connected' });
      }

      let totalNew = 0;
      let totalUpdated = 0;
      const errors: string[] = [];

      for (const store of amazonStores) {
        try {
          const creds = store.credentials as any;
          if (!creds?.refreshToken) {
            errors.push(`Store "${store.name}": missing refresh token — please reconnect`);
            continue;
          }

          const tokenResult = await refreshAmazonAccessToken(creds.refreshToken);
          if (!tokenResult) {
            errors.push(`Store "${store.name}": failed to refresh access token — please reconnect`);
            continue;
          }

          await storage.updateStore(store.id, userId, {
            credentials: { ...creds, accessToken: tokenResult.accessToken, tokenExpiry: Date.now() + (tokenResult.expiresIn * 1000) },
          });

          const endpoint = creds.endpoint || 'https://sellingpartnerapi-eu.amazon.com';
          const marketplaceId = creds.marketplaceId || 'A1F83G8C2ARO7P';

          const createdAfter = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
          const ordersUrl = `${endpoint}/orders/v0/orders?MarketplaceIds=${marketplaceId}&CreatedAfter=${createdAfter}&OrderStatuses=Unshipped,PartiallyShipped,Shipped`;

          const ordersResponse = await fetch(ordersUrl, {
            headers: {
              'x-amz-access-token': tokenResult.accessToken,
              'Content-Type': 'application/json',
            },
          });

          if (!ordersResponse.ok) {
            const errText = await ordersResponse.text();
            console.error(`[AMAZON] Orders API error for store "${store.name}":`, errText);
            errors.push(`Store "${store.name}": Amazon API error (${ordersResponse.status})`);
            continue;
          }

          const ordersData = await ordersResponse.json() as any;
          const amazonOrders = ordersData?.payload?.Orders || [];
          console.log(`[AMAZON] Fetched ${amazonOrders.length} orders from store "${store.name}"`);

          for (const amzOrder of amazonOrders) {
            const orderId = amzOrder.AmazonOrderId;
            const orderStatus = amzOrder.OrderStatus || '';

            const totalAmount = parseFloat(amzOrder.OrderTotal?.Amount || '0');
            const buyerName = amzOrder.BuyerInfo?.BuyerEmail ? amzOrder.BuyerInfo.BuyerEmail.split('@')[0] : 'Amazon Buyer';

            const shippingAddress: any = {};
            if (amzOrder.ShippingAddress) {
              const addr = amzOrder.ShippingAddress;
              shippingAddress.name = addr.Name || buyerName;
              shippingAddress.addressLine1 = addr.AddressLine1 || '';
              shippingAddress.addressLine2 = addr.AddressLine2 || '';
              shippingAddress.city = addr.City || '';
              shippingAddress.stateOrProvince = addr.StateOrRegion || '';
              shippingAddress.postalCode = addr.PostalCode || '';
              shippingAddress.countryCode = addr.CountryCode || '';
            }

            let appStatus = 'pending';
            if (orderStatus === 'Unshipped') appStatus = 'processing';
            else if (orderStatus === 'PartiallyShipped') appStatus = 'processing';
            else if (orderStatus === 'Shipped') appStatus = 'shipped';
            else if (orderStatus === 'Canceled') appStatus = 'cancelled';

            let fulfillmentStatus = 'unfulfilled';
            if (orderStatus === 'Shipped') fulfillmentStatus = 'fulfilled';
            else if (orderStatus === 'PartiallyShipped') fulfillmentStatus = 'in_progress';

            const existingOrder = await storage.getOrderByExternalId(orderId, userId);
            if (existingOrder) {
              const statusChanged = existingOrder.status !== appStatus || existingOrder.fulfillmentStatus !== fulfillmentStatus;
              if (statusChanged) {
                await storage.updateOrder(existingOrder.id, userId, {
                  status: appStatus,
                  fulfillmentStatus,
                  updatedAt: new Date(),
                });
                totalUpdated++;
              }
            } else {
              await storage.createOrder({
                userId,
                storeId: store.id,
                externalOrderId: orderId,
                customerName: shippingAddress.name || buyerName,
                customerEmail: amzOrder.BuyerInfo?.BuyerEmail || '',
                shippingAddress,
                totalAmount: totalAmount.toFixed(2),
                status: appStatus,
                fulfillmentStatus,
                lineItems: [],
              });
              totalNew++;
            }
          }

          await storage.updateStore(store.id, userId, { lastSync: new Date() });
        } catch (storeErr: any) {
          console.error(`[AMAZON] Sync error for store "${store.name}":`, storeErr);
          errors.push(`Store "${store.name}": ${storeErr.message}`);
        }
      }

      res.json({
        success: true,
        newOrders: totalNew,
        updatedOrders: totalUpdated,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (err: any) {
      console.error('[AMAZON] Sync orders error:', err);
      res.status(500).json({ message: err.message || 'Failed to sync Amazon orders' });
    }
  });

  protectedApi.post('/jumia/sync-orders', requireJumiaAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userStores = await storage.getStores(userId);
      const jumiaStores = userStores.filter(s => s.platform === 'jumia' && s.status === 'active');

      if (jumiaStores.length === 0) {
        return res.status(400).json({ message: 'No active Jumia stores connected' });
      }

      const { fetchJumiaOrders, fetchJumiaOrderItems } = await import('./marketplaces/jumia');

      let totalNew = 0;
      let totalUpdated = 0;
      const errors: string[] = [];

      for (const store of jumiaStores) {
        try {
          const creds = store.credentials as any;
          if (!creds?.apiKey || !creds?.userId || !creds?.country) {
            errors.push(`Store "${store.name}": missing API credentials`);
            continue;
          }

          const createdAfter = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
          const jumiaOrders = await fetchJumiaOrders(creds, createdAfter);
          console.log(`[JUMIA] Fetched ${jumiaOrders.length} orders from store "${store.name}"`);

          for (const jOrder of jumiaOrders) {
            const orderId = jOrder.OrderId || jOrder.OrderNumber;
            if (!orderId) {
              console.warn(`[JUMIA] Skipping order with no ID from store "${store.name}"`);
              continue;
            }
            const orderStatus = (jOrder.Statuses?.[0] || jOrder.Status || '').toLowerCase();

            let appStatus = 'pending';
            if (orderStatus === 'pending') appStatus = 'pending';
            else if (orderStatus === 'ready_to_ship' || orderStatus === 'processing') appStatus = 'processing';
            else if (orderStatus === 'shipped') appStatus = 'shipped';
            else if (orderStatus === 'delivered') appStatus = 'delivered';
            else if (orderStatus === 'canceled' || orderStatus === 'failed') appStatus = 'cancelled';

            let fulfillmentStatus = 'unfulfilled';
            if (orderStatus === 'shipped' || orderStatus === 'delivered') fulfillmentStatus = 'fulfilled';
            else if (orderStatus === 'ready_to_ship') fulfillmentStatus = 'in_progress';

            const totalAmount = parseFloat(jOrder.Price || '0');
            const customerName = [jOrder.AddressShipping?.FirstName, jOrder.AddressShipping?.LastName].filter(Boolean).join(' ') || 'Jumia Buyer';

            const shippingAddress: any = {};
            if (jOrder.AddressShipping) {
              const addr = jOrder.AddressShipping;
              shippingAddress.name = customerName;
              shippingAddress.addressLine1 = addr.Address1 || addr.Address || '';
              shippingAddress.addressLine2 = addr.Address2 || '';
              shippingAddress.city = addr.City || '';
              shippingAddress.stateOrProvince = addr.Region || '';
              shippingAddress.postalCode = addr.PostCode || '';
              shippingAddress.countryCode = addr.Country || creds.country?.toUpperCase() || '';
              shippingAddress.phone = addr.Phone || addr.Phone2 || '';
            }

            let lineItems: any[] = [];
            try {
              const items = await fetchJumiaOrderItems(creds, orderId);
              lineItems = items.map((item: any) => ({
                title: item.Name || item.ProductMainImage || '',
                sku: item.Sku || item.ShopSku || '',
                quantity: parseInt(item.Quantity || '1'),
                price: parseFloat(item.ItemPrice || item.PaidPrice || '0'),
              }));
            } catch {}

            const existingOrder = await storage.getOrderByExternalId(orderId, userId);
            if (existingOrder) {
              const statusChanged = existingOrder.status !== appStatus || existingOrder.fulfillmentStatus !== fulfillmentStatus;
              if (statusChanged) {
                await storage.updateOrder(existingOrder.id, userId, {
                  status: appStatus,
                  fulfillmentStatus,
                  updatedAt: new Date(),
                });
                totalUpdated++;
              }
            } else {
              await storage.createOrder({
                userId,
                storeId: store.id,
                externalOrderId: orderId,
                customerName,
                customerEmail: jOrder.AddressShipping?.CustomerEmail || '',
                shippingAddress,
                totalAmount: totalAmount.toFixed(2),
                status: appStatus,
                fulfillmentStatus,
                lineItems,
              });
              totalNew++;
            }
          }

          await storage.updateStore(store.id, userId, { lastSync: new Date() });
        } catch (storeErr: any) {
          console.error(`[JUMIA] Sync error for store "${store.name}":`, storeErr);
          errors.push(`Store "${store.name}": ${storeErr.message}`);
        }
      }

      res.json({
        success: true,
        newOrders: totalNew,
        updatedOrders: totalUpdated,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (err: any) {
      console.error('[JUMIA] Sync orders error:', err);
      res.status(500).json({ message: err.message || 'Failed to sync Jumia orders' });
    }
  });

  protectedApi.post('/amazon/upload-tracking', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { orderId, trackingNumber, carrier } = req.body;

      if (!orderId || !trackingNumber || !carrier) {
        return res.status(400).json({ message: 'Order ID, tracking number, and carrier are required' });
      }

      const order = await storage.getOrder(orderId, userId);
      if (!order || !order.storeId) {
        return res.status(404).json({ message: 'Order not found' });
      }

      const store = (await storage.getStores(userId)).find(s => s.id === order.storeId);
      if (!store || store.platform !== 'amazon') {
        return res.status(400).json({ message: 'This order is not from an Amazon store' });
      }

      const creds = store.credentials as any;
      if (!creds?.refreshToken) {
        return res.status(400).json({ message: 'Amazon store missing refresh token — please reconnect' });
      }

      const tokenResult = await refreshAmazonAccessToken(creds.refreshToken);
      if (!tokenResult) {
        return res.status(400).json({ message: 'Failed to refresh Amazon access token' });
      }

      const endpoint = creds.endpoint || 'https://sellingpartnerapi-eu.amazon.com';
      const externalOrderId = order.externalOrderId;

      const feedBody = {
        feedType: 'POST_ORDER_FULFILLMENT_DATA',
        marketplaceIds: [creds.marketplaceId || 'A1F83G8C2ARO7P'],
        inputDocument: {
          AmazonOrderID: externalOrderId,
          FulfillmentDate: new Date().toISOString(),
          CarrierName: carrier,
          ShippingMethod: 'Standard',
          ShipperTrackingNumber: trackingNumber,
        },
      };

      console.log(`[AMAZON] Uploading tracking for order ${externalOrderId}: ${carrier} ${trackingNumber}`);

      await storage.updateOrder(order.id, userId, {
        trackingNumber,
        carrier,
        status: 'shipped',
        fulfillmentStatus: 'fulfilled',
        updatedAt: new Date(),
      });

      res.json({ success: true, message: `Tracking ${trackingNumber} saved for order ${externalOrderId}` });
    } catch (err: any) {
      console.error('[AMAZON] Upload tracking error:', err);
      res.status(500).json({ message: err.message || 'Failed to upload tracking' });
    }
  });
  // ===== TikTok Shop Order Sync & Tracking =====
  protectedApi.post('/tiktok/sync-orders', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stores = await storage.getStores(userId);
      const tiktokStores = stores.filter(s => s.platform === 'tiktokshop' && s.status === 'active');

      if (tiktokStores.length === 0) {
        return res.status(400).json({ message: 'No active TikTok Shop stores connected' });
      }

      let totalNew = 0;
      let totalUpdated = 0;
      const errors: string[] = [];

      for (const store of tiktokStores) {
        try {
          const creds = store.credentials as any;
          if (!creds?.accessToken || !creds?.appKey || !creds?.appSecret) {
            errors.push(`Store "${store.name}": missing credentials — please reconnect`);
            continue;
          }

          const { fetchTikTokOrders, fetchTikTokProductImages } = await import('./marketplaces/tiktokshop');
          const createdAfter = Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000);
          const ttOrders = await fetchTikTokOrders(creds, createdAfter);
          console.log(`[TikTok] Fetched ${ttOrders.length} orders from store "${store.name}"`);

          const userProducts = await storage.getProducts(userId);
          const skuToProduct = new Map<string, any>();
          for (const p of userProducts) {
            if (p.sku) skuToProduct.set(p.sku, p);
          }
          const enrichedProductIds = new Set<string>();

          for (const ttOrder of ttOrders) {
            const orderId = ttOrder.id;
            if (!orderId) continue;

            const orderStatus = (ttOrder.status || '').toUpperCase();
            let appStatus = 'pending';
            if (orderStatus === 'AWAITING_SHIPMENT' || orderStatus === 'PARTIALLY_SHIPPING') appStatus = 'processing';
            else if (orderStatus === 'AWAITING_COLLECTION') appStatus = 'processing';
            else if (orderStatus === 'IN_TRANSIT') appStatus = 'shipped';
            else if (orderStatus === 'DELIVERED') appStatus = 'delivered';
            else if (orderStatus === 'CANCELLED') appStatus = 'cancelled';
            else if (orderStatus === 'UNPAID') appStatus = 'pending';
            else if (orderStatus === 'ON_HOLD') appStatus = 'pending';
            else if (orderStatus === 'COMPLETED') appStatus = 'completed';

            let fulfillmentStatus = 'unfulfilled';
            if (orderStatus === 'IN_TRANSIT' || orderStatus === 'DELIVERED' || orderStatus === 'COMPLETED') fulfillmentStatus = 'fulfilled';
            else if (orderStatus === 'AWAITING_COLLECTION' || orderStatus === 'AWAITING_SHIPMENT' || orderStatus === 'PARTIALLY_SHIPPING') fulfillmentStatus = 'in_progress';

            const buyerName = ttOrder.recipient_address?.name || 'TikTok Buyer';
            const buyerPhone = ttOrder.recipient_address?.phone || '';

            const shippingAddress: any = {};
            if (ttOrder.recipient_address) {
              const addr = ttOrder.recipient_address;
              shippingAddress.name = addr.name || buyerName;
              shippingAddress.addressLine1 = addr.address_detail || addr.full_address || '';
              shippingAddress.city = addr.city || '';
              shippingAddress.stateOrProvince = addr.state || addr.region || '';
              shippingAddress.postalCode = addr.zipcode || addr.postal_code || '';
              shippingAddress.countryCode = addr.region_code || '';
              shippingAddress.phone = buyerPhone;
            }

            const totalAmount = ttOrder.payment?.total_amount || ttOrder.payment?.product_total_amount || '0';

            const lineItems = (ttOrder.line_items || []).map((item: any) => {
              const itemImages: string[] = [];
              if (item.sku_image) itemImages.push(item.sku_image);
              if (item.product_image?.url) itemImages.push(item.product_image.url);
              if (item.product_images && Array.isArray(item.product_images)) {
                for (const img of item.product_images) {
                  const imgUrl = typeof img === 'string' ? img : (img?.url || img?.thumb_url);
                  if (imgUrl && !itemImages.includes(imgUrl)) itemImages.push(imgUrl);
                }
              }
              return {
                title: item.product_name || item.sku_name || 'TikTok Item',
                quantity: parseInt(item.quantity || '1'),
                price: item.sale_price || item.original_price || '0',
                sku: item.seller_sku || item.sku_id || '',
                externalProductId: item.product_id || '',
                images: itemImages.slice(0, 5),
              };
            });

            const existingOrder = await storage.getOrderByExternalId(orderId, userId);
            if (existingOrder) {
              const statusChanged = existingOrder.status !== appStatus || existingOrder.fulfillmentStatus !== fulfillmentStatus;
              if (statusChanged) {
                await storage.updateOrder(existingOrder.id, userId, {
                  status: appStatus,
                  fulfillmentStatus,
                  updatedAt: new Date(),
                });
                totalUpdated++;
              }
            } else {
              await storage.createOrder({
                userId,
                storeId: store.id,
                externalOrderId: orderId,
                customerName: buyerName,
                customerEmail: '',
                shippingAddress,
                totalAmount: typeof totalAmount === 'string' ? totalAmount : String(totalAmount),
                status: appStatus,
                fulfillmentStatus,
                lineItems,
              });
              totalNew++;

              for (const item of lineItems) {
                if (item.externalProductId && item.sku && !enrichedProductIds.has(item.externalProductId)) {
                  enrichedProductIds.add(item.externalProductId);
                  try {
                    const matched = skuToProduct.get(item.sku);
                    if (matched && (!matched.images || matched.images.length < 5)) {
                      const productImages = await fetchTikTokProductImages(creds, item.externalProductId);
                      if (productImages.length > 0) {
                        const existingImages = Array.isArray(matched.images) ? matched.images : [];
                        const combined = [...existingImages];
                        for (const img of productImages) {
                          if (!combined.includes(img)) combined.push(img);
                          if (combined.length >= 5) break;
                        }
                        if (combined.length > existingImages.length) {
                          await storage.updateProduct(matched.id, userId, { images: combined });
                          console.log(`[TikTok] Enriched product "${matched.title}" with ${combined.length - existingImages.length} images from TikTok`);
                        }
                      }
                    }
                  } catch (imgErr: any) {
                    console.warn(`[TikTok] Could not fetch images for product ${item.externalProductId}:`, imgErr.message);
                  }
                }
              }
            }
          }

          await storage.updateStore(store.id, userId, { lastSync: new Date() });
        } catch (storeErr: any) {
          console.error(`[TikTok] Sync error for store "${store.name}":`, storeErr);
          errors.push(`Store "${store.name}": ${storeErr.message}`);
        }
      }

      res.json({
        success: true,
        newOrders: totalNew,
        updatedOrders: totalUpdated,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (err: any) {
      console.error('[TikTok] Sync orders error:', err);
      res.status(500).json({ message: err.message || 'Failed to sync TikTok Shop orders' });
    }
  });

  protectedApi.post('/tiktok/upload-tracking', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { orderId, trackingNumber, shippingProviderId } = req.body;

      if (!orderId || !trackingNumber || !shippingProviderId) {
        return res.status(400).json({ message: 'Order ID, tracking number, and shipping provider ID are required' });
      }

      const order = await storage.getOrder(orderId, userId);
      if (!order || !order.storeId) {
        return res.status(404).json({ message: 'Order not found' });
      }

      const store = (await storage.getStores(userId)).find(s => s.id === order.storeId);
      if (!store || store.platform !== 'tiktokshop') {
        return res.status(400).json({ message: 'This order is not from a TikTok Shop store' });
      }

      const creds = store.credentials as any;
      if (!creds?.accessToken || !creds?.appKey || !creds?.appSecret) {
        return res.status(400).json({ message: 'TikTok Shop store missing credentials — please reconnect' });
      }

      const { uploadTikTokTracking } = await import('./marketplaces/tiktokshop');
      const externalOrderId = order.externalOrderId;

      console.log(`[TikTok] Uploading tracking for order ${externalOrderId}: provider=${shippingProviderId} tracking=${trackingNumber}`);

      const result = await uploadTikTokTracking(creds, externalOrderId!, trackingNumber, shippingProviderId);

      if (result.success) {
        await storage.updateOrder(order.id, userId, {
          trackingNumber,
          carrier: shippingProviderId,
          status: 'shipped',
          fulfillmentStatus: 'fulfilled',
          updatedAt: new Date(),
        });

        res.json({ success: true, message: `Tracking ${trackingNumber} uploaded to TikTok Shop for order ${externalOrderId}` });
      } else {
        await storage.updateOrder(order.id, userId, {
          trackingNumber,
          carrier: shippingProviderId,
          updatedAt: new Date(),
        });

        res.json({ success: true, message: `Tracking saved locally. TikTok API: ${result.error}`, warning: result.error });
      }
    } catch (err: any) {
      console.error('[TikTok] Upload tracking error:', err);
      res.status(500).json({ message: err.message || 'Failed to upload tracking to TikTok Shop' });
    }
  });

  protectedApi.get('/tiktok/shipping-providers/:orderId', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { orderId } = req.params;

      const order = await storage.getOrder(parseInt(orderId), userId);
      if (!order || !order.storeId) {
        return res.status(404).json({ message: 'Order not found' });
      }

      const store = (await storage.getStores(userId)).find(s => s.id === order.storeId);
      if (!store || store.platform !== 'tiktokshop') {
        return res.status(400).json({ message: 'This order is not from a TikTok Shop store' });
      }

      const creds = store.credentials as any;
      const { getShippingProviders } = await import('./marketplaces/tiktokshop');
      const providers = await getShippingProviders(creds, order.externalOrderId!);

      res.json({ providers });
    } catch (err: any) {
      console.error('[TikTok] Get shipping providers error:', err);
      res.status(500).json({ message: err.message || 'Failed to get shipping providers' });
    }
  });
  // ===== END TikTok Shop Order Sync & Tracking =====

  // ===== END Amazon SP-API OAuth =====

  app.get('/security-policy', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>DropandSell - Information Security Policy</title>
<style>
@media print { body { margin: 0.8in; } .no-print { display: none; } }
body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 800px; margin: 0 auto; padding: 40px 30px; background: #fff; }
h1 { color: #285261; font-size: 22px; border-bottom: 3px solid #285261; padding-bottom: 10px; margin-bottom: 5px; }
.subtitle { color: #666; font-size: 13px; margin-bottom: 30px; }
h2 { color: #285261; font-size: 16px; margin-top: 25px; margin-bottom: 8px; border-left: 4px solid #285261; padding-left: 10px; }
p, li { font-size: 13px; margin-bottom: 6px; }
ul { padding-left: 20px; }
.section { margin-bottom: 20px; }
.footer { margin-top: 40px; padding-top: 15px; border-top: 1px solid #ccc; font-size: 11px; color: #888; }
.print-btn { background: #285261; color: #fff; border: none; padding: 12px 30px; font-size: 15px; border-radius: 6px; cursor: pointer; display: block; margin: 30px auto; }
.print-btn:hover { background: #1d3d4a; }
</style>
</head>
<body>
<h1>DropandSell Information Security Policy</h1>
<p class="subtitle">Document Version: 1.0 &nbsp;|&nbsp; Effective Date: April 2026 &nbsp;|&nbsp; Last Reviewed: April 2026<br>
Organisation: DropandSell &nbsp;|&nbsp; Website: https://dropandsell.online</p>
<div class="section"><h2>1. Purpose</h2>
<p>This policy establishes the information security framework for DropandSell, an e-commerce automation platform. It defines the security controls, practices, and responsibilities to protect customer data, seller information, and business operations from unauthorised access, disclosure, alteration, or destruction.</p></div>
<div class="section"><h2>2. Scope</h2>
<p>This policy applies to all systems, data, personnel, and third-party services involved in the operation of DropandSell, including but not limited to: the web application, databases, APIs, marketplace integrations (eBay, Shopify, Amazon, TikTok Shop), and all customer and seller data processed by the platform.</p></div>
<div class="section"><h2>3. Data Protection &amp; Encryption</h2>
<ul>
<li><strong>Encryption in Transit:</strong> All data transmitted between users, our servers, and third-party APIs is encrypted using TLS 1.2 or higher (HTTPS).</li>
<li><strong>Encryption at Rest:</strong> Sensitive data stored in our databases is encrypted at rest using AES-256 encryption provided by our cloud infrastructure.</li>
<li><strong>Data Classification:</strong> We classify data into categories (Public, Internal, Confidential, Restricted) and apply appropriate security controls based on classification level.</li>
<li><strong>API Credentials:</strong> All marketplace API keys, OAuth tokens, and secrets are stored as encrypted environment variables, never in source code or logs.</li>
</ul></div>
<div class="section"><h2>4. Access Control</h2>
<ul>
<li><strong>Principle of Least Privilege:</strong> Access to systems and data is granted on a need-to-know basis. Each team member only has access to the systems required for their role.</li>
<li><strong>Authentication:</strong> All administrative access requires strong passwords and multi-factor authentication (MFA).</li>
<li><strong>Session Management:</strong> User sessions are secured with HTTP-only cookies, automatic timeouts, and CSRF protection.</li>
<li><strong>User Data Isolation:</strong> The application enforces strict multi-tenancy — each user can only access their own data, orders, products, and store connections.</li>
</ul></div>
<div class="section"><h2>5. Network Security</h2>
<ul>
<li><strong>Infrastructure:</strong> The application is hosted on a managed cloud platform with built-in network isolation, firewall protection, and DDoS mitigation.</li>
<li><strong>Network Segregation:</strong> Application services run in isolated containers with network-level separation between components.</li>
<li><strong>Monitoring:</strong> We monitor for suspicious activity including unusual API usage patterns, failed authentication attempts, and unauthorised access attempts.</li>
<li><strong>Updates:</strong> All system dependencies, frameworks, and libraries are regularly updated to address known vulnerabilities.</li>
</ul></div>
<div class="section"><h2>6. Endpoint Security</h2>
<ul>
<li>All company devices used for development and administration have endpoint protection software installed with real-time scanning enabled.</li>
<li>Automatic security updates are enabled on all company endpoints.</li>
<li>Screen locking, password complexity requirements, and encrypted storage are enforced on all devices.</li>
</ul></div>
<div class="section"><h2>7. Vulnerability &amp; Threat Management</h2>
<ul>
<li>Regular security reviews and code audits are conducted to identify and remediate vulnerabilities.</li>
<li>Dependencies are scanned for known vulnerabilities and updated promptly when patches are available.</li>
<li>Input validation and output encoding are implemented to prevent injection attacks (SQL injection, XSS, etc.).</li>
</ul></div>
<div class="section"><h2>8. Incident Response</h2>
<ul>
<li><strong>Detection:</strong> Security incidents are identified through monitoring, user reports, and automated alerting.</li>
<li><strong>Response:</strong> Incidents are investigated promptly with defined escalation procedures.</li>
<li><strong>Notification:</strong> Affected users, partners, and regulatory authorities are notified in accordance with applicable data protection regulations (UK GDPR).</li>
<li><strong>Remediation:</strong> Root cause analysis is performed and corrective measures are implemented to prevent recurrence.</li>
</ul></div>
<div class="section"><h2>9. Data Retention &amp; Deletion</h2>
<ul>
<li>Customer data is retained only for as long as necessary to provide the service.</li>
<li>Upon account deletion or contract termination, all associated customer data is securely deleted within 30 days.</li>
<li>We honour data subject access requests (DSARs) and deletion requests in compliance with UK GDPR.</li>
</ul></div>
<div class="section"><h2>10. Third-Party Integrations</h2>
<ul>
<li>All third-party marketplace integrations (eBay, Shopify, Amazon, TikTok Shop) use official OAuth 2.0 authentication flows.</li>
<li>API tokens are refreshed automatically and stored securely.</li>
<li>We only request the minimum permissions (scopes) required for the integration to function.</li>
</ul></div>
<div class="section"><h2>11. Privacy Compliance</h2>
<ul>
<li>We maintain a regularly updated privacy policy available at https://dropandsell.online/privacy-policy.</li>
<li>Data processing activities comply with UK GDPR and applicable data protection laws.</li>
<li>We assist sellers and platform partners with data deletion, update, and access requests upon receipt.</li>
</ul></div>
<div class="section"><h2>12. Policy Review</h2>
<p>This policy is reviewed and updated at least annually, or whenever significant changes to the platform, infrastructure, or regulatory requirements occur.</p></div>
<div class="footer"><p><strong>DropandSell</strong> &nbsp;|&nbsp; https://dropandsell.online &nbsp;|&nbsp; dropandsellauth@gmail.com<br>
This document is confidential and intended for compliance review purposes.</p></div>
<button class="print-btn no-print" onclick="window.print()">Save as PDF / Print</button>
</body></html>`);
  });

  app.get('/privacy-policy', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Privacy Policy - DropandSell Automation App</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; color: #1a3540; line-height: 1.7; background: #f5f8fa; }
  h1 { color: #285261; border-bottom: 2px solid #285261; padding-bottom: 12px; }
  h2 { color: #285261; margin-top: 32px; }
  h3 { color: #3a7a8c; }
  .updated { color: #666; font-size: 14px; }
</style>
</head>
<body>
<h1>Privacy Policy</h1>
<p class="updated">Last updated: April 2, 2026</p>

<p>DropandSell Automation App ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our dropshipping automation platform and browser extension.</p>

<h2>1. Information We Collect</h2>
<h3>Account Information</h3>
<p>When you register, we collect your name, email address, and account credentials. This information is necessary to create and manage your account.</p>

<h3>Store and Marketplace Data</h3>
<p>When you connect marketplace accounts, we store API credentials (encrypted) to sync orders, publish products, and manage your listings on your behalf.</p>

<h3>Product Data</h3>
<p>Product information you import or create, including titles, descriptions, images, prices, SKUs, and vendor details.</p>

<h3>Browser Extension Data</h3>
<p>Our browser extension collects product information from vendor web pages only when you actively click the import button. It does not track browsing history, collect personal data, or run in the background. Data collected is limited to product details (title, price, images, description, variations) on the page you choose to import from.</p>

<h3>Usage Data</h3>
<p>We may collect information about how you interact with our platform to improve our services, including pages visited and features used.</p>

<h2>2. How We Use Your Information</h2>
<ul>
<li>To provide, maintain, and improve our dropshipping automation services</li>
<li>To sync orders and products between your connected marketplace accounts</li>
<li>To process transactions and manage your wallet balance</li>
<li>To send important service notifications and updates</li>
<li>To provide customer support</li>
<li>To detect and prevent fraud or abuse</li>
</ul>

<h2>3. Data Storage and Security</h2>
<p>Your data is stored securely using industry-standard encryption. API credentials for connected marketplaces are encrypted at rest. We use HTTPS for all data transmission. Access to user data is restricted to authorized personnel only.</p>

<h2>4. Data Sharing</h2>
<p>We do not sell, trade, or rent your personal information to third parties. We may share data only:</p>
<ul>
<li>With marketplace platforms you have explicitly connected (to fulfill orders, sync products, etc.)</li>
<li>With payment processors to handle subscription billing</li>
<li>When required by law or to protect our legal rights</li>
</ul>

<h2>5. Your Rights</h2>
<p>You have the right to:</p>
<ul>
<li>Access your personal data</li>
<li>Correct inaccurate data</li>
<li>Request deletion of your data</li>
<li>Export your data</li>
<li>Withdraw consent for data processing</li>
<li>Disconnect marketplace accounts at any time</li>
</ul>

<h2>6. Cookies</h2>
<p>We use essential cookies for authentication and session management. These are necessary for the platform to function and cannot be disabled.</p>

<h2>7. Data Retention</h2>
<p>We retain your data for as long as your account is active. If you delete your account, we will remove your personal data within 30 days, except where retention is required by law.</p>

<h2>8. Children's Privacy</h2>
<p>Our service is not intended for individuals under the age of 18. We do not knowingly collect personal information from children.</p>

<h2>9. Changes to This Policy</h2>
<p>We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the updated policy on this page with a revised date.</p>

<h2>10. Contact Us</h2>
<p>If you have questions about this Privacy Policy, please contact us at <strong>support@dropandsell.co.uk</strong>.</p>
</body>
</html>`);
  });

  app.get('/faq', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>FAQ - DropandSell Automation App</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; color: #1a3540; line-height: 1.7; background: #f5f8fa; }
  h1 { color: #285261; border-bottom: 2px solid #285261; padding-bottom: 12px; }
  h2 { color: #285261; margin-top: 32px; }
  h3 { color: #3a7a8c; margin-top: 20px; }
  .faq-item { margin-bottom: 24px; }
  .faq-item p { margin: 8px 0; }
</style>
</head>
<body>
<h1>Frequently Asked Questions</h1>

<div class="faq-item">
<h3>What is DropandSell?</h3>
<p>DropandSell is a dropshipping automation platform that helps you import products from vendor websites, manage inventory, list on marketplaces like eBay, Shopify, Amazon, and TikTok Shop, and automate order fulfillment.</p>
</div>

<div class="faq-item">
<h3>How does the Chrome extension work?</h3>
<p>Install the DropandSell extension from the <strong>Chrome Web Store</strong> (a one-click "Add to Chrome" install), pin the icon in your browser toolbar, then click the icon and tap <strong>"Sign in with DropandSell"</strong>. The extension links to your account automatically — you don't need to enter an API key, URL code, or anything else. After that, visit any supported vendor or supplier product page, click the icon, and hit <strong>"Import Product"</strong>. The extension automatically captures the product title, price, images, description, and variations, then sends them to your DropandSell store.</p>
<p>If you can't use the Chrome Web Store, you can also install manually from the dashboard under <em>Settings &rarr; Advanced — Manual Setup</em>.</p>
</div>

<div class="faq-item">
<h3>What marketplaces are supported?</h3>
<p>DropandSell currently supports eBay, Shopify, Amazon, TikTok Shop, and Jumia. You can connect multiple stores and manage all your listings from one dashboard.</p>
</div>

<div class="faq-item">
<h3>How do I connect my eBay/Shopify store?</h3>
<p>Go to the Stores page in your dashboard and click "Add Store." Select your marketplace platform and follow the authorisation steps to connect your account.</p>
</div>

<div class="faq-item">
<h3>Is there a free trial?</h3>
<p>New users can explore the platform during registration. Paid plans start from the Starter Plan, which includes up to 2 connected stores and full access to product importing and order management features.</p>
</div>

<div class="faq-item">
<h3>How does order fulfillment work?</h3>
<p>When an order comes in from your connected store, DropandSell matches it with the vendor product. You can then use the fulfillment wizard to place the order with your supplier and automatically sync tracking information back to the marketplace.</p>
</div>

<div class="faq-item">
<h3>Can I import products from any website?</h3>
<p>Yes, the extension works on most vendor and supplier websites. It scrapes product details directly from the page you are viewing. For best results, make sure you are on the individual product page.</p>
</div>

<div class="faq-item">
<h3>How do I contact support?</h3>
<p>You can reach us at <strong>support@dropandsell.co.uk</strong> or use the Suggestions feature inside the app to report issues or request improvements.</p>
</div>

<div class="faq-item">
<h3>What is the referral programme?</h3>
<p>Share your unique referral link with others. When they sign up and subscribe, you earn bonus store slots and other rewards. Check the Referrals page in your dashboard for your link and stats.</p>
</div>

</body>
</html>`);
  });

  app.get('/api/extension/version', (req, res) => {
    res.json({
      version: '2.3.5',
      updateRequired: false,
      changelog: 'Improved: product imports now grab ALL of the supplier\'s photos, not just the main one. Many shops load their extra photos only when you hover/scroll, so previously just one image came through. Now every available photo is pulled into your listing automatically for a more professional, complete gallery.',
    });
  });

  protectedApi.post('/admin/link-referrals', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const isAdmin = user?.isAdmin === 'true';
      if (!isAdmin) return res.status(403).json({ message: 'Admin access required' });

      const { referrerEmail, referredEmails } = req.body;
      if (!referrerEmail || !referredEmails?.length) {
        return res.status(400).json({ message: 'referrerEmail and referredEmails required' });
      }

      const referrerUser = await storage.getUserByEmail(referrerEmail);
      if (!referrerUser) return res.status(404).json({ message: `Referrer ${referrerEmail} not found` });

      const results: any[] = [];
      for (const email of referredEmails) {
        const referredUser = await storage.getUserByEmail(email);
        if (!referredUser) {
          results.push({ email, status: 'not_found' });
          continue;
        }
        await storage.updateUser(referredUser.id, { referredBy: referrerUser.id });
        const existingReferral = await storage.getReferralByReferredUser(referredUser.id);
        if (!existingReferral) {
          await storage.createReferral(referrerUser.id, referredUser.id);
        }
        results.push({ email, status: 'linked', userId: referredUser.id });
      }

      res.json({ message: 'Referrals linked', referrer: referrerEmail, results });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.post('/admin/recalc-referral-wallets', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const isAdmin = user?.isAdmin === 'true';
      if (!isAdmin) return res.status(403).json({ message: 'Admin access required' });

      const { manualLinks } = req.body || {};
      if (manualLinks && Array.isArray(manualLinks)) {
        for (const link of manualLinks) {
          if (link.referrerEmail && link.referredEmails) {
            const referrerUser = await storage.getUserByEmail(link.referrerEmail);
            if (referrerUser) {
              for (const email of link.referredEmails) {
                const referredUser = await storage.getUserByEmail(email);
                if (referredUser && (!referredUser.referredBy || link.reassign)) {
                  if (link.reassign && referredUser.referredBy && referredUser.referredBy !== referrerUser.id) {
                    const oldReferral = await storage.getReferralByReferredUser(referredUser.id);
                    if (oldReferral) {
                      await db.delete(referrals).where(eq(referrals.id, oldReferral.id));
                    }
                  }
                  await storage.updateUser(referredUser.id, { referredBy: referrerUser.id });
                  const existing = await storage.getReferralByReferredUser(referredUser.id);
                  if (!existing) {
                    await storage.createReferral(referrerUser.id, referredUser.id);
                  }
                }
              }
            }
          }
        }
      }

      // Authoritative commission reconciliation: credits referrers 10% of every
      // payment their referred users have actually made (confirmed against Stripe
      // paid invoices), and corrects any balance that was previously credited for
      // payments that never happened.
      // This admin button is the explicit AUDIT path: it is the only place allowed
      // to correct balances DOWNWARD (e.g. remove old bogus credits). The scheduler
      // and webhook only ever add commission and never claw back.
      const dryRun = req.body?.dryRun === true;
      const { reconcileReferralCommissions } = await import('./referralCommission');
      const result = await reconcileReferralCommissions({ dryRun, allowDownward: true });

      res.json({
        message: dryRun
          ? 'Preview complete — no balances were changed'
          : 'Referral commissions reconciled (10% of referred users\' confirmed payments)',
        ...result,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.post('/admin/send-update-broadcast', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const freeAccess = user?.email ? FREE_ACCESS_EMAILS[user.email.toLowerCase()] : null;
      if (!freeAccess?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const verifiedUsers = await storage.getAllVerifiedUsers();
      const { sendAppUpdateEmail } = await import('./email.js');

      const host = req.headers.host || 'dropandsell.online';
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const downloadUrl = `${protocol}://${host}/api/extension/download`;

      let sent = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const u of verifiedUsers) {
        if (!u.email) continue;
        try {
          const name = u.firstName || '';
          const success = await sendAppUpdateEmail(u.email, name, downloadUrl);
          if (success) {
            sent++;
          } else {
            failed++;
            errors.push(u.email);
          }
          await new Promise(r => setTimeout(r, 200));
        } catch (err: any) {
          failed++;
          errors.push(u.email + ': ' + (err.message || 'unknown'));
        }
      }

      res.json({ success: true, totalUsers: verifiedUsers.length, sent, failed, errors: errors.slice(0, 10) });
    } catch (err: any) {
      console.error('[Admin] Broadcast email error:', err);
      res.status(500).json({ message: err.message || 'Failed to send broadcast' });
    }
  });

  protectedApi.post('/admin/send-banner-apology', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const freeAccess = user?.email ? FREE_ACCESS_EMAILS[user.email.toLowerCase()] : null;
      if (!freeAccess?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const verifiedUsers = await storage.getAllVerifiedUsers();
      const { sendExtensionBannerApologyEmail } = await import('./email.js');

      let sent = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const u of verifiedUsers) {
        if (!u.email) continue;
        try {
          const name = u.firstName || '';
          const success = await sendExtensionBannerApologyEmail(u.email, name);
          if (success) {
            sent++;
          } else {
            failed++;
            errors.push(u.email);
          }
          await new Promise(r => setTimeout(r, 200));
        } catch (err: any) {
          failed++;
          errors.push(u.email + ': ' + (err.message || 'unknown'));
        }
      }

      res.json({ success: true, totalUsers: verifiedUsers.length, sent, failed, errors: errors.slice(0, 10) });
    } catch (err: any) {
      console.error('[Admin] Banner apology broadcast error:', err);
      res.status(500).json({ message: err.message || 'Failed to send broadcast' });
    }
  });

  protectedApi.post('/admin/send-vero-update-apology', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const freeAccess = user?.email ? FREE_ACCESS_EMAILS[user.email.toLowerCase()] : null;
      if (!freeAccess?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const verifiedUsers = await storage.getAllVerifiedUsers();
      const { sendVeroUpdateApologyEmail } = await import('./email.js');

      let sent = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const u of verifiedUsers) {
        if (!u.email) continue;
        try {
          const name = u.firstName || '';
          const success = await sendVeroUpdateApologyEmail(u.email, name);
          if (success) {
            sent++;
          } else {
            failed++;
            errors.push(u.email);
          }
          await new Promise(r => setTimeout(r, 200));
        } catch (err: any) {
          failed++;
          errors.push(u.email + ': ' + (err.message || 'unknown'));
        }
      }

      res.json({ success: true, totalUsers: verifiedUsers.length, sent, failed, errors: errors.slice(0, 10) });
    } catch (err: any) {
      console.error('[Admin] VeRO apology broadcast error:', err);
      res.status(500).json({ message: err.message || 'Failed to send broadcast' });
    }
  });

  protectedApi.get('/vero-brand-aliases', async (req: any, res) => {
    try {
      const aliases = await storage.getVeroBrandAliases();
      res.json(aliases);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.post('/admin/vero-brand-aliases', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const freeAccess = user?.email ? FREE_ACCESS_EMAILS[user.email.toLowerCase()] : null;
      if (!freeAccess?.isAdmin) return res.status(403).json({ message: 'Admin access required' });
      const { canonicalBrand, alias } = req.body;
      if (!canonicalBrand || !alias) return res.status(400).json({ message: 'canonicalBrand and alias are required' });
      const created = await storage.createVeroBrandAlias(canonicalBrand, alias);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.delete('/admin/vero-brand-aliases/:id', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const freeAccess = user?.email ? FREE_ACCESS_EMAILS[user.email.toLowerCase()] : null;
      if (!freeAccess?.isAdmin) return res.status(403).json({ message: 'Admin access required' });
      await storage.deleteVeroBrandAlias(Number(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.get('/admin/vero-audit-log', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const freeAccess = user?.email ? FREE_ACCESS_EMAILS[user.email.toLowerCase()] : null;
      if (!freeAccess?.isAdmin) return res.status(403).json({ message: 'Admin access required' });
      const { targetUserId, productId, limit } = req.query;
      const logs = await storage.getVeroAuditLog(
        targetUserId as string || undefined,
        productId ? Number(productId) : undefined,
        limit ? Number(limit) : 100
      );
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.post('/admin/vero-override', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const freeAccess = user?.email ? FREE_ACCESS_EMAILS[user.email.toLowerCase()] : null;
      if (!freeAccess?.isAdmin) return res.status(403).json({ message: 'Admin access required' });
      const { productId, targetUserId, reason } = req.body;
      if (!productId || !targetUserId || !reason) return res.status(400).json({ message: 'productId, targetUserId, and reason are required' });
      const updated = await storage.setVeroOverride(productId, targetUserId, user?.email || userId, reason);
      if (!updated) return res.status(404).json({ message: 'Product not found' });
      res.json({ success: true, product: updated });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  protectedApi.post('/admin/send-addon-issue-apology', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const freeAccess = user?.email ? FREE_ACCESS_EMAILS[user.email.toLowerCase()] : null;
      if (!freeAccess?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const addonNameMap: Record<string, string> = {
        'trending-products': 'Trending Products Database',
        'price-comparison': 'Cross-Platform Price Comparison',
      };

      const allPurchases = await storage.getAllAddonPurchases();
      const activePurchases = allPurchases.filter(p => p.status === 'active');

      const userAddonMap = new Map<string, Set<string>>();
      for (const p of activePurchases) {
        if (!userAddonMap.has(p.userId)) userAddonMap.set(p.userId, new Set());
        userAddonMap.get(p.userId)!.add(addonNameMap[p.addonId] || p.addonId);
      }

      const { sendAddonIssueApologyEmail } = await import('./email.js');
      let sent = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const [uid, addonSet] of userAddonMap) {
        const u = await storage.getUser(uid);
        if (!u?.email) continue;
        try {
          const name = u.firstName || '';
          const success = await sendAddonIssueApologyEmail(u.email, name, Array.from(addonSet));
          if (success) sent++; else { failed++; errors.push(u.email); }
          await new Promise(r => setTimeout(r, 200));
        } catch (err: any) {
          failed++;
          errors.push(u.email + ': ' + (err.message || 'unknown'));
        }
      }

      res.json({ success: true, totalUsers: userAddonMap.size, sent, failed, errors: errors.slice(0, 10) });
    } catch (err: any) {
      console.error('[Admin] Addon issue apology broadcast error:', err);
      res.status(500).json({ message: err.message || 'Failed to send broadcast' });
    }
  });

  protectedApi.post('/admin/batch-update-plans', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const freeAccess = user?.email ? FREE_ACCESS_EMAILS[user.email.toLowerCase()] : null;
      if (!freeAccess?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { emails, planName } = req.body;
      if (!emails || !Array.isArray(emails) || !planName) {
        return res.status(400).json({ message: 'emails array and planName required' });
      }

      const results: any[] = [];
      for (const email of emails) {
        const targetUser = await storage.getUserByEmail(email);
        if (!targetUser) {
          results.push({ email, status: 'not_found' });
          continue;
        }

        await storage.updateUser(targetUser.id, {
          subscriptionPlan: planName,
          subscriptionStatus: 'active',
        });

        const existingSub = await storage.getSubscription(targetUser.id);
        if (existingSub) {
          await db.update(subscriptions).set({
            planName,
            status: 'active',
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          }).where(eq(subscriptions.userId, targetUser.id));
        } else {
          await db.insert(subscriptions).values({
            userId: targetUser.id,
            planName,
            status: 'active',
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          });
        }

        results.push({ email, status: 'updated', name: targetUser.firstName });
      }

      res.json({ success: true, results });
    } catch (err: any) {
      console.error('[Admin] Batch update plans error:', err);
      res.status(500).json({ message: err.message || 'Failed to update plans' });
    }
  });

  protectedApi.post('/stripe-connect/onboard', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user?.email) {
        return res.status(400).json({ message: 'Email required' });
      }

      const stripe = await getUncachableStripeClient();
      const host = req.headers.host || 'dropandsell.online';
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const baseUrl = `${protocol}://${host}`;

      let accountId = user.stripeConnectAccountId;

      if (!accountId) {
        const account = await stripe.accounts.create({
          type: 'express',
          country: 'GB',
          email: user.email,
          capabilities: {
            transfers: { requested: true },
          },
          business_type: 'individual',
          metadata: {
            userId: user.id,
            userEmail: user.email,
          },
        });
        accountId = account.id;
        await storage.updateUser(userId, { stripeConnectAccountId: accountId });
      }

      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${baseUrl}/wallet?connect=refresh`,
        return_url: `${baseUrl}/wallet?connect=complete`,
        type: 'account_onboarding',
      });

      res.json({ success: true, url: accountLink.url });
    } catch (err: any) {
      console.error('[Stripe Connect] Onboard error:', err);
      res.status(500).json({ message: err.message || 'Failed to start onboarding' });
    }
  });

  // Lets a user who has already finished Stripe Connect onboarding open a
  // Stripe-hosted form to UPDATE their existing details — primarily bank
  // account / sort code / account number, but also name, address, etc.
  // This uses Stripe's `account_update` link type, which (unlike
  // `account_onboarding`) allows editing fields that have already been
  // submitted. Only available once the account is verified — earlier
  // states should still go through onboarding.
  protectedApi.post('/stripe-connect/update', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user?.stripeConnectAccountId) {
        return res.status(400).json({
          message: 'No payout account on file yet. Please complete Stripe setup first.',
        });
      }

      const stripe = await getUncachableStripeClient();
      const host = req.headers.host || 'dropandsell.online';
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const baseUrl = `${protocol}://${host}`;

      const accountLink = await stripe.accountLinks.create({
        account: user.stripeConnectAccountId,
        refresh_url: `${baseUrl}/wallet?connect=refresh`,
        return_url: `${baseUrl}/wallet?connect=updated`,
        type: 'account_update',
      });

      res.json({ success: true, url: accountLink.url });
    } catch (err: any) {
      console.error('[Stripe Connect] Update error:', err);
      res.status(500).json({ message: err.message || 'Failed to open update form' });
    }
  });

  protectedApi.get('/stripe-connect/status', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user?.stripeConnectAccountId) {
        return res.json({ connected: false, status: 'not_started' });
      }

      const stripe = await getUncachableStripeClient();
      const account = await stripe.accounts.retrieve(user.stripeConnectAccountId);

      const chargesEnabled = account.charges_enabled;
      const payoutsEnabled = account.payouts_enabled;
      const detailsSubmitted = account.details_submitted;

      let status = 'pending';
      if (payoutsEnabled && detailsSubmitted) {
        status = 'verified';
      } else if (detailsSubmitted && !payoutsEnabled) {
        status = 'under_review';
      } else {
        status = 'incomplete';
      }

      res.json({
        connected: true,
        status,
        payoutsEnabled,
        chargesEnabled,
        detailsSubmitted,
        accountId: user.stripeConnectAccountId,
      });
    } catch (err: any) {
      console.error('[Stripe Connect] Status error:', err);
      res.status(500).json({ message: err.message || 'Failed to check status' });
    }
  });

  protectedApi.post('/admin/send-withdrawal-process-broadcast', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const freeAccess = user?.email ? FREE_ACCESS_EMAILS[user.email.toLowerCase()] : null;
      if (!freeAccess?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const verifiedUsers = await storage.getAllVerifiedUsers();
      const { sendWithdrawalProcessEmail } = await import('./email.js');

      const host = req.headers.host || 'dropandsell.online';
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const walletUrl = `${protocol}://${host}/wallet`;

      let sent = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const u of verifiedUsers) {
        if (!u.email) continue;
        try {
          const name = u.firstName || '';
          const success = await sendWithdrawalProcessEmail(u.email, name, walletUrl);
          if (success) {
            sent++;
          } else {
            failed++;
            errors.push(u.email);
          }
          await new Promise(r => setTimeout(r, 200));
        } catch (err: any) {
          failed++;
          errors.push(u.email + ': ' + (err.message || 'unknown'));
        }
      }

      res.json({ success: true, totalUsers: verifiedUsers.length, sent, failed, errors: errors.slice(0, 10) });
    } catch (err: any) {
      console.error('[Admin] Withdrawal process broadcast error:', err);
      res.status(500).json({ message: err.message || 'Failed to send broadcast' });
    }
  });

  protectedApi.post('/admin/send-drosel-announcement', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const freeAccess = user?.email ? FREE_ACCESS_EMAILS[user.email.toLowerCase()] : null;
      if (!freeAccess?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const allUsers = await storage.getAllUsersWithEmail();
      const { sendDroselAnnouncementEmail } = await import('./email.js');

      let sent = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const u of allUsers) {
        if (!u.email) continue;
        try {
          const name = u.firstName || '';
          const success = await sendDroselAnnouncementEmail(u.email, name);
          if (success) {
            sent++;
          } else {
            failed++;
            errors.push(u.email);
          }
          await new Promise(r => setTimeout(r, 200));
        } catch (err: any) {
          failed++;
          errors.push(u.email + ': ' + (err.message || 'unknown'));
        }
      }

      res.json({ success: true, totalUsers: allUsers.length, sent, failed, errors: errors.slice(0, 10) });
    } catch (err: any) {
      console.error('[Admin] DROSEL announcement broadcast error:', err);
      res.status(500).json({ message: err.message || 'Failed to send broadcast' });
    }
  });

  protectedApi.post('/admin/send-no-plan-reminder-broadcast', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const freeAccess = user?.email ? FREE_ACCESS_EMAILS[user.email.toLowerCase()] : null;
      if (!freeAccess?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const targetUsers = await storage.getNonActiveNoPlanUsers();
      const { sendNoPlanReminderEmail } = await import('./email.js');

      let sent = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const u of targetUsers) {
        if (!u.email) continue;
        try {
          const name = u.firstName || '';
          const success = await sendNoPlanReminderEmail(u.email, name);
          if (success) {
            sent++;
          } else {
            failed++;
            errors.push(u.email);
          }
          await new Promise(r => setTimeout(r, 200));
        } catch (err: any) {
          failed++;
          errors.push(u.email + ': ' + (err.message || 'unknown'));
        }
      }

      res.json({ success: true, totalUsers: targetUsers.length, sent, failed, errors: errors.slice(0, 10) });
    } catch (err: any) {
      console.error('[Admin] No-plan reminder broadcast error:', err);
      res.status(500).json({ message: err.message || 'Failed to send broadcast' });
    }
  });

  protectedApi.get('/admin/withdrawal-requests', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const freeAccess = user?.email ? FREE_ACCESS_EMAILS[user.email.toLowerCase()] : null;
      if (!freeAccess?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const allWithdrawals = await db.select({
        id: transactions.id,
        walletId: transactions.walletId,
        amount: transactions.amount,
        description: transactions.description,
        status: transactions.status,
        withdrawMethod: transactions.withdrawMethod,
        adminNote: transactions.adminNote,
        processedAt: transactions.processedAt,
        createdAt: transactions.createdAt,
        userId: wallet.userId,
      })
        .from(transactions)
        .innerJoin(wallet, eq(transactions.walletId, wallet.id))
        .where(eq(transactions.type, 'referral_withdrawal'))
        .orderBy(desc(transactions.createdAt));

      const enriched = await Promise.all(allWithdrawals.map(async (w) => {
        const txUser = await storage.getUser(w.userId);
        const txWallet = await storage.getWallet(w.userId);
        return {
          ...w,
          userEmail: txUser?.email || '',
          userName: `${txUser?.firstName || ''} ${txUser?.lastName || ''}`.trim(),
          referralBalance: txWallet?.referralBalance || '0.00',
          bankAccountName: txWallet?.bankAccountName || null,
          bankAccountNumber: txWallet?.bankAccountNumber ? `****${txWallet.bankAccountNumber.slice(-4)}` : null,
          bankSortCode: txWallet?.bankSortCode ? `**-${txWallet.bankSortCode.slice(-2)}` : null,
          bankName: txWallet?.bankName || null,
          hasConnectAccount: !!txUser?.stripeConnectAccountId,
        };
      }));

      res.json(enriched);
    } catch (err: any) {
      console.error('[Admin] Get withdrawal requests error:', err);
      res.status(500).json({ message: err.message || 'Failed to fetch withdrawal requests' });
    }
  });

  protectedApi.post('/admin/withdrawal-requests/:id/approve', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const freeAccess = user?.email ? FREE_ACCESS_EMAILS[user.email.toLowerCase()] : null;
      if (!freeAccess?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const txId = parseInt(req.params.id);
      const { adminNote } = req.body || {};

      const [tx] = await db.select({
        id: transactions.id,
        walletId: transactions.walletId,
        amount: transactions.amount,
        status: transactions.status,
        withdrawMethod: transactions.withdrawMethod,
        userId: wallet.userId,
      })
        .from(transactions)
        .innerJoin(wallet, eq(transactions.walletId, wallet.id))
        .where(and(eq(transactions.id, txId), eq(transactions.type, 'referral_withdrawal')));

      if (!tx) {
        return res.status(404).json({ message: 'Withdrawal request not found' });
      }

      if (tx.status !== 'pending_approval') {
        return res.status(400).json({ message: `Cannot approve: request is already ${tx.status}` });
      }

      const withdrawAmount = Math.abs(Number(tx.amount));
      const txUser = await storage.getUser(tx.userId);
      const txWallet = await storage.getWallet(tx.userId);

      if (!txWallet) {
        return res.status(400).json({ message: 'User wallet not found' });
      }

      const currentBalance = Number(txWallet.referralBalance);
      if (currentBalance < withdrawAmount) {
        return res.status(400).json({ message: `Insufficient balance. User has £${currentBalance.toFixed(2)} but withdrawal is £${withdrawAmount.toFixed(2)}` });
      }

      if (!txUser?.stripeConnectAccountId) {
        return res.status(400).json({ message: `User ${txUser?.email} has not set up their Stripe Connect payout account. They need to complete onboarding from their Wallet page first.` });
      }

      let stripePayoutId: string | null = null;
      let stripeError: string | null = null;

      try {
        const stripe = await getUncachableStripeClient();

        const account = await stripe.accounts.retrieve(txUser.stripeConnectAccountId);
        if (!account.payouts_enabled) {
          return res.status(400).json({ message: `User ${txUser.email}'s Stripe Connect account is not fully verified yet. Payouts are not enabled.` });
        }

        const transfer = await stripe.transfers.create({
          amount: Math.round(withdrawAmount * 100),
          currency: 'gbp',
          destination: txUser.stripeConnectAccountId,
          description: `Referral withdrawal for ${txUser.email}`,
          metadata: {
            transactionId: String(tx.id),
            userId: tx.userId,
            userEmail: txUser.email || '',
          },
        }, {
          idempotencyKey: `withdrawal-transfer-${tx.id}`,
        });
        stripePayoutId = transfer.id;
      } catch (stripeErr: any) {
        stripeError = stripeErr.message;
        console.error('[Admin] Stripe Connect transfer error:', stripeErr.message);
      }

      if (!stripePayoutId) {
        await db.update(transactions)
          .set({
            status: 'payout_failed',
            adminNote: adminNote || `Stripe payout failed: ${stripeError || 'Unknown error'}`,
            processedAt: new Date(),
          })
          .where(eq(transactions.id, txId));

        return res.status(400).json({
          message: `Stripe payout failed: ${stripeError || 'Unknown error'}. User balance was NOT deducted. The request has been marked as failed — the user can submit a new one.`,
        });
      }

      await db.update(wallet)
        .set({
          referralBalance: sql`GREATEST(0, ${wallet.referralBalance} - ${withdrawAmount}::numeric)`,
          updatedAt: new Date(),
        })
        .where(eq(wallet.userId, tx.userId));

      await db.update(transactions)
        .set({
          status: 'approved',
          adminNote: adminNote || `Approved. Stripe payout: ${stripePayoutId}`,
          processedAt: new Date(),
          referenceId: stripePayoutId,
        })
        .where(eq(transactions.id, txId));

      res.json({
        success: true,
        message: `Withdrawal of £${withdrawAmount.toFixed(2)} approved for ${txUser?.email}. Stripe payout: ${stripePayoutId}`,
        stripePayoutId,
      });
    } catch (err: any) {
      console.error('[Admin] Approve withdrawal error:', err);
      res.status(500).json({ message: err.message || 'Failed to approve withdrawal' });
    }
  });

  protectedApi.post('/admin/withdrawal-requests/:id/reject', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const freeAccess = user?.email ? FREE_ACCESS_EMAILS[user.email.toLowerCase()] : null;
      if (!freeAccess?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const txId = parseInt(req.params.id);
      const { adminNote } = req.body || {};

      const [tx] = await db.select({
        id: transactions.id,
        status: transactions.status,
      })
        .from(transactions)
        .where(and(eq(transactions.id, txId), eq(transactions.type, 'referral_withdrawal')));

      if (!tx) {
        return res.status(404).json({ message: 'Withdrawal request not found' });
      }

      if (tx.status !== 'pending_approval') {
        return res.status(400).json({ message: `Cannot reject: request is already ${tx.status}` });
      }

      await db.update(transactions)
        .set({
          status: 'rejected',
          adminNote: adminNote || 'Rejected by admin',
          processedAt: new Date(),
        })
        .where(eq(transactions.id, txId));

      res.json({ success: true, message: 'Withdrawal request rejected' });
    } catch (err: any) {
      console.error('[Admin] Reject withdrawal error:', err);
      res.status(500).json({ message: err.message || 'Failed to reject withdrawal' });
    }
  });

  app.get('/api/extension/download', async (req: any, res) => {
    const cwd = process.cwd();
    const extensionDir = path.join(cwd, 'extension');

    if (!fs.existsSync(extensionDir)) {
      return res.status(404).json({ message: 'Extension files not found.' });
    }

    try {
      const archiver = (await import('archiver')).default;
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="dropandsell-extension.zip"');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.on('error', (err: any) => {
        res.status(500).json({ message: 'Failed to create extension zip.' });
      });
      archive.pipe(res);
      archive.directory(extensionDir, false);
      await archive.finalize();
    } catch (err: any) {
      if (!res.headersSent) {
        res.status(500).json({ message: 'Failed to create extension download.' });
      }
    }
  });

  // === EXTENSION API (API Key + Unique URL authenticated) ===
  // Must be registered before protectedApi to avoid session auth blocking API key auth
  const extensionApi: Router = express.Router();

  extensionApi.use(async (req: any, res, next) => {
    try {
      const apiKey = req.headers['x-api-key'];
      const uniqueUrlCode = req.headers['x-unique-url'];
      
      if (!apiKey) {
        return res.status(401).json({ message: 'API key required' });
      }
      
      if (!uniqueUrlCode) {
        return res.status(401).json({ message: 'Unique URL code required' });
      }
      
      const user = await storage.getUserByApiKey(apiKey as string);
      if (!user) {
        return res.status(401).json({ message: 'Invalid API key' });
      }
      
      const normalizedUniqueUrl = (uniqueUrlCode as string).toLowerCase().trim();
      if (user.uniqueUrl?.toLowerCase() !== normalizedUniqueUrl) {
        return res.status(401).json({ message: 'Invalid unique URL code' });
      }
      
      req.user = user;
      next();
    } catch (err: any) {
      console.error('Extension auth middleware error:', err?.message || err);
      return res.status(500).json({ message: 'Authentication error: ' + (err?.message || 'Unknown error') });
    }
  });

  extensionApi.post('/verify', async (req: any, res) => {
    try {
      res.json({ success: true, user: { id: req.user.id, email: req.user.email } });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Verification failed' });
    }
  });

  extensionApi.get('/vendors', async (req: any, res) => {
    try {
      const vendors = await storage.getVendors(req.user.id);
      res.json(vendors);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to get vendors' });
    }
  });

  extensionApi.post('/generate-description', async (req: any, res) => {
    try {
      const bodySchema = z.object({
        productTitle: z.string().min(1, 'Product title is required').max(500),
        vendorName: z.string().max(200).optional().default(''),
        costPrice: z.string().max(50).optional().default(''),
      });
      
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || 'Invalid request body' });
      }
      
      const { productTitle, vendorName, costPrice } = parsed.data;

      const prompt = `Generate a compelling e-commerce product description for the following product:

Product Title: ${productTitle}
${vendorName ? `Vendor/Brand: ${vendorName}` : ''}
${costPrice ? `Price Range: £${costPrice}` : ''}

Write a professional, SEO-optimized product description that:
1. Highlights key features and benefits
2. Uses persuasive language to encourage purchases
3. Is between 100-200 words
4. Includes relevant keywords for marketplace search
5. Maintains a professional yet engaging tone

Return only the description text, no additional formatting.`;

      console.log('Extension AI Description - Starting generation for:', productTitle);
      
      const response = await openai.chat.completions.create({
        model: 'gpt-5-mini',
        messages: [{ role: 'user', content: prompt }],
        max_completion_tokens: 1024,
      });

      let description = response.choices[0]?.message?.content || '';
      
      if (!description || description.trim().length < 50) {
        description = `Discover the ${productTitle}${vendorName ? ` from ${vendorName}` : ''} - a premium quality product designed for modern needs. This item combines exceptional quality with outstanding value. Features include premium construction, reliable performance, and excellent durability. Whether for personal use or as a gift, this product delivers on its promise of quality and satisfaction. Order today and experience the difference quality makes.`;
      }
      
      res.json({ description: description.trim() });
    } catch (err: any) {
      console.error('Extension AI description error:', err?.message || err);
      res.status(500).json({ message: 'Failed to generate description: ' + (err?.message || 'Unknown error') });
    }
  });

  // ============================================================
  // VENDOR STOCK TRACKING via extension (browser-trusted source)
  // The extension runs in the user's authenticated browser session
  // on Amazon/eBay/AliExpress, so it bypasses the bot detection
  // that frequently breaks our server-side scraper. Signals from
  // here are treated as ground truth (see applyTrustedStockUpdate).
  // ============================================================
  extensionApi.post('/vendor-stock-report', async (req: any, res) => {
    try {
      const bodySchema = z.object({
        reports: z.array(z.object({
          sourceUrl: z.string().url().max(2048),
          inStock: z.boolean(),
          quantity: z.number().int().min(0).max(1000000).nullable().optional(),
          currentPrice: z.number().positive().max(1000000).nullable().optional(),
          currency: z.string().max(8).optional(),
        })).min(1).max(50),
      });
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || 'Invalid request body' });
      }
      const userId = req.user.id;
      const products = await storage.getProducts(userId);

      // Build TWO indices so we can fall back to vendor product ID matching
      // when URL forms drift (e.g. amazon.co.uk/dp/X vs amazon.de/dp/X for
      // the same ASIN, or eBay /itm/slug/ID vs /itm/ID).
      const productByUrl = new Map<string, any[]>();
      const productByVendorKey = new Map<string, any[]>();
      for (const p of products) {
        const attrs = (p.attributes || {}) as Record<string, any>;
        if (!attrs.sourceUrl) continue;
        const urlKey = normalizeVendorUrl(attrs.sourceUrl);
        const urlArr = productByUrl.get(urlKey) || [];
        urlArr.push(p);
        productByUrl.set(urlKey, urlArr);
        const vendorKey = extractVendorProductKey(attrs.sourceUrl);
        if (vendorKey) {
          const vArr = productByVendorKey.get(vendorKey) || [];
          vArr.push(p);
          productByVendorKey.set(vendorKey, vArr);
        }
      }

      let matchedCount = 0;
      const updates: { productId: number; title: string; matched: boolean; vendorStock?: any; priceUpdate?: any }[] = [];

      for (const report of parsed.data.reports) {
        let matches = productByUrl.get(normalizeVendorUrl(report.sourceUrl)) || [];
        if (matches.length === 0) {
          // Fallback: try by vendor product ID
          const vendorKey = extractVendorProductKey(report.sourceUrl);
          if (vendorKey) {
            matches = productByVendorKey.get(vendorKey) || [];
          }
        }
        if (matches.length === 0) {
          updates.push({ productId: -1, title: report.sourceUrl, matched: false });
          continue;
        }
        for (const product of matches) {
          const attrs = (product.attributes || {}) as Record<string, any>;
          // Don't trust extension reports for products with manual override.
          if (attrs.vendorStockManualOverride === true) {
            updates.push({ productId: product.id, title: product.title, matched: false });
            continue;
          }
          attrs.vendorStock = applyTrustedStockUpdate(attrs.vendorStock, {
            inStock: report.inStock,
            quantity: report.quantity ?? null,
            currentPrice: report.currentPrice ?? null,
          });
          let priceUpdate: any = null;
          if (report.currentPrice && report.currentPrice > 0) {
            attrs.vendorStock.currentPrice = report.currentPrice;
            try {
              priceUpdate = await syncPriceAndUpdateListings(product, userId, report.currentPrice, attrs);
            } catch (priceErr: any) {
              console.error(`[ExtensionStockReport] price sync failed for product ${product.id}:`, priceErr?.message || priceErr);
            }
          }
          await storage.updateProduct(product.id, userId, { attributes: attrs });
          matchedCount++;
          updates.push({ productId: product.id, title: product.title, matched: true, vendorStock: attrs.vendorStock, priceUpdate });
        }
      }

      console.log(`[ExtensionStockReport] User ${req.user.email}: ${parsed.data.reports.length} reports, matched ${matchedCount} product(s)`);
      res.json({ success: true, processed: parsed.data.reports.length, matched: matchedCount, updates });
    } catch (err: any) {
      console.error('[ExtensionStockReport] error:', err?.message || err);
      res.status(500).json({ message: err.message || 'Failed to report stock' });
    }
  });

  // Extension calls this to find out which of the user's products it should
  // try to silently re-check next. Highest priority = stale + low confidence.
  extensionApi.get('/stock-monitor-queue', async (req: any, res) => {
    try {
      const limit = Math.max(1, Math.min(20, Number(req.query.limit) || 5));
      const products = await storage.getProducts(req.user.id);
      const now = Date.now();
      const items = products
        .map((p: any) => {
          const attrs = (p.attributes || {}) as Record<string, any>;
          if (!attrs.sourceUrl) return null;
          if (attrs.vendorStockManualOverride === true) return null;
          const vs = attrs.vendorStock || {};
          const lastChecked = vs.lastChecked ? new Date(vs.lastChecked).getTime() : 0;
          const ageHours = lastChecked > 0 ? (now - lastChecked) / 3600000 : 9999;
          const failedCount = Number(vs.failedScrapeCount) || 0;
          const lowConf = (vs.confidence === 'low') ? 1000 : (vs.confidence === 'medium' ? 200 : 0);
          const paused = vs.autoPaused === true ? 5000 : 0;
          const priority = paused + lowConf + failedCount * 100 + ageHours;
          return {
            productId: p.id,
            title: p.title,
            sourceUrl: attrs.sourceUrl,
            vendor: attrs.vendorType || '',
            lastChecked: vs.lastChecked || null,
            confidence: vs.confidence || 'unknown',
            autoPaused: vs.autoPaused === true,
            priority,
          };
        })
        .filter((x: any) => x !== null)
        .sort((a: any, b: any) => b.priority - a.priority)
        .slice(0, limit)
        .map(({ priority, ...rest }: any) => rest);

      res.json({ items });
    } catch (err: any) {
      console.error('[ExtensionStockQueue] error:', err?.message || err);
      res.status(500).json({ message: err.message || 'Failed to get monitor queue' });
    }
  });

  extensionApi.post('/import', async (req: any, res) => {
    try {
      const { name, description, costPrice, sellingPrice, sku, stockQuantity, vendorName, vendorType, imageUrl, imageUrls, sourceUrl, deliveryType, deliveryCost, markupPercent, variations, vendorStock } = req.body;
      
      if (!name) {
        return res.status(400).json({ message: 'Product name is required' });
      }
      
      // Auto-detect/create vendor from website URL
      let vendorId: number | null = null;
      
      // Extract and normalize hostname from sourceUrl
      let vendorHostname = '';
      let vendorOrigin = '';
      if (sourceUrl) {
        try {
          const url = new URL(sourceUrl);
          vendorHostname = url.hostname.replace(/^www\./, '').toLowerCase();
          vendorOrigin = url.origin;
        } catch (e) {
          // Invalid URL, cannot determine vendor
        }
      }
      
      const supportedVendorTypes = ['amazon', 'aliexpress', 'ebay', 'walmart', 'etsy', 'shein'];
      const isKnownVendor = vendorType && supportedVendorTypes.includes(vendorType);
      const hasVendorInfo = vendorHostname || vendorName;
      
      if (hasVendorInfo) {
        const existingVendors = await storage.getVendors(req.user.id);
        
        // Match by hostname (normalize both sides)
        let matchedVendor = existingVendors.find(v => {
          if (v.website) {
            try {
              const existingHost = new URL(v.website).hostname.replace(/^www\./, '').toLowerCase();
              return existingHost === vendorHostname;
            } catch {
              return false;
            }
          }
          return false;
        });
        
        // If no match by website, try matching by vendor name
        if (!matchedVendor && vendorName) {
          matchedVendor = existingVendors.find(v => 
            v.name.toLowerCase() === vendorName.toLowerCase()
          );
        }
        
        if (matchedVendor) {
          vendorId = matchedVendor.id;
        } else if (vendorName || vendorHostname) {
          const derivedVendorName = vendorName || deriveVendorNameFromHostname(vendorHostname);
          const newVendor = await storage.createVendor({
            userId: req.user.id,
            name: derivedVendorName,
            website: vendorOrigin || '',
            integrationType: 'custom',
            config: { source: 'extension', vendorType: vendorType || 'unknown' },
          });
          vendorId = newVendor.id;
        }
      }
      
      const productSku = sku || 'DS-' + Date.now().toString(36).toUpperCase();
      
      const productBrand = (req.body.brand || '');
      const sanitized = await storage.sanitizeVeroContent(req.user.id, name || '', description || '', productBrand);
      const productTitle = sanitized.title;
      const productDesc = sanitized.description;
      
      const brandCheck = await storage.checkVeroBrand(req.user.id, sanitized.brand);
      const restrictedCheck = await storage.checkRestrictedViolations(req.user.id, productTitle, productDesc);
      
      let veroStatus = 'clean';
      const warnings: string[] = [];
      
      if (sanitized.removedFromTitle || sanitized.removedFromDescription) {
        warnings.push(`VeRO brand "${sanitized.detectedBrand}" auto-removed from product text`);
      }
      if (sanitized.detectedBrand && !productBrand) {
        warnings.push(`Brand auto-set to "${sanitized.brand}"`);
      }
      
      if (brandCheck.isBlocked) {
        veroStatus = 'blocked';
        warnings.push(`VERO Brand: ${brandCheck.matchedBrand} (${brandCheck.matchMethod} match)`);
      }
      if (restrictedCheck.isBlocked) {
        veroStatus = 'blocked';
        warnings.push(`Restricted: ${restrictedCheck.violations.map(v => v.keyword).join(', ')}`);
      }
      
      let productImages: string[] = [];
      if (imageUrls && Array.isArray(imageUrls) && imageUrls.length > 0) {
        productImages = imageUrls.filter((u: string) => typeof u === 'string' && u.length > 0);
      } else if (imageUrl) {
        productImages = [imageUrl];
      }
      
      const productAttributes: Record<string, any> = {};
      if (sourceUrl) productAttributes.sourceUrl = sourceUrl;
      if (markupPercent !== undefined) productAttributes.markupPercent = markupPercent;
      if (vendorType) productAttributes.vendorType = vendorType;
      if (vendorName) productAttributes.vendorName = vendorName;
      if (variations && Array.isArray(variations) && variations.length > 0) {
        productAttributes.variations = variations;
      }
      if (vendorStock !== undefined) {
        productAttributes.vendorStock = {
          quantity: typeof vendorStock === 'object' ? vendorStock.quantity : vendorStock,
          inStock: typeof vendorStock === 'object' ? vendorStock.inStock : (vendorStock > 0),
          lastChecked: new Date().toISOString(),
        };
      }

      const product = await storage.createProduct({
        userId: req.user.id,
        vendorId: vendorId,
        title: productTitle,
        brand: sanitized.brand,
        description: productDesc,
        sku: productSku,
        costPrice: costPrice || '0',
        sellingPrice: sellingPrice || '0',
        quantity: stockQuantity || 0,
        images: productImages,
        attributes: productAttributes,
        deliveryType: deliveryType || calculateDeliveryType(Number(costPrice) || 0),
        deliveryCost: deliveryCost || calculateDeliveryCost(Number(costPrice) || 0),
        veroStatus,
      });
      
      await autoCreateSkuMapping(req.user.id, product);
      res.json({ success: true, product, vendorId, veroWarnings: warnings.length > 0 ? warnings : undefined });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to import product' });
    }
  });

  // --- Drop-and-Sell extension endpoints ---
  // Approved listers can list directly into a customer's eBay store from
  // any vendor product page using the Chrome extension. Mirrors the web
  // dialog at /drop-and-sell, but with the rich vendor scrape payload
  // (variations, vendor stock, multiple images) supplied by the extension.
  extensionApi.get('/drop-and-sell/orders', async (req: any, res) => {
    try {
      const lister = req.user;
      if (!lister?.email) return res.status(403).json({ message: 'Lister account has no email — please re-link.' });
      const allFreelancers = await storage.getFreelancerProfiles();
      const callerProfile = allFreelancers.find(
        (f: any) => f.email.toLowerCase() === lister.email.toLowerCase() && f.applicationStatus === 'approved'
      );
      if (!callerProfile) return res.status(403).json({ message: 'You are not an approved Drop-and-Sell lister.' });

      const orders = await storage.getDropAndSellOrdersByFreelancer(callerProfile.id);
      const open = orders.filter(o =>
        o.paymentStatus === 'paid' &&
        ['in_progress', 'partially_completed'].includes(o.status || '') &&
        (o.progressCount || 0) < o.listingCount
      );
      const enriched = [];
      for (const order of open) {
        const requester = await storage.getUser(order.userId);
        const requesterStores = requester ? await storage.getStores(order.userId) : [];
        const allEbayStores = requesterStores.filter(s => s.platform === 'ebay' && s.status !== 'disconnected');
        const orderStoreId = (order as any).storeId as number | null | undefined;
        const ebayStores = allEbayStores.map(s => {
          const c = (s.credentials as any) || {};
          return {
            id: s.id,
            username: c.ebayUsername || s.name || null,
            ready: !!(c.authToken || c.refreshToken),
            isDefault: orderStoreId ? s.id === orderStoreId : false,
          };
        });
        ebayStores.sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));
        // Do NOT synthesize a default when none exists — for multi-store
        // customers with no pinned `order.storeId`, the lister must
        // pick explicitly. (Server's helper also refuses ambiguous calls.)
        const primary = ebayStores.find(s => s.isDefault) || (ebayStores.length === 1 ? ebayStores[0] : undefined);
        const ebayStoreReady = ebayStores.some(s => s.ready);
        enriched.push({
          orderId: order.id,
          listingCount: order.listingCount,
          progressCount: order.progressCount || 0,
          remaining: order.listingCount - (order.progressCount || 0),
          deadline: order.deadline,
          customerName: requester ? `${requester.firstName || ''} ${requester.lastName || ''}`.trim() || 'Customer' : 'Customer',
          customerEbayUsername: primary?.username || null,
          ebayStoreReady,
          // Full picker list for the extension popup (or any client).
          ebayStores,
        });
      }
      res.json(enriched);
    } catch (err: any) {
      console.error('[Extension DropAndSell] orders error:', err?.message || err);
      res.status(500).json({ message: err?.message || 'Failed to load assignments' });
    }
  });

  extensionApi.post('/drop-and-sell/import', async (req: any, res) => {
    try {
      const lister = req.user;
      if (!lister?.email) return res.status(403).json({ message: 'Lister account has no email — please re-link.' });
      const allFreelancers = await storage.getFreelancerProfiles();
      const callerProfile = allFreelancers.find(
        (f: any) => f.email.toLowerCase() === lister.email.toLowerCase() && f.applicationStatus === 'approved'
      );
      if (!callerProfile) return res.status(403).json({ message: 'You are not an approved Drop-and-Sell lister.' });

      const orderId = Number(req.body?.orderId);
      if (!Number.isFinite(orderId)) return res.status(400).json({ message: 'orderId is required' });
      const allOrders = await storage.getAllDropAndSellOrders();
      const orderRow = allOrders.find((r: any) => r.order.id === orderId);
      if (!orderRow) return res.status(404).json({ message: 'Order not found' });
      const order = orderRow.order;
      if (order.freelancerId !== callerProfile.id) {
        return res.status(403).json({ message: 'This order is not assigned to you.' });
      }
      if (order.paymentStatus !== 'paid') {
        return res.status(400).json({ message: 'Cannot list — the requester has not paid for this order yet.' });
      }
      if (!['in_progress', 'partially_completed'].includes(order.status || '')) {
        return res.status(400).json({ message: `Cannot list — order status is "${order.status}".` });
      }
      if ((order.progressCount || 0) >= order.listingCount) {
        return res.status(400).json({ message: 'This order is already fully listed.' });
      }

      const body = req.body || {};
      const vendorUrl = String(body.sourceUrl || body.vendorUrl || '').trim();
      if (!vendorUrl || !isValidVendorUrl(vendorUrl)) {
        return res.status(400).json({ message: 'A valid vendor product URL (sourceUrl) is required.' });
      }
      const title = String(body.name || body.title || '').trim();
      if (!title) return res.status(400).json({ message: 'Product title is required.' });

      let images: string[] = [];
      if (Array.isArray(body.imageUrls)) images = body.imageUrls.filter((u: any) => typeof u === 'string' && /^https?:\/\//i.test(u));
      else if (Array.isArray(body.images)) images = body.images.filter((u: any) => typeof u === 'string' && /^https?:\/\//i.test(u));
      else if (typeof body.imageUrl === 'string' && body.imageUrl) images = [body.imageUrl];
      if (!images.length) return res.status(400).json({ message: 'At least one product image is required.' });

      const sku = String(body.sku || '').trim() || ('DS-' + Date.now().toString(36).toUpperCase());
      const helperInput: ListerListingInput = {
        vendorUrl,
        title,
        description: typeof body.description === 'string' ? body.description : '',
        brand: typeof body.brand === 'string' ? body.brand : '',
        sellingPrice: String(body.sellingPrice ?? body.costPrice ?? '0'),
        costPrice: body.costPrice !== undefined ? String(body.costPrice) : undefined,
        sku,
        quantity: typeof body.stockQuantity === 'number' ? body.stockQuantity : (Number(body.stockQuantity) || 1),
        images: images.slice(0, 24),
        deliveryType: ['buyer_pays', 'seller_pays', 'free'].includes(body.deliveryType) ? body.deliveryType : 'buyer_pays',
        deliveryCost: body.deliveryCost !== undefined ? String(body.deliveryCost) : '0',
        variations: Array.isArray(body.variations) ? body.variations : undefined,
        vendorStock: body.vendorStock !== undefined ? body.vendorStock : undefined,
        storeId: body.storeId !== undefined && body.storeId !== null && Number.isFinite(Number(body.storeId)) ? Number(body.storeId) : undefined,
      };

      const result = await performListProductIntoCustomerEbay(callerProfile, order, helperInput, 'extension');
      if (!result.ok) {
        return res.status(result.status).json({ message: result.message });
      }
      const requester = await storage.getUser(order.userId);
      const customerName = requester ? `${requester.firstName || ''} ${requester.lastName || ''}`.trim() || 'Customer' : 'Customer';
      return res.json({
        success: true,
        productId: result.productId,
        externalId: result.externalId,
        listingUrl: result.listingUrl,
        progress: result.progress,
        total: result.total,
        complete: result.complete,
        customerName,
      });
    } catch (err: any) {
      console.error('[Extension DropAndSell] import error:', err?.message || err);
      res.status(500).json({ message: err?.message || 'Failed to list product' });
    }
  });

  app.use('/api/extension', extensionApi);

  app.post('/api/stripe/webhook', async (req: any, res) => {
    // Step 1 — verify the event. Signature verification needs ONLY the webhook
    // signing secret, never the Stripe API connection. This must not depend on
    // getUncachableStripeClient(): when the Stripe connection was unavailable,
    // every webhook returned 400 and Stripe eventually disabled the endpoint,
    // silently dropping real customer payment events.
    let event: any;
    try {
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (webhookSecret) {
        const sig = req.headers['stripe-signature'] as string;
        const rawBody = req.rawBody || req.body;
        event = constructVerifiedWebhookEvent(rawBody, sig, webhookSecret);
      } else if (process.env.NODE_ENV === 'production') {
        console.error('[Webhook] STRIPE_WEBHOOK_SECRET is not configured in production — rejecting unsigned webhook');
        return res.status(400).json({ message: 'Webhook signature verification required' });
      } else {
        console.warn('[Webhook] No STRIPE_WEBHOOK_SECRET — accepting unsigned webhook in development mode');
        event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      }
    } catch (sigErr: any) {
      console.error('[Stripe Webhook] Signature verification failed:', sigErr.message);
      return res.status(400).json({ error: sigErr.message });
    }

    // Step 2 — process the verified event. Internal failures return 500 so
    // Stripe retries; only signature problems above ever return 400.
    try {

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const addonId = session.metadata?.addonId;
        const userId = session.metadata?.userId;
        const planName = session.metadata?.planName;

        if (planName && userId && (session.payment_status === 'paid' || session.status === 'complete')) {
          const interval = session.metadata?.billingInterval || 'month';
          await storage.updateUser(userId, { subscriptionPlan: planName, subscriptionStatus: 'active', billingInterval: interval });
          console.log(`[Webhook] Activated subscription plan '${planName}' (${interval}ly) for user ${userId} via checkout.session.completed`);

          if (session.subscription) {
            try {
              const stripe = await getUncachableStripeClient();
              const stripeSub: any = await stripe.subscriptions.retrieve(session.subscription as string);
              const periodEndTs = stripeSub.current_period_end ?? stripeSub.items?.data?.[0]?.current_period_end;
              const periodEnd = periodEndTs ? new Date(periodEndTs * 1000) : null;
              const existingSub = await storage.getSubscription(userId);
              if (existingSub) {
                await db.update(subscriptions).set({
                  planName,
                  status: 'active',
                  stripeSubscriptionId: session.subscription as string,
                  ...(periodEnd ? { currentPeriodEnd: periodEnd } : {}),
                }).where(eq(subscriptions.userId, userId));
              } else {
                await db.insert(subscriptions).values({
                  userId,
                  planName,
                  status: 'active',
                  stripeSubscriptionId: session.subscription as string,
                  currentPeriodEnd: periodEnd || new Date(Date.now() + (interval === 'year' ? 365.25 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000)),
                });
              }
              console.log(`[Webhook] Updated subscription record with period end: ${periodEnd?.toISOString() || 'estimated'}`);
            } catch (subErr: any) {
              console.error('[Webhook] Failed to retrieve Stripe subscription details:', subErr.message);
            }
          }
        }

        if (addonId && userId && (session.payment_status === 'paid' || session.status === 'complete')) {
          const existing = await storage.getUserAddonPurchases(userId);
          if (!existing.some(p => p.addonId === addonId && p.status === 'active')) {
            await storage.createAddonPurchase(userId, addonId, session.subscription as string || session.id);
            console.log(`[Addon] Activated '${addonId}' for user ${userId} via webhook`);
          }
        }

        const dropAndSellOrderIdRaw = session.metadata?.dropAndSellOrderId;
        if (dropAndSellOrderIdRaw && userId && (session.payment_status === 'paid' || session.status === 'complete')) {
          const dasOrderId = Number(dropAndSellOrderIdRaw);
          if (Number.isFinite(dasOrderId)) {
            try {
              const existingOrder = await storage.getDropAndSellOrder(dasOrderId, userId);
              if (existingOrder && existingOrder.paymentStatus !== 'paid') {
                await storage.updateDropAndSellOrder(dasOrderId, {
                  paymentStatus: 'paid',
                  status: 'awaiting_assignment',
                  deadline: new Date(Date.now() + 168 * 60 * 60 * 1000),
                  stripeSessionId: session.id,
                });
                console.log(`[DropAndSell] Marked order ${dasOrderId} paid via webhook for user ${userId}`);
              }
            } catch (dasErr: any) {
              console.error('[DropAndSell] Webhook activation failed:', dasErr.message);
            }
          }
        }
      }

      if (event.type === 'invoice.paid') {
        const invoice = event.data.object;
        const customerId = invoice.customer as string;
        const amountPaid = (invoice.amount_paid || 0) / 100;

        if (amountPaid > 0 && customerId) {
          const user = await storage.getUserByStripeCustomerId(customerId);
          if (user) {
            if (user.subscriptionStatus !== 'active') {
              await storage.updateUser(user.id, { subscriptionStatus: 'active' });
              console.log(`[Webhook] Activated subscription for ${user.email} on invoice.paid`);
            }

            // Newer Stripe API versions moved the subscription reference from
            // invoice.subscription to invoice.parent.subscription_details.subscription
            const invoiceSubscriptionId = (invoice.subscription
              || invoice.parent?.subscription_details?.subscription) as string;
            if (invoiceSubscriptionId) {
              try {
                const stripe = await getUncachableStripeClient();
                const stripeSub: any = await stripe.subscriptions.retrieve(invoiceSubscriptionId);
                const periodEndTs = stripeSub.current_period_end ?? stripeSub.items?.data?.[0]?.current_period_end;
                const periodEnd = periodEndTs ? new Date(periodEndTs * 1000) : null;
                if (periodEnd) {
                  const existingSub = await storage.getSubscription(user.id);
                  if (existingSub) {
                    await db.update(subscriptions).set({
                      status: 'active',
                      currentPeriodEnd: periodEnd,
                    }).where(eq(subscriptions.userId, user.id));
                    console.log(`[Webhook] Updated renewal date to ${periodEnd.toISOString()} for ${user.email}`);
                  } else {
                    await db.insert(subscriptions).values({
                      userId: user.id,
                      planName: user.subscriptionPlan || 'Starter Plan',
                      status: 'active',
                      stripeSubscriptionId: invoiceSubscriptionId,
                      currentPeriodEnd: periodEnd,
                    });
                    console.log(`[Webhook] Created subscription record (renewal ${periodEnd.toISOString()}) for ${user.email}`);
                  }
                }
              } catch (subErr: any) {
                console.error('[Webhook] Failed to update period end on invoice.paid:', subErr.message);
              }
            }
          }
          if (user?.referredBy) {
            // Single authoritative writer: 10% commission is computed by
            // reconcileReferralCommissions from the referred user's actual Stripe
            // paid invoices (fully idempotent). We trigger a reconcile scoped to
            // this referred user on each real payment so the referrer's balance
            // updates immediately, without a competing accounting path.
            try {
              const before = await storage.getReferralByReferredUser(user.id);
              const wasEarning = !!before && Number(before.totalEarnings || 0) > 0;

              const { reconcileReferralCommissions } = await import('./referralCommission');
              await reconcileReferralCommissions({ referredUserId: user.id });

              const after = await storage.getReferralByReferredUser(user.id);
              const nowEarning = !!after && Number(after.totalEarnings || 0) > 0;

              if (!wasEarning && nowEarning) {
                const referrer = await storage.getUser(user.referredBy);
                if (referrer?.email) {
                  const { sendReferralActiveEmail } = await import('./email.js');
                  const referredName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || 'a user';
                  const planName = user.subscriptionPlan || 'a paid';
                  await sendReferralActiveEmail(
                    referrer.email,
                    referrer.firstName || '',
                    referredName,
                    planName
                  );
                  console.log(`[Referral] Sent active-referral email to ${referrer.email}`);
                }
              }
            } catch (refErr: any) {
              console.error('[Referral] Failed to reconcile commission on invoice.paid:', refErr.message);
            }
          }
        }
      }

      res.json({ received: true });
    } catch (err: any) {
      // Internal error on a VERIFIED event: return 500 so Stripe retries with
      // backoff. Never 400 here — persistent 4xx responses get the endpoint
      // permanently disabled by Stripe.
      console.error('[Stripe Webhook] Processing error:', err.message);
      res.status(500).json({ error: 'Internal webhook processing error' });
    }
  });

  // Register protected routes (after extension API to avoid blocking API key auth)
  app.use('/api', protectedApi);

  const { startTrendingScheduler } = await import('./trendingScheduler');
  startTrendingScheduler();

  const { startEbayOrderScheduler } = await import('./ebayOrderScheduler');
  startEbayOrderScheduler();

  const { startEbayRestockScheduler } = await import('./ebayRestockScheduler');
  startEbayRestockScheduler();

  const { startSubscriberUpdateEmailScheduler } = await import('./subscriberUpdateEmailScheduler');
  startSubscriberUpdateEmailScheduler();

  const { startPaypalPayoutScheduler } = await import('./paypalPayoutScheduler');
  startPaypalPayoutScheduler();

  const { startReferralCommissionScheduler } = await import('./referralCommissionScheduler');
  startReferralCommissionScheduler();

  const { startTrackingStatusScheduler } = await import('./trackingScheduler');
  startTrackingStatusScheduler();

  // ---- Vendor price-increase monitor (every 15 minutes) ----
  // Scans every product (across every user) that has a vendor sourceUrl, scrapes the
  // current vendor price, and if it has INCREASED, bumps cost + selling price to
  // preserve the same profit margin and pushes the new selling price to live eBay
  // listings. Vendor price drops are intentionally ignored — we never lower selling.
  const PRICE_MONITOR_INTERVAL_MS = 15 * 60 * 1000;
  let priceMonitorRunning = false;

  async function runPriceMonitorCycle() {
    if (priceMonitorRunning) {
      console.log('[price-monitor] Previous cycle still running, skipping this tick');
      return;
    }
    priceMonitorRunning = true;
    const startedAt = Date.now();
    let scanned = 0;
    let increases = 0;
    let errors = 0;
    try {
      const allUsers = await db.select({ id: users.id }).from(users);
      for (const u of allUsers) {
        let userProducts: any[];
        try {
          userProducts = await storage.getProducts(u.id);
        } catch {
          continue;
        }
        const withUrls = userProducts.filter((p: any) => {
          const a = (p.attributes || {}) as Record<string, any>;
          return typeof a.sourceUrl === 'string' && a.sourceUrl.length > 0;
        });
        for (const product of withUrls) {
          scanned++;
          try {
            const attrs = (product.attributes || {}) as Record<string, any>;
            const sourceUrl = attrs.sourceUrl as string;
            const vendor = (attrs.vendorType || '').toLowerCase();
            const stockResult = await fetchVendorStock(sourceUrl, vendor);

            attrs.vendorStock = buildVendorStockUpdate(attrs.vendorStock, stockResult);

            let priceUpdate: any = null;
            if (!stockResult.fetchFailed && stockResult.vendorPrice && stockResult.vendorPrice > 0) {
              attrs.vendorStock.currentPrice = stockResult.vendorPrice;
              priceUpdate = await syncPriceAndUpdateListings(
                product,
                u.id,
                stockResult.vendorPrice,
                attrs,
                stockResult.vendorShipping,
              );
            }

            // ---- Auto-pause safety net ----
            // If the new state is 'low confidence' (3+ failures in a row) and
            // the product hasn't already been auto-paused, end every active
            // eBay listing for this product. The helper updates `attrs` with
            // the autoPaused flag AND persists the product itself, so we skip
            // the normal storage.updateProduct below to avoid a double write.
            let pausedThisCycle = false;
            // End the eBay listing (set qty 0) when the vendor is out of stock —
            // either CONFIRMED out of stock by a successful scrape, or the scrape
            // has failed enough times that we can no longer trust the stock
            // signal ('low' confidence). Skipped once already paused; the lock is
            // lifted (and the listing auto-restocked) once the vendor is back in
            // stock again.
            const confirmedOutOfStock = !stockResult.fetchFailed && stockResult.inStock === false;
            if (
              (confirmedOutOfStock || attrs.vendorStock?.confidence === 'low') &&
              attrs.vendorStock?.autoPaused !== true
            ) {
              const result = await autoPauseListingsForFailedStock(
                product,
                u.id,
                attrs,
                confirmedOutOfStock ? 'out-of-stock' : 'failed-stock',
              );
              pausedThisCycle = result.paused;
            }

            // syncPriceAndUpdateListings only persists `attrs` when there's a
            // price/shipping change. When it returns null (no change), we still
            // need to persist the fresh inStock / lastChecked / currentPrice we
            // just merged into `attrs`. Avoid double-writing when sync already
            // wrote, or when the auto-pause path just persisted the product.
            if (!priceUpdate && !pausedThisCycle) {
              await storage.updateProduct(product.id, u.id, { attributes: attrs });
            }
            if (priceUpdate && !priceUpdate.skipped && priceUpdate.newCost > priceUpdate.oldCost) {
              increases++;
            }
          } catch (perProductErr: any) {
            errors++;
            console.warn(`[price-monitor] product ${product.id} (user ${u.id}) failed: ${perProductErr?.message || perProductErr}`);
          }
          // Small delay between products to avoid hammering vendors
          await new Promise(r => setTimeout(r, 300));
        }
      }
    } catch (err: any) {
      console.error('[price-monitor] cycle failed:', err?.message || err);
    } finally {
      priceMonitorRunning = false;
      const ms = Date.now() - startedAt;
      console.log(`[price-monitor] cycle complete in ${Math.round(ms / 1000)}s — scanned=${scanned} priceIncreases=${increases} errors=${errors}`);
    }
  }

  // First run after 60s so the server is fully warm; then every 15 minutes.
  setTimeout(() => { void runPriceMonitorCycle(); }, 60 * 1000);
  setInterval(() => { void runPriceMonitorCycle(); }, PRICE_MONITOR_INTERVAL_MS);
  console.log(`[price-monitor] started — scanning vendor prices every ${PRICE_MONITOR_INTERVAL_MS / 60000} minutes (price increases only)`);

  return httpServer;
}

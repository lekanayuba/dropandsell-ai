import { db, pool } from "../db";
import { products, vendors, stores, notifications, supplierReplacementLog } from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";

export interface ReplacementCandidate {
  vendorId: number;
  vendorName: string;
  productId: number;
  productTitle: string;
  costPrice: string;
  sellingPrice: string;
  quantity: number;
  healthScore: number | null;
  matchType: 'same_sku' | 'same_title';
  matchScore: number;
}

export interface ReplacementResult {
  replaced: boolean;
  newVendorId: number | null;
  newVendorName: string | null;
  reason: string;
}

/**
 * Find replacement suppliers for a product that's gone out of stock.
 * Searches by SKU first (exact match), then by title keywords.
 */
export async function findReplacementSuppliers(
  productId: number,
  userId: string,
): Promise<ReplacementCandidate[]> {
  const product = await db.select().from(products)
    .where(and(eq(products.id, productId), eq(products.userId, userId)))
    .limit(1)
    .then(r => r[0]);

  if (!product) return [];

  // Get all user's products with their vendor info
  const userProducts = await db.select({
    id: products.id,
    vendorId: products.vendorId,
    title: products.title,
    sku: products.sku,
    costPrice: products.costPrice,
    sellingPrice: products.sellingPrice,
    quantity: products.quantity,
  }).from(products)
    .where(eq(products.userId, userId));

  // Get all user's vendors
  const userVendors = await db.select().from(vendors)
    .where(eq(vendors.userId, userId));

  const vendorMap = new Map(userVendors.map(v => [v.id, v]));
  const sourceTitleWords = (product.title || '').toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const seen = new Set<string>();
  const results: ReplacementCandidate[] = [];

  for (const p of userProducts) {
    if (p.id === productId || !p.vendorId) continue;

    const v = vendorMap.get(p.vendorId);
    if (!v) continue;

    const key = `${p.vendorId}-${p.sku}`;
    if (seen.has(key)) continue;
    seen.add(key);

    let matchType: 'same_sku' | 'same_title' | null = null;
    let matchScore = 0;

    if (p.sku && product.sku && p.sku.toLowerCase() === product.sku.toLowerCase()) {
      matchType = 'same_sku';
      matchScore = 10;
    } else {
      const titleWords = (p.title || '').toLowerCase().split(/\s+/);
      const shared = sourceTitleWords.filter(w => titleWords.includes(w));
      if (shared.length >= 2) {
        matchType = 'same_title';
        matchScore = shared.length * 0.5;
      }
    }

    if (!matchType) continue;

    // In-stock bonus
    if (p.quantity > 0) matchScore += 3;
    // Healthy vendor bonus
    if (v.healthScore && v.healthScore >= 4) matchScore += 2;
    else if (v.healthScore && v.healthScore >= 3) matchScore += 1;

    results.push({
      vendorId: p.vendorId,
      vendorName: v.name,
      productId: p.id,
      productTitle: p.title,
      costPrice: p.costPrice,
      sellingPrice: p.sellingPrice,
      quantity: p.quantity,
      healthScore: v.healthScore,
      matchType,
      matchScore,
    });
  }

  return results.sort((a, b) => b.matchScore - a.matchScore).slice(0, 5);
}

/**
 * Auto-replace a product's supplier with the best available candidate.
 * Updates vendorId, cost price, and selling price on the product.
 */
export async function autoReplaceSupplier(
  productId: number,
  userId: string,
): Promise<ReplacementResult> {
  const product = await db.select().from(products)
    .where(and(eq(products.id, productId), eq(products.userId, userId)))
    .limit(1)
    .then(r => r[0]);

  if (!product) {
    return { replaced: false, newVendorId: null, newVendorName: null, reason: 'Product not found' };
  }

  const candidates = await findReplacementSuppliers(productId, userId);
  if (candidates.length === 0) {
    return { replaced: false, newVendorId: null, newVendorName: null, reason: 'No replacement suppliers found' };
  }

  const best = candidates[0];
  const oldVendor = product.vendorId
    ? await db.select().from(vendors).where(eq(vendors.id, product.vendorId)).limit(1).then(r => r[0])
    : null;

  await db.update(products)
    .set({
      vendorId: best.vendorId,
      costPrice: best.costPrice,
      sellingPrice: best.sellingPrice,
    })
    .where(eq(products.id, productId));

  await db.insert(supplierReplacementLog).values({
    productId: product.id,
    oldVendorId: product.vendorId,
    newVendorId: best.vendorId,
    oldVendorName: oldVendor?.name || 'Unknown',
    newVendorName: best.vendorName,
    productTitle: product.title,
    productSku: product.sku,
    reason: 'out_of_stock',
    triggeredBy: 'auto',
  });

  // Notify about supplier replacement
  await db.insert(notifications).values({
    userId,
    type: 'supplier_alert',
    title: `Supplier Replaced: ${product.title}`,
    message: `${oldVendor?.name || 'Previous supplier'} was out of stock → switched to ${best.vendorName}${product.sku ? ` (SKU: ${product.sku})` : ''}`,
  });

  return {
    replaced: true,
    newVendorId: best.vendorId,
    newVendorName: best.vendorName,
    reason: `Switched to ${best.vendorName} (${best.matchType === 'same_sku' ? 'same SKU' : 'title match'})`,
  };
}

/**
 * Batch auto-replace all out-of-stock products that have auto-switch enabled.
 */
export async function batchAutoReplaceSuppliers(userId: string): Promise<{
  total: number;
  replaced: number;
  failed: number;
  results: ReplacementResult[];
}> {
  const userProducts = await db.select().from(products)
    .where(and(eq(products.userId, userId), eq(products.quantity, 0)));

  let enabledStores: any[] = [];
  try {
    const result = await pool.query(
      `SELECT id FROM stores WHERE user_id = $1 AND auto_switch_supplier = true LIMIT 1`,
      [userId]
    );
    enabledStores = result.rows;
  } catch {
    return { total: userProducts.length, replaced: 0, failed: 0, results: [] };
  }

  if (enabledStores.length === 0) {
    return { total: userProducts.length, replaced: 0, failed: 0, results: [] };
  }

  const results: ReplacementResult[] = [];
  let replaced = 0;
  let failed = 0;

  for (const p of userProducts) {
    const result = await autoReplaceSupplier(p.id, userId);
    results.push(result);
    if (result.replaced) replaced++;
    else failed++;
  }

  return { total: userProducts.length, replaced, failed, results };
}

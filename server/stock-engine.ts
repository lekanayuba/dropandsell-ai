import { and, desc, eq } from "drizzle-orm";
import { db } from "./db";
import {
  products,
  productStockRules,
  productVendorSources,
  stockSyncEvents,
  type Product,
  type ProductStockRule,
  type ProductVendorSource,
} from "@shared/schema";

export type StockStatus = "in_stock" | "out_of_stock" | "unknown";

export interface StockEvaluation {
  productId: number;
  userId: string;
  effectiveQuantity: number;
  stockStatus: StockStatus;
  rawOutOfStock: boolean;
  shouldMarkOutOfStock: boolean;
  shouldRestock: boolean;
  oosThreshold: number;
  restockThreshold: number;
  restockQuantity: number;
  sourceCount: number;
  activeSourceCount: number;
  reason: string;
}

export interface ProductVendorSourceInput {
  vendorId: number;
  vendorSku?: string | null;
  sourceUrl?: string | null;
  isPrimary?: boolean;
  isEnabled?: boolean;
  priority?: number;
  stockQuantity?: number;
  stockStatus?: StockStatus;
  lastError?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ProductStockRuleInput {
  oosThreshold?: number;
  oosAutomationEnabled?: boolean;
  autoSwitchSupplier?: boolean;
  restockAutomationEnabled?: boolean;
  restockThreshold?: number;
  restockQuantity?: number;
  restockMode?: "fixed" | "top_up_to";
  pinnedVendorSourceId?: number | null;
}

const DEFAULT_RULE = {
  oosThreshold: 0,
  oosAutomationEnabled: true,
  autoSwitchSupplier: false,
  restockAutomationEnabled: false,
  restockThreshold: 1,
  restockQuantity: 1,
  restockMode: "fixed" as const,
  pinnedVendorSourceId: null as number | null,
};

let warnedMissingStockTables = false;

function isMissingStockTableError(err: unknown) {
  const code = (err as { code?: string })?.code;
  return code === "42P01" || String((err as Error)?.message || "").includes("product_vendor_sources");
}

function warnMissingStockTables(err: unknown) {
  if (!warnedMissingStockTables) {
    console.warn("[StockEngine] Stock automation tables unavailable; falling back to legacy product quantity.", err);
    warnedMissingStockTables = true;
  }
}

function nonNegativeInt(value: unknown, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

export function normalizeStockStatus(status: unknown, quantity: number): StockStatus {
  if (status === "in_stock" || status === "out_of_stock" || status === "unknown") {
    return status;
  }
  if (quantity > 0) return "in_stock";
  if (quantity === 0) return "out_of_stock";
  return "unknown";
}

function ruleWithDefaults(rule: ProductStockRule | null) {
  return {
    ...DEFAULT_RULE,
    ...(rule || {}),
    oosThreshold: nonNegativeInt(rule?.oosThreshold, DEFAULT_RULE.oosThreshold),
    restockThreshold: nonNegativeInt(rule?.restockThreshold, DEFAULT_RULE.restockThreshold),
    restockQuantity: Math.max(1, nonNegativeInt(rule?.restockQuantity, DEFAULT_RULE.restockQuantity)),
  };
}

function sourceEffectiveQuantity(source: ProductVendorSource, oosThreshold: number) {
  const quantity = nonNegativeInt(source.stockQuantity, 0);
  const status = normalizeStockStatus(source.stockStatus, quantity);
  if (status === "in_stock" && quantity <= oosThreshold) {
    return oosThreshold + 1;
  }
  return quantity;
}

async function getProductStockRule(userId: string, productId: number) {
  try {
    const [rule] = await db.select().from(productStockRules)
      .where(and(eq(productStockRules.userId, userId), eq(productStockRules.productId, productId)))
      .limit(1);
    return rule ?? null;
  } catch (err) {
    if (isMissingStockTableError(err)) {
      warnMissingStockTables(err);
      return null;
    }
    throw err;
  }
}

export async function getProductStockSources(userId: string, productId: number) {
  try {
    return await db.select().from(productVendorSources)
      .where(and(eq(productVendorSources.userId, userId), eq(productVendorSources.productId, productId)))
      .orderBy(desc(productVendorSources.isPrimary), desc(productVendorSources.priority));
  } catch (err) {
    if (isMissingStockTableError(err)) {
      warnMissingStockTables(err);
      return [] as ProductVendorSource[];
    }
    throw err;
  }
}

export async function getProductStockRuleForApi(userId: string, productId: number) {
  const rule = await getProductStockRule(userId, productId);
  return ruleWithDefaults(rule);
}

export async function evaluateProductStockForProduct(product: Product): Promise<StockEvaluation> {
  const userId = product.userId;
  const rule = ruleWithDefaults(await getProductStockRule(userId, product.id));
  const sources = await getProductStockSources(userId, product.id);
  const activeSources = sources.filter(source => source.isEnabled);

  const pinnedSource = rule.pinnedVendorSourceId
    ? activeSources.find(source => source.id === rule.pinnedVendorSourceId)
    : null;
  const selectedSources = pinnedSource ? [pinnedSource] : activeSources;
  const knownSources = selectedSources.filter(source => source.lastSyncedAt || source.stockStatus !== "unknown");

  let effectiveQuantity = nonNegativeInt(product.quantity, 0);
  let stockStatus = normalizeStockStatus((product.attributes as any)?.vendorStockStatus, effectiveQuantity);
  let reason = selectedSources.length > 0 ? "vendor_sources_unknown_fallback" : "legacy_product_quantity";

  if (knownSources.length > 0) {
    effectiveQuantity = selectedSources.reduce((sum, source) => sum + sourceEffectiveQuantity(source, rule.oosThreshold), 0);
    const anyInStock = selectedSources.some(source =>
      normalizeStockStatus(source.stockStatus, nonNegativeInt(source.stockQuantity, 0)) === "in_stock" ||
      sourceEffectiveQuantity(source, rule.oosThreshold) > rule.oosThreshold
    );
    const allOutOfStock = selectedSources.every(source =>
      normalizeStockStatus(source.stockStatus, nonNegativeInt(source.stockQuantity, 0)) === "out_of_stock" ||
      sourceEffectiveQuantity(source, rule.oosThreshold) <= rule.oosThreshold
    );
    stockStatus = anyInStock ? "in_stock" : allOutOfStock ? "out_of_stock" : "unknown";
    reason = pinnedSource ? "pinned_vendor_source" : "summed_enabled_vendor_sources";
  }

  const rawOutOfStock = stockStatus === "out_of_stock" || effectiveQuantity <= rule.oosThreshold;
  const shouldMarkOutOfStock = Boolean(rule.oosAutomationEnabled && rawOutOfStock);
  const shouldRestock = Boolean(
    rule.restockAutomationEnabled &&
    !rawOutOfStock &&
    effectiveQuantity <= rule.restockThreshold,
  );

  return {
    productId: product.id,
    userId,
    effectiveQuantity,
    stockStatus,
    rawOutOfStock,
    shouldMarkOutOfStock,
    shouldRestock,
    oosThreshold: rule.oosThreshold,
    restockThreshold: rule.restockThreshold,
    restockQuantity: rule.restockQuantity,
    sourceCount: sources.length,
    activeSourceCount: activeSources.length,
    reason,
  };
}

export async function evaluateProductStock(userId: string, productId: number) {
  const [product] = await db.select().from(products)
    .where(and(eq(products.userId, userId), eq(products.id, productId)))
    .limit(1);
  if (!product) return null;
  return evaluateProductStockForProduct(product);
}

export async function upsertProductStockRule(userId: string, productId: number, input: ProductStockRuleInput) {
  const payload = {
    oosThreshold: input.oosThreshold !== undefined ? nonNegativeInt(input.oosThreshold, DEFAULT_RULE.oosThreshold) : undefined,
    oosAutomationEnabled: input.oosAutomationEnabled,
    autoSwitchSupplier: input.autoSwitchSupplier,
    restockAutomationEnabled: input.restockAutomationEnabled,
    restockThreshold: input.restockThreshold !== undefined ? nonNegativeInt(input.restockThreshold, DEFAULT_RULE.restockThreshold) : undefined,
    restockQuantity: input.restockQuantity !== undefined ? Math.max(1, nonNegativeInt(input.restockQuantity, DEFAULT_RULE.restockQuantity)) : undefined,
    restockMode: input.restockMode,
    pinnedVendorSourceId: input.pinnedVendorSourceId,
    updatedAt: new Date(),
  };
  const cleanPayload = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));

  const existing = await getProductStockRule(userId, productId);
  if (existing) {
    const [updated] = await db.update(productStockRules)
      .set(cleanPayload)
      .where(and(eq(productStockRules.userId, userId), eq(productStockRules.productId, productId)))
      .returning();
    return updated;
  }

  const [created] = await db.insert(productStockRules)
    .values({
      userId,
      productId,
      ...DEFAULT_RULE,
      ...cleanPayload,
    })
    .returning();
  return created;
}

export async function upsertProductVendorSource(userId: string, productId: number, input: ProductVendorSourceInput) {
  const stockQuantity = input.stockQuantity !== undefined ? nonNegativeInt(input.stockQuantity, 0) : undefined;
  const stockStatus = input.stockStatus !== undefined
    ? normalizeStockStatus(input.stockStatus, stockQuantity ?? 0)
    : stockQuantity !== undefined
      ? normalizeStockStatus(undefined, stockQuantity)
      : undefined;

  if (input.isPrimary) {
    await db.update(productVendorSources)
      .set({ isPrimary: false, updatedAt: new Date() })
      .where(and(eq(productVendorSources.userId, userId), eq(productVendorSources.productId, productId)));
  }

  const existing = await db.select().from(productVendorSources)
    .where(and(
      eq(productVendorSources.userId, userId),
      eq(productVendorSources.productId, productId),
      eq(productVendorSources.vendorId, input.vendorId),
    ))
    .limit(1)
    .then(rows => rows[0]);

  const payload = {
    vendorSku: input.vendorSku,
    sourceUrl: input.sourceUrl,
    isPrimary: input.isPrimary,
    isEnabled: input.isEnabled,
    priority: input.priority,
    stockQuantity,
    stockStatus,
    lastSyncedAt: stockQuantity !== undefined || stockStatus !== undefined ? new Date() : undefined,
    lastError: input.lastError,
    metadata: input.metadata,
    updatedAt: new Date(),
  };
  const cleanPayload = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));

  let source: ProductVendorSource;
  if (existing) {
    [source] = await db.update(productVendorSources)
      .set(cleanPayload)
      .where(eq(productVendorSources.id, existing.id))
      .returning();
    if (stockQuantity !== undefined || stockStatus !== undefined) {
      await recordStockSyncEvent({
        userId,
        productId,
        vendorId: source.vendorId,
        vendorSourceId: source.id,
        oldQuantity: existing.stockQuantity,
        newQuantity: source.stockQuantity,
        oldStatus: existing.stockStatus,
        newStatus: source.stockStatus,
        action: "vendor_stock_update",
        reason: "source_upsert",
        triggeredBy: "user",
      });
    }
  } else {
    [source] = await db.insert(productVendorSources)
      .values({
        userId,
        productId,
        vendorId: input.vendorId,
        vendorSku: input.vendorSku ?? null,
        sourceUrl: input.sourceUrl ?? null,
        isPrimary: Boolean(input.isPrimary),
        isEnabled: input.isEnabled !== false,
        priority: input.priority ?? 0,
        stockQuantity: stockQuantity ?? 0,
        stockStatus: stockStatus ?? "unknown",
        lastSyncedAt: stockQuantity !== undefined || stockStatus !== undefined ? new Date() : null,
        lastError: input.lastError ?? null,
        metadata: input.metadata ?? null,
      })
      .returning();
    await recordStockSyncEvent({
      userId,
      productId,
      vendorId: source.vendorId,
      vendorSourceId: source.id,
      oldQuantity: null,
      newQuantity: source.stockQuantity,
      oldStatus: null,
      newStatus: source.stockStatus,
      action: "vendor_stock_update",
      reason: "source_created",
      triggeredBy: "user",
    });
  }

  return source;
}

export async function updateProductVendorSource(
  userId: string,
  productId: number,
  sourceId: number,
  input: Partial<ProductVendorSourceInput>,
) {
  const [existing] = await db.select().from(productVendorSources)
    .where(and(
      eq(productVendorSources.userId, userId),
      eq(productVendorSources.productId, productId),
      eq(productVendorSources.id, sourceId),
    ))
    .limit(1);

  if (!existing) return null;

  const next = await upsertProductVendorSource(userId, productId, {
    vendorId: existing.vendorId,
    vendorSku: input.vendorSku,
    sourceUrl: input.sourceUrl,
    isPrimary: input.isPrimary,
    isEnabled: input.isEnabled,
    priority: input.priority,
    stockQuantity: input.stockQuantity,
    stockStatus: input.stockStatus,
    lastError: input.lastError,
    metadata: input.metadata,
  });
  return next;
}

export async function applyStockEvaluationToProduct(userId: string, productId: number) {
  const [product] = await db.select().from(products)
    .where(and(eq(products.userId, userId), eq(products.id, productId)))
    .limit(1);
  if (!product) return { applied: false, evaluation: null };

  const evaluation = await evaluateProductStockForProduct(product);
  const attrs = (product.attributes as Record<string, unknown>) || {};

  if (attrs.vendorStockManual === true || evaluation.activeSourceCount === 0 || evaluation.stockStatus === "unknown") {
    return { applied: false, evaluation };
  }

  if (Number(product.quantity) === evaluation.effectiveQuantity && attrs.vendorStockStatus === evaluation.stockStatus) {
    return { applied: false, evaluation };
  }

  await db.update(products)
    .set({
      quantity: evaluation.effectiveQuantity,
      attributes: {
        ...attrs,
        vendorStockStatus: evaluation.stockStatus,
        vendorStockManual: false,
      },
      updatedAt: new Date(),
    })
    .where(and(eq(products.userId, userId), eq(products.id, productId)));

  await recordStockSyncEvent({
    userId,
    productId,
    oldQuantity: Number(product.quantity),
    newQuantity: evaluation.effectiveQuantity,
    oldStatus: typeof attrs.vendorStockStatus === "string" ? attrs.vendorStockStatus : null,
    newStatus: evaluation.stockStatus,
    action: evaluation.rawOutOfStock ? "listing_oos" : "listing_restored",
    reason: evaluation.reason,
    triggeredBy: "system",
  });

  return { applied: true, evaluation };
}

export async function getProductStockEvents(userId: string, productId: number, limit = 50) {
  try {
    return await db.select().from(stockSyncEvents)
      .where(and(eq(stockSyncEvents.userId, userId), eq(stockSyncEvents.productId, productId)))
      .orderBy(desc(stockSyncEvents.createdAt))
      .limit(limit);
  } catch (err) {
    if (isMissingStockTableError(err)) {
      warnMissingStockTables(err);
      return [];
    }
    throw err;
  }
}

async function recordStockSyncEvent(event: {
  userId: string;
  productId: number;
  vendorId?: number | null;
  vendorSourceId?: number | null;
  storeId?: number | null;
  marketplaceListingId?: number | null;
  oldQuantity?: number | null;
  newQuantity?: number | null;
  oldStatus?: string | null;
  newStatus?: string | null;
  action: string;
  reason?: string | null;
  triggeredBy?: string;
  metadata?: Record<string, unknown> | null;
}) {
  try {
    await db.insert(stockSyncEvents).values({
      userId: event.userId,
      productId: event.productId,
      vendorId: event.vendorId ?? null,
      vendorSourceId: event.vendorSourceId ?? null,
      storeId: event.storeId ?? null,
      marketplaceListingId: event.marketplaceListingId ?? null,
      oldQuantity: event.oldQuantity ?? null,
      newQuantity: event.newQuantity ?? null,
      oldStatus: event.oldStatus ?? null,
      newStatus: event.newStatus ?? null,
      action: event.action,
      reason: event.reason ?? null,
      triggeredBy: event.triggeredBy ?? "system",
      metadata: event.metadata ?? null,
    });
  } catch (err) {
    if (isMissingStockTableError(err)) {
      warnMissingStockTables(err);
      return;
    }
    console.warn("[StockEngine] Failed to write stock sync event:", err);
  }
}

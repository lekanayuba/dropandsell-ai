import { storage } from "./storage";

// Shared inventory group: these staff accounts all operate on the SAME product
// inventory. The owner account physically holds the products (products.userId),
// and every member account is transparently resolved to the owner's id for all
// product endpoints so both admins see and manage exactly the same items.
const SHARED_INVENTORY_OWNER_EMAIL = "dropandsellauth@gmail.com";
const SHARED_INVENTORY_MEMBER_EMAILS = ["no-reply@dropandsell.online"];

let cache: { ownerId: string; memberIds: Set<string> } | null = null;
let cacheComplete = false;

async function loadCache(): Promise<void> {
  try {
    const owner = await storage.getUserByEmail(SHARED_INVENTORY_OWNER_EMAIL);
    if (!owner?.id) return; // owner not present yet — keep any previous cache

    const memberIds = new Set<string>();
    let allFound = true;
    for (const email of SHARED_INVENTORY_MEMBER_EMAILS) {
      const member = await storage.getUserByEmail(email);
      if (member?.id) memberIds.add(member.id);
      else allFound = false;
    }
    cache = { ownerId: owner.id, memberIds };
    cacheComplete = allFound;
  } catch (err: any) {
    console.error("[shared-inventory] Failed to resolve shared inventory accounts:", err?.message || err);
  }
}

// Resolve the effective inventory-owner id for a requesting user. Members of the
// shared group are mapped to the owner id; everyone else keeps their own id, so
// normal tenant isolation is untouched for all other accounts.
export async function resolveInventoryOwnerId(userId: string): Promise<string> {
  if (!cache || !cacheComplete) {
    await loadCache();
  }
  if (cache && cache.memberIds.has(userId)) {
    return cache.ownerId;
  }
  return userId;
}

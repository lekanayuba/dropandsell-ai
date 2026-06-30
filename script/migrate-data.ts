import { db } from "../server/db";
import { sql } from "drizzle-orm";
import { users } from "../shared/models/auth";
import { subscriptions, vendors, products } from "../shared/schema";

async function migrateData() {
  console.log("=== Data Migration ===\n");

  // 1. Migrate subscription data from old users columns
  console.log("1. Migrating subscriptions...");
  const existingSubs = await db.select({ userId: subscriptions.userId }).from(subscriptions);
  const existingSubUserIds = new Set(existingSubs.map(s => s.userId));

  // Check old columns: billing_interval, stripe_connect_account_id
  const usersWithBilling = await db.execute(sql`
    SELECT id, email, subscription_plan, subscription_status, billing_interval, 
           stripe_connect_account_id, stripe_customer_id
    FROM users 
    WHERE billing_interval IS NOT NULL 
       OR stripe_connect_account_id IS NOT NULL
       OR subscription_status = 'active'
  `);

  let subMigrated = 0;
  for (const row of usersWithBilling.rows as any[]) {
    if (existingSubUserIds.has(row.id)) continue;
    const plan = row.subscription_plan || 'starter';
    const status = row.subscription_status || (row.billing_interval ? 'active' : 'inactive');
    await db.insert(subscriptions).values({
      userId: row.id,
      planName: plan,
      status,
      stripeSubscriptionId: row.stripe_connect_account_id || null,
    });
    subMigrated++;
  }
  console.log(`   Created ${subMigrated} subscription records`);

  // 2. Set subscription_status for users with old billing_interval
  await db.execute(sql`
    UPDATE users 
    SET subscription_status = 'active' 
    WHERE billing_interval IS NOT NULL 
      AND (subscription_status IS NULL OR subscription_status = '')
  `);
  console.log("   Updated subscription_status from billing_interval");

  // 3. Create vendor records from product brands
  console.log("\n2. Extracting vendors from product brands...");
  const brands = await db.execute(sql`
    SELECT DISTINCT brand FROM products 
    WHERE brand IS NOT NULL AND brand != ''
  `);

  const existingVendors = await db.select({ name: vendors.name }).from(vendors);
  const existingVendorNames = new Set(existingVendors.map(v => v.name.toLowerCase()));

  let vendorCreated = 0;
  for (const row of brands.rows as any[]) {
    const brand = String(row.brand).trim();
    if (!brand || existingVendorNames.has(brand.toLowerCase())) continue;
    await db.insert(vendors).values({
      userId: (await db.select({ id: users.id }).from(users).limit(1).then(r => r[0]))?.id || '',
      name: brand,
      category: 'manufacturer',
      tags: brand,
      integrationType: 'custom',
      status: 'active',
    });
    vendorCreated++;
    existingVendorNames.add(brand.toLowerCase());
  }
  console.log(`   Created ${vendorCreated} vendor records from brands`);

  // 4. Link products to their vendor by brand
  if (vendorCreated > 0) {
    console.log("\n3. Linking products to vendors...");
    const allVendors = await db.select({ id: vendors.id, name: vendors.name, tags: vendors.tags }).from(vendors);
    let linked = 0;
    for (const v of allVendors) {
      const brandMatch = v.tags || v.name;
      const result = await db.execute(sql`
        UPDATE products 
        SET vendor_id = ${v.id} 
        WHERE brand = ${brandMatch} AND vendor_id IS NULL
      `);
      linked += result.rowCount || 0;
    }
    console.log(`   Linked ${linked} products to vendors`);
  }

  // 5. Copy user settings from old columns
  console.log("\n4. Preserving user settings...");
  await db.execute(sql`
    UPDATE users 
    SET 
      onboarding_completed = COALESCE(onboarding_completed, 
        CASE WHEN disclaimer_accepted IS NOT NULL THEN NOW() ELSE NULL END),
      policies_accepted = COALESCE(policies_accepted, disclaimer_accepted)
    WHERE disclaimer_accepted IS NOT NULL
  `);
  console.log("   Copied disclaimer_accepted → policies_accepted");

  // Set role for admin users
  await db.execute(sql`
    UPDATE users 
    SET role = 'admin' 
    WHERE is_admin = true AND (role IS NULL OR role = 'user')
  `);
  console.log("   Set admin roles from is_admin column");

  // Copy auto_restock settings if they exist
  await db.execute(sql`
    UPDATE stores s
    SET auto_restock = u.auto_restock_enabled
    FROM users u
    WHERE s.user_id = u.id AND u.auto_restock_enabled IS NOT NULL
  `);
  console.log("   Copied user auto_restock settings to stores");

  // 6. Summary
  const counts = await db.execute(sql`
    SELECT 
      (SELECT count(*) FROM users) as users,
      (SELECT count(*) FROM vendors) as vendors,
      (SELECT count(*) FROM subscriptions) as subscriptions,
      (SELECT count(*) FROM products) as products
  `);
  const c = (counts.rows[0] || {}) as any;
  console.log("\n=== Migration Complete ===");
  console.log(`Users: ${c.users} | Vendors: ${c.vendors} | Subscriptions: ${c.subscriptions} | Products: ${c.products}`);

  process.exit(0);
}

migrateData().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});

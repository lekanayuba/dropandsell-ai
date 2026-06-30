import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function migrateData() {
  console.log("=== Data Migration ===\n");

  // 0. Check what old columns exist
  console.log("0. Checking available columns...");
  const cols = await db.execute(sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name IN ('users', 'products', 'stores')
    ORDER BY table_name, ordinal_position
  `);
  const existingCols = new Set<string>();
  for (const row of cols.rows as any[]) {
    existingCols.add(`${row.table_name}.${row.column_name}`);
  }
  console.log(`   Found ${existingCols.size} total columns across users/products/stores`);

  // Helper to check if column exists
  const has = (table: string, col: string) => existingCols.has(`${table}.${col}`);

  // 1. Migrate subscriptions from old user columns
  if (has('users', 'billing_interval') || has('users', 'stripe_connect_account_id')) {
    console.log("\n1. Migrating subscriptions...");
    const existingSubs = await db.execute(sql`SELECT user_id FROM subscriptions`);
    const existingIds = new Set((existingSubs.rows as any[]).map(r => r.user_id));

    // Check if old subscriptions table exists and has data
    const hasOldSubsTable = (await db.execute(sql`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'subscriptions')
    `)).rows[0]?.exists === true;

    // Read subscription data from old users columns
    const usersWithBilling = await db.execute(sql`
      SELECT id, email, subscription_plan, subscription_status, 
             stripe_customer_id
      FROM users 
      WHERE subscription_status = 'active'
         OR subscription_plan IS NOT NULL
    `);

    let subMigrated = 0;
    for (const row of usersWithBilling.rows as any[]) {
      if (existingIds.has(row.id)) continue;
      const plan = row.subscription_plan || 'starter';
      const status = row.subscription_status || 'active';
      await db.execute(sql`
        INSERT INTO subscriptions (user_id, plan_name, status, stripe_subscription_id)
        VALUES (${row.id}, ${plan}, ${status}, ${row.stripe_customer_id || null})
        ON CONFLICT (user_id) DO NOTHING
      `);
      subMigrated++;
    }
    console.log(`   Created ${subMigrated} subscription records`);

    // Set subscription_status for users who had billing_interval
    if (has('users', 'billing_interval')) {
      await db.execute(sql`
        UPDATE users 
        SET subscription_status = 'active' 
        WHERE billing_interval IS NOT NULL 
          AND billing_interval != ''
          AND (subscription_status IS NULL OR subscription_status = '')
      `);
      console.log("   Updated subscription_status from billing_interval");
    }
  } else {
    console.log("\n1. No old billing columns found on users table");
  }

  // 2. Create vendor records from product brands
  if (has('products', 'brand')) {
    console.log("\n2. Extracting vendors from product brands...");
    const brands = await db.execute(sql`
      SELECT DISTINCT brand FROM products 
      WHERE brand IS NOT NULL AND brand != ''
    `);

    const existingVendors = await db.execute(sql`SELECT name FROM vendors`);
    const existingNames = new Set((existingVendors.rows as any[]).map(r => r.name?.toLowerCase()));

    // Get the first user id (for ownership)
    const firstUser = await db.execute(sql`SELECT id FROM users LIMIT 1`);
    const defaultUserId = (firstUser.rows[0] as any)?.id || '';

    let vendorCreated = 0;
    for (const row of brands.rows as any[]) {
      const brand = String(row.brand).trim();
      if (!brand || existingNames.has(brand.toLowerCase())) continue;
      try {
        await db.execute(sql`
          INSERT INTO vendors (user_id, name, category, tags, integration_type, status)
          VALUES (${defaultUserId}, ${brand}, 'manufacturer', ${brand}, 'custom', 'active')
        `);
        vendorCreated++;
        existingNames.add(brand.toLowerCase());
      } catch (err: any) {
        console.log(`   Skipped brand "${brand}": ${err.message}`);
      }
    }
    console.log(`   Created ${vendorCreated} vendor records from brands`);

    // Link products to their vendor by brand
    if (vendorCreated > 0) {
      console.log("\n3. Linking products to vendors...");
      const allVendors = await db.execute(sql`SELECT id, name FROM vendors`);
      let linked = 0;
      for (const v of allVendors.rows as any[]) {
        try {
          const result = await db.execute(sql`
            UPDATE products 
            SET vendor_id = ${v.id} 
            WHERE brand = ${v.name} AND vendor_id IS NULL
          `);
          linked += result.rowCount || 0;
        } catch (err: any) {
          console.log(`   Failed linking "${v.name}": ${err.message}`);
        }
      }
      console.log(`   Linked ${linked} products to vendors`);
    }
  } else {
    console.log("\n2. No 'brand' column found on products table - skipping vendor extraction");
  }

  // 4. Copy user settings from old columns
  console.log("\n4. Preserving user settings...");

  if (has('users', 'disclaimer_accepted')) {
    await db.execute(sql`
      UPDATE users 
      SET policies_accepted = COALESCE(policies_accepted, CURRENT_TIMESTAMP)
      WHERE disclaimer_accepted IS NOT NULL 
        AND policies_accepted IS NULL
    `);
    console.log("   Copied disclaimer_accepted → policies_accepted");
  }

  if (has('users', 'is_admin')) {
    await db.execute(sql`
      UPDATE users 
      SET role = 'admin' 
      WHERE is_admin IS NOT NULL 
        AND LOWER(is_admin::text) IN ('true', '1', 'yes', 't')
        AND (role IS NULL OR role = 'user')
    `);
    console.log("   Set admin roles from is_admin column");
  }

  if (has('users', 'auto_restock_enabled')) {
    await db.execute(sql`
      UPDATE stores s
      SET auto_restock = true
      FROM users u
      WHERE s.user_id = u.id 
        AND u.auto_restock_enabled IS NOT NULL 
        AND LOWER(u.auto_restock_enabled::text) IN ('true', '1', 'yes', 't')
    `);
    console.log("   Copied user auto_restock settings to stores");
  }

  // 5. Migrate old VERO data if tables exist
  const oldVeroExists = (await db.execute(sql`
    SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'global_vero_list')
  `)).rows[0]?.exists === true;

  if (oldVeroExists) {
    console.log("\n5. Migrating old VERO list data...");
    const oldVero = await db.execute(sql`SELECT * FROM global_vero_list LIMIT 500`);
    let veroMigrated = 0;
    for (const row of oldVero.rows as any[]) {
      try {
        await db.execute(sql`
          INSERT INTO vero_list (user_id, type, value, platform, reason, is_active)
          VALUES (${
            (await db.execute(sql`SELECT id FROM users LIMIT 1`)).rows[0]?.id || ''
          }, 'brand', ${row.value || row.brand || ''}, ${row.platform || null}, ${row.reason || null}, true)
        `);
        veroMigrated++;
      } catch { /* skip duplicates */ }
    }
    console.log(`   Migrated ${veroMigrated} VERO items`);
  }

  // 6. Summary
  const counts = await db.execute(sql`
    SELECT 
      (SELECT count(*) FROM users) as users,
      (SELECT count(*) FROM vendors) as vendors,
      (SELECT count(*) FROM subscriptions) as subscriptions,
      (SELECT count(*) FROM products) as products,
      (SELECT count(*) FROM stores) as stores
  `);
  const c = (counts.rows[0] || {}) as any;
  console.log("\n=== Migration Complete ===");
  console.log(`Users: ${c.users} | Vendors: ${c.vendors} | Subscriptions: ${c.subscriptions} | Products: ${c.products} | Stores: ${c.stores}`);

  process.exit(0);
}

migrateData().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});

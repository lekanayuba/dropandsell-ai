import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function migrateShipping() {
  console.log("=== Shipping Profiles Migration ===\n");

  const tableExists = (await db.execute(sql`
    SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'shipping_profiles')
  `)).rows[0]?.exists === true;

  if (tableExists) {
    console.log("shipping_profiles table already exists, checking for missing columns...");

    const cols = await db.execute(sql`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'shipping_profiles'
    `);
    const existingCols = new Set((cols.rows as any[]).map(r => r.column_name));

    const desiredCols = ['id', 'user_id', 'name', 'carrier', 'service_level', 'base_rate', 'rate_per_kg', 'free_shipping_threshold', 'estimated_days_min', 'estimated_days_max', 'regions', 'is_active', 'created_at', 'updated_at'];
    const missing = desiredCols.filter(c => !existingCols.has(c));
    if (missing.length > 0) {
      console.log(`Missing columns: ${missing.join(', ')}`);
    } else {
      console.log("All columns present.");
    }
  } else {
    console.log("Creating shipping_profiles table...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS shipping_profiles (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR NOT NULL REFERENCES users(id),
        name TEXT NOT NULL,
        carrier TEXT NOT NULL DEFAULT 'other',
        service_level TEXT NOT NULL DEFAULT 'standard',
        base_rate DECIMAL(10,2) NOT NULL DEFAULT '0',
        rate_per_kg DECIMAL(10,2),
        free_shipping_threshold DECIMAL(10,2),
        estimated_days_min INTEGER DEFAULT 3,
        estimated_days_max INTEGER DEFAULT 7,
        regions TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("shipping_profiles table created successfully.");
  }

  console.log("\n=== Migration Complete ===");
  process.exit(0);
}

migrateShipping().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
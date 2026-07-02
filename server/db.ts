import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

// Shared column list for raw SQL queries - must match Drizzle camelCase property names
export const STORE_COLUMNS = 'id, user_id AS "userId", name, platform, credentials, status, last_sync AS "lastSync", created_at AS "createdAt"';
export const STORE_INSERT_COLUMNS = 'user_id, name, platform, credentials, status';

export async function runMigrations() {
  try {
    const client = await pool.connect();
    try {
      console.log("[DB] Running migrations...");
      await client.query(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS auto_restock boolean NOT NULL DEFAULT false`);
      await client.query(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS auto_pause_listings boolean NOT NULL DEFAULT false`);
      await client.query(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS auto_mark_out_of_stock boolean NOT NULL DEFAULT false`);
      await client.query(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS auto_switch_supplier boolean NOT NULL DEFAULT false`);
      await client.query(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS restock_threshold integer NOT NULL DEFAULT 1`);

      // Marketplace listings columns
      await client.query(`ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS sync_status text DEFAULT 'synced'`);
      await client.query(`ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS stock_status text DEFAULT 'in_stock'`);
      await client.query(`ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS out_of_stock_at timestamp`);
      await client.query(`ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS last_sync timestamp`);

      // Vendor columns
      await client.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS logo text`);
      await client.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS contact_person text`);
      await client.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS contact_email text`);
      await client.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS contact_phone text`);
      await client.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS category text`);
      await client.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS tags text`);
      await client.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS country text`);
      await client.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS lead_time text`);
      await client.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS payment_terms text`);
      await client.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS min_order_amount decimal(10,2)`);
      await client.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS notes text`);
      await client.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS health_score integer`);
      await client.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS average_shipping_days text`);
      await client.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS cancellation_rate decimal(5,2)`);
      await client.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS stock_update_reliability text`);
      await client.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS return_rate decimal(5,2)`);
      await client.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS late_delivery_rate decimal(5,2)`);
      await client.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS total_orders_fulfilled integer DEFAULT 0`);
      await client.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS last_health_check timestamp`);
      await client.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS is_global boolean NOT NULL DEFAULT false`);
      await client.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending'`);
      await client.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS verified_at timestamp`);
      await client.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS verified_by varchar`);

      // Add-on catalog columns
      await client.query(`ALTER TABLE addon_catalog ADD COLUMN IF NOT EXISTS image text`);
      await client.query(`ALTER TABLE addon_catalog ADD COLUMN IF NOT EXISTS is_new boolean NOT NULL DEFAULT false`);
      console.log("[DB] Migrations complete.");
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("[DB] Migration error (non-fatal):", err);
  }
}

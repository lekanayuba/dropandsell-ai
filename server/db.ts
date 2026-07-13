import { drizzle } from "drizzle-orm/node-postgres";
import { existsSync } from "fs";
import pg from "pg";
import { loadEnvFile } from "process";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (existsSync(".env")) {
  loadEnvFile(".env");
}

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

// Compatibility patches for older deployments. Fresh databases still need
// `npm run db:push` so Drizzle can create the full schema.
export async function runCompatibilityMigrations() {
  try {
    const client = await pool.connect();
    try {
      console.log("[DB] Running compatibility schema checks...");
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

      // Product-level stock automation foundation
      await client.query(`
        CREATE TABLE IF NOT EXISTS product_vendor_sources (
          id SERIAL PRIMARY KEY,
          user_id varchar NOT NULL REFERENCES users(id),
          product_id integer NOT NULL REFERENCES products(id),
          vendor_id integer NOT NULL REFERENCES vendors(id),
          vendor_sku text,
          source_url text,
          is_primary boolean NOT NULL DEFAULT false,
          is_enabled boolean NOT NULL DEFAULT true,
          priority integer NOT NULL DEFAULT 0,
          stock_quantity integer NOT NULL DEFAULT 0,
          stock_status text NOT NULL DEFAULT 'unknown',
          last_synced_at timestamp,
          last_error text,
          metadata jsonb,
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now(),
          CONSTRAINT uq_product_vendor_source UNIQUE (product_id, vendor_id)
        )
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS product_stock_rules (
          id SERIAL PRIMARY KEY,
          user_id varchar NOT NULL REFERENCES users(id),
          product_id integer NOT NULL REFERENCES products(id),
          oos_threshold integer NOT NULL DEFAULT 0,
          oos_automation_enabled boolean NOT NULL DEFAULT true,
          auto_switch_supplier boolean NOT NULL DEFAULT false,
          restock_automation_enabled boolean NOT NULL DEFAULT false,
          restock_threshold integer NOT NULL DEFAULT 1,
          restock_quantity integer NOT NULL DEFAULT 1,
          restock_mode text NOT NULL DEFAULT 'fixed',
          pinned_vendor_source_id integer REFERENCES product_vendor_sources(id),
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now(),
          CONSTRAINT uq_product_stock_rule UNIQUE (product_id)
        )
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS stock_sync_events (
          id SERIAL PRIMARY KEY,
          user_id varchar NOT NULL REFERENCES users(id),
          product_id integer NOT NULL REFERENCES products(id),
          vendor_id integer REFERENCES vendors(id),
          vendor_source_id integer REFERENCES product_vendor_sources(id),
          store_id integer REFERENCES stores(id),
          marketplace_listing_id integer REFERENCES marketplace_listings(id),
          old_quantity integer,
          new_quantity integer,
          old_status text,
          new_status text,
          action text NOT NULL,
          reason text,
          triggered_by text NOT NULL DEFAULT 'system',
          metadata jsonb,
          created_at timestamp DEFAULT now()
        )
      `);

      // Referral withdrawal requests for manual bank payouts.
      await client.query(`
        CREATE TABLE IF NOT EXISTS referral_withdrawals (
          id SERIAL PRIMARY KEY,
          user_id varchar NOT NULL REFERENCES users(id),
          wallet_id integer NOT NULL REFERENCES wallet(id),
          transaction_id integer NOT NULL REFERENCES transactions(id),
          amount decimal(12,2) NOT NULL,
          currency text NOT NULL DEFAULT 'GBP',
          account_holder_name text NOT NULL,
          bank_name text NOT NULL,
          bank_country text NOT NULL DEFAULT 'United Kingdom',
          account_number_last4 text NOT NULL,
          sort_code_last2 text,
          bank_details jsonb NOT NULL,
          status text NOT NULL DEFAULT 'pending',
          admin_notes text,
          processed_at timestamp,
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now()
        )
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_referral_withdrawals_user_id ON referral_withdrawals(user_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_referral_withdrawals_status ON referral_withdrawals(status)`);

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
      console.log("[DB] Compatibility schema checks complete.");
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("[DB] Compatibility schema check error (non-fatal):", err);
  }
}

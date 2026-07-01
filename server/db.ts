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
      console.log("[DB] Migrations complete.");
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("[DB] Migration error (non-fatal):", err);
  }
}

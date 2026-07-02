import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Hardened pool config:
// - keepAlive prevents the OS from silently dropping idle TCP connections,
//   which is a common cause of "Connection terminated unexpectedly" after
//   brief network/control-plane blips.
// - max=20 + idleTimeoutMillis=30s + connectionTimeoutMillis=10s gives us
//   headroom during traffic spikes without churning new connections (and
//   re-paying the control-plane handshake cost) on every request.
// - statement_timeout caps a stuck query at 30s so one bad statement can't
//   pin a connection forever.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  keepAlive: true,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 30_000,
});

// Without an 'error' listener, an idle-client error (e.g. server-side
// disconnect during a control-plane outage) will crash the entire Node
// process. Log instead — node-postgres will lazily replace the client.
pool.on('error', (err) => {
  console.error('[db] Idle pool client error (non-fatal):', err?.message || err);
});

export const db = drizzle(pool, { schema });

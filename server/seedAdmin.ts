import crypto from "crypto";
import { and, eq, ne } from "drizzle-orm";
import { db } from "./db";
import { users } from "@shared/schema";

/**
 * Ensures the admin account exists in whatever database this instance is
 * connected to (development or production). The password is never stored in
 * plain text — only a bcrypt hash is read from ADMIN_PASSWORD_HASH.
 *
 * Set ADMIN_USERNAME (the login username) and ADMIN_PASSWORD_HASH (a bcrypt
 * hash of the password) as shared config so both dev and the published app
 * seed the same admin login.
 */
// The owner's account always keeps admin access, regardless of which
// login the ADMIN_USERNAME config points at.
const OWNER_EMAIL = "dropandsellauth@gmail.com";

export async function seedAdminUser() {
  const username = process.env.ADMIN_USERNAME?.trim().toLowerCase();
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;

  if (!username || !passwordHash) {
    return;
  }

  try {
    const [existing] = await db.select().from(users).where(eq(users.email, username));
    const now = new Date();

    if (!existing) {
      const referralCode = "DS" + crypto.randomBytes(4).toString("hex").toUpperCase();
      const uniqueUrl = "admin-" + crypto.randomBytes(6).toString("hex");
      await db.insert(users).values({
        email: username,
        password: passwordHash,
        firstName: "Admin",
        isAdmin: "true",
        emailVerified: now,
        policiesAccepted: now,
        onboardingCompleted: now,
        referralCode,
        uniqueUrl,
        subscriptionPlan: "Enterprise Plan",
        subscriptionStatus: "active",
      });
      console.log(`[seed-admin] Created admin user "${username}"`);
    } else {
      await db
        .update(users)
        .set({
          password: passwordHash,
          isAdmin: "true",
          emailVerified: existing.emailVerified ?? now,
          policiesAccepted: existing.policiesAccepted ?? now,
          onboardingCompleted: existing.onboardingCompleted ?? now,
          updatedAt: now,
        })
        .where(eq(users.id, existing.id));
      console.log(`[seed-admin] Ensured admin access for "${username}"`);
    }

    // Make sure the owner's account always has admin access.
    const ownerPromoted = await db
      .update(users)
      .set({ isAdmin: "true", updatedAt: now })
      .where(and(eq(users.email, OWNER_EMAIL), ne(users.isAdmin, "true")))
      .returning({ id: users.id });
    if (ownerPromoted.length > 0) {
      console.log(`[seed-admin] Restored admin access for owner "${OWNER_EMAIL}"`);
    }

    // Lock down the admin portal: strip admin access from every account
    // except the configured admin login and the owner's account.
    const demoted = await db
      .update(users)
      .set({ isAdmin: "false", updatedAt: now })
      .where(and(ne(users.email, username), ne(users.email, OWNER_EMAIL), eq(users.isAdmin, "true")))
      .returning({ id: users.id });
    if (demoted.length > 0) {
      console.log(`[seed-admin] Revoked admin access from ${demoted.length} other account(s)`);
    }
  } catch (err: any) {
    console.error("[seed-admin] Failed to seed admin user:", err?.message || err);
  }
}

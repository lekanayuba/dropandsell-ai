import { existsSync } from "fs";
import { loadEnvFile } from "process";

if (existsSync(".env")) {
  loadEnvFile(".env");
}

const email = (process.env.ADMIN_EMAIL || process.argv[2] || "").trim();

async function promoteAdmin() {
  if (!email) {
    console.error("Usage: ADMIN_EMAIL=owner@example.com npm run admin:promote");
    console.error("You can also pass the email as an argument: npm run admin:promote -- owner@example.com");
    process.exitCode = 1;
    return;
  }

  const [{ sql }, { db, pool }, { users }] = await Promise.all([
    import("drizzle-orm"),
    import("../server/db"),
    import("../shared/models/auth"),
  ]);

  try {
    const [user] = await db
      .update(users)
      .set({
        role: "admin",
        emailVerified: new Date(),
        updatedAt: new Date(),
      })
      .where(sql`lower(${users.email}) = lower(${email})`)
      .returning({
        id: users.id,
        email: users.email,
        role: users.role,
      });

    if (!user) {
      console.error(`No user found for ${email}. Register the account first, then run this command again.`);
      process.exitCode = 1;
      return;
    }

    console.log(`Promoted ${user.email} (${user.id}) to ${user.role}.`);
  } finally {
    await pool.end();
  }
}

promoteAdmin().catch((err) => {
  console.error("Failed to promote admin user:", err);
  process.exitCode = 1;
});

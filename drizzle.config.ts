import { defineConfig } from "drizzle-kit";
import { existsSync } from "fs";
import { loadEnvFile } from "process";

if (existsSync(".env")) {
  loadEnvFile(".env");
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});

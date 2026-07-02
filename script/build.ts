import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile, copyFile, access, mkdir } from "fs/promises";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });

  console.log("copying extension zip to dist...");
  const extSrc = "public/dropandsell-extension.zip";
  const extDest = "dist/public/dropandsell-extension.zip";
  try {
    await access(extSrc);
    await mkdir("dist/public", { recursive: true });
    await copyFile(extSrc, extDest);
    console.log("extension zip copied successfully");
  } catch {
    console.warn("extension zip not found at", extSrc, "- skipping");
  }
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});

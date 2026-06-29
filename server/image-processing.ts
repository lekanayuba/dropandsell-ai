import sharp from "sharp";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const UPLOADS_DIR = path.resolve("uploads");

export async function ensureUploadsDir(): Promise<void> {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

function safeFilename(url: string): string {
  const hash = crypto.createHash("md5").update(url).digest("hex");
  const ext = path.extname(new URL(url).pathname) || ".jpg";
  return `${hash}${ext}`;
}

export async function downloadImage(imageUrl: string): Promise<string | null> {
  try {
    await ensureUploadsDir();
    const filename = safeFilename(imageUrl);
    const filepath = path.join(UPLOADS_DIR, filename);

    if (fs.existsSync(filepath)) {
      return `/uploads/${filename}`;
    }

    const response = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(filepath, buffer);
    return `/uploads/${filename}`;
  } catch {
    return null;
  }
}

export async function validateImageUrl(imageUrl: string): Promise<boolean> {
  try {
    const response = await fetch(imageUrl, { method: "HEAD", signal: AbortSignal.timeout(8000) });
    return response.ok;
  } catch {
    return false;
  }
}

export async function upscaleImage(
  imageUrl: string,
): Promise<{ originalUrl: string; upscaledUrl: string }> {
  try {
    await ensureUploadsDir();
    const filename = safeFilename(imageUrl);
    const filepath = path.join(UPLOADS_DIR, filename);
    const upscaledFilename = `upscaled_${filename}`;
    const upscaledFilepath = path.join(UPLOADS_DIR, upscaledFilename);

    if (fs.existsSync(upscaledFilepath)) {
      return { originalUrl: imageUrl, upscaledUrl: `/uploads/${upscaledFilename}` };
    }

    if (!fs.existsSync(filepath)) {
      const saved = await downloadImage(imageUrl);
      if (!saved) {
        return { originalUrl: imageUrl, upscaledUrl: imageUrl };
      }
    }

    const image = sharp(filepath);
    const metadata = await image.metadata();
    const width = metadata.width || 800;
    const height = metadata.height || 800;

    await image
      .resize(Math.round(width * 2), Math.round(height * 2), { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .sharpen()
      .toFile(upscaledFilepath);

    return { originalUrl: imageUrl, upscaledUrl: `/uploads/${upscaledFilename}` };
  } catch (err) {
    console.error("[image-processing] upscaleImage failed:", err);
    return { originalUrl: imageUrl, upscaledUrl: imageUrl };
  }
}

export async function downloadAndCacheImages(imageUrls: string[]): Promise<string[]> {
  const results: string[] = [];
  for (const url of imageUrls) {
    const local = await downloadImage(url);
    if (local) {
      results.push(local);
    }
  }
  return results.length > 0 ? results : imageUrls;
}

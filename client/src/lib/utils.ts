import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Public-facing brand origin shown to users (extension URL, share links, etc.).
// Always use this instead of window.location.origin so the URL stays uniform
// regardless of which host the app happens to be served from
// (e.g. *.replit.app vs the custom domain).
export const PUBLIC_APP_ORIGIN = "https://dropandsell.online"

export function buildUserUniqueUrl(uniqueUrlCode: string): string {
  const code = (uniqueUrlCode || "").trim()
  if (!code) return ""
  return `${PUBLIC_APP_ORIGIN}/u/${encodeURIComponent(code)}`
}

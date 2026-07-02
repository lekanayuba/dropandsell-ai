/**
 * Supplier inventory monitor.
 *
 * Continuously checks the live supplier listing for an imported product and
 * reports whether it is still available. Works across the supported suppliers
 * (Amazon, eBay, Walmart, AliExpress, CJ Dropshipping, Temu, Costco, Best Buy,
 * Etsy) and any future supplier added to the allowlist below.
 *
 * This is a best-effort real check: it fetches the actual source listing over
 * HTTP and looks for genuine availability signals. When a listing cannot be
 * read reliably (blocked, JS-only, network error) it returns `unknown` so the
 * caller leaves the product untouched instead of guessing.
 *
 * SECURITY: `sourceUrl` is user-controlled and fetched server-side on a timer,
 * which is a classic SSRF vector. Every request is therefore constrained to a
 * strict supplier-domain allowlist, IP-literal hosts are rejected, DNS is
 * resolved and checked against private/link-local/loopback ranges, and
 * redirects are followed manually with the same checks on every hop.
 */

import { lookup } from "dns/promises";
import net from "net";

export type SupplierStatus =
  | "in_stock"
  | "out_of_stock"
  | "discontinued"
  | "removed"
  | "unknown";

export interface SupplierStockResult {
  status: SupplierStatus;
  quantity?: number;
  supplier: string;
  checkedUrl?: string;
  detail?: string;
}

export type SupplierKey =
  | "amazon"
  | "ebay"
  | "walmart"
  | "aliexpress"
  | "cjdropshipping"
  | "temu"
  | "costco"
  | "bestbuy"
  | "etsy"
  | "generic";

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

// Only these supplier domains may ever be fetched server-side (SSRF allowlist).
const ALLOWED_DOMAINS: string[] = [
  "amazon.com", "amazon.co.uk", "amazon.de", "amazon.fr", "amazon.ca",
  "amazon.it", "amazon.es", "amazon.nl", "amazon.co.jp", "amazon.in",
  "amazon.com.au", "amazon.com.mx", "amazon.com.br", "amazon.se", "amazon.pl",
  "amazon.sg", "amazon.ae",
  "ebay.com", "ebay.co.uk", "ebay.de", "ebay.com.au", "ebay.ca", "ebay.fr",
  "ebay.it", "ebay.es", "ebay.ie",
  "walmart.com", "walmart.ca",
  "aliexpress.com", "aliexpress.us", "aliexpress.ru",
  "cjdropshipping.com",
  "temu.com",
  "costco.com", "costco.co.uk", "costco.ca",
  "bestbuy.com", "bestbuy.ca",
  "etsy.com",
];

// Signals that a listing has been removed / no longer exists.
const REMOVED_PATTERNS: RegExp[] = [
  /this listing (was|has) ended/i,
  /page not found/i,
  /we couldn'?t find that page/i,
  /item not found/i,
  /this product is no longer available/i,
  /the item you'?re looking for is no longer available/i,
];

// Signals that a listing is permanently discontinued.
const DISCONTINUED_PATTERNS: RegExp[] = [
  /discontinued/i,
  /no longer (being )?(sold|carried|produced|manufactured)/i,
];

// Signals that a listing exists but is out of stock.
const OOS_PATTERNS: RegExp[] = [
  /out[\s-]?of[\s-]?stock/i,
  /sold[\s-]?out/i,
  /currently unavailable/i,
  /temporarily out of stock/i,
  /this item is unavailable/i,
  /all sold out/i,
  /we don'?t know when or if this item will be back in stock/i,
];

// Strong signals that a listing is purchasable right now (buy CTA present).
const INSTOCK_PATTERNS: RegExp[] = [
  /add to cart/i,
  /add to bag/i,
  /add to basket/i,
  /add to trolley/i,
  /buy it now/i,
  /buy now/i,
];

/** Determine the supplier from a source URL (and optional vendor hints). */
export function detectSupplier(
  url?: string | null,
  vendorName?: string | null,
  vendorWebsite?: string | null,
): SupplierKey {
  const haystack = `${url || ""} ${vendorName || ""} ${vendorWebsite || ""}`.toLowerCase();
  if (/amazon\./.test(haystack) || /\bamazon\b/.test(haystack)) return "amazon";
  if (/ebay\./.test(haystack) || /\bebay\b/.test(haystack)) return "ebay";
  if (/walmart\./.test(haystack) || /\bwalmart\b/.test(haystack)) return "walmart";
  if (/aliexpress\./.test(haystack) || /\baliexpress\b/.test(haystack)) return "aliexpress";
  if (/cjdropshipping\./.test(haystack) || /cj\s?dropshipping/.test(haystack)) return "cjdropshipping";
  if (/temu\./.test(haystack) || /\btemu\b/.test(haystack)) return "temu";
  if (/costco\./.test(haystack) || /\bcostco\b/.test(haystack)) return "costco";
  if (/bestbuy\./.test(haystack) || /best\s?buy/.test(haystack)) return "bestbuy";
  if (/etsy\./.test(haystack) || /\betsy\b/.test(haystack)) return "etsy";
  return "generic";
}

function isAllowedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (net.isIP(host) !== 0) return false; // never allow raw IP hosts
  return ALLOWED_DOMAINS.some((d) => host === d || host.endsWith("." + d));
}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 10) return true;
    if (a === 127) return true; // loopback
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true; // loopback / unspecified
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local
    if (lower.startsWith("fe80")) return true; // link-local
    if (lower.startsWith("::ffff:")) return isPrivateIp(lower.replace("::ffff:", ""));
    return false;
  }
  return true; // unparseable → treat as unsafe
}

/** Resolve DNS and confirm the host points at a public address. */
async function resolvesToPublicAddress(hostname: string): Promise<boolean> {
  try {
    const records = await lookup(hostname, { all: true });
    if (!records.length) return false;
    return records.every((r) => !isPrivateIp(r.address));
  } catch {
    return false;
  }
}

/** Try to extract a numeric available quantity from the listing HTML. */
function parseQuantity(html: string): number | undefined {
  const patterns: RegExp[] = [
    /only\s+(\d{1,4})\s+left/i, // Amazon "Only 5 left in stock"
    /(\d{1,4})\s+available/i, // eBay / Etsy "12 available"
    /(\d{1,4})\s+in stock/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n) && n >= 0) return n;
    }
  }
  return undefined;
}

function matchAny(patterns: RegExp[], text: string): boolean {
  return patterns.some((re) => re.test(text));
}

/**
 * Reconstruct a checkable URL for a product that only has an external id
 * (e.g. Temu imports store a goods id rather than a full URL).
 */
export function buildSourceUrl(
  supplier: SupplierKey,
  externalId?: string | null,
): string | undefined {
  if (!externalId) return undefined;
  switch (supplier) {
    case "temu":
      return `https://www.temu.com/goods.html?goods_id=${encodeURIComponent(externalId)}`;
    default:
      return undefined;
  }
}

/**
 * SSRF-safe fetch: validates the host against the supplier allowlist, blocks
 * private/loopback/link-local addresses, and follows redirects manually while
 * re-validating every hop. Returns the final Response or null if disallowed.
 */
async function safeFetch(
  startUrl: string,
): Promise<{ res: Response | null; reason?: string }> {
  let currentUrl = startUrl;
  for (let hop = 0; hop < 4; hop++) {
    let parsed: URL;
    try {
      parsed = new URL(currentUrl);
    } catch {
      return { res: null, reason: "invalid_url" };
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { res: null, reason: "bad_protocol" };
    }
    if (!isAllowedHost(parsed.hostname)) {
      return { res: null, reason: "host_not_allowed" };
    }
    if (!(await resolvesToPublicAddress(parsed.hostname))) {
      return { res: null, reason: "private_or_unresolvable_host" };
    }

    let res: Response;
    try {
      res = await fetch(currentUrl, {
        method: "GET",
        headers: BROWSER_HEADERS,
        redirect: "manual",
        signal: AbortSignal.timeout(12_000),
      });
    } catch (err: any) {
      return { res: null, reason: `fetch_error:${err?.name || "error"}` };
    }

    // Follow redirects manually so each hop is re-validated.
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return { res, reason: "redirect_no_location" };
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }
    return { res };
  }
  return { res: null, reason: "too_many_redirects" };
}

/**
 * Check the live stock status of a single supplier listing.
 *
 * @param url  The public product listing URL to inspect.
 * @param supplierHint  Optional pre-detected supplier key.
 */
export async function checkSupplierStock(
  url: string,
  supplierHint?: SupplierKey,
): Promise<SupplierStockResult> {
  const supplier = supplierHint || detectSupplier(url);

  const { res, reason } = await safeFetch(url);
  if (!res) {
    return { status: "unknown", supplier, checkedUrl: url, detail: reason };
  }

  // A 404/410 means the listing was taken down.
  if (res.status === 404 || res.status === 410) {
    return { status: "removed", supplier, checkedUrl: url, detail: `http_${res.status}` };
  }
  // Anything else non-OK is inconclusive — do not guess.
  if (!res.ok) {
    return { status: "unknown", supplier, checkedUrl: url, detail: `http_${res.status}` };
  }

  let html = "";
  try {
    html = await res.text();
  } catch {
    return { status: "unknown", supplier, checkedUrl: url, detail: "read_error" };
  }

  // Only inspect a bounded chunk to keep memory/CPU predictable.
  const body = html.slice(0, 800_000);

  // A live, purchasable listing almost always renders a buy CTA in its HTML.
  // Requiring the CTA to be ABSENT before flagging unavailability greatly
  // reduces false positives from "out of stock" text in related/variant blocks.
  const hasBuyCta = matchAny(INSTOCK_PATTERNS, body);
  if (hasBuyCta) {
    return {
      status: "in_stock",
      quantity: parseQuantity(body),
      supplier,
      checkedUrl: url,
      detail: "buy_cta_present",
    };
  }

  if (matchAny(REMOVED_PATTERNS, body)) {
    return { status: "removed", supplier, checkedUrl: url, detail: "removed_text" };
  }
  if (matchAny(DISCONTINUED_PATTERNS, body)) {
    return { status: "discontinued", supplier, checkedUrl: url, detail: "discontinued_text" };
  }
  if (matchAny(OOS_PATTERNS, body)) {
    return { status: "out_of_stock", supplier, checkedUrl: url, detail: "oos_text" };
  }

  // No buy CTA and no clear unavailability signal (often JS-rendered or
  // bot-blocked). Stay conservative and change nothing.
  return { status: "unknown", supplier, checkedUrl: url, detail: "no_signal" };
}

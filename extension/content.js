// DropandSell Automation App - Content script v2.1.0
// Two jobs:
//   1. Enable product extraction by the popup (legacy behaviour).
//   2. Passively report vendor stock & price back to DropandSell so the
//      inventory dashboard always knows whether each product is still
//      buyable from its supplier — without our server having to scrape
//      vendor sites (which gets blocked by Amazon/eBay/AliExpress).
//
// Job #2 is the "vendor stock tracking" major resolution: the extension
// runs in the user's authenticated browser session, so it sees the same
// page a real shopper sees, and never gets bot-blocked.
console.log('%c[DropandSell v2.1.0] Loaded on:', 'color:#285261;font-weight:bold', window.location.hostname);

function detectVendor() {
  const host = window.location.hostname.toLowerCase();
  if (host.includes('amazon.')) return 'amazon';
  if (host.includes('ebay.')) return 'ebay';
  if (host.includes('aliexpress.')) return 'aliexpress';
  if (host.includes('walmart.')) return 'walmart';
  if (host.includes('etsy.')) return 'etsy';
  if (host.includes('shein.')) return 'shein';
  return 'unknown';
}

function isProductPage(vendor) {
  const p = window.location.pathname;
  if (vendor === 'amazon') return /\/dp\/[A-Z0-9]{10}/i.test(p) || /\/gp\/product\/[A-Z0-9]{10}/i.test(p);
  if (vendor === 'ebay') return /\/itm\//i.test(p);
  if (vendor === 'aliexpress') return /\/item\/\d+/i.test(p);
  if (vendor === 'walmart') return /\/ip\/\d+/i.test(p) || /\/ip\//.test(p);
  if (vendor === 'etsy') return /\/listing\/\d+/i.test(p);
  if (vendor === 'shein') return /-p-\d+\.html/i.test(p);
  return false;
}

function parsePriceText(txt) {
  if (!txt) return null;
  const cleaned = String(txt).replace(/[^\d.,]/g, '').replace(/,(?=\d{3}\b)/g, '');
  const norm = cleaned.includes(',') && !cleaned.includes('.') ? cleaned.replace(',', '.') : cleaned;
  const p = parseFloat(norm);
  return (!isNaN(p) && p > 0 && p < 1000000) ? p : null;
}

function firstText(selectors) {
  for (const s of selectors) {
    const el = document.querySelector(s);
    if (el && (el.innerText || el.textContent || '').trim()) {
      return (el.innerText || el.textContent).trim();
    }
  }
  return '';
}

function extractStockAndPrice(vendor) {
  let inStock = true;
  let quantity = null;
  let currentPrice = null;
  let signalsFound = 0;

  // Try schema.org JSON-LD first — the most reliable cross-vendor signal.
  try {
    const jsonLdNodes = document.querySelectorAll('script[type="application/ld+json"]');
    for (const node of jsonLdNodes) {
      try {
        const data = JSON.parse(node.textContent || '{}');
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          const offers = item?.offers ? (Array.isArray(item.offers) ? item.offers : [item.offers]) : [];
          for (const offer of offers) {
            const avail = String(offer.availability || '').toLowerCase();
            if (avail.includes('outofstock') || avail.includes('discontinued') || avail.includes('soldout')) {
              inStock = false; signalsFound++;
            } else if (avail.includes('instock') || avail.includes('preorder') || avail.includes('limitedavailability')) {
              inStock = true; signalsFound++;
            }
            if (offer.price) {
              const p = parseFloat(String(offer.price));
              if (!isNaN(p) && p > 0) { currentPrice = p; signalsFound++; }
            }
          }
        }
      } catch {}
    }
  } catch {}

  if (vendor === 'amazon') {
    const availTxt = firstText(['#availability', '#outOfStock', '#availability_feature_div', '#exports_desktop_qualifiedBuybox_feature_div']).toLowerCase();
    if (/currently unavailable|temporarily out of stock|out of stock|no longer available/i.test(availTxt)) {
      inStock = false; signalsFound++;
    } else if (/in stock/i.test(availTxt)) {
      inStock = true; signalsFound++;
    }
    const qtyMatch = availTxt.match(/only\s+(\d+)\s+left/i);
    if (qtyMatch) { quantity = parseInt(qtyMatch[1]); signalsFound++; }
    if (currentPrice === null) {
      const priceTxt = firstText([
        '.a-price.priceToPay .a-offscreen',
        '.a-price[data-a-color="base"] .a-offscreen',
        '#corePrice_feature_div .a-offscreen',
        '#corePriceDisplay_desktop_feature_div .a-offscreen',
        '.a-price .a-offscreen',
      ]);
      const p = parsePriceText(priceTxt);
      if (p) { currentPrice = p; signalsFound++; }
    }
  } else if (vendor === 'ebay') {
    const bodyTxt = (document.body.innerText || '').toLowerCase().slice(0, 50000);
    if (/this listing has ended|out of stock|no longer available|sold out/i.test(bodyTxt)) {
      inStock = false; signalsFound++;
    }
    const availTxt = firstText(['.x-quantity__availability', '.d-quantity', '#qtySubTxt']);
    const qtyMatch = (availTxt || bodyTxt).match(/(\d+)\s+available/i);
    if (qtyMatch) {
      const q = parseInt(qtyMatch[1]);
      if (q >= 0 && q < 100000) { quantity = q; signalsFound++; }
    }
    if (currentPrice === null) {
      const priceEl = document.querySelector('[itemprop="price"]') ||
                      document.querySelector('.x-price-primary span') ||
                      document.querySelector('.display-price') ||
                      document.querySelector('.x-bin-price__content .ux-textspans');
      const priceTxt = priceEl ? (priceEl.getAttribute('content') || priceEl.innerText || priceEl.textContent || '') : '';
      const p = parsePriceText(priceTxt);
      if (p) { currentPrice = p; signalsFound++; }
    }
  } else if (vendor === 'aliexpress') {
    const bodyTxt = (document.body.innerText || '').toLowerCase().slice(0, 50000);
    if (/this item is no longer available|out of stock|sold out/i.test(bodyTxt)) {
      inStock = false; signalsFound++;
    }
    if (currentPrice === null) {
      const priceTxt = firstText([
        '.product-price-current',
        '[class*="price--current"]',
        '[class*="price-current"]',
        '.uniform-banner-box-price',
      ]);
      const p = parsePriceText(priceTxt);
      if (p) { currentPrice = p; signalsFound++; }
    }
  } else if (vendor === 'walmart') {
    const bodyTxt = (document.body.innerText || '').toLowerCase().slice(0, 50000);
    if (/out of stock|not available|currently unavailable/i.test(bodyTxt)) {
      inStock = false; signalsFound++;
    }
    if (currentPrice === null) {
      const priceTxt = firstText(['[itemprop="price"]', '[data-testid="price-wrap"] span', '.price-characteristic']);
      const p = parsePriceText(priceTxt);
      if (p) { currentPrice = p; signalsFound++; }
    }
  } else if (vendor === 'etsy') {
    const bodyTxt = (document.body.innerText || '').toLowerCase().slice(0, 50000);
    if (/out of stock|sold out|no longer available/i.test(bodyTxt)) {
      inStock = false; signalsFound++;
    }
    if (currentPrice === null) {
      const priceTxt = firstText(['[data-buy-box-region="price"] .currency-value', '[data-selector="price-only"]', '.wt-text-title-larger']);
      const p = parsePriceText(priceTxt);
      if (p) { currentPrice = p; signalsFound++; }
    }
  } else if (vendor === 'shein') {
    const bodyTxt = (document.body.innerText || '').toLowerCase().slice(0, 50000);
    if (/sold out|out of stock/i.test(bodyTxt)) {
      inStock = false; signalsFound++;
    }
    if (currentPrice === null) {
      const priceTxt = firstText(['.product-intro__head-price', '.from .price', '[class*="discountPrice"]']);
      const p = parsePriceText(priceTxt);
      if (p) { currentPrice = p; signalsFound++; }
    }
  }

  return { inStock, quantity, currentPrice, signalsFound };
}

async function reportStockToBackend() {
  try {
    const vendor = detectVendor();
    if (vendor === 'unknown' || !isProductPage(vendor)) return;

    const stored = await chrome.storage.local.get(['apiUrl', 'apiKey', 'uniqueUrl', 'lastStockReport']);
    if (!stored.apiUrl || !stored.apiKey || !stored.uniqueUrl) return;

    // background.js (v2.2.0+) opens vendor pages in invisible tabs with a
    // sentinel hash fragment so we know to bypass the throttle and report
    // a fresh signal even if this URL was reported recently. We also
    // throttle/store under the URL with that marker stripped so that a
    // user-driven visit a few minutes later still throttles correctly.
    const isBackgroundSyncVisit = (window.location.hash || '').includes('dse-bg-sync=1');
    const throttleKey = window.location.href.replace(/[#&]?dse-bg-sync=1/g, '').replace(/#$/, '');
    const reportUrl = throttleKey;

    // Throttle: don't report the same URL more than once per 30 minutes,
    // unless this is an extension-driven background-sync visit.
    const lastReports = stored.lastStockReport || {};
    const lastTs = lastReports[throttleKey] || 0;
    if (!isBackgroundSyncVisit && (Date.now() - lastTs) < 30 * 60 * 1000) return;

    const data = extractStockAndPrice(vendor);
    // Only send if we extracted at least one real signal (price or explicit OOS).
    // Otherwise we'd be sending "in stock with no price" which is just noise.
    if (data.signalsFound === 0) return;
    if (data.inStock === true && data.currentPrice === null && data.quantity === null) return;

    const payload = {
      reports: [{
        sourceUrl: reportUrl,
        inStock: data.inStock,
        quantity: data.quantity,
        currentPrice: data.currentPrice,
      }],
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const resp = await fetch(`${stored.apiUrl}/api/extension/vendor-stock-report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': stored.apiKey,
        'X-Unique-URL': stored.uniqueUrl,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (resp.ok) {
      const result = await resp.json();
      if (result && result.matched > 0) {
        console.log('%c[DropandSell] Stock auto-synced ✓', 'color:#10b981;font-weight:bold', result);
      }
      // Update throttle map (cap at 100 entries to avoid storage bloat).
      // Always key by the URL with the background-sync marker stripped so
      // user visits and background-sync visits share one throttle entry.
      const updated = { ...lastReports, [throttleKey]: Date.now() };
      const keys = Object.keys(updated);
      if (keys.length > 100) {
        const sorted = keys.sort((a, b) => updated[b] - updated[a]).slice(0, 100);
        const trimmed = {};
        for (const k of sorted) trimmed[k] = updated[k];
        await chrome.storage.local.set({ lastStockReport: trimmed });
      } else {
        await chrome.storage.local.set({ lastStockReport: updated });
      }
    } else if (resp.status !== 401) {
      console.log('[DropandSell] Stock report rejected:', resp.status);
    }
  } catch (e) {
    if (e.name !== 'AbortError') console.log('[DropandSell] Stock report failed:', e.message);
  }
}

// Wait until the vendor page has had a chance to render (some are SPA-heavy)
// then report once. We deliberately avoid running on every URL change in
// SPAs to keep the impact on the user's browsing minimal.
function scheduleReport() {
  if (document.readyState === 'complete') {
    setTimeout(reportStockToBackend, 3500);
  } else {
    window.addEventListener('load', () => setTimeout(reportStockToBackend, 3500), { once: true });
  }
}

scheduleReport();

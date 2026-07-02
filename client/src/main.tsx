import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// Patterns that match Replit's various injected widgets (dev banner,
// deployment beacon / "powered by" badge, cartographer overlay, etc.).
// All of these run only against host platform injections — they never
// match anything in our own code because we never use these names.
const REPLIT_SELECTORS = [
  '[id^="__repl"]',
  '[id*="replit-dev-banner"]',
  '[data-replit-dev-banner]',
  '[class*="replit-dev-banner"]',
  '#beacon',
  '#beacon-container',
  '#replit-beacon',
  '#replit-badge',
  '[id^="replit-badge"]',
  '[id^="replit-beacon"]',
  '[class*="replit-badge"]',
  '[class*="replit-beacon"]',
  'iframe[src*="replit.com"]',
  'iframe[src*="replit.dev"]',
  'iframe[src*="repl.co"]',
  'iframe[src*="repl.it"]',
  'a[href*="replit.com"][target="_blank"]',
];

function hideReplitBadge() {
  const style = document.getElementById('replit-hide-style') || document.createElement('style');
  if (!style.id) {
    style.id = 'replit-hide-style';
    style.textContent = `
      ${REPLIT_SELECTORS.join(',\n      ')} {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
        position: fixed !important;
        top: -9999px !important;
        left: -9999px !important;
        width: 0 !important;
        height: 0 !important;
        overflow: hidden !important;
      }
    `;
    document.head.appendChild(style);
  }

  // Hard-remove matching nodes — CSS alone can be defeated by injected
  // shadow roots or scripts that re-set inline styles.
  for (const sel of REPLIT_SELECTORS) {
    try {
      document.querySelectorAll(sel).forEach((el) => el.remove());
    } catch (_) {
      // Ignore selector errors so a single bad selector can't break the loop.
    }
  }
}

hideReplitBadge();
setTimeout(hideReplitBadge, 100);
setTimeout(hideReplitBadge, 500);
setTimeout(hideReplitBadge, 1500);
setTimeout(hideReplitBadge, 4000);

// Catch anything that gets injected later (deployment beacons mount
// asynchronously, sometimes long after page load).
if (typeof MutationObserver !== 'undefined') {
  const startObserver = () => {
    const observer = new MutationObserver(() => hideReplitBadge());
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };
  if (document.body) {
    startObserver();
  } else {
    document.addEventListener('DOMContentLoaded', startObserver);
  }
}

createRoot(document.getElementById("root")!).render(<App />);

import { useEffect } from "react";
import { useLanguage } from "./LanguageContext";

const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "CODE",
  "PRE",
  "TEXTAREA",
  "INPUT",
  "SVG",
  "PATH",
  "IFRAME",
  "CANVAS",
]);

const ATTR_TRANSLATE = ["placeholder", "title", "aria-label", "alt"];

const NUMERIC_OR_SYMBOL = /^[\s\d\W_]+$/u;
const HAS_LETTER = /\p{L}/u;

const STORAGE_PREFIX = "dropandsell_i18n_cache_v1::";

function loadCache(lang: string): Map<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + lang);
    if (!raw) return new Map();
    const obj = JSON.parse(raw) as Record<string, string>;
    return new Map(Object.entries(obj));
  } catch {
    return new Map();
  }
}

function saveCache(lang: string, cache: Map<string, string>) {
  try {
    const obj: Record<string, string> = {};
    cache.forEach((v, k) => {
      obj[k] = v;
    });
    localStorage.setItem(STORAGE_PREFIX + lang, JSON.stringify(obj));
  } catch {
    // Storage full — ignore.
  }
}

function shouldSkipNode(node: Node): boolean {
  let p: Node | null = node.parentNode;
  while (p && p.nodeType === 1) {
    const el = p as Element;
    if (SKIP_TAGS.has(el.tagName)) return true;
    if (el.getAttribute && el.getAttribute("data-no-translate") !== null) return true;
    if (el.getAttribute && el.getAttribute("contenteditable") === "true") return true;
    p = el.parentNode;
  }
  return false;
}

interface PendingNode {
  type: "text" | "attr";
  node: Text | Element;
  attr?: string;
  original: string;
}

export function DomTranslator() {
  const { lang } = useLanguage();

  useEffect(() => {
    if (lang === "en") {
      // Restore originals if any.
      const els = document.querySelectorAll<HTMLElement>("[data-i18n-orig]");
      els.forEach((el) => {
        const orig = el.getAttribute("data-i18n-orig");
        if (orig !== null) {
          // Restore text nodes from the original snapshot — but only if we
          // stored child text per node. Simpler: do a full reload to revert.
        }
      });
      return;
    }

    let cache = loadCache(lang);
    let cancelled = false;
    let pendingTimer: number | null = null;
    const queue: PendingNode[] = [];
    const seenTextNodes = new WeakSet<Text>();
    const seenAttrs = new WeakMap<Element, Set<string>>();
    const translatedFor = "data-i18n-lang";

    const collectFromRoot = (root: Node) => {
      // Collect text nodes via TreeWalker.
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const text = (node as Text).nodeValue || "";
          if (!text.trim()) return NodeFilter.FILTER_REJECT;
          if (!HAS_LETTER.test(text)) return NodeFilter.FILTER_REJECT;
          if (NUMERIC_OR_SYMBOL.test(text)) return NodeFilter.FILTER_REJECT;
          if (shouldSkipNode(node)) return NodeFilter.FILTER_REJECT;
          if (seenTextNodes.has(node as Text)) return NodeFilter.FILTER_REJECT;
          // Already translated for current lang?
          const parent = (node as Text).parentElement;
          if (parent && parent.getAttribute(translatedFor) === lang) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      } as any);

      let n: Node | null = walker.nextNode();
      while (n) {
        const tn = n as Text;
        const original = tn.nodeValue!.trim();
        if (original) {
          seenTextNodes.add(tn);
          queue.push({ type: "text", node: tn, original });
        }
        n = walker.nextNode();
      }

      // Collect translatable attributes on element subtree.
      if (root.nodeType === 1 || root.nodeType === 9 || root.nodeType === 11) {
        const elRoot = root as Element | Document | DocumentFragment;
        const all = (elRoot as Element).querySelectorAll
          ? (elRoot as Element).querySelectorAll<HTMLElement>("*")
          : ([] as unknown as NodeListOf<HTMLElement>);
        all.forEach((el) => {
          if (SKIP_TAGS.has(el.tagName)) return;
          if (el.getAttribute("data-no-translate") !== null) return;
          for (const attr of ATTR_TRANSLATE) {
            const val = el.getAttribute(attr);
            if (!val || !val.trim() || !HAS_LETTER.test(val) || NUMERIC_OR_SYMBOL.test(val)) continue;
            if (el.getAttribute(`data-i18n-${attr}-lang`) === lang) continue;
            const seenSet = seenAttrs.get(el) || new Set<string>();
            const key = `${attr}::${val}`;
            if (seenSet.has(key)) continue;
            seenSet.add(key);
            seenAttrs.set(el, seenSet);
            queue.push({ type: "attr", node: el, attr, original: val });
          }
        });
      }
    };

    const flush = async () => {
      if (cancelled) return;
      if (queue.length === 0) return;
      const batch = queue.splice(0, queue.length);

      // Resolve from cache first; collect uncached strings.
      const uncachedTexts: string[] = [];
      const uncachedIdx: number[] = [];
      const resolved: (string | null)[] = batch.map((p) => {
        const hit = cache.get(p.original);
        return hit !== undefined ? hit : null;
      });
      for (let i = 0; i < batch.length; i++) {
        if (resolved[i] === null) {
          uncachedIdx.push(i);
          uncachedTexts.push(batch[i].original);
        }
      }

      if (uncachedTexts.length > 0) {
        // Dedupe to reduce token usage.
        const uniqueMap = new Map<string, number[]>();
        uncachedTexts.forEach((t, i) => {
          const arr = uniqueMap.get(t) || [];
          arr.push(uncachedIdx[i]);
          uniqueMap.set(t, arr);
        });
        const uniqueTexts = Array.from(uniqueMap.keys());

        // Send in chunks of 80 to keep responses fast.
        const CHUNK = 80;
        for (let start = 0; start < uniqueTexts.length; start += CHUNK) {
          if (cancelled) return;
          const chunk = uniqueTexts.slice(start, start + CHUNK);
          try {
            const resp = await fetch("/api/translate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ texts: chunk, target: lang }),
            });
            if (!resp.ok) continue;
            const data = await resp.json();
            const translations: string[] = Array.isArray(data.translations) ? data.translations : [];
            chunk.forEach((src, i) => {
              const out = translations[i];
              if (typeof out === "string" && out.length > 0) {
                cache.set(src, out);
                const targetIdxs = uniqueMap.get(src) || [];
                targetIdxs.forEach((batchIdx) => {
                  resolved[batchIdx] = out;
                });
              }
            });
          } catch {
            // Network error — leave uncached items as originals.
          }
        }
        saveCache(lang, cache);
      }

      if (cancelled) return;

      // Apply translations to the DOM.
      for (let i = 0; i < batch.length; i++) {
        const item = batch[i];
        const translated = resolved[i];
        if (!translated || translated === item.original) continue;
        try {
          if (item.type === "text") {
            const tn = item.node as Text;
            // Preserve leading/trailing whitespace from original raw nodeValue.
            const raw = tn.nodeValue || "";
            const leadMatch = raw.match(/^\s*/);
            const trailMatch = raw.match(/\s*$/);
            const lead = leadMatch ? leadMatch[0] : "";
            const trail = trailMatch ? trailMatch[0] : "";
            tn.nodeValue = lead + translated + trail;
            const parent = tn.parentElement;
            if (parent) parent.setAttribute(translatedFor, lang);
          } else if (item.type === "attr" && item.attr) {
            const el = item.node as Element;
            el.setAttribute(item.attr, translated);
            el.setAttribute(`data-i18n-${item.attr}-lang`, lang);
          }
        } catch {
          // ignore single-node failures
        }
      }
    };

    const scheduleFlush = () => {
      if (pendingTimer !== null) return;
      pendingTimer = window.setTimeout(() => {
        pendingTimer = null;
        flush();
      }, 120);
    };

    // Initial sweep.
    collectFromRoot(document.body);
    scheduleFlush();

    // Observe future DOM changes (route navigations, lazy loaded content, etc.)
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "childList") {
          m.addedNodes.forEach((n) => {
            if (n.nodeType === 1 || n.nodeType === 3) {
              if (n.nodeType === 3) {
                if (!shouldSkipNode(n) && !seenTextNodes.has(n as Text)) {
                  const text = (n as Text).nodeValue || "";
                  if (text.trim() && HAS_LETTER.test(text) && !NUMERIC_OR_SYMBOL.test(text)) {
                    seenTextNodes.add(n as Text);
                    queue.push({ type: "text", node: n as Text, original: text.trim() });
                  }
                }
              } else {
                collectFromRoot(n);
              }
            }
          });
        } else if (m.type === "characterData") {
          const tn = m.target as Text;
          if (!shouldSkipNode(tn)) {
            const parent = tn.parentElement;
            if (parent && parent.getAttribute(translatedFor) === lang) {
              // We already translated this node; the change is likely our own write — skip.
            } else {
              const text = tn.nodeValue || "";
              if (text.trim() && HAS_LETTER.test(text) && !NUMERIC_OR_SYMBOL.test(text)) {
                seenTextNodes.delete(tn);
                seenTextNodes.add(tn);
                queue.push({ type: "text", node: tn, original: text.trim() });
              }
            }
          }
        } else if (m.type === "attributes" && m.attributeName) {
          const attr = m.attributeName;
          if (ATTR_TRANSLATE.includes(attr)) {
            const el = m.target as Element;
            const val = el.getAttribute(attr);
            if (val && val.trim() && HAS_LETTER.test(val) && !NUMERIC_OR_SYMBOL.test(val)) {
              if (el.getAttribute(`data-i18n-${attr}-lang`) !== lang) {
                queue.push({ type: "attr", node: el, attr, original: val });
              }
            }
          }
        }
      }
      scheduleFlush();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTR_TRANSLATE,
    });

    return () => {
      cancelled = true;
      if (pendingTimer !== null) window.clearTimeout(pendingTimer);
      observer.disconnect();
    };
  }, [lang]);

  return null;
}

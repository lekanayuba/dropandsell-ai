const CURRENT_VERSION = '2.3.4';

// ---------- INSTALL / STARTUP ----------
chrome.runtime.onInstalled.addListener(() => {
  console.log('DropandSell Automation App extension installed v' + CURRENT_VERSION);
  checkForUpdate();
  scheduleAlarms();
});

chrome.runtime.onStartup.addListener(() => {
  checkForUpdate();
  scheduleAlarms();
});

function scheduleAlarms() {
  // Hourly version check
  chrome.alarms.create('updateCheck', { periodInMinutes: 60 });
  // Hourly background stock refresh — first run after 5 min so we don't
  // hammer the network the moment the browser opens.
  chrome.alarms.create('backgroundStockSync', { periodInMinutes: 60, delayInMinutes: 5 });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'updateCheck') {
    checkForUpdate();
  } else if (alarm.name === 'backgroundStockSync') {
    runBackgroundStockSync().catch(e => console.log('[DropandSell BG sync] alarm handler error:', e?.message));
  }
});

// ---------- VERSION CHECK ----------
async function checkForUpdate() {
  try {
    const stored = await chrome.storage.local.get(['apiUrl']);
    if (!stored.apiUrl) return;

    const response = await fetch(`${stored.apiUrl}/api/extension/version`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) return;

    const data = await response.json();
    if (data.version && data.version !== CURRENT_VERSION) {
      await chrome.storage.local.set({
        updateAvailable: true,
        latestVersion: data.version,
        changelog: data.changelog || ''
      });
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
      console.log('[DropandSell] Update available: v' + data.version);
    } else {
      await chrome.storage.local.set({ updateAvailable: false });
      chrome.action.setBadgeText({ text: '' });
    }
  } catch (e) {
    console.log('[DropandSell] Update check failed:', e.message);
  }
}

// ---------- BACKGROUND STOCK SYNC ----------
// Every hour the extension asks the server "which of my products need a
// stock check?" and silently opens up to 5 vendor pages in invisible
// background tabs. The content script (already shipped in v2.1.0) extracts
// stock + price as soon as each page loads and POSTs it back, so all this
// background.js does is: open tab → wait for page-load + report → close tab
// → wipe the URL out of browser history. Tabs never come into focus,
// never disturb the user.
const SYNC_BATCH_SIZE = 5;
const TAB_LOAD_TIMEOUT_MS = 30000;     // give the page up to 30s to fully load
const POST_LOAD_WAIT_MS = 6000;        // content.js waits 3.5s then reports — give it headroom
const STALE_LOCK_MS = 10 * 60 * 1000;  // if previous cycle hung, allow restart after 10 min
const MIN_GAP_MS = 30000;              // 30-60s randomised gap between tabs
const GAP_RANGE_MS = 30000;
// Sentinel fragment appended to URLs we open in invisible background tabs.
// content.js (v2.2.0+) detects this and bypasses its 30-min throttle so the
// background sync ALWAYS gets a fresh report. The marker is in a fragment,
// which servers never see, so vendor sites are unaffected.
const BG_SYNC_MARKER = '#dse-bg-sync=1';

function appendSyncMarker(url) {
  if (!url) return url;
  if (url.includes('dse-bg-sync=1')) return url;
  // If URL already has a fragment, append with & so we don't break it.
  if (url.includes('#')) return url + '&dse-bg-sync=1';
  return url + BG_SYNC_MARKER;
}

async function runBackgroundStockSync() {
  let stored;
  try {
    stored = await chrome.storage.local.get([
      'apiUrl', 'apiKey', 'uniqueUrl',
      'backgroundSyncEnabled', 'backgroundSyncInProgress',
    ]);
  } catch (e) {
    console.log('[DropandSell BG sync] storage read failed:', e.message);
    return;
  }

  // Default ON — only skip when the user has explicitly disabled it.
  if (stored.backgroundSyncEnabled === false) return;
  if (!stored.apiUrl || !stored.apiKey || !stored.uniqueUrl) return;

  // Concurrency guard: if a cycle is already running (or crashed without
  // releasing the lock), short-circuit. Lock auto-expires after 10 min.
  if (stored.backgroundSyncInProgress && (Date.now() - stored.backgroundSyncInProgress) < STALE_LOCK_MS) {
    console.log('[DropandSell BG sync] another cycle already in progress, skipping');
    return;
  }

  // chrome.storage.local has no atomic CAS, so two near-simultaneous triggers
  // (alarm + "Sync now" + service-worker rehydration) could both pass the
  // lock check. Mitigation: write a unique nonce alongside the lock, wait a
  // short settle window, then re-read. If the nonce isn't ours any more,
  // another cycle won the race — abort.
  const lockNonce = Math.random().toString(36).slice(2) + ':' + Date.now();
  await chrome.storage.local.set({
    backgroundSyncInProgress: Date.now(),
    backgroundSyncNonce: lockNonce,
  });
  await sleep(75);
  const verify = await chrome.storage.local.get('backgroundSyncNonce');
  if (verify.backgroundSyncNonce !== lockNonce) {
    console.log('[DropandSell BG sync] lost lock race, aborting');
    return;
  }

  let attemptedCount = 0;
  let refreshedCount = 0;

  try {
    // 1. Fetch the priority queue from the server.
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 15000);
    let queueResp;
    try {
      queueResp = await fetch(`${stored.apiUrl}/api/extension/stock-monitor-queue?limit=${SYNC_BATCH_SIZE}`, {
        method: 'GET',
        headers: {
          'X-API-Key': stored.apiKey,
          'X-Unique-URL': stored.uniqueUrl,
        },
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(tid);
    }

    if (!queueResp.ok) {
      console.log('[DropandSell BG sync] queue fetch failed:', queueResp.status);
      return;
    }
    const data = await queueResp.json();
    const items = (data.items || []).filter(it => it && it.sourceUrl);
    if (items.length === 0) {
      console.log('[DropandSell BG sync] queue is empty — nothing to refresh');
      return;
    }

    // 2. Skip URLs the user already has open — we'd just collide with the
    //    passive content-script report, and we don't want to focus or
    //    duplicate one of their tabs.
    let openUrls = new Set();
    try {
      const allTabs = await chrome.tabs.query({});
      openUrls = new Set(allTabs.map(t => (t.url || '').split('#')[0]).filter(Boolean));
    } catch {}
    const toCheck = items.filter(it => !openUrls.has(it.sourceUrl.split('#')[0]));
    console.log(`[DropandSell BG sync] cycle starting: ${toCheck.length}/${items.length} URL(s) to check`);

    // 3. Process one URL at a time with a randomised gap between each.
    //    Sequential (not parallel) so we don't slam the user's bandwidth
    //    or trip vendor bot detection.
    for (let i = 0; i < toCheck.length; i++) {
      const item = toCheck[i];
      attemptedCount++;
      try {
        const ok = await openHiddenTabAndAwaitReport(item.sourceUrl);
        if (ok) refreshedCount++;
      } catch (e) {
        console.log('[DropandSell BG sync] item failed:', item.sourceUrl, e?.message);
      }
      if (i < toCheck.length - 1) {
        const gap = MIN_GAP_MS + Math.random() * GAP_RANGE_MS;
        await sleep(gap);
      }
    }

    await chrome.storage.local.set({
      lastBackgroundSync: Date.now(),
      lastBackgroundSyncAttempted: attemptedCount,
      lastBackgroundSyncRefreshed: refreshedCount,
    });
    console.log(`[DropandSell BG sync] cycle complete: ${refreshedCount}/${attemptedCount} refreshed`);
  } catch (e) {
    console.log('[DropandSell BG sync] cycle error:', e?.message);
  } finally {
    try {
      await chrome.storage.local.remove(['backgroundSyncInProgress', 'backgroundSyncNonce']);
    } catch {}
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Open `url` in an invisible background tab, wait for the page to fully
// load + the content script to fire its stock report, then close the tab
// and conditionally wipe the entry out of browser history. Returns true
// if we believe the report was sent.
//
// Throttle handling:
//   We append a `#dse-bg-sync=1` sentinel fragment so content.js (v2.2.0+)
//   knows to bypass its 30-minute throttle. content.js stores its throttle
//   timestamp under the URL with the marker stripped, so future user visits
//   to the same URL still throttle correctly.
//
// History handling:
//   chrome.history.deleteUrl({url}) removes ALL visits for a URL, including
//   ones the user made themselves. To respect that, we check whether the
//   user had pre-existing history for this URL BEFORE we opened the tab —
//   if yes, we leave history alone (the new visit blends in). Only when
//   the URL was never visited before do we clean up our own visit.
async function openHiddenTabAndAwaitReport(url) {
  const cleanUrl = url; // already marker-free as we received it from the queue
  const navUrl = appendSyncMarker(url);

  // Snapshot lastStockReport keyed by the URL content.js will store under
  // (the marker-stripped URL). Lets us detect whether content.js fired.
  let beforeTs = 0;
  try {
    const before = await chrome.storage.local.get('lastStockReport');
    beforeTs = (before.lastStockReport || {})[cleanUrl] || 0;
  } catch {}

  // Check whether the user had any pre-existing history for this URL.
  // If yes, skip our history cleanup later to avoid wiping their record.
  let hadPreExistingHistory = false;
  try {
    if (chrome.history && chrome.history.getVisits) {
      const visits = await chrome.history.getVisits({ url: cleanUrl });
      hadPreExistingHistory = Array.isArray(visits) && visits.length > 0;
    }
  } catch {}

  let tabId = null;
  try {
    const tab = await chrome.tabs.create({ url: navUrl, active: false, pinned: false });
    if (!tab || !tab.id) return false;
    tabId = tab.id;
  } catch (e) {
    console.log('[DropandSell BG sync] tab create failed:', e?.message);
    return false;
  }

  // Wait for the tab to reach "complete", then give content.js extra time
  // to do its 3.5s post-load delay + the network roundtrip to our server.
  let pageLoaded = false;
  const startTs = Date.now();
  while (Date.now() - startTs < TAB_LOAD_TIMEOUT_MS) {
    await sleep(1500);
    try {
      const t = await chrome.tabs.get(tabId);
      if (t.status === 'complete') { pageLoaded = true; break; }
    } catch {
      pageLoaded = false;
      break;
    }
  }

  let reported = false;
  if (pageLoaded) {
    await sleep(POST_LOAD_WAIT_MS);
    try {
      const after = await chrome.storage.local.get('lastStockReport');
      const afterTs = (after.lastStockReport || {})[cleanUrl] || 0;
      reported = afterTs > beforeTs;
    } catch {}
  }

  // Always close the tab — invisible or not, leaving it open would pile up.
  try { await chrome.tabs.remove(tabId); } catch {}

  // Privacy-safe history cleanup: only delete if the user had no prior
  // visits to this URL. We try to delete both the marker and the clean
  // form because Chrome may have recorded either (deleteUrl is a no-op
  // if the URL is absent).
  if (!hadPreExistingHistory) {
    try {
      if (chrome.history && chrome.history.deleteUrl) {
        await chrome.history.deleteUrl({ url: navUrl });
        await chrome.history.deleteUrl({ url: cleanUrl });
      }
    } catch {}
  }

  return reported;
}

// ---------- MESSAGES ----------
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'log') {
    console.log('[DropandSell]', request.message);
  }
  if (request.action === 'checkUpdate') {
    checkForUpdate().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (request.action === 'runBackgroundSyncNow') {
    runBackgroundStockSync()
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: e?.message }));
    return true;
  }
  return true;
});

// ---------- EXTERNAL CONNECT (unchanged from v2.1.0) ----------
const TRUSTED_CONNECT_HOSTS = [
  'dropandsell.online',
  'www.dropandsell.online',
  'app.dropandsell.online',
];

function isTrustedSenderUrl(url) {
  if (!url || typeof url !== 'string') return false;
  let parsed;
  try {
    parsed = new URL(url);
  } catch (_) {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  const host = parsed.hostname.toLowerCase();
  if (TRUSTED_CONNECT_HOSTS.includes(host)) return true;
  if (host.endsWith('.dropandsell.online')) return true;
  return false;
}

chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      if (!isTrustedSenderUrl(sender && sender.url)) {
        console.log('[DropandSell] Rejected external message from untrusted sender:', sender && sender.url);
        sendResponse({ ok: false, message: 'Sender not trusted' });
        return;
      }
      if (!request || request.type !== 'DROPANDSELL_CONNECT') {
        sendResponse({ ok: false, message: 'Unknown message type' });
        return;
      }
      const { apiUrl, uniqueUrl, apiKey } = request.payload || {};
      if (!apiUrl || !uniqueUrl || !apiKey) {
        sendResponse({ ok: false, message: 'Missing credentials' });
        return;
      }

      let payloadUrl;
      try {
        payloadUrl = new URL(String(apiUrl));
      } catch (_) {
        sendResponse({ ok: false, message: 'Invalid apiUrl' });
        return;
      }
      const senderUrl = new URL(sender.url);
      if (payloadUrl.origin !== senderUrl.origin) {
        console.log('[DropandSell] apiUrl origin mismatch:', payloadUrl.origin, 'vs', senderUrl.origin);
        sendResponse({ ok: false, message: 'apiUrl does not match sender origin' });
        return;
      }

      const cleanedUrl = payloadUrl.origin;
      await chrome.storage.local.set({
        apiUrl: cleanedUrl,
        uniqueUrl: String(uniqueUrl),
        apiKey: String(apiKey),
      });

      try { chrome.action.setBadgeText({ text: '' }); } catch (_) {}

      console.log('[DropandSell] Account connected via website link');
      sendResponse({ ok: true });
    } catch (e) {
      console.log('[DropandSell] External connect failed:', e?.message);
      sendResponse({ ok: false, message: e?.message || 'Unknown error' });
    }
  })();
  return true;
});

let productData = null;
let apiUrl = '';
let apiKey = '';
let uniqueUrl = '';
// Drop-and-Sell extension mode — populated lazily the first time the user
// flips the "List Into" picker to "Drop-and-Sell". Cached for the lifetime
// of the popup so picking different products doesn't re-fetch each time.
let dropAndSellOrders = [];
let dropAndSellOrdersLoaded = false;

async function loadDropAndSellOrders() {
  if (!apiUrl || !apiKey || !uniqueUrl) {
    dropAndSellOrders = [];
    return;
  }
  try {
    const response = await fetch(`${apiUrl}/api/extension/drop-and-sell/orders`, {
      headers: { 'X-API-Key': apiKey, 'X-Unique-URL': uniqueUrl }
    });
    if (!response.ok) {
      console.log('[DropandSell] DROSEL orders endpoint returned', response.status);
      dropAndSellOrders = [];
      return;
    }
    dropAndSellOrders = await response.json();
  } catch (e) {
    console.log('[DropandSell] Could not load DROSEL assignments:', e?.message);
    dropAndSellOrders = [];
  } finally {
    dropAndSellOrdersLoaded = true;
  }
}

function renderDropAndSellOrders() {
  const select = document.getElementById('dropandsellOrderSelect');
  const hint = document.getElementById('dropandsellHint');
  if (!select || !hint) return;
  select.innerHTML = '';
  if (!dropAndSellOrders.length) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'No active assignments — apply on the Drop-and-Sell page';
    select.appendChild(opt);
    hint.textContent = 'You will only see assignments where the customer has paid AND the order is still in progress.';
    renderDropAndSellStorePicker(null);
    return;
  }
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Pick a customer assignment…';
  select.appendChild(placeholder);
  dropAndSellOrders.forEach(o => {
    const opt = document.createElement('option');
    opt.value = String(o.orderId);
    const ebayLabel = o.customerEbayUsername ? ` @${o.customerEbayUsername}` : '';
    opt.textContent = `DAS-${o.orderId} • ${o.customerName}${ebayLabel} • ${o.remaining}/${o.listingCount} left`;
    if (!o.ebayStoreReady) {
      opt.disabled = true;
      opt.textContent += ' (eBay not connected)';
    }
    select.appendChild(opt);
  });
  hint.textContent = `${dropAndSellOrders.length} active assignment${dropAndSellOrders.length === 1 ? '' : 's'}. Title, images, variations & price will be pushed directly into the customer's eBay store.`;

  // Re-render the per-store picker whenever the lister switches assignment.
  // We bind once; subsequent renders just refresh the options.
  if (!select.dataset.storePickerBound) {
    select.addEventListener('change', () => {
      const oid = parseInt(select.value || '', 10);
      const picked = dropAndSellOrders.find(o => o.orderId === oid) || null;
      renderDropAndSellStorePicker(picked);
    });
    select.dataset.storePickerBound = '1';
  }
  renderDropAndSellStorePicker(null);
}

// Shows the per-store picker only when the chosen customer has more
// than one connected eBay store. Defaults to whichever store the order
// is pinned to (e.g. funma70 for Margaret).
function renderDropAndSellStorePicker(order) {
  const wrap = document.getElementById('dropandsellStoreWrapper');
  const sel = document.getElementById('dropandsellStoreSelect');
  const hint = document.getElementById('dropandsellStoreHint');
  if (!wrap || !sel || !hint) return;
  const stores = Array.isArray(order?.ebayStores) ? order.ebayStores : [];
  if (stores.length < 2) {
    wrap.style.display = 'none';
    sel.innerHTML = '';
    return;
  }
  wrap.style.display = 'block';
  sel.innerHTML = '';
  const hasDefault = stores.some(s => s.isDefault);
  // When no real default exists, force the lister to pick. A disabled
  // placeholder option keeps the native <select> from auto-choosing the
  // first store.
  if (!hasDefault) {
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.disabled = true;
    placeholder.selected = true;
    placeholder.textContent = 'Pick which eBay store…';
    sel.appendChild(placeholder);
  }
  let defaultId = '';
  stores.forEach(s => {
    const opt = document.createElement('option');
    opt.value = String(s.id);
    opt.textContent = `@${s.username || ('store-' + s.id)}${s.isDefault ? ' — default' : ''}${s.ready === false ? ' (not linked)' : ''}`;
    if (s.ready === false) opt.disabled = true;
    if (s.isDefault) defaultId = String(s.id);
    sel.appendChild(opt);
  });
  if (defaultId) sel.value = defaultId;
  hint.textContent = hasDefault
    ? `This customer has ${stores.length} eBay stores connected. Default is pre-selected — switch if you need to.`
    : `This customer has ${stores.length} eBay stores connected. Pick which one to list into.`;
}

const vendorNames = {
  amazon: 'Amazon',
  aliexpress: 'AliExpress',
  ebay: 'eBay',
  walmart: 'Walmart',
  etsy: 'Etsy',
  shein: 'Shein',
  unknown: 'Other Vendor'
};

document.addEventListener('DOMContentLoaded', async () => {
  const stored = await chrome.storage.local.get(['apiUrl', 'apiKey', 'uniqueUrl', 'updateAvailable', 'latestVersion', 'changelog']);
  apiUrl = stored.apiUrl ? cleanApiUrl(stored.apiUrl) : '';
  apiKey = stored.apiKey || '';
  uniqueUrl = stored.uniqueUrl || '';
  
  if (stored.updateAvailable) {
    const banner = document.getElementById('updateBanner');
    const changelogEl = document.getElementById('updateChangelog');
    if (banner) banner.classList.add('visible');
    if (changelogEl) changelogEl.textContent = stored.changelog || ('v' + stored.latestVersion + ' is available');
    document.getElementById('updateBtn').addEventListener('click', () => {
      if (apiUrl) {
        chrome.tabs.create({ url: apiUrl + '/settings' });
      }
      window.close();
    });
  }
  
  if (stored.apiUrl && apiUrl !== stored.apiUrl) {
    await chrome.storage.local.set({ apiUrl });
    console.log('[DropandSell] Cleaned API URL from', stored.apiUrl, 'to', apiUrl);
  }
  
  setupEventListeners();

  // The toolbar popup always closes when it loses focus (standard Chrome
  // behaviour) — e.g. when you click the page or switch tabs. To let users keep
  // working while they switch tabs, "Keep open" re-opens this same UI in its own
  // detached window, which stays put until they close it themselves.
  const isDetachedWindow = new URLSearchParams(location.search).get('window') === '1';
  const popoutBtn = document.getElementById('popoutBtn');
  if (popoutBtn) {
    if (isDetachedWindow) {
      popoutBtn.style.display = 'none';
    } else {
      popoutBtn.addEventListener('click', async () => {
        try {
          await chrome.windows.create({
            url: chrome.runtime.getURL('popup.html?window=1'),
            type: 'popup',
            width: 420,
            height: 720,
          });
          window.close();
        } catch (e) {
          console.log('[DropandSell] Could not open detached window:', e?.message);
        }
      });
    }
  }
  
  if (apiUrl && apiKey && uniqueUrl) {
    // Verify credentials are still valid before showing product section
    const isValid = await verifyCredentials();
    if (isValid) {
      showProductSection();
    } else {
      // Credentials invalid, clear them and show login
      await chrome.storage.local.remove(['apiUrl', 'apiKey', 'uniqueUrl']);
      apiUrl = '';
      apiKey = '';
      uniqueUrl = '';
      showLoginSection();
    }
  } else {
    showLoginSection();
  }
});

async function verifyCredentials() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${apiUrl}/api/extension/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'X-Unique-URL': uniqueUrl
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.log('[DropandSell] Credential verification failed:', error.message);
    return false;
  }
}

function recalcSellingPrice() {
  const cost = parseFloat(document.getElementById('costPrice').value) || 0;
  const markup = parseFloat(document.getElementById('markupPercent').value) || 0;
  if (cost > 0) {
    document.getElementById('sellingPrice').value = (cost * (1 + markup / 100)).toFixed(2);
  }
}

function setupEventListeners() {
  // One-click sign in: opens the website's /extension-link page with this
  // extension's id, so the page can post our credentials back via
  // chrome.runtime.sendMessage. The website domain is whitelisted in the
  // manifest's externally_connectable.matches.
  const signInBtn = document.getElementById('signInBtn');
  if (signInBtn) {
    signInBtn.addEventListener('click', () => {
      const extId = chrome.runtime.id;
      const stored = apiUrl && apiUrl.length > 0 ? apiUrl : 'https://dropandsell.online';
      const linkUrl = `${stored.replace(/\/+$/, '')}/extension-link?ext=${encodeURIComponent(extId)}`;
      chrome.tabs.create({ url: linkUrl });
      window.close();
    });
  }

  // Manual setup fallback toggle.
  const manualLink = document.getElementById('manualSetupLink');
  if (manualLink) {
    manualLink.addEventListener('click', (e) => {
      e.preventDefault();
      const form = document.getElementById('manualSetupForm');
      if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
    });
  }

  // Live-refresh the popup when credentials arrive from the website.
  if (chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;
      if (changes.apiUrl || changes.apiKey || changes.uniqueUrl) {
        chrome.storage.local.get(['apiUrl', 'apiKey', 'uniqueUrl'], (s) => {
          apiUrl = s.apiUrl ? cleanApiUrl(s.apiUrl) : '';
          apiKey = s.apiKey || '';
          uniqueUrl = s.uniqueUrl || '';
          if (apiUrl && apiKey && uniqueUrl) {
            showProductSection();
          }
        });
      }
    });
  }

  document.getElementById('connectBtn').addEventListener('click', handleConnect);
  document.getElementById('importBtn').addEventListener('click', handleImport);
  document.getElementById('cancelBtn').addEventListener('click', () => window.close());
  document.getElementById('disconnectLink').addEventListener('click', handleDisconnect);
  document.getElementById('viewInventoryBtn').addEventListener('click', () => {
    const inventoryUrl = uniqueUrl ? `${apiUrl}/u/${uniqueUrl}/inventory` : `${apiUrl}/inventory`;
    chrome.tabs.create({ url: inventoryUrl });
    window.close();
  });
  document.getElementById('importAnotherBtn').addEventListener('click', () => {
    showProductSection();
  });
  document.getElementById('retryBtn').addEventListener('click', () => {
    showProductSection();
  });
  
  document.getElementById('generateDescBtn').addEventListener('click', handleGenerateDescription);
  document.getElementById('deliveryType').addEventListener('change', (e) => {
    const costGroup = document.getElementById('deliveryCostGroup');
    costGroup.style.display = e.target.value === 'free' ? 'none' : 'block';
  });

  // "List Into" picker — toggles between My Inventory (default) and the
  // Drop-and-Sell flow that pushes the listing into a paying customer's
  // connected eBay store. The customer-assignment dropdown is loaded
  // lazily the first time the user flips this picker to dropandsell.
  const targetMode = document.getElementById('targetMode');
  const dropandsellWrapper = document.getElementById('dropandsellTargetWrapper');
  if (targetMode && dropandsellWrapper) {
    targetMode.addEventListener('change', async (e) => {
      const isDropAndSell = e.target.value === 'dropandsell';
      dropandsellWrapper.style.display = isDropAndSell ? 'block' : 'none';
      const importBtn = document.getElementById('importBtn');
      const btnText = importBtn?.querySelector('.btn-text');
      if (btnText) btnText.textContent = isDropAndSell ? "List on Customer's eBay" : 'Add to Inventory';
      if (isDropAndSell) {
        if (!dropAndSellOrdersLoaded) {
          const select = document.getElementById('dropandsellOrderSelect');
          if (select) {
            select.innerHTML = '';
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'Loading your assignments…';
            select.appendChild(opt);
          }
          await loadDropAndSellOrders();
        }
        renderDropAndSellOrders();
      }
    });
  }

  chrome.storage.local.get(['markupPercent'], (result) => {
    if (result.markupPercent !== undefined) {
      document.getElementById('markupPercent').value = result.markupPercent;
    }
  });

  document.getElementById('markupPercent').addEventListener('input', () => {
    const markup = parseFloat(document.getElementById('markupPercent').value) || 0;
    chrome.storage.local.set({ markupPercent: markup });
    recalcSellingPrice();
  });

  document.getElementById('costPrice').addEventListener('input', () => {
    recalcSellingPrice();
  });

  // Background-sync toggle: persists immediately to chrome.storage so the
  // service worker honours the new value on its next alarm fire.
  const bgToggle = document.getElementById('backgroundSyncToggle');
  if (bgToggle) {
    bgToggle.addEventListener('change', async (e) => {
      try {
        await chrome.storage.local.set({ backgroundSyncEnabled: !!e.target.checked });
        loadBackgroundSyncSettings();
      } catch (err) {
        console.log('[DropandSell] Toggle save failed:', err?.message);
      }
    });
  }

  // "Sync now" link — asks the service worker to run a cycle immediately.
  const syncNowLink = document.getElementById('syncNowLink');
  if (syncNowLink) {
    syncNowLink.addEventListener('click', async (e) => {
      e.preventDefault();
      const orig = syncNowLink.textContent;
      syncNowLink.textContent = 'Syncing...';
      syncNowLink.style.pointerEvents = 'none';
      try {
        chrome.runtime.sendMessage({ action: 'runBackgroundSyncNow' }, () => { /* fire-and-forget */ });
      } catch (err) {
        console.log('[DropandSell] Sync-now send failed:', err?.message);
      }
      // The cycle takes 2-5 minutes (5 URLs × 30-60s gaps). Don't block the
      // popup; just refresh the status text after a short delay so the user
      // sees "Sync in progress..." appear.
      setTimeout(() => {
        loadBackgroundSyncSettings();
        syncNowLink.textContent = orig;
        syncNowLink.style.pointerEvents = '';
      }, 2500);
    });
  }
}

function showLoginSection() {
  document.getElementById('loginSection').classList.add('active');
  document.getElementById('productSection').classList.remove('active');
  document.getElementById('successSection').classList.remove('active');
  document.getElementById('errorSection').classList.remove('active');
  
  document.getElementById('apiUrl').value = apiUrl;
  document.getElementById('uniqueUrl').value = uniqueUrl;
  document.getElementById('apiKey').value = apiKey;
}

async function showProductSection() {
  document.getElementById('loginSection').classList.remove('active');
  document.getElementById('productSection').classList.add('active');
  document.getElementById('successSection').classList.remove('active');
  document.getElementById('errorSection').classList.remove('active');
  
  // Show loading state
  document.getElementById('vendorName').textContent = 'Scanning page...';
  document.getElementById('productTitle').value = '';
  document.getElementById('productTitle').placeholder = 'Extracting...';
  
  // Refresh the background-sync UI every time the popup opens.
  loadBackgroundSyncSettings();
  
  await extractProductData();
  
  // Restore placeholder
  document.getElementById('productTitle').placeholder = 'Product title';
}

// ---------- BACKGROUND SYNC SETTINGS UI (v2.2.0) ----------
async function loadBackgroundSyncSettings() {
  try {
    const stored = await chrome.storage.local.get([
      'backgroundSyncEnabled',
      'lastBackgroundSync',
      'lastBackgroundSyncAttempted',
      'lastBackgroundSyncRefreshed',
      'backgroundSyncInProgress',
    ]);
    const enabled = stored.backgroundSyncEnabled !== false; // default ON
    const toggle = document.getElementById('backgroundSyncToggle');
    if (toggle) toggle.checked = enabled;
    
    const status = document.getElementById('backgroundSyncStatus');
    if (!status) return;
    if (stored.backgroundSyncInProgress && (Date.now() - stored.backgroundSyncInProgress) < 10 * 60 * 1000) {
      status.textContent = 'Sync in progress...';
      return;
    }
    if (stored.lastBackgroundSync) {
      const mins = Math.round((Date.now() - stored.lastBackgroundSync) / 60000);
      const ago = mins < 1 ? 'just now' : mins < 60 ? `${mins} min ago` : `${Math.round(mins / 60)} hr ago`;
      const refreshed = stored.lastBackgroundSyncRefreshed || 0;
      const attempted = stored.lastBackgroundSyncAttempted || 0;
      status.textContent = enabled
        ? `Last auto-sync: ${ago} — refreshed ${refreshed} of ${attempted} product(s).`
        : 'Auto-sync is off.';
    } else {
      status.textContent = enabled ? 'Auto-sync starts within an hour.' : 'Auto-sync is off.';
    }
  } catch (e) {
    console.log('[DropandSell] loadBackgroundSyncSettings failed:', e?.message);
  }
}

function showSuccessSection(opts) {
  document.getElementById('loginSection').classList.remove('active');
  document.getElementById('productSection').classList.remove('active');
  document.getElementById('successSection').classList.add('active');
  document.getElementById('errorSection').classList.remove('active');
  // Optional override so the Drop-and-Sell flow can show a custom message
  // ("Listing 3 of 10 for Jane Doe is live.") while the personal flow keeps
  // its default copy ("The product has been added to your inventory.").
  if (opts && (opts.title || opts.message)) {
    const titleEl = document.querySelector('#successSection h2');
    const msgEl = document.querySelector('#successSection [data-testid="text-success-message"]');
    if (titleEl && opts.title) titleEl.textContent = opts.title;
    if (msgEl && opts.message) msgEl.textContent = opts.message;
  } else {
    const titleEl = document.querySelector('#successSection h2');
    const msgEl = document.querySelector('#successSection [data-testid="text-success-message"]');
    if (titleEl) titleEl.textContent = 'Success!';
    if (msgEl) msgEl.textContent = 'The product has been added to your inventory.';
  }
}

function showErrorSection(message) {
  document.getElementById('loginSection').classList.remove('active');
  document.getElementById('productSection').classList.remove('active');
  document.getElementById('successSection').classList.remove('active');
  document.getElementById('errorSection').classList.add('active');
  document.getElementById('errorMessage').textContent = message;
}

function cleanApiUrl(rawUrl) {
  let url = rawUrl.trim().replace(/\/+$/, '');
  url = url.replace(/\/u\/[^/]+.*$/, '');
  url = url.replace(/\/(inventory|dashboard|settings|stores|vendors|orders|wallet|automation|policies|onboarding|faq).*$/, '');
  return url;
}

async function handleConnect() {
  let url = cleanApiUrl(document.getElementById('apiUrl').value);
  const unique = document.getElementById('uniqueUrl').value.trim();
  const key = document.getElementById('apiKey').value.trim();
  
  if (!url || !key || !unique) {
    alert('Please enter URL, Unique URL code, and API key');
    return;
  }
  
  document.getElementById('apiUrl').value = url;
  
  const btn = document.getElementById('connectBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="loading"><span class="spinner"></span> Connecting...</span>';
  
  try {
    const response = await fetch(`${url}/api/extension/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': key,
        'X-Unique-URL': unique
      }
    });
    
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Invalid credentials');
    }
    
    apiUrl = url;
    apiKey = key;
    uniqueUrl = unique;
    await chrome.storage.local.set({ apiUrl, apiKey, uniqueUrl });
    
    showProductSection();
  } catch (error) {
    alert(error.message || 'Failed to connect. Please check your credentials.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Connect';
  }
}

async function handleDisconnect(e) {
  e.preventDefault();
  await chrome.storage.local.remove(['apiUrl', 'apiKey', 'uniqueUrl']);
  apiUrl = '';
  apiKey = '';
  uniqueUrl = '';
  showLoginSection();
}


async function extractProductData() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.id) {
      console.error('[DropandSell] No active tab found');
      showExtractionError('No active tab found. Please open a product page.');
      return;
    }
    
    // Check if we can access this URL
    const url = tab.url || '';
    console.log('[DropandSell] Tab URL:', url);
    console.log('[DropandSell] Tab ID:', tab.id);
    console.log('[DropandSell] Tab status:', tab.status);
    
    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('about:') || url.startsWith('edge://')) {
      showExtractionError('Cannot extract from browser pages. Navigate to a product page.');
      return;
    }
    
    // Wait for tab to be fully loaded
    if (tab.status !== 'complete') {
      console.log('[DropandSell] Waiting for page to load...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const isShein = url.includes('shein.') || url.includes('sheIn.');
    if (isShein) {
      console.log('[DropandSell] Shein detected — waiting extra for SPA render...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    console.log('[DropandSell] Extracting from tab:', url);
    
    // Try to execute script
    let results;
    try {
      results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: scrapeProductData
      });
      console.log('[DropandSell] Script execution successful');
    } catch (scriptError) {
      console.error('[DropandSell] Script injection failed:', scriptError.message);
      console.error('[DropandSell] Full error:', scriptError);
      productData = { 
        vendor: detectVendorFromUrl(url), 
        title: tab.title || '', 
        description: '', 
        price: 0, 
        image: '', 
        images: [],
        sku: '', 
        sourceUrl: url 
      };
      console.log('[DropandSell] Using fallback data:', productData);
      populateForm(productData);
      return;
    }
    
    console.log('[DropandSell] Raw extraction results:', JSON.stringify(results, null, 2));
    
    if (results && results[0] && results[0].result) {
      productData = results[0].result;
      console.log('[DropandSell] Product data extracted successfully:');
      console.log('[DropandSell] - Title:', productData.title);
      console.log('[DropandSell] - Price:', productData.price);
      console.log('[DropandSell] - Image:', productData.image ? 'Found' : 'Not found');
      console.log('[DropandSell] - Images:', (productData.images || []).length, 'found');
      console.log('[DropandSell] - Vendor:', productData.vendor);
      console.log('[DropandSell] - SKU:', productData.sku);

      if (isShein && !productData.image) {
        console.log('[DropandSell] Shein image not found on first attempt, retrying after delay...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        try {
          const retryResults = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: scrapeProductData
          });
          if (retryResults && retryResults[0] && retryResults[0].result) {
            const retryData = retryResults[0].result;
            if (retryData.image) {
              productData.image = retryData.image;
              console.log('[DropandSell] Shein retry found image:', retryData.image.substring(0, 80));
            }
            if (!productData.title && retryData.title) productData.title = retryData.title;
            if (!productData.price && retryData.price) productData.price = retryData.price;
          }
        } catch (retryErr) {
          console.log('[DropandSell] Shein retry failed:', retryErr.message);
        }
      }

      populateForm(productData);
    } else {
      console.log('[DropandSell] No product data in results, using tab info');
      productData = { 
        vendor: detectVendorFromUrl(url), 
        title: tab.title || '', 
        description: '', 
        price: 0, 
        image: '', 
        images: [],
        sku: '', 
        sourceUrl: url 
      };
      console.log('[DropandSell] Fallback data:', productData);
      populateForm(productData);
    }
  } catch (error) {
    console.error('[DropandSell] Failed to extract product data:', error.message);
    console.error('[DropandSell] Stack:', error.stack);
    showExtractionError('Failed to extract product data. Try refreshing the page.');
  }
}

function detectVendorFromUrl(url) {
  if (url.includes('amazon.')) return 'amazon';
  if (url.includes('aliexpress.')) return 'aliexpress';
  if (url.includes('ebay.')) return 'ebay';
  if (url.includes('walmart.com')) return 'walmart';
  if (url.includes('etsy.com')) return 'etsy';
  if (url.includes('shein.') || url.includes('sheIn.')) return 'shein';
  return 'unknown';
}

function showExtractionError(message) {
  document.getElementById('vendorName').textContent = 'Manual Entry';
  document.getElementById('productImageContainer').innerHTML = `<div class="no-image">${message}</div>`;
  document.getElementById('productTitle').value = '';
  document.getElementById('productDescription').value = '';
  document.getElementById('costPrice').value = '';
  document.getElementById('sellingPrice').value = '';
  document.getElementById('sku').value = generateSKU();
}

function scrapeProductData() {
  console.log('[DropandSell Scraper] Starting product scrape v1.7.4...');
  const url = window.location.href;
  console.log('[DropandSell Scraper] URL:', url);
  
  let vendor = 'unknown';
  let title = '';
  let description = '';
  let price = 0;
  let image = '';
  let images = [];
  let sku = '';
  
  function extractPrice(text) {
    if (!text) return 0;
    const cleaned = text.replace(/[^0-9.,]/g, '').replace(',', '');
    const parsed = parseFloat(cleaned) || 0;
    console.log('[DropandSell Scraper] Extracted price:', parsed, 'from text:', text);
    return parsed;
  }
  
  function getMetaContent(name) {
    const content = document.querySelector(`meta[property="${name}"]`)?.content ||
           document.querySelector(`meta[name="${name}"]`)?.content || '';
    if (content) {
      console.log('[DropandSell Scraper] Found meta', name, ':', content.substring(0, 50));
    }
    return content;
  }

  function getJsonLdData() {
    try {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of scripts) {
        const data = JSON.parse(script.textContent);
        let product = null;
        if (data['@type'] === 'Product') {
          product = data;
        } else if (Array.isArray(data['@graph'])) {
          product = data['@graph'].find(i => i['@type'] === 'Product');
        } else if (Array.isArray(data)) {
          product = data.find(i => i['@type'] === 'Product');
        }
        if (product) {
          console.log('[DropandSell Scraper] Found JSON-LD Product data');
          return product;
        }
      }
    } catch (e) {
      console.log('[DropandSell Scraper] JSON-LD parse error:', e.message);
    }
    return null;
  }

  function trySelectors(selectors, attribute) {
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el) {
          const val = attribute ? el.getAttribute(attribute) : el.textContent?.trim();
          if (val && val.length > 0) {
            console.log('[DropandSell Scraper] Found with selector:', sel);
            return val;
          }
        }
      } catch (e) {}
    }
    return '';
  }

  function extractDescription(selectors) {
    for (const sel of selectors) {
      try {
        const els = document.querySelectorAll(sel);
        if (els.length > 1) {
          const texts = Array.from(els).map(el => el.textContent?.trim()).filter(t => t && t.length > 5);
          if (texts.length > 0) {
            const joined = texts.join('\n');
            console.log('[DropandSell Scraper] Found description with selector (multi):', sel, '- items:', texts.length);
            return joined.substring(0, 2000);
          }
        } else if (els.length === 1) {
          const text = els[0].textContent?.trim();
          if (text && text.length > 10) {
            console.log('[DropandSell Scraper] Found description with selector:', sel, '- length:', text.length);
            return text.substring(0, 2000);
          }
        }
      } catch (e) {}
    }
    return '';
  }

  function upscaleImageUrl(src) {
    if (!src) return src;
    if (src.includes('amazon.') || src.includes('media-amazon.com') || src.includes('images-amazon.com')) {
      return src
        .replace(/\._[A-Z]{2}\d+[_,A-Za-z0-9]*_\./, '._SL1500_.')
        .replace(/\._[A-Z]{2}\d+[_,A-Za-z0-9]*_$/, '._SL1500_')
        .replace(/\._S[A-Z]\d+_\./, '._SL1500_.')
        .replace(/\._AC_US\d+_\./, '._SL1500_.')
        .replace(/\._AC_S[XY]\d+_\./, '._SL1500_.')
        .replace(/\._AC_UL\d+_\./, '._SL1500_.')
        .replace(/\._AC_SR\d+,\d+_\./, '._SL1500_.');
    }
    if (src.includes('ebayimg.com')) {
      return src.replace(/\/s-l\d+\./g, '/s-l1600.').replace(/\/s-l\d+$/g, '/s-l1600');
    }
    if (src.includes('walmart.') || src.includes('walmartimages.com')) {
      return src.replace(/\/\d+x\d+\//g, '/1500x1500/').replace(/odnWidth=\d+/g, 'odnWidth=1500').replace(/odnHeight=\d+/g, 'odnHeight=1500');
    }
    if (src.includes('etsystatic.com')) {
      return src.replace(/il_\d+x\d+/g, 'il_1588xN');
    }
    if (src.includes('alicdn.com') || src.includes('aliexpress.')) {
      return src.replace(/_\d+x\d+\./g, '.').replace(/\.\d+x\d+\./g, '.').replace(/_\d+x\d+$/g, '');
    }
    // Dunelm — Adobe Scene7 (assets.dunelm.com/is/image/...). Force largest preset.
    if (src.includes('assets.dunelm.com') || src.includes('dunelm.scene7.com')) {
      const base = src.split('?')[0];
      return base + '?$pdp_main$&wid=1600&hei=1600&fmt=jpg&qlt=85';
    }
    // Temu / Pinduoduo CDN — strip trailing _NxN / _NwN size markers in path.
    if (src.includes('kwcdn.com') || src.includes('img.temu.') || src.includes('aimg.kwcdn.com') || src.includes('temu.com')) {
      return src
        .replace(/_(\d{2,4})x(\d{2,4})(\.|_|$)/g, '$3')
        .replace(/_(\d{2,4})w(\.|_|$)/g, '$2')
        .replace(/_thumbnail(\.|_|$)/g, '$1')
        .replace(/\?imageView2.*$/g, '')
        .replace(/\?imageMogr2.*$/g, '');
    }
    // B&Q (diy.com) — Kingfisher Adobe Scene7.
    if (src.includes('media.diy.com') || src.includes('diy.com/is/image')) {
      const base = src.split('?')[0];
      return base + '?$MOB_PREV$&wid=1600&hei=1600&fmt=jpg&qlt=85';
    }
    // TKMaxx — Adobe Scene7 (tkmaxx.scene7.com or media.tjxeurope.com).
    if (src.includes('tkmaxx.scene7.com') || src.includes('tjxeurope.com') || src.includes('tjmaxx.scene7.com')) {
      const base = src.split('?')[0];
      return base + '?$Browse$&wid=1600&hei=1600&fmt=jpg&qlt=85';
    }
    // Booths — typically Shopify CDN. Strip _NxN from filename.
    if (src.includes('cdn.shopify.com') || src.includes('booths.co.uk')) {
      return src
        .replace(/_(pico|icon|thumb|small|compact|medium|large|grande|original|master|\d{2,4}x\d{0,4}|\d{2,4}x|x\d{2,4})\.(jpe?g|png|webp|avif)/i, '_1600x1600.$2')
        .replace(/_(pico|icon|thumb|small|compact|medium|large|grande|\d{2,4}x\d{0,4})(\?|$)/i, '_1600x1600$2');
    }
    // Tesco — digitalcontent.tesco.com / digitalcontent.api.tesco.com.
    if (src.includes('digitalcontent.api.tesco.com') || src.includes('digitalcontent.tesco.com') || src.includes('tesco.com/groceries')) {
      return src
        .replace(/[?&]h=\d+/g, '')
        .replace(/[?&]w=\d+/g, '')
        .replace(/\?$/, '')
        .replace(/\?&/, '?') + (src.includes('?') ? '&h=1600&w=1600' : '?h=1600&w=1600');
    }
    // Generic Adobe Scene7 (any /is/image/ URL) — last-resort upscale for sites
    // that use Scene7 without our explicit detection above.
    if (src.match(/\/is\/image\//i) && !src.includes('amazon')) {
      const base = src.split('?')[0];
      return base + '?wid=1600&hei=1600&fmt=jpg&qlt=85';
    }
    return src;
  }

  function pickLargestFromSrcset(srcset) {
    if (!srcset || typeof srcset !== 'string') return '';
    let best = '';
    let bestW = 0;
    srcset.split(',').forEach(part => {
      const [u, descriptor] = part.trim().split(/\s+/);
      if (!u) return;
      const w = descriptor && descriptor.endsWith('w') ? parseInt(descriptor) || 0 : 0;
      if (w >= bestW) {
        bestW = w;
        best = u;
      }
    });
    return best;
  }

  function collectImages(selectors, attribute, filterFn) {
    const found = [];
    const seen = new Set();
    for (const sel of selectors) {
      try {
        const els = document.querySelectorAll(sel);
        for (const el of els) {
          let src = el.dataset?.oldHires || el.dataset?.aHiResImage || el.getAttribute('data-old-hires') || el.getAttribute('data-a-dynamic-image') || '';
          if (src && src.startsWith('{')) {
            try {
              const parsed = JSON.parse(src);
              const urls = Object.keys(parsed);
              src = urls.reduce((best, url) => {
                const dims = parsed[url];
                const bestDims = parsed[best] || [0, 0];
                return (dims[0] * dims[1]) > (bestDims[0] * bestDims[1]) ? url : best;
              }, urls[0] || '');
            } catch { src = ''; }
          }
          if (!src) src = attribute ? el.getAttribute(attribute) : null;
          // Prefer the highest-res entry from srcset / data-srcset before falling back to src.
          if (!src) src = pickLargestFromSrcset(el.getAttribute('data-srcset') || el.getAttribute('srcset') || '');
          if (!src) src = el.getAttribute('data-src') || el.getAttribute('data-zoom-image') || el.getAttribute('data-large-image') || el.getAttribute('data-image') || el.getAttribute('data-original') || el.src || '';
          if (src && src.startsWith('//')) src = 'https:' + src;
          if (!src || src.includes('data:') || src.includes('placeholder') || src.length < 10) continue;
          if (filterFn && !filterFn(src)) continue;
          src = upscaleImageUrl(src);
          const normalized = src.split('?')[0].replace(/_\d+x\d+/, '').replace(/\._[A-Z]{2}\d+[_,A-Za-z0-9]*_\./, '.').replace(/\/s-l\d+/g, '/s-l0');
          if (seen.has(normalized)) continue;
          seen.add(normalized);
          found.push(src);
          if (found.length >= 12) return found;
        }
      } catch (e) {}
    }
    return found;
  }

  const jsonLd = getJsonLdData();
  
  if (url.includes('amazon.')) {
    vendor = 'amazon';
    console.log('[DropandSell Scraper] Detected Amazon page');
    
    const titleSelectors = [
      '#productTitle',
      '#title span',
      '[data-feature-name="title"]',
      'h1#title',
      'h1.product-title-word-break',
      '#titleSection h1',
      '#bylineInfo_feature_div + div h1',
      '[data-csa-c-type="widget"] h1 span'
    ];
    title = trySelectors(titleSelectors);
    if (!title) title = jsonLd?.name || getMetaContent('og:title') || '';
    
    const priceSelectors = [
      '.a-price .a-offscreen',
      '#priceblock_ourprice',
      '#priceblock_dealprice', 
      '#corePrice_feature_div .a-offscreen',
      '#corePriceDisplay_desktop_feature_div .a-offscreen',
      '.a-price-whole',
      '[data-a-color="price"] .a-offscreen',
      '#tp_price_block_total_price_ww .a-offscreen',
      '.priceToPay .a-offscreen',
      '#apex_desktop .a-offscreen',
      '#price_inside_buybox',
      '#newBuyBoxPrice',
      '.apexPriceToPay .a-offscreen',
      '#apex_desktop_newAccordionRow .a-offscreen',
      '#corePrice_desktop .a-offscreen'
    ];
    for (const sel of priceSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const extractedPrice = extractPrice(el.textContent);
        if (extractedPrice > 0) {
          price = extractedPrice;
          break;
        }
      }
    }
    if (!price && jsonLd?.offers) {
      const offer = Array.isArray(jsonLd.offers) ? jsonLd.offers[0] : jsonLd.offers;
      price = parseFloat(offer?.price) || 0;
    }
    
    const imageSelectors = [
      '#landingImage',
      '#imgBlkFront',
      '#main-image-container img',
      '#imageBlock img',
      '#imgTagWrapperId img',
      '.imgTagWrapper img',
      '#ivLargeImage img',
      '#mainImageContainer img',
      '#ebooksImgBlkFront'
    ];
    for (const sel of imageSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        image = el.dataset?.oldHires || el.dataset?.aHiResImage || el.src || '';
        if (image) break;
      }
    }
    if (!image) image = jsonLd?.image?.[0] || jsonLd?.image || getMetaContent('og:image') || '';
    image = upscaleImageUrl(image);
    
    images = collectImages([
      '#altImages img', '#imageBlock img', '#imageBlockNew img',
      '#imageBlock_feature_div img', '.imageThumbnail img',
      '#altImages .a-button-thumbnail img', '.a-dynamic-image',
      '#ivThumbs img', '#ivLargeImage img'
    ]);
    if (images.length === 0 && jsonLd?.image) {
      images = (Array.isArray(jsonLd.image) ? jsonLd.image.slice(0, 12) : [jsonLd.image]).map(upscaleImageUrl);
    }
    if (image && !images.includes(image)) images.unshift(image);
    images = images.filter(src => !src.includes('sprite') && !src.includes('icon') && !src.includes('play-button'));
    
    description = extractDescription([
      '#feature-bullets li span.a-list-item',
      '#feature-bullets li',
      '#feature-bullets ul li',
      '[data-feature-name="featurebullets"] li span',
      '#productFactsDesktopExpander li',
      '#aplus_feature_div .aplus-v2 p',
      '#aplus_feature_div p',
      '#productDescription p',
      '#productDescription',
      '#bookDescription_feature_div .a-expander-content',
      '#bookDescription_feature_div span',
      '[data-a-expander-name="book_description_expander"] span',
      '#detailBullets_feature_div li span.a-list-item',
      '#detailBulletsWrapper_feature_div li',
      '#aplus3p_feature_div p'
    ]);
    if (!description && jsonLd?.description) {
      description = jsonLd.description.substring(0, 2000);
      console.log('[DropandSell Scraper] Using JSON-LD description');
    }
    if (!description) {
      description = getMetaContent('og:description') || getMetaContent('description') || '';
    }
    
    sku = document.querySelector('[data-asin]')?.dataset?.asin || 
          document.querySelector('input[name="ASIN"]')?.value ||
          url.match(/\/dp\/([A-Z0-9]+)/i)?.[1] || 
          url.match(/\/gp\/product\/([A-Z0-9]+)/i)?.[1] || '';
    
  } else if (url.includes('aliexpress.')) {
    vendor = 'aliexpress';
    console.log('[DropandSell Scraper] Detected AliExpress page');
    title = trySelectors([
      'h1[data-pl="product-title"]',
      '[data-pl="product-title"]',
      'h1.product-title-text',
      'h1',
    ]);
    if (!title) title = jsonLd?.name || getMetaContent('og:title') || '';
    
    const priceSelectors = [
      '[class*="price--current"] span',
      '[class*="price--current"]',
      '[class*="product-price-value"]',
      '[class*="uniform-banner-box-price"]',
      '.product-price-current',
      '[class*="es--wrap"] span[class*="notranslate"]',
      '[data-pl="product-price"]'
    ];
    for (const sel of priceSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        price = extractPrice(el.textContent);
        if (price > 0) break;
      }
    }
    if (!price && jsonLd?.offers) {
      const offer = Array.isArray(jsonLd.offers) ? jsonLd.offers[0] : jsonLd.offers;
      price = parseFloat(offer?.price) || 0;
    }
    
    image = trySelectors([
      '[class*="magnifier--image"] img',
      '.product-image img',
      '[class*="slider--img"] img',
      '[class*="slider--img"]',
      'img[class*="magnifier"]',
      '[class*="image-view"] img',
      'img.product-img'
    ], 'src');
    if (!image) image = jsonLd?.image?.[0] || jsonLd?.image || getMetaContent('og:image') || '';
    image = upscaleImageUrl(image);
    
    images = collectImages([
      '[class*="slider--img"] img', '[class*="image-view"] img',
      '[class*="magnifier--image"] img', '.product-image img',
      'img[class*="magnifier"]', 'img.product-img',
      '[class*="slider--item"] img', '[class*="images-view"] img'
    ], 'src');
    if (images.length === 0 && jsonLd?.image) {
      images = (Array.isArray(jsonLd.image) ? jsonLd.image.slice(0, 12) : [jsonLd.image]).map(upscaleImageUrl);
    }
    if (image && !images.includes(image)) images.unshift(image);
    
    description = extractDescription([
      '[class*="product-description"] p',
      '[class*="product-description"]',
      '[class*="detail-desc"] p',
      '[class*="detail-desc"]',
      '[class*="ProductDescription"] p',
      '[class*="ProductDescription"]',
      '[data-pl="product-description"]',
      '[class*="specification"] li',
      '[class*="product-specs"] li',
      '[class*="sku-property"] li',
      '.product-overview li'
    ]);
    if (!description && jsonLd?.description) {
      description = jsonLd.description.substring(0, 2000);
    }
    if (!description) {
      description = getMetaContent('og:description') || getMetaContent('description') || '';
    }
    
    sku = url.match(/\/item\/(\d+)/)?.[1] || url.match(/\/(\d+)\.html/)?.[1] || '';
    
  } else if (url.includes('ebay.')) {
    vendor = 'ebay';
    console.log('[DropandSell Scraper] Detected eBay page');
    title = trySelectors([
      'h1.x-item-title__mainTitle span.ux-textspans--BOLD',
      'h1.x-item-title__mainTitle span',
      'h1[class*="title"] span',
      '.x-item-title__mainTitle',
      'h1[class*="item-title"]',
      'h1[itemprop="name"]',
      '#itemTitle',
    ]);
    if (!title) title = jsonLd?.name || getMetaContent('og:title') || '';
    
    const priceSelectors = [
      '.x-price-primary span.ux-textspans',
      '[class*="x-price-primary"] span',
      '#prcIsum',
      '[itemprop="price"]',
      '.x-bin-price__content span.ux-textspans',
      '[data-testid="x-price-primary"] span',
      '#mm-saleDscPrc',
      '.display-price'
    ];
    for (const sel of priceSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        price = extractPrice(el.textContent);
        if (price > 0) break;
      }
    }
    if (!price && jsonLd?.offers) {
      const offer = Array.isArray(jsonLd.offers) ? jsonLd.offers[0] : jsonLd.offers;
      price = parseFloat(offer?.price) || 0;
    }
    
    image = trySelectors([
      '.ux-image-carousel-item.active img',
      '.ux-image-carousel-item img',
      '[class*="ux-image-carousel-item"] img',
      '#icImg',
      'img[itemprop="image"]',
      '.ux-image-magnify__container img',
      '[data-testid="ux-image-carousel"] img'
    ], 'src');
    if (!image) image = jsonLd?.image?.[0] || jsonLd?.image || getMetaContent('og:image') || '';
    image = upscaleImageUrl(image);
    
    images = collectImages([
      '.ux-image-carousel-item img', '[class*="ux-image-carousel-item"] img',
      '[data-testid="ux-image-carousel"] img', '.ux-image-magnify__container img',
      '#vi_main_img_fs img', '.ux-image-grid img'
    ], 'src');
    if (images.length === 0 && jsonLd?.image) {
      images = (Array.isArray(jsonLd.image) ? jsonLd.image.slice(0, 12) : [jsonLd.image]).map(upscaleImageUrl);
    }
    if (image && !images.includes(image)) images.unshift(image);

    description = '';
    const descFrame = document.querySelector('#desc_ifr');
    if (descFrame) {
      try {
        if (descFrame.contentDocument && descFrame.contentDocument.body) {
          description = descFrame.contentDocument.body.textContent?.trim()?.substring(0, 2000) || '';
          console.log('[DropandSell Scraper] Got description from iframe, length:', description.length);
        }
      } catch (e) {
        console.log('[DropandSell Scraper] Cannot access iframe (cross-origin):', e.message);
      }
    }
    if (!description) {
      description = extractDescription([
        '[data-testid="ux-layout-section-evo__item"] [class*="ux-labels-values"] span',
        '[data-testid="ux-layout-section-evo__item"]',
        '#viTabs_0_is .itemAttr td',
        '.x-item-condition-text span',
        '[class*="item-specifics"] td',
        '[data-testid="x-item-description"] p',
        '[data-testid="x-about-this-item"] span',
        '.section-title--about-this-item ~ div span',
        '#desc_wrapper_ctr',
        '.x-item-description-child',
        '[itemprop="description"]',
        '.itemDescriptionWrapper',
        '#readMoreDesc'
      ]);
    }
    if (!description && jsonLd?.description) {
      description = jsonLd.description.substring(0, 2000);
    }
    if (!description) {
      description = getMetaContent('og:description') || getMetaContent('description') || '';
    }
    
    sku = url.match(/\/itm\/(\d+)/)?.[1] || '';
    
  } else if (url.includes('walmart.com')) {
    vendor = 'walmart';
    console.log('[DropandSell Scraper] Detected Walmart page');
    title = trySelectors([
      '[itemprop="name"]',
      'h1[data-automation-id="productTitle"]',
      '[data-testid="product-title"] h1',
      'h1[class*="prod-ProductTitle"]',
      'h1',
    ]);
    if (!title) title = jsonLd?.name || getMetaContent('og:title') || '';
    
    const priceSelectors = [
      '[itemprop="price"]',
      '[data-automation="product-price"]',
      '.price-characteristic',
      '[data-testid="price-wrap"] span',
      '[class*="price-group"]',
      '[data-automation-id="product-price"] span',
      '.prod-PriceHero span',
      '.price span'
    ];
    for (const sel of priceSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const p = extractPrice(el.textContent);
        if (p > 0) { price = p; break; }
      }
    }
    if (!price && jsonLd?.offers) {
      const offer = Array.isArray(jsonLd.offers) ? jsonLd.offers[0] : jsonLd.offers;
      price = parseFloat(offer?.price) || 0;
    }
    
    image = trySelectors([
      '[data-testid="hero-image-container"] img',
      '.hover-zoom-hero-image img',
      '[data-testid="media-thumbnail"] img',
      '.prod-hero-image img',
      'img[data-automation-id="hero-image"]',
      '[class*="heroImage"] img'
    ], 'src');
    if (!image) image = jsonLd?.image?.[0] || jsonLd?.image || getMetaContent('og:image') || '';
    image = upscaleImageUrl(image);
    
    images = collectImages([
      '[data-testid="hero-image-container"] img', '[data-testid="media-thumbnail"] img',
      '.hover-zoom-hero-image img', '.prod-hero-image img',
      'img[data-automation-id="hero-image"]', '[class*="heroImage"] img',
      '[data-testid="vertical-carousel"] img'
    ], 'src');
    if (images.length === 0 && jsonLd?.image) {
      images = (Array.isArray(jsonLd.image) ? jsonLd.image.slice(0, 12) : [jsonLd.image]).map(upscaleImageUrl);
    }
    if (image && !images.includes(image)) images.unshift(image);
    
    description = extractDescription([
      '[data-testid="product-description"] p',
      '[data-testid="product-description"]',
      '[data-testid="product-short-description"] p',
      '[data-testid="product-short-description"]',
      '.dangerous-html',
      '[class*="product-description"] p',
      '[class*="about-product-description"]',
      '.about-desc p',
      '[data-testid="product-highlights"] li',
      '[class*="Highlights"] li',
      '[data-automation-id="product-highlights"] li',
      '.prod-ProductHighlights li',
      '[itemprop="description"]'
    ]);
    if (!description && jsonLd?.description) {
      description = jsonLd.description.substring(0, 2000);
    }
    if (!description) {
      description = getMetaContent('og:description') || getMetaContent('description') || '';
    }
    
    sku = url.match(/\/ip\/[^\/]+\/(\d+)/)?.[1] || url.match(/\/ip\/(\d+)/)?.[1] || '';
    
  } else if (url.includes('etsy.com')) {
    vendor = 'etsy';
    console.log('[DropandSell Scraper] Detected Etsy page');
    title = trySelectors([
      'h1[data-buy-box-listing-title]',
      '[data-buy-box-listing-title] span',
      'h1.wt-text-body-01',
      'h1',
    ]);
    if (!title) title = jsonLd?.name || getMetaContent('og:title') || '';
    
    const priceSelectors = [
      '[data-buy-box-region="price"] p span',
      '[data-buy-box-region="price"] p',
      '.wt-text-title-larger',
      '[data-selector="price-only"] p',
      '.wt-text-title-03',
      '[data-appear-animation-name="price"]'
    ];
    for (const sel of priceSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        price = extractPrice(el.textContent);
        if (price > 0) break;
      }
    }
    if (!price && jsonLd?.offers) {
      const offer = Array.isArray(jsonLd.offers) ? jsonLd.offers[0] : jsonLd.offers;
      price = parseFloat(offer?.price) || 0;
    }
    
    image = trySelectors([
      '[data-carousel-first-image] img',
      '.carousel-image img',
      'img[data-listing-card-listing-image]',
      '.image-carousel-container img',
      'ul[data-carousel-pagination-list] img',
      '.wt-max-width-full img'
    ], 'src');
    if (!image) image = jsonLd?.image?.[0] || jsonLd?.image || getMetaContent('og:image') || '';
    image = upscaleImageUrl(image);
    
    images = collectImages([
      '[data-carousel-first-image] img', '.carousel-image img',
      '.image-carousel-container img', 'ul[data-carousel-pagination-list] img',
      '.wt-max-width-full img', '.listing-page-image-carousel img',
      '[data-carousel-pane] img'
    ], 'src');
    if (images.length === 0 && jsonLd?.image) {
      images = (Array.isArray(jsonLd.image) ? jsonLd.image.slice(0, 12) : [jsonLd.image]).map(upscaleImageUrl);
    }
    if (image && !images.includes(image)) images.unshift(image);
    
    description = extractDescription([
      '[data-id="description-text"] p',
      '[data-id="description-text"]',
      '#wt-content-toggle-product-details-read-more p',
      '#wt-content-toggle-product-details-read-more',
      '[data-product-details-description-text-content] p',
      '[data-product-details-description-text-content]',
      '.wt-content-toggle--truncated p',
      '.wt-content-toggle--truncated',
      '.listing-page-description p',
      '.listing-page-description',
      '[itemprop="description"]',
      '#description-text p',
      '#description-text'
    ]);
    if (!description && jsonLd?.description) {
      description = jsonLd.description.substring(0, 2000);
    }
    if (!description) {
      description = getMetaContent('og:description') || getMetaContent('description') || '';
    }
    
    sku = url.match(/listing\/(\d+)/)?.[1] || '';
    
  } else if (url.includes('shein.') || url.includes('sheIn.')) {
    vendor = 'shein';
    console.log('[DropandSell Scraper] Detected Shein page');

    title = trySelectors([
      '.product-intro__head-name',
      '.product-intro__head-title',
      'h1.product-intro__head-name',
      '.goods-detail__title',
      '.product-title',
      '[class*="goodsName"]',
      '[class*="product-intro"] h1'
    ]);
    if (!title) title = jsonLd?.name || getMetaContent('og:title') || document.querySelector('h1')?.textContent?.trim() || '';

    const priceSelectors = [
      '.product-intro__head-mainprice .from',
      '.product-intro__head-mainprice .original',
      '.product-intro__head-mainprice span',
      '.product-intro__head-price .from',
      '.product-intro__head-price span[aria-label]',
      '.goods-detail__price .from',
      '[class*="productPrice"]',
      '[class*="mainPrice"] span',
      '.original.from'
    ];
    for (const sel of priceSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const txt = el.getAttribute('aria-label') || el.textContent;
        const extractedPrice = extractPrice(txt);
        if (extractedPrice > 0) {
          price = extractedPrice;
          break;
        }
      }
    }
    if (!price && jsonLd?.offers) {
      const offer = Array.isArray(jsonLd.offers) ? jsonLd.offers[0] : jsonLd.offers;
      price = parseFloat(offer?.price) || 0;
    }

    const sheinImageSelectors = [
      '.product-intro__main-image img',
      '.product-intro__thumbs-item img',
      '.product-intro__head-img img',
      '.goods-detail__gallery img',
      '.goods-detail__main-img img',
      '.crop-image-container img',
      '.swiper-slide img[src*="img.ltwebstatic"]',
      '.swiper-slide img[data-src*="img.ltwebstatic"]',
      '[class*="goodsDetail"] img[src*="img.ltwebstatic"]',
      '[class*="gallery"] img[src*="img.ltwebstatic"]',
      '[class*="gallery"] img[src*="shein"]',
      '[class*="product-intro"] img',
      '[class*="goods-detail"] img',
      'img[src*="img.ltwebstatic"]',
      'img[data-src*="img.ltwebstatic"]',
      'img[data-before-crop-src]',
      '.she-lazyload[data-src]'
    ];
    const isProductImg = (src) => {
      if (!src || src.includes('data:') || src.includes('placeholder') || src.includes('lazy')) return false;
      if (!src.startsWith('http') && !src.startsWith('//')) return false;
      if (src.startsWith('//')) src = 'https:' + src;
      if (src.includes('img.ltwebstatic.com') && (src.includes('/images') || src.includes('_thumbnail'))) return true;
      if (src.includes('img.shein.com')) return true;
      return false;
    };
    const cleanImgSrc = (src) => {
      if (src && src.startsWith('//')) src = 'https:' + src;
      return src.replace(/_thumbnail_\d+x\d+/, '').replace(/thumbnail_\d+x/, '');
    };
    for (const sel of sheinImageSelectors) {
      try {
        const els = document.querySelectorAll(sel);
        for (const el of els) {
          const src = el.getAttribute('data-before-crop-src') || el.getAttribute('data-src') || el.src;
          if (isProductImg(src)) {
            const w = el.naturalWidth || parseInt(el.getAttribute('width')) || 0;
            if (w > 0 && w < 50) continue;
            image = cleanImgSrc(src);
            console.log('[DropandSell Scraper] Found Shein image with selector:', sel, 'src:', image.substring(0, 80));
            break;
          }
        }
        if (image) break;
      } catch (e) {}
    }
    if (!image) {
      const allImgs = document.querySelectorAll('img');
      for (const img of allImgs) {
        const src = img.getAttribute('data-before-crop-src') || img.getAttribute('data-src') || img.src;
        if (isProductImg(src)) {
          const w = img.naturalWidth || parseInt(img.getAttribute('width')) || 0;
          if (w > 0 && w < 50) continue;
          image = cleanImgSrc(src);
          console.log('[DropandSell Scraper] Found Shein image via broad scan:', image.substring(0, 80));
          break;
        }
      }
    }
    if (!image) {
      const bgEls = document.querySelectorAll('[style*="ltwebstatic"], [style*="shein"]');
      for (const el of bgEls) {
        const style = el.getAttribute('style') || '';
        const bgMatch = style.match(/url\(["']?(https?:\/\/[^"')]+)["']?\)/);
        if (bgMatch && isProductImg(bgMatch[1])) {
          image = cleanImgSrc(bgMatch[1]);
          console.log('[DropandSell Scraper] Found Shein image via background-image:', image.substring(0, 80));
          break;
        }
      }
    }
    if (!image) image = jsonLd?.image?.[0] || jsonLd?.image || getMetaContent('og:image') || '';

    images = collectImages([
      '.product-intro__thumbs-item img', '.product-intro__main-image img',
      '.product-intro__head-img img', '.goods-detail__gallery img',
      '.goods-detail__main-img img', '.crop-image-container img',
      '.swiper-slide img[src*="img.ltwebstatic"]', 'img[src*="img.ltwebstatic"]',
      'img[data-src*="img.ltwebstatic"]'
    ], null, isProductImg);
    images = images.map(cleanImgSrc);
    if (images.length === 0 && jsonLd?.image) {
      images = Array.isArray(jsonLd.image) ? jsonLd.image.slice(0, 12) : [jsonLd.image];
    }
    if (image && !images.includes(image)) images.unshift(image);

    description = extractDescription([
      '.product-intro__description-table',
      '.product-intro__description',
      '.goods-detail__description',
      '[class*="product-intro__description"]',
      '[class*="productDescription"]',
      '.product-middle__container .detail-content'
    ]);
    if (!description && jsonLd?.description) {
      description = jsonLd.description.substring(0, 2000);
    }
    if (!description) {
      description = getMetaContent('og:description') || getMetaContent('description') || '';
    }

    sku = url.match(/p-(\d+)-/)?.[1] || url.match(/-p-(\d+)/)?.[1] || url.match(/\/(\d{7,})/)?.[1] || '';

  } else {
    console.log('[DropandSell Scraper] Unknown vendor, using generic extraction');
    title = jsonLd?.name || getMetaContent('og:title') || document.querySelector('h1')?.textContent?.trim() || document.title || '';
    
    description = jsonLd?.description || '';
    if (!description) {
      description = extractDescription([
        '[itemprop="description"]',
        '.product-description',
        '#product-description',
        '.description',
        '#description',
        'main p'
      ]);
    }
    if (!description) {
      description = getMetaContent('og:description') || 
                    document.querySelector('meta[name="description"]')?.content || '';
    }
    
    image = jsonLd?.image?.[0] || jsonLd?.image || getMetaContent('og:image') || '';
    if (!image) {
      const productImgSelectors = [
        '[itemprop="image"]', '.product-image img', '.product-gallery img',
        '#product-images img', '.product-photos img', '[class*="product"] img[src]',
        '.gallery img', '.carousel img'
      ];
      for (const sel of productImgSelectors) {
        const el = document.querySelector(sel);
        if (el) {
          const src = el.getAttribute('data-src') || el.src || '';
          if (src && !src.includes('data:') && !src.includes('placeholder') && !src.includes('icon') && !src.includes('logo') && !src.includes('banner') && !src.includes('sprite') && src.length > 10) {
            image = src;
            break;
          }
        }
      }
    }
    image = upscaleImageUrl(image);

    // Generic gallery / thumbnail / zoom selectors that catch Dunelm, Temu,
    // B&Q (diy.com), TKMaxx, Booths, Tesco and most other vendor sites.
    images = collectImages([
      '[itemprop="image"]',
      '.product-image img', '.product-gallery img', '.product-photos img',
      '#product-images img', '#productImages img',
      '[data-test*="product-image"] img', '[data-test*="ProductImage"] img',
      '[data-testid*="product-image"] img', '[data-testid*="ProductImage"] img',
      '[data-auto-id*="image"] img', '[data-auto*="image"] img',
      '[class*="ProductImage"] img', '[class*="product-image"] img',
      '[class*="ProductGallery"] img', '[class*="product-gallery"] img',
      '[class*="ImageGallery"] img', '[class*="image-gallery"] img',
      '[class*="MediaGallery"] img', '[class*="media-gallery"] img',
      '[class*="Carousel"] img', '[class*="carousel"] img',
      '[class*="Slider"] img', '[class*="slider"] img',
      '[class*="Swiper"] img', '[class*="swiper"] img',
      '[class*="Thumbnail"] img', '[class*="thumbnail"] img',
      '[class*="Thumb"] img', '[class*="thumb"] img',
      '[class*="Zoom"] img', '[class*="zoom"] img',
      '[class*="Hero"] img', '[class*="hero"] img',
      '[class*="MainImage"] img', '[class*="main-image"] img',
      'picture source', 'picture img',
      'main img[src*="product"]', 'main img[data-src*="product"]',
      'main img[srcset]', 'main img[data-srcset]',
    ], 'src', (src) => {
      const lower = src.toLowerCase();
      if (lower.includes('icon') || lower.includes('logo') || lower.includes('banner') ||
          lower.includes('sprite') || lower.includes('payment') || lower.includes('badge') ||
          lower.includes('rating') || lower.includes('star') || lower.includes('social') ||
          lower.includes('favicon') || lower.includes('avatar') || lower.includes('flag-')) return false;
      return true;
    });

    if (images.length < 4 && jsonLd?.image) {
      const ldImages = (Array.isArray(jsonLd.image) ? jsonLd.image : [jsonLd.image])
        .map(it => typeof it === 'string' ? it : (it?.url || it?.contentUrl || ''))
        .filter(Boolean)
        .map(upscaleImageUrl);
      ldImages.forEach(u => { if (!images.includes(u)) images.push(u); });
    }
    if (image && !images.includes(image)) images.unshift(image);
    
    if (jsonLd?.offers) {
      const offer = Array.isArray(jsonLd.offers) ? jsonLd.offers[0] : jsonLd.offers;
      price = parseFloat(offer?.price) || 0;
    }
    if (!price) {
      const pricePatterns = document.body.innerText.match(/[\$\£\€]\s*[\d,]+\.?\d*/g);
      if (pricePatterns && pricePatterns.length > 0) {
        price = extractPrice(pricePatterns[0]);
      }
    }
  }
  
  if (description) {
    description = description.replace(/\s+/g, ' ').replace(/\n\s*\n/g, '\n').trim();
  }

  images = images.filter(src => src && !src.includes('icon') && !src.includes('logo') && !src.includes('banner') && !src.includes('sprite') && !src.includes('play-button') && !src.includes('payment') && !src.includes('badge') && !src.includes('rating') && !src.includes('star') && !src.includes('social') && !src.includes('favicon') && src.length > 10).slice(0, 12);
  if (!image && images.length > 0) image = images[0];
  
  let variations = [];
  let vendorStock = { inStock: true, quantity: null, lastChecked: new Date().toISOString() };

  try {
    if (vendor === 'amazon') {
      const sizeSelectors = [
        '#native_dropdown_selected_size_name',
        'select#native_size_name',
        '#variation_size_name select'
      ];
      for (const sel of sizeSelectors) {
        const sizeSelect = document.querySelector(sel);
        if (sizeSelect) {
          const opts = Array.from(sizeSelect.querySelectorAll('option')).filter(o => o.value && o.value !== '-1' && o.textContent.trim());
          opts.forEach(o => variations.push({ type: 'Size', value: o.textContent.trim(), available: !o.classList.contains('dropdownUnavailable') }));
          if (opts.length > 0) break;
        }
      }
      const genericSelects = document.querySelectorAll('#twister_feature_div select');
      genericSelects.forEach(sel => {
        const row = sel.closest('.a-row, .a-section');
        const labelEl = row?.querySelector('.a-form-label, label');
        const label = labelEl?.textContent?.trim()?.replace(':', '').replace(/\s+/g, ' ') || 'Option';
        if (label.toLowerCase().includes('size')) return;
        const opts = Array.from(sel.querySelectorAll('option')).filter(o => o.value && o.value !== '-1' && o.textContent.trim());
        opts.forEach(o => variations.push({ type: label, value: o.textContent.trim(), available: !o.classList.contains('dropdownUnavailable') }));
      });
      const sizeBtns = document.querySelectorAll('#variation_size_name li, [id*="size"] .a-button-inner');
      sizeBtns.forEach(btn => {
        const val = btn.querySelector('.a-button-text, .a-size-base')?.textContent?.trim() || btn.textContent?.trim();
        if (val && val.length < 30 && !val.includes('Select')) {
          const isUnavail = btn.closest('li')?.classList.contains('swatchUnavailable') || btn.closest('.a-button')?.classList.contains('a-button-unavailable');
          variations.push({ type: 'Size', value: val, available: !isUnavail });
        }
      });
      const colorBtns = document.querySelectorAll('#variation_color_name li, [data-defaultcolor] li, #variation_style_name li, #variation_pattern_name li');
      colorBtns.forEach(btn => {
        const img = btn.querySelector('img');
        const val = img?.alt || btn.querySelector('.a-button-text')?.textContent?.trim();
        if (val && val.length < 80) {
          const isUnavail = btn.classList.contains('swatchUnavailable');
          const variationType = btn.closest('#variation_style_name') ? 'Style' : btn.closest('#variation_pattern_name') ? 'Pattern' : 'Colour';
          variations.push({ type: variationType, value: val, available: !isUnavail });
        }
      });
      const twisterRows = document.querySelectorAll('#twister_feature_div .a-row');
      twisterRows.forEach(row => {
        const labelEl = row.querySelector('.a-form-label, label.a-native-dropdown');
        const label = labelEl?.textContent?.trim()?.replace(':', '').replace(/\s+/g, ' ') || '';
        if (!label || variations.some(v => v.type.toLowerCase() === label.toLowerCase())) return;
        const inlineLinks = row.querySelectorAll('.swatchSelect span.swatch-title-text, .swatchSelect .a-button-text');
        inlineLinks.forEach(el => {
          const val = el.textContent?.trim();
          if (val && val.length < 50) variations.push({ type: label || 'Option', value: val, available: true });
        });
      });
      const avail = document.querySelector('#availability span, #availability-string span, #outOfStock');
      if (avail) {
        const text = avail.textContent.trim().toLowerCase();
        vendorStock.inStock = !text.includes('out of stock') && !text.includes('currently unavailable');
        const qtyMatch = text.match(/(\d+)\s*(?:left|in stock)/);
        if (qtyMatch) vendorStock.quantity = parseInt(qtyMatch[1]);
      }
    } else if (vendor === 'ebay') {
      const menuBtns = document.querySelectorAll('[class*="x-msku"] select option, .x-msku__select-box option, [data-testid="x-msku-evo"] select option');
      menuBtns.forEach(opt => {
        if (opt.value && opt.textContent.trim() && !opt.disabled) {
          variations.push({ type: 'Option', value: opt.textContent.trim().replace(/\s*\(.*\)/, ''), available: true });
        }
      });
      const btnVariants = document.querySelectorAll('.x-msku__btn, [data-testid="x-msku-evo"] button');
      btnVariants.forEach(btn => {
        const val = btn.textContent?.trim();
        if (val && val.length < 50) variations.push({ type: 'Option', value: val, available: !btn.classList.contains('x-msku__disabled-btn') });
      });
      const qtyEl = document.querySelector('.x-quantity__availability span, [data-testid="x-quantity"] span, .d-quantity__availability span');
      if (qtyEl) {
        const text = qtyEl.textContent.trim().toLowerCase();
        vendorStock.inStock = !text.includes('out of stock') && !text.includes('sold out');
        const qtyMatch = text.match(/(\d+)\s*available/);
        if (qtyMatch) vendorStock.quantity = parseInt(qtyMatch[1]);
      }
    } else if (vendor === 'aliexpress') {
      const skuProps = document.querySelectorAll('[class*="sku-property"], [data-pl="product-sku"]');
      skuProps.forEach(prop => {
        const label = prop.querySelector('[class*="property-title"], [class*="sku-title"]')?.textContent?.trim()?.replace(':', '') || 'Option';
        const items = prop.querySelectorAll('[class*="sku-property-item"] img, [class*="sku-property-item"] span, button[class*="sku"]');
        items.forEach(item => {
          const val = item.alt || item.title || item.textContent?.trim();
          if (val && val.length < 80) variations.push({ type: label, value: val, available: true });
        });
      });
    } else if (vendor === 'walmart') {
      const variantGroups = document.querySelectorAll('[data-testid="variant-group-title"]');
      variantGroups.forEach(group => {
        const label = group.textContent?.trim()?.replace(':', '') || 'Option';
        const chips = group.closest('[class*="variant"]')?.querySelectorAll('[data-testid="variant-chip"] span, button[role="radio"] span');
        if (chips) chips.forEach(chip => {
          const val = chip.textContent?.trim();
          if (val && val.length < 50) variations.push({ type: label, value: val, available: true });
        });
      });
    } else if (vendor === 'etsy') {
      const selects = document.querySelectorAll('#variation_form select, [data-selector="listing-page-variation"] select');
      selects.forEach(sel => {
        const label = sel.closest('div')?.querySelector('label')?.textContent?.trim() || 'Option';
        Array.from(sel.querySelectorAll('option')).filter(o => o.value && o.textContent.trim() && o.value !== '').forEach(o => {
          variations.push({ type: label, value: o.textContent.trim(), available: true });
        });
      });
    } else if (vendor === 'shein') {
      const skuGroups = document.querySelectorAll('.product-intro__size-radio, .product-intro__color-radio, [class*="product-intro__size"], [class*="product-intro__color"], [class*="sku-item-sale"]');
      skuGroups.forEach(group => {
        const row = group.closest('[class*="product-intro__size"], [class*="product-intro__color"], [class*="sku-sale"]');
        const labelEl = row?.querySelector('[class*="attr-name"], [class*="title"], label') || row?.previousElementSibling;
        const label = labelEl?.textContent?.trim()?.replace(':', '') || 'Option';
        const items = group.querySelectorAll('span, button, a, [class*="radio"]');
        items.forEach(item => {
          const val = item.getAttribute('aria-label') || item.title || item.textContent?.trim();
          if (val && val.length > 0 && val.length < 80 && !val.includes('Select')) {
            const isUnavail = item.classList.contains('disabled') || item.getAttribute('aria-disabled') === 'true';
            variations.push({ type: label, value: val, available: !isUnavail });
          }
        });
      });
      const sizeSelector = document.querySelectorAll('.product-intro__size-radio-inner span, [class*="product-intro__size"] .product-intro__size-radio span');
      sizeSelector.forEach(el => {
        const val = el.textContent?.trim();
        if (val && val.length < 30 && !variations.some(v => v.type === 'Size' && v.value === val)) {
          variations.push({ type: 'Size', value: val, available: true });
        }
      });
      const colorSwatches = document.querySelectorAll('.product-intro__color-radio-item img, [class*="color-radio"] img, [class*="color-swatch"] img');
      colorSwatches.forEach(img => {
        const val = img.alt || img.title;
        if (val && val.length < 80 && !variations.some(v => v.type === 'Colour' && v.value === val)) {
          variations.push({ type: 'Colour', value: val, available: true });
        }
      });
      const attrBlocks = document.querySelectorAll('[class*="product-intro__head-sku"] [class*="attr"], [class*="sku-sale-attr"] [class*="attr"]');
      attrBlocks.forEach(block => {
        const titleEl = block.querySelector('[class*="attr-name"], [class*="title"]');
        const label = titleEl?.textContent?.trim()?.replace(':', '') || 'Option';
        const chips = block.querySelectorAll('[class*="attr-value"] span, [class*="attr-value"] button, [class*="radio"] span');
        chips.forEach(chip => {
          const val = chip.getAttribute('aria-label') || chip.title || chip.textContent?.trim();
          if (val && val.length > 0 && val.length < 80 && !variations.some(v => v.type === label && v.value === val)) {
            variations.push({ type: label, value: val, available: true });
          }
        });
      });
    }

    // === UNIVERSAL GENERIC VARIATION SCRAPER ===
    // Runs on ALL sites: as primary for unknown vendors, and as supplement for known vendors when vendor-specific scraping found nothing
    if (variations.length === 0) {
      console.log('[DropandSell Scraper] Running universal variation scraper...');

      // 1. JSON-LD structured data — works on most modern e-commerce sites
      if (jsonLd) {
        try {
          if (jsonLd.offers && Array.isArray(jsonLd.offers) && jsonLd.offers.length > 1) {
            jsonLd.offers.forEach(offer => {
              const varName = offer.name || offer.sku || '';
              if (varName && varName.length < 100) {
                variations.push({ type: 'Option', value: varName, available: offer.availability ? !offer.availability.includes('OutOfStock') : true });
              }
            });
          }
          if (jsonLd.hasVariant && Array.isArray(jsonLd.hasVariant)) {
            jsonLd.hasVariant.forEach(variant => {
              const varName = variant.name || variant.sku || '';
              if (varName && varName.length < 100) {
                variations.push({ type: 'Variant', value: varName, available: true });
              }
              if (variant.additionalProperty && Array.isArray(variant.additionalProperty)) {
                variant.additionalProperty.forEach(prop => {
                  if (prop.name && prop.value) {
                    variations.push({ type: prop.name, value: String(prop.value), available: true });
                  }
                });
              }
            });
          }
          if (jsonLd.additionalProperty && Array.isArray(jsonLd.additionalProperty)) {
            jsonLd.additionalProperty.forEach(prop => {
              if (prop.name && prop.value && String(prop.value).length < 80) {
                const name = prop.name.trim();
                const val = String(prop.value).trim();
                if (name && val) {
                  variations.push({ type: name, value: val, available: true });
                }
              }
            });
          }
        } catch (ldErr) {
          console.log('[DropandSell Scraper] JSON-LD variation parse error:', ldErr.message);
        }
      }

      // 2. Product option <select> dropdowns — the most common variation pattern across all sites
      const variationKeywords = /size|color|colour|style|material|flavor|flavour|scent|pattern|variant|option|type|finish|length|width|weight|pack|quantity|model|capacity|voltage|wattage|format|edition|version|gender|age|fit|shape|theme/i;
      const skipKeywords = /country|language|shipping|delivery|payment|currency|sort|filter|order|page|per.page|quantity.in.cart|add.to/i;
      const allSelects = document.querySelectorAll('select');
      allSelects.forEach(sel => {
        const nameAttr = sel.name || sel.id || '';
        const ariaLabel = sel.getAttribute('aria-label') || '';
        const wrapper = sel.closest('div, fieldset, li, tr, section');
        const labelEl = wrapper?.querySelector('label, legend, .label, [class*="label"], [class*="option-name"], [class*="option-title"]');
        const labelText = labelEl?.textContent?.trim()?.replace(/[:\*]/g, '').trim() || '';
        const inferredLabel = labelText || ariaLabel || nameAttr;
        if (skipKeywords.test(inferredLabel) || skipKeywords.test(nameAttr)) return;
        if (!variationKeywords.test(inferredLabel) && !variationKeywords.test(nameAttr) && !sel.closest('[class*="variant"], [class*="variation"], [class*="option"], [class*="swatch"], [class*="selector"], [class*="sku"], [class*="product-form"], [data-product-option], [data-option]')) return;
        const opts = Array.from(sel.querySelectorAll('option')).filter(o => {
          const v = o.value?.trim();
          const t = o.textContent?.trim();
          return v && v !== '' && v !== '-1' && v !== '0' && t && t.length > 0 && t.length < 80 && !/select|choose|pick/i.test(t);
        });
        if (opts.length > 0 && opts.length <= 50) {
          const label = inferredLabel || 'Option';
          const cleanLabel = label.charAt(0).toUpperCase() + label.slice(1).replace(/_/g, ' ');
          opts.forEach(o => {
            variations.push({ type: cleanLabel, value: o.textContent.trim(), available: !o.disabled });
          });
        }
      });

      // 3. Radio buttons — common on Shopify, WooCommerce, BigCommerce, Magento, Squarespace, etc.
      const radioGroups = new Map();
      const allRadios = document.querySelectorAll('input[type="radio"]');
      allRadios.forEach(radio => {
        const name = radio.name || '';
        if (!name || skipKeywords.test(name)) return;
        if (!radioGroups.has(name)) radioGroups.set(name, []);
        const label = radio.closest('label')?.textContent?.trim() || radio.nextElementSibling?.textContent?.trim() || radio.value || '';
        if (label && label.length < 80 && label.length > 0) {
          radioGroups.get(name).push({ value: label, disabled: radio.disabled });
        }
      });
      radioGroups.forEach((items, groupName) => {
        if (items.length < 2 || items.length > 50) return;
        const wrapper = document.querySelector(`input[name="${groupName}"]`)?.closest('div, fieldset, li, section');
        const legendOrLabel = wrapper?.querySelector('legend, label:first-child, [class*="label"], [class*="option-name"], [class*="option-title"]');
        let label = legendOrLabel?.textContent?.trim()?.replace(/[:\*]/g, '').trim() || groupName;
        if (items.some(i => i.value === label)) label = groupName;
        const cleanLabel = label.charAt(0).toUpperCase() + label.slice(1).replace(/[_-]/g, ' ');
        items.forEach(item => {
          variations.push({ type: cleanLabel, value: item.value, available: !item.disabled });
        });
      });

      // 4. Swatch buttons — used by Shopify themes, WooCommerce, BigCommerce, custom sites
      const swatchSelectors = [
        '[class*="swatch"] button', '[class*="swatch"] a', '[class*="swatch"] span[role="button"]',
        '[class*="variant"] button', '[class*="variant"] a',
        '[class*="option-value"] button', '[class*="option-value"] a', '[class*="option-value"] span',
        '[data-option-value]', '[data-value]',
        '[class*="color-swatch"]', '[class*="size-swatch"]',
        '[class*="product-option"] button', '[class*="product-option"] a',
        'fieldset button', 'fieldset [role="button"]',
        '[class*="selector"] button', '[class*="selector"] [role="radio"]',
        '[class*="picker"] button', '[class*="picker"] a',
        '[role="radiogroup"] button', '[role="radiogroup"] [role="radio"]',
        '[role="listbox"] [role="option"]',
        '[class*="product-form"] [class*="chip"]', '[class*="product-form"] [class*="pill"]',
      ];
      const seenSwatchGroups = new Set();
      swatchSelectors.forEach(sel => {
        try {
          const btns = document.querySelectorAll(sel);
          if (btns.length < 2 || btns.length > 50) return;
          const container = btns[0].closest('[class*="swatch"], [class*="variant"], [class*="option"], fieldset, [role="radiogroup"], [role="listbox"], [class*="selector"], [class*="picker"], [class*="product-form"]');
          if (!container) return;
          const containerId = container.className + container.id;
          if (seenSwatchGroups.has(containerId)) return;
          seenSwatchGroups.add(containerId);
          const labelEl = container.querySelector('legend, label, [class*="label"], [class*="option-name"], [class*="title"]') || container.previousElementSibling;
          let label = labelEl?.textContent?.trim()?.replace(/[:\*]/g, '').trim() || '';
          if (skipKeywords.test(label)) return;
          if (!label || label.length > 40) label = 'Option';
          btns.forEach(btn => {
            const val = btn.getAttribute('data-option-value') || btn.getAttribute('data-value') || btn.getAttribute('aria-label') || btn.title || btn.textContent?.trim();
            if (val && val.length > 0 && val.length < 80 && !/select|choose/i.test(val)) {
              const isUnavail = btn.disabled || btn.classList.contains('disabled') || btn.classList.contains('unavailable') || btn.classList.contains('sold-out') || btn.classList.contains('out-of-stock') || btn.getAttribute('aria-disabled') === 'true';
              variations.push({ type: label, value: val, available: !isUnavail });
            }
          });
        } catch (e) {}
      });

      // 5. Shopify-specific: window product JSON (works on almost all Shopify stores)
      try {
        const shopifyScripts = document.querySelectorAll('script:not([src])');
        for (const script of shopifyScripts) {
          const text = script.textContent || '';
          const productJsonMatch = text.match(/var\s+(?:meta|product)\s*=\s*(\{[\s\S]*?"variants"[\s\S]*?\});/) || text.match(/"product"\s*:\s*(\{[\s\S]*?"variants"[\s\S]*?\})/);
          if (productJsonMatch) {
            try {
              const pData = JSON.parse(productJsonMatch[1]);
              if (pData.options && Array.isArray(pData.options)) {
                pData.options.forEach(opt => {
                  const optName = typeof opt === 'string' ? opt : opt.name || 'Option';
                  if (typeof opt === 'object' && opt.values) {
                    opt.values.forEach(val => {
                      if (typeof val === 'string' && val.length < 80) {
                        variations.push({ type: optName, value: val, available: true });
                      }
                    });
                  }
                });
              }
              if (pData.variants && Array.isArray(pData.variants) && (!pData.options || variations.length === 0)) {
                pData.variants.forEach(v => {
                  if (v.option1) variations.push({ type: pData.options?.[0] || 'Option 1', value: v.option1, available: v.available !== false });
                  if (v.option2) variations.push({ type: pData.options?.[1] || 'Option 2', value: v.option2, available: v.available !== false });
                  if (v.option3) variations.push({ type: pData.options?.[2] || 'Option 3', value: v.option3, available: v.available !== false });
                });
              }
            } catch (pe) {}
            break;
          }
        }
      } catch (shopifyErr) {
        console.log('[DropandSell Scraper] Shopify product JSON parse error:', shopifyErr.message);
      }

      // 6. WooCommerce-specific: variation form data attributes
      try {
        const wcForm = document.querySelector('form.variations_form, [data-product_variations]');
        if (wcForm) {
          const wcData = wcForm.getAttribute('data-product_variations');
          if (wcData) {
            const wcVars = JSON.parse(wcData);
            if (Array.isArray(wcVars)) {
              wcVars.forEach(v => {
                if (v.attributes) {
                  Object.entries(v.attributes).forEach(([key, val]) => {
                    if (val && typeof val === 'string' && val.length < 80) {
                      const label = key.replace('attribute_pa_', '').replace('attribute_', '').replace(/-/g, ' ');
                      const cleanLabel = label.charAt(0).toUpperCase() + label.slice(1);
                      variations.push({ type: cleanLabel, value: val, available: v.is_in_stock !== false });
                    }
                  });
                }
              });
            }
          }
        }
      } catch (wcErr) {
        console.log('[DropandSell Scraper] WooCommerce variation parse error:', wcErr.message);
      }

      // 7. Generic data attributes — catches sites using data-* patterns for variations
      try {
        const dataVariantEls = document.querySelectorAll('[data-variant-id], [data-option-index], [data-product-option], [data-option]');
        if (dataVariantEls.length > 1) {
          dataVariantEls.forEach(el => {
            const val = el.getAttribute('data-value') || el.getAttribute('data-option-value') || el.getAttribute('aria-label') || el.title || el.textContent?.trim();
            if (val && val.length > 0 && val.length < 80) {
              const container = el.closest('[data-option-name], [data-option-index], fieldset, [class*="option"]');
              const label = container?.getAttribute('data-option-name') || container?.querySelector('legend, label')?.textContent?.trim()?.replace(/[:\*]/g, '') || 'Option';
              variations.push({ type: label, value: val, available: !el.classList.contains('disabled') && !el.classList.contains('unavailable') });
            }
          });
        }
      } catch (dataErr) {}

      // 8. Generic stock detection for unknown vendors
      const stockIndicators = document.querySelectorAll('[class*="stock"], [class*="availability"], [class*="inventory"], [data-availability], [itemprop="availability"]');
      stockIndicators.forEach(el => {
        const text = (el.textContent || el.getAttribute('content') || '').toLowerCase();
        if (text.includes('out of stock') || text.includes('sold out') || text.includes('unavailable') || text.includes('currently not available')) {
          vendorStock.inStock = false;
        }
        const qtyMatch = text.match(/(\d+)\s*(?:left|in stock|available|remaining)/);
        if (qtyMatch && !vendorStock.quantity) vendorStock.quantity = parseInt(qtyMatch[1]);
      });

      console.log('[DropandSell Scraper] Universal scraper found', variations.length, 'variations');
    }

    if (jsonLd?.offers) {
      const offers = Array.isArray(jsonLd.offers) ? jsonLd.offers : [jsonLd.offers];
      const availability = offers[0]?.availability || '';
      if (availability.includes('OutOfStock') || availability.includes('Discontinued')) {
        vendorStock.inStock = false;
      }
    }
  } catch (e) {
    console.log('[DropandSell Scraper] Variation/stock extraction error:', e.message);
  }

  const sizeColourKeywords = /^(size|colour|color)$/i;
  const sizeKeywords = /size|dimension|length|width|waist|chest|inseam|shoe|uk|us|eu/i;
  const colourKeywords = /colou?r|shade|hue|tint|finish/i;
  variations = variations.map(v => {
    const t = (v.type || '').trim();
    if (sizeColourKeywords.test(t)) return v;
    if (sizeKeywords.test(t)) return { ...v, type: 'Size' };
    if (colourKeywords.test(t)) return { ...v, type: 'Colour' };
    return null;
  }).filter(Boolean);

  const uniqueVariations = [];
  const seenVars = new Set();
  for (const v of variations) {
    const key = `${v.type}:${v.value}`;
    if (!seenVars.has(key)) { seenVars.add(key); uniqueVariations.push(v); }
  }
  variations = uniqueVariations.slice(0, 50);

  const result = { vendor, title, description, price, image, images, sku, sourceUrl: url, variations, vendorStock };
  console.log('[DropandSell Scraper] Scrape complete. Results:');
  console.log('[DropandSell Scraper] - Vendor:', result.vendor);
  console.log('[DropandSell Scraper] - Title:', result.title && result.title.length > 0 ? (result.title.length > 50 ? result.title.substring(0, 50) + '...' : result.title) : 'Not found');
  console.log('[DropandSell Scraper] - Description:', result.description ? (result.description.length + ' chars') : 'Not found');
  console.log('[DropandSell Scraper] - Price:', result.price);
  console.log('[DropandSell Scraper] - Image:', result.image && result.image.length > 0 ? 'Found' : 'Not found');
  console.log('[DropandSell Scraper] - Images:', result.images.length, 'found');
  console.log('[DropandSell Scraper] - SKU:', result.sku || 'Not found');
  console.log('[DropandSell Scraper] - Variations:', result.variations.length, 'found');
  console.log('[DropandSell Scraper] - Vendor Stock:', result.vendorStock.inStock ? 'In Stock' : 'Out of Stock', result.vendorStock.quantity ? `(${result.vendorStock.quantity})` : '');
  return result;
}

function getVariationsFromEditor() {
  const container = document.getElementById('variationsContainer');
  if (!container) return [];
  const rows = container.querySelectorAll('.variation-row');
  const out = [];
  rows.forEach(row => {
    const type = (row.querySelector('.var-type')?.value || '').trim();
    const value = (row.querySelector('.var-value')?.value || '').trim();
    if (!type || !value) return;
    const priceRaw = (row.querySelector('.var-price')?.value || '').trim();
    const qtyRaw = (row.querySelector('.var-qty')?.value || '').trim();
    const available = !row.classList.contains('unavailable');
    const v = { type, value, available };
    const priceNum = parseFloat(priceRaw);
    if (priceRaw && !isNaN(priceNum) && priceNum >= 0) v.price = String(priceNum);
    const qtyNum = parseInt(qtyRaw, 10);
    if (qtyRaw && !isNaN(qtyNum) && qtyNum >= 0) v.quantity = qtyNum;
    out.push(v);
  });
  return out;
}

function buildVariationRow(variation) {
  const row = document.createElement('div');
  row.className = 'variation-row';
  if (variation && variation.available === false) row.classList.add('unavailable');

  const types = ['Colour', 'Size', 'Material', 'Style', 'Pattern', 'Option'];
  const typeSelect = document.createElement('select');
  typeSelect.className = 'var-type';
  typeSelect.setAttribute('data-testid', 'select-variation-type');
  let selectedType = (variation?.type || 'Colour').trim();
  if (!types.includes(selectedType)) {
    const opt = document.createElement('option');
    opt.value = selectedType;
    opt.textContent = selectedType;
    typeSelect.appendChild(opt);
  }
  types.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    if (t === selectedType) opt.selected = true;
    typeSelect.appendChild(opt);
  });

  const valueInput = document.createElement('input');
  valueInput.type = 'text';
  valueInput.className = 'var-value';
  valueInput.placeholder = 'e.g. Red, Large';
  valueInput.value = variation?.value || '';
  valueInput.setAttribute('data-testid', 'input-variation-value');

  const priceInput = document.createElement('input');
  priceInput.type = 'number';
  priceInput.step = '0.01';
  priceInput.min = '0';
  priceInput.className = 'var-price';
  priceInput.placeholder = 'Price';
  priceInput.value = variation?.price != null && variation.price !== '' ? String(variation.price) : '';
  priceInput.setAttribute('data-testid', 'input-variation-price');

  const qtyInput = document.createElement('input');
  qtyInput.type = 'number';
  qtyInput.min = '0';
  qtyInput.className = 'var-qty';
  qtyInput.placeholder = 'Qty';
  qtyInput.value = variation?.quantity != null && variation.quantity !== '' ? String(variation.quantity) : '';
  qtyInput.setAttribute('data-testid', 'input-variation-quantity');

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'var-remove';
  removeBtn.textContent = '\u00D7';
  removeBtn.title = 'Remove';
  removeBtn.setAttribute('data-testid', 'button-remove-variation');
  removeBtn.addEventListener('click', () => {
    row.remove();
    updateVariationCount();
  });

  row.appendChild(typeSelect);
  row.appendChild(valueInput);
  row.appendChild(priceInput);
  row.appendChild(qtyInput);
  row.appendChild(removeBtn);
  return row;
}

function updateVariationCount() {
  const container = document.getElementById('variationsContainer');
  const countEl = document.getElementById('variationsCount');
  if (!container || !countEl) return;
  const count = container.querySelectorAll('.variation-row').length;
  countEl.textContent = count > 0 ? count + ' added' : 'optional';
}

function renderVariationEditor(variations, container, countEl) {
  container.innerHTML = '';

  const headerRow = document.createElement('div');
  headerRow.className = 'variations-header-row';
  ['Type', 'Value', 'Price', 'Qty', ''].forEach(label => {
    const span = document.createElement('span');
    span.textContent = label;
    headerRow.appendChild(span);
  });

  const listDiv = document.createElement('div');
  listDiv.className = 'variations-list';
  listDiv.appendChild(headerRow);

  (variations || []).forEach(v => {
    listDiv.appendChild(buildVariationRow(v));
  });

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'variation-add-btn';
  addBtn.textContent = '+ Add variation (e.g. Black £12.99, Red £14.99)';
  addBtn.setAttribute('data-testid', 'button-add-variation');
  addBtn.addEventListener('click', () => {
    const newRow = buildVariationRow({ type: 'Colour', value: '', available: true });
    listDiv.insertBefore(newRow, addBtn);
    updateVariationCount();
    newRow.querySelector('.var-value')?.focus();
  });
  listDiv.appendChild(addBtn);

  const helper = document.createElement('p');
  helper.style.cssText = 'font-size: 10px; color: #64748b; margin: 6px 2px 0; line-height: 1.4;';
  helper.textContent = 'Leave Price blank to use the main selling price. eBay supports per-variation pricing & stock.';
  listDiv.appendChild(helper);

  container.appendChild(listDiv);

  if (countEl) {
    const count = (variations || []).length;
    countEl.textContent = count > 0 ? count + ' added' : 'optional';
  }
}

function populateForm(data) {
  console.log('[DropandSell] populateForm called with data:', data);
  
  if (!data) {
    console.error('[DropandSell] populateForm: No data provided');
    showExtractionError('No product data available');
    return;
  }
  
  const vendorLabel = vendorNames[data.vendor] || vendorNames.unknown;
  console.log('[DropandSell] Setting vendor name to:', vendorLabel);
  
  const vendorNameEl = document.getElementById('vendorName');
  if (vendorNameEl) {
    vendorNameEl.textContent = vendorLabel;
  } else {
    console.error('[DropandSell] vendorName element not found');
  }
  
  const imageContainer = document.getElementById('productImageContainer');
  if (imageContainer) {
    const allImages = data.images && data.images.length > 0 ? data.images : (data.image ? [data.image] : []);
    if (allImages.length > 0) {
      console.log('[DropandSell] Setting images:', allImages.length, 'found');
      let html = `<img class="product-image" id="mainPreviewImage" src="${allImages[0]}" alt="Product" onerror="this.style.display='none'" />`;
      if (allImages.length > 1) {
        html += '<div class="image-thumbnails">';
        allImages.forEach((src, i) => {
          html += `<img class="image-thumb${i === 0 ? ' active' : ''}" src="${src}" alt="Image ${i + 1}" onclick="document.getElementById('mainPreviewImage').src=this.src; document.querySelectorAll('.image-thumb').forEach(t=>t.classList.remove('active')); this.classList.add('active');" onerror="this.style.display='none'" />`;
        });
        html += '</div>';
        html += `<div class="image-count">${allImages.length} images</div>`;
      }
      imageContainer.innerHTML = html;
    } else {
      console.log('[DropandSell] No images in data');
      imageContainer.innerHTML = '<div class="no-image">No image detected</div>';
    }
  } else {
    console.error('[DropandSell] productImageContainer element not found');
  }
  
  // Set form field values with validation
  const titleEl = document.getElementById('productTitle');
  const descEl = document.getElementById('productDescription');
  const costEl = document.getElementById('costPrice');
  const sellingEl = document.getElementById('sellingPrice');
  const skuEl = document.getElementById('sku');
  const stockEl = document.getElementById('stock');
  
  if (titleEl) {
    titleEl.value = data.title || '';
    console.log('[DropandSell] Set productTitle to:', titleEl.value);
  } else {
    console.error('[DropandSell] productTitle element not found');
  }
  
  if (descEl) {
    descEl.value = data.description || '';
    console.log('[DropandSell] Set productDescription, length:', descEl.value.length);
  } else {
    console.error('[DropandSell] productDescription element not found');
  }
  
  if (costEl) {
    costEl.value = data.price || '';
    console.log('[DropandSell] Set costPrice to:', costEl.value);
  } else {
    console.error('[DropandSell] costPrice element not found');
  }
  
  if (sellingEl) {
    const markupEl = document.getElementById('markupPercent');
    const markup = markupEl ? (parseFloat(markupEl.value) || 30) : 30;
    sellingEl.value = data.price ? (data.price * (1 + markup / 100)).toFixed(2) : '';
    console.log('[DropandSell] Set sellingPrice to:', sellingEl.value, '(markup:', markup + '%)');
  } else {
    console.error('[DropandSell] sellingPrice element not found');
  }
  
  if (skuEl) {
    skuEl.value = data.sku || generateSKU();
    console.log('[DropandSell] Set sku to:', skuEl.value);
  } else {
    console.error('[DropandSell] sku element not found');
  }
  
  if (stockEl) {
    stockEl.value = 100;
    console.log('[DropandSell] Set stock to:', stockEl.value);
  } else {
    console.error('[DropandSell] stock element not found');
  }
  
  const variationsSection = document.getElementById('variationsSection');
  const variationsContainer = document.getElementById('variationsContainer');
  const variationsCount = document.getElementById('variationsCount');
  
  if (variationsSection && variationsContainer) {
    const scrapedVariations = Array.isArray(data.variations) ? data.variations : [];
    // Always show the variations section so the user can add their own colours
    // / sizes / options even when the page didn't expose any. Per-variation
    // price and quantity are editable here so the data flows through to eBay
    // (which supports variation-level pricing & stock).
    variationsSection.style.display = 'block';
    renderVariationEditor(scrapedVariations, variationsContainer, variationsCount);
    console.log('[DropandSell] Variation editor ready with', scrapedVariations.length, 'scraped row(s)');
  }
  
  if (!data.title && !data.price && !data.image) {
    console.log('[DropandSell] No meaningful data extracted, showing manual entry message');
    if (vendorNameEl) {
      vendorNameEl.textContent = 'Manual Entry Required';
    }
    if (imageContainer) {
      imageContainer.innerHTML = '<div class="no-image">Navigate to a product page first</div>';
    }
  }
  
  console.log('[DropandSell] Form population complete');
}

function generateSKU() {
  return 'DF-' + Date.now().toString(36).toUpperCase();
}

async function handleGenerateDescription() {
  const title = document.getElementById('productTitle').value.trim();
  if (!title) {
    alert('Please enter a product title first');
    return;
  }
  
  const btn = document.getElementById('generateDescBtn');
  const btnText = btn.querySelector('.btn-ai-text');
  
  btn.disabled = true;
  btnText.innerHTML = '<span class="loading"><span class="spinner" style="border-color: #ffffff40; border-top-color: white;"></span> Generating...</span>';
  
  const vendorLabel = document.getElementById('vendorName').textContent || '';
  const costPrice = document.getElementById('costPrice').value || '';
  
  try {
    const response = await fetch(`${apiUrl}/api/extension/generate-description`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'X-Unique-URL': uniqueUrl
      },
      body: JSON.stringify({
        productTitle: title,
        vendorName: vendorLabel !== 'Manual Entry' && vendorLabel !== 'Manual Entry Required' ? vendorLabel : '',
        costPrice: costPrice
      })
    });
    
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error('Server returned an unexpected response. Please check your API URL in settings and try again.');
    }
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to generate description');
    }
    
    if (data.description) {
      document.getElementById('productDescription').value = data.description;
    }
  } catch (error) {
    alert('Failed to generate description: ' + (error.message || 'Unknown error'));
  } finally {
    btn.disabled = false;
    btnText.textContent = 'AI Generate Description';
  }
}

async function handleDropAndSellImport() {
  const btn = document.getElementById('importBtn');
  const btnText = btn.querySelector('.btn-text');
  const orderSelect = document.getElementById('dropandsellOrderSelect');
  const orderId = parseInt(orderSelect?.value || '', 10);
  if (!orderId) {
    alert('Please pick a Drop-and-Sell customer assignment first.');
    return;
  }
  // If the picked customer has multiple connected eBay stores, the
  // lister must say which one. The server enforces this too — alerting
  // here just gives a friendlier message before the network round-trip.
  const pickedOrder = dropAndSellOrders.find(o => o.orderId === orderId);
  const pickerWrap = document.getElementById('dropandsellStoreWrapper');
  const storeSelect = document.getElementById('dropandsellStoreSelect');
  let chosenStoreId = null;
  if (pickerWrap && pickerWrap.style.display !== 'none' && storeSelect) {
    const v = parseInt(storeSelect.value || '', 10);
    if (!Number.isFinite(v) || v <= 0) {
      alert('This customer has more than one eBay store connected — pick which store to list into.');
      return;
    }
    chosenStoreId = v;
  } else if (Array.isArray(pickedOrder?.ebayStores) && pickedOrder.ebayStores.length === 1) {
    // Single connected store — pass it explicitly so the listing never
    // routes via a silent server-side fallback.
    chosenStoreId = pickedOrder.ebayStores[0].id;
  }
  const title = document.getElementById('productTitle').value.trim();
  if (!title) {
    alert('Please enter a product title');
    return;
  }
  const description = document.getElementById('productDescription').value.trim();
  const costPrice = parseFloat(document.getElementById('costPrice').value) || 0;
  const sellingPrice = parseFloat(document.getElementById('sellingPrice').value) || 0;
  const sku = document.getElementById('sku').value.trim() || generateSKU();
  const stock = parseInt(document.getElementById('stock').value) || 1;
  const deliveryType = document.getElementById('deliveryType').value;
  const deliveryCost = parseFloat(document.getElementById('deliveryCost').value) || 0;
  const sourceUrl = productData?.sourceUrl || '';
  const productImages = productData?.images && productData.images.length > 0
    ? productData.images
    : (productData?.image ? [productData.image] : []);

  if (!sourceUrl) {
    alert('No vendor URL detected. Open a real product page on Amazon, AliExpress, Walmart, Etsy, Shein or eBay first.');
    return;
  }
  if (!productImages.length) {
    alert('No product image detected. Try refreshing the page or pick a different product.');
    return;
  }

  btn.disabled = true;
  btnText.innerHTML = '<span class="loading"><span class="spinner"></span> Listing on customer\'s eBay...</span>';

  try {
    const importPayload = {
      orderId,
      name: title,
      description,
      brand: '',
      costPrice: costPrice.toString(),
      sellingPrice: sellingPrice.toString(),
      sku,
      stockQuantity: stock,
      imageUrls: productImages,
      sourceUrl,
      deliveryType,
      deliveryCost: deliveryCost.toString(),
      variations: getVariationsFromEditor(),
      vendorStock: productData?.vendorStock || { inStock: true, quantity: null, lastChecked: new Date().toISOString() },
      ...(chosenStoreId ? { storeId: chosenStoreId } : {}),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    const response = await fetch(`${apiUrl}/api/extension/drop-and-sell/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'X-Unique-URL': uniqueUrl,
      },
      body: JSON.stringify(importPayload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error('Server returned an unexpected response (status ' + response.status + '). Please retry.');
    }
    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: 'Server returned status ' + response.status }));
      throw new Error(err.message || "Failed to list on customer's eBay");
    }
    const data = await response.json();

    showSuccessSection({
      title: data.complete ? 'Order completed!' : "Listed on customer's eBay",
      message: data.complete
        ? `All ${data.total} listings done for ${data.customerName} — order moved to awaiting approval.`
        : `Listing ${data.progress} of ${data.total} for ${data.customerName} is now live on their eBay.`,
    });
    // Force the next popup open to refresh assignments (progressCount changed).
    dropAndSellOrdersLoaded = false;
  } catch (error) {
    console.error('[DropandSell extension] DROSEL import error:', error?.message || error);
    showErrorSection(error?.message || 'Failed to list product. Please try again.');
  } finally {
    btn.disabled = false;
    btnText.textContent = "List on Customer's eBay";
  }
}

async function handleImport() {
  // Dispatch: if the user picked the Drop-and-Sell mode, the listing goes
  // into a paying customer's eBay store via /api/extension/drop-and-sell/import
  // (using the customer's stored token). Otherwise it follows the standard
  // /api/extension/import path that adds it to the lister's own inventory.
  const targetModeEl = document.getElementById('targetMode');
  if (targetModeEl && targetModeEl.value === 'dropandsell') {
    return handleDropAndSellImport();
  }

  const btn = document.getElementById('importBtn');
  const btnText = btn.querySelector('.btn-text');
  
  const title = document.getElementById('productTitle').value.trim();
  const description = document.getElementById('productDescription').value.trim();
  const costPrice = parseFloat(document.getElementById('costPrice').value) || 0;
  const sellingPrice = parseFloat(document.getElementById('sellingPrice').value) || 0;
  const sku = document.getElementById('sku').value.trim() || generateSKU();
  const stock = parseInt(document.getElementById('stock').value) || 0;
  const deliveryType = document.getElementById('deliveryType').value;
  const deliveryCost = parseFloat(document.getElementById('deliveryCost').value) || 0;
  
  if (!title) {
    alert('Please enter a product title');
    return;
  }
  
  btn.disabled = true;
  btnText.innerHTML = '<span class="loading"><span class="spinner"></span> Importing...</span>';
  
  // Get vendor info from detected product data - only send known vendor names
  const detectedVendor = productData?.vendor;
  const vendorName = (detectedVendor && detectedVendor !== 'unknown') ? vendorNames[detectedVendor] : null;
  const sourceUrl = productData?.sourceUrl || '';
  const markupPercent = parseFloat(document.getElementById('markupPercent').value) || 0;
  
  try {
    const productImages = productData?.images && productData.images.length > 0 
      ? productData.images 
      : (productData?.image ? [productData.image] : []);
    
    const importPayload = {
      name: title,
      description,
      costPrice: costPrice.toString(),
      sellingPrice: sellingPrice.toString(),
      sku,
      stockQuantity: stock,
      vendorName,
      vendorType: productData?.vendor || 'unknown',
      imageUrl: productData?.image || null,
      imageUrls: productImages,
      sourceUrl,
      deliveryType,
      deliveryCost: deliveryCost.toString(),
      markupPercent,
      variations: getVariationsFromEditor(),
      vendorStock: productData?.vendorStock || { inStock: true, quantity: null, lastChecked: new Date().toISOString() }
    };

    let response;
    let lastError;
    const maxAttempts = 3;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        console.log('[DropandSell] Import attempt', attempt + 1, 'of', maxAttempts, 'to', apiUrl + '/api/extension/import');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);
        response = await fetch(`${apiUrl}/api/extension/import`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey,
            'X-Unique-URL': uniqueUrl
          },
          body: JSON.stringify(importPayload),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          const status = response.status;
          console.log('[DropandSell] Non-JSON response on attempt', attempt + 1, '- status:', status);
          if (attempt < maxAttempts - 1 && (status === 502 || status === 503 || status === 504 || status === 0)) {
            console.log('[DropandSell] Server may be restarting, retrying in 3s...');
            await new Promise(r => setTimeout(r, 3000));
            response = null;
            continue;
          }
          if (status === 502 || status === 503 || status === 504) {
            throw new Error('Server is temporarily unavailable (restarting). Please wait a moment and try again.');
          }
          const bodyText = await response.text().catch(() => '');
          console.log('[DropandSell] Unexpected response body:', bodyText.substring(0, 200));
          throw new Error('Server returned an unexpected response (status ' + status + '). Please check your API URL in settings.');
        }
        
        break;
      } catch (fetchErr) {
        if (fetchErr.message && (fetchErr.message.includes('Server is temporarily') || fetchErr.message.includes('Server returned'))) {
          throw fetchErr;
        }
        lastError = fetchErr;
        console.log('[DropandSell] Import attempt', attempt + 1, 'failed:', fetchErr.name, fetchErr.message);
        if (attempt < maxAttempts - 1) {
          await new Promise(r => setTimeout(r, 3000));
        }
      }
    }

    if (!response) {
      const msg = lastError?.name === 'AbortError' 
        ? 'Request timed out. The server may be temporarily unavailable. Please try again in a moment.'
        : 'Could not connect to server. Please check your internet connection and that the API URL in settings is correct (e.g. https://yourapp.replit.app).';
      throw new Error(msg);
    }
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown server error (status ' + response.status + ')' }));
      throw new Error(error.message || 'Failed to import product');
    }
    
    showSuccessSection();
  } catch (error) {
    console.error('[DropandSell] Import error:', error.message, error.stack);
    showErrorSection(error.message || 'Failed to import product. Please try again.');
  } finally {
    btn.disabled = false;
    btnText.textContent = 'Add to Inventory';
  }
}

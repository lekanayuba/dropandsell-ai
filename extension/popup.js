let productData = null;
let apiUrl = '';
let apiKey = '';

const vendorNames = {
  amazon: 'Amazon',
  aliexpress: 'AliExpress',
  ebay: 'eBay',
  unknown: 'Unknown Vendor'
};

document.addEventListener('DOMContentLoaded', async () => {
  const stored = await chrome.storage.local.get(['apiUrl', 'apiKey']);
  apiUrl = stored.apiUrl || '';
  apiKey = stored.apiKey || '';
  
  if (apiUrl && apiKey) {
    const valid = await verifyStoredCredentials();
    if (valid) {
      showProductSection();
    } else {
      apiUrl = '';
      apiKey = '';
      showLoginSection();
    }
  } else {
    showLoginSection();
  }
  
  setupEventListeners();
});

async function verifyStoredCredentials() {
  try {
    const response = await fetch(`${apiUrl}/api/extension/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      }
    });
    return response.ok;
  } catch (error) {
    console.error('Stored credentials verification failed:', error);
    return false;
  }
}

function setupEventListeners() {
  document.getElementById('connectBtn').addEventListener('click', handleConnect);
  document.getElementById('importBtn').addEventListener('click', handleImport);
  document.getElementById('cancelBtn').addEventListener('click', () => window.close());
  document.getElementById('disconnectLink').addEventListener('click', handleDisconnect);
  document.getElementById('viewInventoryBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: `${apiUrl}/inventory` });
    window.close();
  });
  document.getElementById('importAnotherBtn').addEventListener('click', () => {
    showProductSection();
  });
  document.getElementById('retryBtn').addEventListener('click', () => {
    showProductSection();
  });
  
  document.getElementById('deliveryType').addEventListener('change', (e) => {
    const costGroup = document.getElementById('deliveryCostGroup');
    costGroup.style.display = e.target.value === 'free' ? 'none' : 'block';
  });
}

function showLoginSection() {
  document.getElementById('loginSection').classList.add('active');
  document.getElementById('productSection').classList.remove('active');
  document.getElementById('successSection').classList.remove('active');
  document.getElementById('errorSection').classList.remove('active');
  
  document.getElementById('apiUrl').value = apiUrl;
  document.getElementById('apiKey').value = apiKey;
}

async function showProductSection() {
  document.getElementById('loginSection').classList.remove('active');
  document.getElementById('productSection').classList.add('active');
  document.getElementById('successSection').classList.remove('active');
  document.getElementById('errorSection').classList.remove('active');
  
  await loadVendors();
  await extractProductData();
}

function showSuccessSection() {
  document.getElementById('loginSection').classList.remove('active');
  document.getElementById('productSection').classList.remove('active');
  document.getElementById('successSection').classList.add('active');
  document.getElementById('errorSection').classList.remove('active');
}

function showErrorSection(message) {
  document.getElementById('loginSection').classList.remove('active');
  document.getElementById('productSection').classList.remove('active');
  document.getElementById('successSection').classList.remove('active');
  document.getElementById('errorSection').classList.add('active');
  document.getElementById('errorMessage').textContent = message;
}

async function handleConnect() {
  const url = document.getElementById('apiUrl').value.trim();
  const key = document.getElementById('apiKey').value.trim();
  
  if (!url || !key) {
    alert('Please enter both URL and API key');
    return;
  }
  
  const btn = document.getElementById('connectBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="loading"><span class="spinner"></span> Connecting...</span>';
  
  try {
    const response = await fetch(`${url}/api/extension/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': key
      }
    });
    
    if (!response.ok) {
      throw new Error('Invalid API key or URL');
    }
    
    apiUrl = url;
    apiKey = key;
    await chrome.storage.local.set({ apiUrl, apiKey });
    
    showProductSection();
  } catch (error) {
    alert(error.message || 'Failed to connect. Please check your URL and API key.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Connect';
  }
}

async function handleDisconnect(e) {
  e.preventDefault();
  await chrome.storage.local.remove(['apiUrl', 'apiKey']);
  apiUrl = '';
  apiKey = '';
  showLoginSection();
}

async function loadVendors() {
  try {
    const response = await fetch(`${apiUrl}/api/extension/vendors`, {
      headers: {
        'X-API-Key': apiKey
      }
    });
    
    if (!response.ok) throw new Error('Failed to load vendors');
    
    const vendors = await response.json();
    const select = document.getElementById('vendorSelect');
    select.innerHTML = '<option value="">Select a vendor...</option>';
    
    vendors.forEach(vendor => {
      const option = document.createElement('option');
      option.value = vendor.id;
      option.textContent = vendor.name;
      select.appendChild(option);
    });
  } catch (error) {
    console.error('Failed to load vendors:', error);
  }
}

async function extractProductData() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scrapeProductData
    });
    
    if (results && results[0] && results[0].result) {
      productData = results[0].result;
      populateForm(productData);
    }
  } catch (error) {
    console.error('Failed to extract product data:', error);
  }
}

function scrapeProductData() {
  const url = window.location.href;
  let vendor = 'unknown';
  let title = '';
  let description = '';
  let price = 0;
  let image = '';
  let sku = '';
  
  if (url.includes('amazon.')) {
    vendor = 'amazon';
    title = document.querySelector('#productTitle')?.textContent?.trim() || 
            document.querySelector('[data-feature-name="title"]')?.textContent?.trim() || '';
    
    const priceEl = document.querySelector('.a-price .a-offscreen') ||
                    document.querySelector('#priceblock_ourprice') ||
                    document.querySelector('#priceblock_dealprice') ||
                    document.querySelector('.a-price-whole');
    if (priceEl) {
      const priceText = priceEl.textContent.replace(/[^0-9.,]/g, '').replace(',', '');
      price = parseFloat(priceText) || 0;
    }
    
    image = document.querySelector('#landingImage')?.src ||
            document.querySelector('#imgBlkFront')?.src ||
            document.querySelector('[data-old-hires]')?.dataset?.oldHires || '';
    
    const bulletPoints = document.querySelectorAll('#feature-bullets li span');
    description = Array.from(bulletPoints).map(el => el.textContent.trim()).join('\n');
    
    sku = document.querySelector('[data-asin]')?.dataset?.asin || '';
    
  } else if (url.includes('aliexpress.')) {
    vendor = 'aliexpress';
    title = document.querySelector('h1')?.textContent?.trim() || '';
    
    const priceEl = document.querySelector('[class*="price--current"]') ||
                    document.querySelector('[class*="product-price-value"]');
    if (priceEl) {
      const priceText = priceEl.textContent.replace(/[^0-9.,]/g, '').replace(',', '');
      price = parseFloat(priceText) || 0;
    }
    
    image = document.querySelector('[class*="magnifier--image"] img')?.src ||
            document.querySelector('.product-image img')?.src || '';
    
    const descEl = document.querySelector('[class*="description"]');
    description = descEl?.textContent?.trim()?.substring(0, 500) || '';
    
  } else if (url.includes('ebay.')) {
    vendor = 'ebay';
    title = document.querySelector('h1[class*="title"]')?.textContent?.trim() ||
            document.querySelector('.x-item-title__mainTitle')?.textContent?.trim() || '';
    
    const priceEl = document.querySelector('[class*="x-price-primary"] span') ||
                    document.querySelector('#prcIsum') ||
                    document.querySelector('[itemprop="price"]');
    if (priceEl) {
      const priceText = priceEl.textContent.replace(/[^0-9.,]/g, '').replace(',', '');
      price = parseFloat(priceText) || 0;
    }
    
    image = document.querySelector('[class*="ux-image-carousel-item"] img')?.src ||
            document.querySelector('#icImg')?.src || '';
    
    const descFrame = document.querySelector('#desc_ifr');
    if (descFrame && descFrame.contentDocument) {
      description = descFrame.contentDocument.body?.textContent?.trim()?.substring(0, 500) || '';
    }
    
    sku = url.match(/\/itm\/(\d+)/)?.[1] || '';
  }
  
  return { vendor, title, description, price, image, sku, sourceUrl: url };
}

function populateForm(data) {
  document.getElementById('vendorName').textContent = vendorNames[data.vendor] || vendorNames.unknown;
  
  const imageContainer = document.getElementById('productImageContainer');
  if (data.image) {
    imageContainer.innerHTML = `<img class="product-image" src="${data.image}" alt="Product" />`;
  } else {
    imageContainer.innerHTML = '<div class="no-image">No image detected</div>';
  }
  
  document.getElementById('productTitle').value = data.title || '';
  document.getElementById('productDescription').value = data.description || '';
  document.getElementById('costPrice').value = data.price || '';
  document.getElementById('sellingPrice').value = data.price ? (data.price * 1.3).toFixed(2) : '';
  document.getElementById('sku').value = data.sku || generateSKU();
  document.getElementById('stock').value = 100;
}

function generateSKU() {
  return 'DF-' + Date.now().toString(36).toUpperCase();
}

async function handleImport() {
  const btn = document.getElementById('importBtn');
  const btnText = btn.querySelector('.btn-text');
  
  const title = document.getElementById('productTitle').value.trim();
  const description = document.getElementById('productDescription').value.trim();
  const costPrice = parseFloat(document.getElementById('costPrice').value) || 0;
  const sellingPrice = parseFloat(document.getElementById('sellingPrice').value) || 0;
  const sku = document.getElementById('sku').value.trim() || generateSKU();
  const stock = parseInt(document.getElementById('stock').value) || 0;
  const vendorId = document.getElementById('vendorSelect').value;
  const deliveryType = document.getElementById('deliveryType').value;
  const deliveryCost = parseFloat(document.getElementById('deliveryCost').value) || 0;
  
  if (!title) {
    alert('Please enter a product title');
    return;
  }
  
  if (!vendorId) {
    alert('Please select a vendor');
    return;
  }
  
  btn.disabled = true;
  btnText.innerHTML = '<span class="loading"><span class="spinner"></span> Importing...</span>';
  
  try {
    const response = await fetch(`${apiUrl}/api/extension/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        name: title,
        description,
        costPrice: costPrice.toString(),
        sellingPrice: sellingPrice.toString(),
        sku,
        stockQuantity: stock,
        vendorId: parseInt(vendorId),
        imageUrl: productData?.image || null,
        sourceUrl: productData?.sourceUrl || null,
        deliveryType,
        deliveryCost: deliveryCost.toString()
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to import product');
    }
    
    showSuccessSection();
  } catch (error) {
    showErrorSection(error.message || 'Failed to import product. Please try again.');
  } finally {
    btn.disabled = false;
    btnText.textContent = 'Add to Inventory';
  }
}

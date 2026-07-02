export interface FaqQuestion {
  q: string;
  a: string;
}

export interface FaqCategory {
  category: string;
  questions: FaqQuestion[];
}

export const faqData: FaqCategory[] = [
  {
    category: "Getting Started",
    questions: [
      {
        q: "How do I connect my eBay store?",
        a: "Go to the Stores page, click 'Connect Store', select eBay, enter your eBay username and the email address linked to your eBay account, choose a store name and eBay site (UK, US, Germany, etc.), then click 'Connect to eBay'. You'll be securely redirected to eBay to authorise DropandSell Automation App. Once approved, your store is connected automatically — no API keys needed."
      },
      {
        q: "How do I connect my Shopify or Amazon store?",
        a: "Go to the Stores page, click 'Connect Store', select your platform (Shopify or Amazon), enter your store name and API credentials, then click 'Connect Store'. For Shopify you'll need your shop domain and access token. For Amazon you'll need your Seller ID and AWS credentials."
      },
      {
        q: "What marketplaces does DropandSell Automation App support?",
        a: "DropandSell Automation App currently supports eBay, Shopify, and Amazon. eBay connects automatically via OAuth (one click). Shopify and Amazon require API credentials from your seller accounts."
      },
      {
        q: "How do I add products to my inventory?",
        a: "There are three ways to add products: (1) Use the Chrome Browser Extension to import products directly from vendor websites like Amazon, AliExpress, eBay, Walmart, Etsy, and Shein. (2) Upload a CSV file via Manual > Import tab. (3) Manually add products from the Manual > Import tab using the product entry form."
      },
      {
        q: "What is the Chrome Browser Extension?",
        a: "The DropandSell Automation App Browser Extension lets you import products directly from vendor websites while browsing. Simply navigate to a product page on Amazon, AliExpress, eBay, Walmart, Etsy, or Shein, click the extension icon, and import the product with one click. It automatically extracts the product title, price, images, and description. You can download it from Settings > Browser Extension."
      },
      {
        q: "How do I set up the Browser Extension?",
        a: "Go to Settings, scroll to the Browser Extension section, and download the extension zip file. Unzip it, then go to chrome://extensions in Chrome, enable Developer Mode, click 'Load unpacked', and select the unzipped folder. Enter your API URL (your app's base URL), Unique URL code, and API Key to connect."
      }
    ]
  },
  {
    category: "Products & Inventory",
    questions: [
      {
        q: "How do I import products using CSV?",
        a: "Go to Manual > Import tab. Select your vendor, upload a CSV file with product data, map the columns to the appropriate fields (title, SKU, price, etc.), preview the data, and confirm the import. Products will be added to your inventory."
      },
      {
        q: "How do I manage product delivery settings?",
        a: "Each product has configurable delivery settings. When adding or editing a product, choose the delivery type: 'Free Delivery' (no cost to buyer), 'Buyer Pays' (buyer covers shipping), or 'Seller Pays' (you cover shipping). Set the delivery cost when applicable."
      },
      {
        q: "What are vendors and how do I add them?",
        a: "Vendors are your product suppliers (e.g., Amazon, AliExpress). Navigate to the Vendors page and click 'Add Vendor'. When using the Browser Extension, vendors are automatically detected and created based on the website you're importing from."
      },
      {
        q: "Can I generate product descriptions with AI?",
        a: "Yes! When adding products manually or via the Browser Extension, click the 'AI Generate Description' button. The AI will create a professional, SEO-optimized product description based on the product title and details."
      }
    ]
  },
  {
    category: "Publishing & Marketplace Listings",
    questions: [
      {
        q: "How do I publish products to my stores?",
        a: "From the Inventory page, select the products you want to publish and click 'Publish to Store'. Choose a specific store or select 'All Stores' to publish to every connected store at once. Products will be added to the publish queue with pricing rules applied. You can also review and manage the queue in Manual > Publish tab."
      },
      {
        q: "How does the publish queue work?",
        a: "The publish queue is a staging area where you can review products before they go live on your marketplace stores. Products are checked for VERO compliance, content filters, and restricted items before publishing. You can adjust quantities and review pricing before confirming."
      },
      {
        q: "What happens when I publish a product?",
        a: "When you publish, the product is sent directly to your connected marketplace store via their API. For Shopify, it creates a new product listing. For eBay, it creates a fixed-price listing. For Amazon, it submits a product feed. The listing URL and external ID are tracked in your dashboard."
      },
      {
        q: "Why was my product blocked from publishing?",
        a: "Products can be blocked for three reasons: (1) VERO violation - the product matches a restricted brand or keyword. (2) Personal information detected - the title or description contains email addresses, phone numbers, or website URLs. (3) Restricted product - the item falls into a regulated category. Check the error message for specific details."
      }
    ]
  },
  {
    category: "Store Connections",
    questions: [
      {
        q: "Do I need eBay API keys to connect my store?",
        a: "No! eBay uses a secure OAuth connection. Just click 'Connect to eBay', log into your eBay account, and authorise DropandSell Automation App. Your store is connected automatically with no API keys to manage."
      },
      {
        q: "How do I reconnect or refresh my eBay connection?",
        a: "If your eBay connection expires, go to Stores, click the edit (pencil) icon on your eBay store, and click 'Reconnect eBay Account'. You'll be redirected to eBay to re-authorise."
      },
      {
        q: "Can I connect multiple stores?",
        a: "Yes! The number of stores you can connect depends on your subscription plan: Starter (2 stores), Basic (4), Growth (6), Professional (8), Business (12), and Enterprise (15). Each store requires its own unique marketplace credentials. To add another store, click 'Connect Store' and enter the details for your marketplace account."
      },
      {
        q: "Can I publish to all stores at once?",
        a: "Yes! When you have 2 or more active stores connected, you'll see an 'All Stores' option in the store selector when publishing. Select it to publish the same products to every connected store simultaneously. This works from both the Inventory page and the Automation publish queue."
      },
      {
        q: "How do I test if my store connection is working?",
        a: "On the Stores page, click 'Test Connection' on any store card. This will verify your credentials are valid and the connection to the marketplace is active."
      }
    ]
  },
  {
    category: "Pricing Rules",
    questions: [
      {
        q: "How do pricing rules work?",
        a: "Pricing rules automatically calculate selling prices from cost prices. Go to Manual > Pricing tab to create rules. Three types are available: Markup % (adds a percentage on top), Margin % (sets profit margin), or Fixed Amount (adds a fixed value). Rules can target specific vendors or apply globally."
      },
      {
        q: "Can I set minimum and maximum prices?",
        a: "Yes! When creating a pricing rule, you can set optional min/max price constraints. This prevents products from being priced too low (protecting margins) or too high (remaining competitive)."
      },
      {
        q: "How are pricing rules prioritised?",
        a: "Each rule has a priority number. Higher priority rules take precedence. If multiple rules could apply to a product (e.g., a vendor-specific rule and a global rule), the one with the highest priority is used."
      }
    ]
  },
  {
    category: "VERO & Content Protection",
    questions: [
      {
        q: "What is VERO compliance?",
        a: "VERO (Verified Rights Owner Program) prevents listing trademarked or restricted products. DropandSell Automation App scans product titles, SKUs, and descriptions against your VERO list before publishing. Manage your VERO list in Manual > VERO tab."
      },
      {
        q: "What are content filters?",
        a: "Content filters prevent personal information (emails, phone numbers, website URLs, social media handles) from being included in product listings. This helps avoid marketplace policy violations. Manage filters in Manual > Filters tab."
      },
      {
        q: "How do I manage the VERO list?",
        a: "Go to Manual > VERO tab. You can add restricted brands, keywords, and SKU patterns (with wildcard support using *). Items can be set for specific platforms (eBay, Amazon, Shopify) or all platforms. Toggle items active/inactive without deleting them."
      }
    ]
  },
  {
    category: "Orders & Wallet",
    questions: [
      {
        q: "How do orders appear in the system?",
        a: "Orders from your connected eBay stores are automatically synced and tracked in the Orders page. Each order shows customer details, shipping address, order total, and fulfillment status (Pending, Processing, Shipped, or Cancelled). eBay sales revenue is automatically credited to your wallet."
      },
      {
        q: "How does the wallet work?",
        a: "Your DropandSell Automation App wallet tracks your earnings and funds. eBay sales revenue is automatically deposited into your wallet when orders sync. You can also deposit funds via card payment through our secure Stripe integration. Your saved Stripe subscription card is automatically available as a payment method. View all transactions, referral earnings, and your current balance on the Wallet page."
      },
      {
        q: "What is the referral programme?",
        a: "Share your unique referral link (found on the Referrals page) with other sellers. When they subscribe to any plan, you earn 10% monthly commission on their subscription amount. Referral earnings are tracked in your wallet's referral balance and on the Referrals page, where you can see each referred user, their plan, and your total earnings."
      }
    ]
  },
  {
    category: "Automated Fulfillment",
    questions: [
      {
        q: "What is automated fulfillment?",
        a: "Automated Fulfillment is DropandSell's semi-automated order processing system. When an eBay order comes in, click 'Fulfill' on the order to see a guided workflow: the system matches the product to a vendor via SKU mappings, shows you the vendor product link and cost, pre-formats the shipping address for one-click copy, and opens the vendor page for you. After you place the vendor order, enter the tracking number and it syncs back to eBay automatically."
      },
      {
        q: "How do SKU mappings work?",
        a: "SKU mappings link your eBay product SKUs to vendor product SKUs. You can set them up in two ways: (1) Automatic — click the 'Sync from Inventory' button on the Fulfillment page > SKU Mapping tab, and the system will automatically generate mappings from your imported product inventory, using each product's SKU, vendor, cost price, and source URL. SKU mappings are also auto-created when eBay orders are synced and the order's SKU matches a product in your inventory. (2) Manual — click 'Add Mapping' and enter the eBay SKU, vendor SKU, vendor name (e.g., Amazon, AliExpress), vendor product URL, cost price, and optional price threshold. When an order arrives, the system uses these mappings to find the correct vendor product."
      },
      {
        q: "How do I add payment cards for fulfillment?",
        a: "Go to the Fulfillment page > Payment Methods tab. Your saved Stripe subscription card from your wallet is automatically shown with a 'Wallet Card' badge. You can also add additional cards specifically for vendor checkout by clicking 'Add Card' and entering the card details. Set any card as your default payment method for automated vendor orders."
      },
      {
        q: "How do I view fulfillment jobs?",
        a: "Go to the Fulfillment page > Fulfillment Jobs tab. Each job shows the order ID, vendor, status (queued, processing, completed, or failed), cost, tracking number, and timestamps. You can monitor the progress of all automated orders here."
      },
      {
        q: "What about returns?",
        a: "Return requests can be managed from the Fulfillment page > Returns tab. Submit return requests with the order ID, reason, and details. Track the status of each return request from submitted through to completed."
      },
      {
        q: "Is automated fulfillment available to everyone?",
        a: "Automated Fulfillment is currently being rolled out. It may be in admin-only testing mode initially. Once published, it becomes available to all subscribers. Check the Fulfillment page — if you can see it in your sidebar, the feature is active for your account."
      }
    ]
  },
  {
    category: "Subscription & Billing",
    questions: [
      {
        q: "What subscription plans are available?",
        a: "DropandSell Automation App offers 6 tiers: Starter (£12/month, 500 listings), Basic (£20/month, 750 listings), Growth (£35/month, 1,200 listings), Professional (£50/month, 2,000 listings), Business (£75/month, 4,000 listings), and Enterprise (£100/month, 8,000 listings)."
      },
      {
        q: "Can I upgrade or downgrade my plan?",
        a: "Yes! You can change your plan at any time from the Subscription page. Upgrades take effect immediately, and downgrades apply at the end of your billing cycle."
      },
      {
        q: "When does billing start?",
        a: "Billing starts immediately when you subscribe. You can cancel anytime from the Subscription page. All plans are billed monthly with no long-term commitment."
      }
    ]
  },
  {
    category: "Account & Settings",
    questions: [
      {
        q: "Is my data secure?",
        a: "Yes. We use industry-standard encryption for all data at rest and in transit. eBay connections use secure OAuth so your marketplace credentials are never entered into our system. All API communications use HTTPS."
      },
      {
        q: "How do I verify my email address?",
        a: "After signing up, you'll receive a verification email. Click the link to verify. You must verify your email before accessing the full dashboard. You can resend the verification from the verification page."
      },
      {
        q: "How do I log out?",
        a: "Go to the Settings page and click the 'Sign Out' button at the bottom. You can also sign out from the sidebar on desktop."
      },
      {
        q: "What is my Unique URL?",
        a: "Your unique URL is a personalised link to your DropandSell Automation App account. It's displayed in your Settings and Dashboard. Use it when setting up the Browser Extension and for sharing your account access link."
      },
      {
        q: "How do I regenerate my API key?",
        a: "Go to Settings and click 'Regenerate API Key' in the Browser Extension section. Note that this will invalidate your old key, so you'll need to update it in your Browser Extension settings."
      },
      {
        q: "The page doesn't look updated after a new release. What should I do?",
        a: "Click the refresh button in the top-right corner of any page, or do a hard refresh in your browser (Ctrl+Shift+R on Windows, Cmd+Shift+R on Mac) to load the latest version."
      }
    ]
  },
  {
    category: "Support",
    questions: [
      {
        q: "How do I contact support?",
        a: "You can reach our support team via email at support@dropandsell.com. We typically respond within 24 hours during business days."
      },
      {
        q: "The Browser Extension shows 'Import Failed'. What do I do?",
        a: "First, make sure your API URL is just the base URL (e.g., https://yourapp.replit.app) without any extra path. Check that your API Key and Unique URL code are correct in the extension settings. If the error persists, try disconnecting and reconnecting in the extension, or regenerate your API key from Settings."
      },
      {
        q: "What if I find a bug?",
        a: "Please report any issues to support@dropandsell.com with details about what happened, what you expected, and steps to reproduce. Screenshots are very helpful!"
      }
    ]
  }
];

export function searchFaq(query: string): { q: string; a: string } | null {
  const normalizedQuery = query.toLowerCase().trim();
  
  const allQuestions = faqData.flatMap(cat => cat.questions);
  
  const keywords = normalizedQuery.split(/\s+/).filter(w => w.length > 2);
  
  let bestMatch: { q: string; a: string; score: number } | null = null;
  
  for (const item of allQuestions) {
    const questionLower = item.q.toLowerCase();
    const answerLower = item.a.toLowerCase();
    let score = 0;
    
    for (const keyword of keywords) {
      if (questionLower.includes(keyword)) score += 3;
      if (answerLower.includes(keyword)) score += 1;
    }
    
    if (keywords.length > 0) {
      const matchRatio = score / (keywords.length * 3);
      if (matchRatio >= 0.4 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { ...item, score };
      }
    }
  }
  
  return bestMatch ? { q: bestMatch.q, a: bestMatch.a } : null;
}

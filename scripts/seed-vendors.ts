import { db } from "../server/db";
import { vendors } from "@shared/schema";

const supplierList = [
  // === PLATFORM / DIRECTORY (Global) ===
  { name: "AliExpress", website: "https://www.aliexpress.com", category: "marketplace", tags: "global,general,electronics,fashion,home", country: "China", integrationType: "api", leadTime: "15-30 days", notes: "Alibaba Group. 100M+ products across all categories. Most popular dropshipping source." },
  { name: "Alibaba", website: "https://www.alibaba.com", category: "manufacturer", tags: "global,wholesale,bulk,manufacturing", country: "China", integrationType: "api", leadTime: "15-45 days", notes: "B2B marketplace connecting buyers with manufacturers. Minimum orders typically required." },
  { name: "CJDropshipping", website: "https://cjdropshipping.com", category: "dropshipper", tags: "global,general,fulfillment,warehouse", country: "China", integrationType: "api", leadTime: "4-15 days", notes: "50+ warehouses worldwide. Product sourcing, warehousing, fulfillment, private labeling." },
  { name: "DSers", website: "https://www.dsers.com", category: "dropshipper", tags: "global,aliexpress,automation,shopify", country: "China", integrationType: "api", leadTime: "15-30 days", notes: "AliExpress dropshipping automation. Bulk order management, auto-fulfillment." },
  { name: "Spocket", website: "https://www.spocket.co", category: "dropshipper", tags: "global,us,eu,fashion,home,beauty", country: "United States", integrationType: "api", leadTime: "2-7 days", notes: "Curated US/EU suppliers. Fast shipping, branded invoicing. Shopify, WooCommerce, Wix." },
  { name: "Zendrop", website: "https://www.zendrop.com", category: "dropshipper", tags: "global,automation,fulfillment", country: "United States", integrationType: "api", leadTime: "5-15 days", notes: "Automated dropshipping with quality control. US warehouse. Shopify, WooCommerce." },
  { name: "Modalyst", website: "https://www.modalyst.co", category: "dropshipper", tags: "global,us,eu,fashion,lifestyle,beauty", country: "United States", integrationType: "api", leadTime: "3-10 days", notes: "Premium US/EU brands. Boutique and luxury products. Shopify, BigCommerce, Wix." },
  { name: "AutoDS", website: "https://www.autods.com", category: "dropshipper", tags: "global,automation,general,fulfillment", country: "United States", integrationType: "api", leadTime: "5-20 days", notes: "All-in-one dropshipping automation. Price monitoring, auto-ordering, fulfillment." },
  { name: "Syncee", website: "https://syncee.com", category: "dropshipper", tags: "global,general,catalog,import", country: "United States", integrationType: "api", leadTime: "5-15 days", notes: "Global supplier directory with product import. 25 free products. Shopify, Wix, BigCommerce." },
  { name: "SaleHoo", website: "https://www.salehoo.com", category: "dropshipper", tags: "global,directory,vetted,research", country: "New Zealand", integrationType: "api", leadTime: "varies", notes: "8,000+ pre-vetted suppliers. Market research tools. 2.5M+ products across 75 categories." },
  { name: "Worldwide Brands", website: "https://www.worldwidebrands.com", category: "dropshipper", tags: "global,directory,certified,wholesale", country: "United States", integrationType: "api", leadTime: "varies", notes: "Lifetime access directory. 16M+ certified products. 8,000+ verified suppliers since 1999." },
  { name: "Wholesale Central", website: "https://www.wholesalecentral.com", category: "dropshipper", tags: "global,directory,us,general", country: "United States", integrationType: "api", leadTime: "varies", notes: "Free B2B supplier directory. US-based wholesalers across all categories." },
  { name: "Wholesale2B", website: "https://www.wholesale2b.com", category: "dropshipper", tags: "global,directory,us,general", country: "United States", integrationType: "api", leadTime: "3-10 days", notes: "1.5M+ products from 100+ US suppliers. Multi-platform integration." },
  { name: "Doba", website: "https://www.doba.com", category: "dropshipper", tags: "global,aggregator,general,multi-supplier", country: "United States", integrationType: "api", leadTime: "3-12 days", notes: "2M+ products aggregated from multiple suppliers. Amazon, eBay, Shopify." },
  { name: "TopDawg", website: "https://topdawg.com", category: "dropshipper", tags: "global,us,general,fast-shipping", country: "United States", integrationType: "api", leadTime: "2-5 days", notes: "3,000+ verified US suppliers. 500K+ products. Real-time inventory sync." },
  { name: "DropCommerce", website: "https://www.dropcommerce.com", category: "dropshipper", tags: "global,us,curated,general", country: "United States", integrationType: "api", leadTime: "2-7 days", notes: "Curated directory of US dropshippers. vetted suppliers, no monthly fee." },
  { name: "AI Dropship", website: "https://www.aindropship.com", category: "dropshipper", tags: "global,automation,ai,general", country: "United States", integrationType: "api", leadTime: "5-15 days", notes: "AI-powered dropshipping. Product recommendations, auto-fulfillment." },
  { name: "Inventory Source", website: "https://www.inventorysource.com", category: "dropshipper", tags: "global,us,directory,automation", country: "United States", integrationType: "api", leadTime: "varies", notes: "6,500+ dropshippers. Automated inventory sync. Multi-channel integration." },

  // === ELECTRONICS ===
  { name: "Megagoods", website: "https://www.megagoods.com", category: "dropshipper", tags: "electronics,consumer-electronics,us,fast-shipping", country: "United States", integrationType: "api", leadTime: "1-2 days", notes: "Consumer electronics specialist. 3,000+ products. Bluetooth, audio, TV, appliances." },
  { name: "Aulola UK", website: "https://aulola.co.uk", category: "wholesale", tags: "electronics,phone-accessories,uk,eu", country: "United Kingdom", integrationType: "custom", leadTime: "3-7 days", notes: "Phone accessories, consumer electronics. 10,000+ products. UK/EU warehouse." },
  { name: "Sunrise Wholesale", website: "https://www.sunrisewholesale.com", category: "wholesale", tags: "electronics,branded,us,jewelry,home", country: "United States", integrationType: "api", leadTime: "2-5 days", notes: "30,000+ products. Sony, Panasonic, Apple brands. eBay, Amazon, Shopify." },
  { name: "Tmart", website: "https://www.tmart.com", category: "dropshipper", tags: "electronics,gadgets,general,global", country: "China", integrationType: "custom", leadTime: "10-20 days", notes: "Electronics, gadgets, phone accessories. Global shipping." },
  { name: "Chinavasion", website: "https://www.chinavasion.com", category: "wholesale", tags: "electronics,gadgets,china,wholesale", country: "China", integrationType: "custom", leadTime: "10-20 days", notes: "Consumer electronics wholesale. Dropshipping available. Wholesale pricing." },
  { name: "TomTop", website: "https://www.tomtop.com", category: "dropshipper", tags: "electronics,gadgets,general,global", country: "China", integrationType: "custom", leadTime: "10-20 days", notes: "Electronics, gadgets, RC toys. Global warehouse network." },
  { name: "GeekBuying", website: "https://www.geekbuying.com", category: "dropshipper", tags: "electronics,gadgets,tech,global", country: "China", integrationType: "custom", leadTime: "10-20 days", notes: "Tech gadgets, electronics, home appliances. Dropshipping program." },
  { name: "Electronics For Less", website: "https://www.electronicsforless.com", category: "wholesale", tags: "electronics,us,discount,wholesale", country: "United States", integrationType: "custom", leadTime: "3-7 days", notes: "Discounted consumer electronics. US-based wholesale." },
  { name: "Bluetooth Supplier", website: "https://www.bluetoothsupplier.com", category: "wholesale", tags: "electronics,bluetooth,audio,accessories", country: "China", integrationType: "custom", leadTime: "10-18 days", notes: "Bluetooth audio products, headphones, speakers, accessories." },

  // === FASHION & APPAREL ===
  { name: "Trendsi", website: "https://www.trendsi.com", category: "dropshipper", tags: "fashion,womens,apparel,accessories", country: "United States", integrationType: "api", leadTime: "3-10 days", notes: "Free fashion dropshipping. Women's clothing, accessories, jewelry. US/global suppliers." },
  { name: "FashionGo", website: "https://www.fashiongo.net", category: "wholesale", tags: "fashion,wholesale,apparel,accessories", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Wholesale fashion marketplace. 500+ brands. Apparel, accessories, beauty." },
  { name: "LA Showroom", website: "https://www.lashowroom.com", category: "wholesale", tags: "fashion,apparel,us,wholesale", country: "United States", integrationType: "custom", leadTime: "3-7 days", notes: "Los Angeles fashion wholesale. Contemporary women's apparel." },
  { name: "FashionTIY", website: "https://www.fashiontiy.com", category: "wholesale", tags: "fashion,apparel,accessories,wholesale", country: "China", integrationType: "custom", leadTime: "10-20 days", notes: "Global fashion wholesale. Clothing, shoes, accessories, jewelry." },
  { name: "Nihaojewelry", website: "https://www.nihaojewelry.com", category: "wholesale", tags: "fashion,jewelry,accessories,wholesale", country: "China", integrationType: "custom", leadTime: "10-18 days", notes: "Fashion jewelry, accessories, hair products. Wholesale pricing, dropshipping." },
  { name: "Intimate Dropship", website: "https://www.intimatedropship.com", category: "dropshipper", tags: "fashion,lingerie,adult,intimate", country: "United States", integrationType: "api", leadTime: "2-5 days", notes: "Specialized adult products and lingerie. 120K+ products. 20+ years." },
  { name: "Zhelin Fashion", website: "https://www.zhelinfashion.com", category: "wholesale", tags: "fashion,womens,apparel,wholesale", country: "China", integrationType: "custom", leadTime: "10-20 days", notes: "Women's fashion wholesale. Dresses, tops, bottoms. OEM/ODM available." },
  { name: "SheIn Wholesale", website: "https://wholesale.shein.com", category: "wholesale", tags: "fashion,womens,apparel,wholesale,global", country: "China", integrationType: "custom", leadTime: "10-20 days", notes: "SheIn wholesale program. Trendy women's fashion at wholesale prices." },
  { name: "Romwe Wholesale", website: "https://wholesale.romwe.com", category: "wholesale", tags: "fashion,womens,apparel,wholesale", country: "China", integrationType: "custom", leadTime: "10-20 days", notes: "Romwe wholesale. Budget-friendly women's fashion." },

  // === PRINT ON DEMAND ===
  { name: "Printful", website: "https://www.printful.com", category: "dropshipper", tags: "pod,custom,apparel,merch,global", country: "United States", integrationType: "api", leadTime: "2-7 days", notes: "Print-on-demand. Custom apparel, accessories, home decor. Multiple fulfillment centers." },
  { name: "Printify", website: "https://printify.com", category: "dropshipper", tags: "pod,custom,apparel,merch,global", country: "United States", integrationType: "api", leadTime: "2-10 days", notes: "Print-on-demand marketplace. 100+ print providers. Wide product catalog." },
  { name: "Gooten", website: "https://www.gooten.com", category: "dropshipper", tags: "pod,custom,apparel,home,global", country: "United States", integrationType: "api", leadTime: "3-10 days", notes: "Print-on-demand with global fulfillment network. Apparel, home decor, accessories." },
  { name: "Merchize", website: "https://merchize.com", category: "dropshipper", tags: "pod,custom,apparel,fulfillment,global", country: "United States", integrationType: "api", leadTime: "3-8 days", notes: "Print-on-demand fulfillment. No minimum orders. Global shipping." },
  { name: "CustomCat", website: "https://www.customcat.com", category: "dropshipper", tags: "pod,custom,apparel,us,fast", country: "United States", integrationType: "api", leadTime: "2-5 days", notes: "US-based print-on-demand. Fast turnaround. No monthly fees." },
  { name: "T-Pop", website: "https://www.t-pop.com", category: "dropshipper", tags: "pod,custom,apparel,eu", country: "Poland", integrationType: "api", leadTime: "3-10 days", notes: "EU-based print-on-demand. Apparel, accessories, home decor." },

  // === HOME, GARDEN & FURNITURE ===
  { name: "vidaXL", website: "https://www.vidaxl.com", category: "dropshipper", tags: "home,furniture,garden,uk,eu", country: "Netherlands", integrationType: "api", leadTime: "3-10 days", notes: "Furniture, garden, home decor dropshipping. European logistics network." },
  { name: "Costway", website: "https://www.costway.com", category: "dropshipper", tags: "home,furniture,fitness,toys,garden", country: "United States", integrationType: "custom", leadTime: "5-15 days", notes: "Furniture, fitness equipment, toys, garden essentials. UK dropshipping program." },
  { name: "Wayfair Professional", website: "https://www.wayfair.com/professional", category: "wholesale", tags: "home,furniture,decor,us,wholesale", country: "United States", integrationType: "custom", leadTime: "5-15 days", notes: "B2B furniture and home decor. Trade program for resellers." },
  { name: "Geko Products", website: "https://www.gekoproducts.co.uk", category: "dropshipper", tags: "home,giftware,lifestyle,uk", country: "United Kingdom", integrationType: "custom", leadTime: "2-5 days", notes: "UK-based giftware and home decor. Boutique lifestyle products." },
  { name: "Touch of Class", website: "https://www.touchofclass.com", category: "wholesale", tags: "home,decor,furniture,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Home decor, bedding, furniture. Catalog wholesale program." },
  { name: "Lush Decor", website: "https://www.lushdecor.com", category: "wholesale", tags: "home,decor,curtains,bedding,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Home decor wholesaler. Curtains, bedding, decorative accessories." },
  { name: "Danish Design", website: "https://www.danishdesign.com", category: "wholesale", tags: "home,furniture,danish,eu,modern", country: "Denmark", integrationType: "custom", leadTime: "7-21 days", notes: "Modern Danish furniture and home accessories." },
  { name: "Homary", website: "https://www.homary.com", category: "dropshipper", tags: "home,furniture,decor,lighting,global", country: "China", integrationType: "custom", leadTime: "10-25 days", notes: "Modern home furniture and decor. Global shipping. Wholesale program." },

  // === BEAUTY & HEALTH ===
  { name: "Wholesale Beauty Supplies", website: "https://www.wbsbeauty.com", category: "wholesale", tags: "beauty,cosmetics,skincare,wholesale", country: "United States", integrationType: "custom", leadTime: "3-7 days", notes: "Beauty supply wholesaler. Cosmetics, skincare, nail products, salon supplies." },
  { name: "Beautylish", website: "https://www.beautylish.com", category: "wholesale", tags: "beauty,cosmetics,skincare,premium", country: "United States", integrationType: "custom", leadTime: "3-7 days", notes: "Premium beauty products. Independent and luxury brands." },
  { name: "Derma E", website: "https://www.dermae.com", category: "wholesale", tags: "beauty,skincare,natural,us", country: "United States", integrationType: "custom", leadTime: "3-7 days", notes: "Natural skincare products. Wholesale program for resellers." },
  { name: "Beauty Supply Source", website: "https://www.beautysupplysource.com", category: "wholesale", tags: "beauty,cosmetics,salon,hair,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Full-service beauty supply wholesaler. Hair, skin, nails, salon equipment." },
  { name: "Nature's Beauty", website: "https://www.naturesbeauty.com", category: "wholesale", tags: "beauty,natural,organic,skincare", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Natural and organic beauty products. Wholesale pricing." },
  { name: "My Beauty Supply", website: "https://www.mybeautysupply.com", category: "wholesale", tags: "beauty,hair,wigs,extensions,us", country: "United States", integrationType: "custom", leadTime: "3-7 days", notes: "Hair products, wigs, extensions, beauty supplies." },

  // === PET SUPPLIES ===
  { name: "PetSmart Wholesale", website: "https://www.petsmart.com/wholesale", category: "wholesale", tags: "pets,pet-supplies,us,wholesale", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Pet supplies wholesale program. Food, toys, accessories, health products." },
  { name: "PetFlow", website: "https://www.petflow.com", category: "dropshipper", tags: "pets,pet-food,pet-supplies,us", country: "United States", integrationType: "custom", leadTime: "2-7 days", notes: "Pet food and supplies dropshipping. Auto-ship available." },
  { name: "Wholesale Pet Supplies", website: "https://www.wholesalepetsupplies.com", category: "wholesale", tags: "pets,pet-supplies,us,wholesale", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Pet supply wholesaler. Food, treats, toys, accessories, health." },
  { name: "Pet Products Wholesale", website: "https://www.petproductswholesale.com", category: "wholesale", tags: "pets,pet-supplies,us,wholesale,uk", country: "United Kingdom", integrationType: "custom", leadTime: "3-10 days", notes: "UK-based pet products wholesaler. Dropshipping available." },
  { name: "BudgetPetWorld", website: "https://www.budgetpetworld.com", category: "dropshipper", tags: "pets,pet-supplies,au,wholesale", country: "Australia", integrationType: "custom", leadTime: "5-15 days", notes: "Australian pet supplies. Dropshipping program." },

  // === SPORTS & FITNESS ===
  { name: "Sports Unlimited", website: "https://www.sportsunlimited.com", category: "wholesale", tags: "sports,fitness,outdoor,us,wholesale", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Sports equipment and apparel wholesaler." },
  { name: "Fitness Wholesale", website: "https://www.fitnesswholesale.com", category: "wholesale", tags: "sports,fitness,equipment,us,wholesale", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Fitness equipment and accessories wholesale." },
  { name: "Outdoor Sports Wholesale", website: "https://www.outdoorsportswholesale.com", category: "wholesale", tags: "sports,outdoor,camping,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Outdoor sports and camping gear wholesale." },
  { name: "Yoga Wholesale", website: "https://www.yogawholesale.com", category: "wholesale", tags: "sports,yoga,fitness,wholesale", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Yoga mats, apparel, accessories wholesale." },
  { name: "Cycling Wholesale", website: "https://www.cyclingwholesale.com", category: "wholesale", tags: "sports,cycling,bike,accessories,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Cycling parts, accessories, apparel wholesale." },

  // === BABY & KIDS ===
  { name: "Baby Products Wholesale", website: "https://www.babyproductswholesale.com", category: "wholesale", tags: "baby,kids,gear,us,wholesale", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Baby products, gear, clothing wholesale." },
  { name: "Kids Fashion Wholesale", website: "https://www.kidsfashionwholesale.com", category: "wholesale", tags: "kids,clothing,fashion,wholesale", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Children's clothing and accessories wholesale." },
  { name: "Toy Wholesaler", website: "https://www.toywholesaler.com", category: "wholesale", tags: "toys,kids,games,wholesale", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Toy and game wholesaler. Educational, action figures, board games." },
  { name: "Educational Toys Wholesale", website: "https://www.educationaltoyswholesale.com", category: "wholesale", tags: "toys,kids,educational,wholesale", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Educational toys and learning materials wholesale." },

  // === AUTOMOTIVE ===
  { name: "Auto Parts Wholesale", website: "https://www.autopartswholesale.com", category: "wholesale", tags: "automotive,parts,accessories,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Auto parts and accessories wholesale distributor." },
  { name: "Car Accessories Wholesale", website: "https://www.caraccessorieswholesale.com", category: "wholesale", tags: "automotive,accessories,car,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Car accessories wholesale. Interior, exterior, electronics." },
  { name: "Automotive Wholesale Direct", website: "https://www.automotivewholesaledirect.com", category: "wholesale", tags: "automotive,parts,tools,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Automotive parts and tools wholesale." },

  // === JEWELRY & WATCHES ===
  { name: "Jewelry Wholesale", website: "https://www.jewelrywholesale.com", category: "wholesale", tags: "jewelry,fashion,accessories,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Fashion jewelry wholesale. Sterling silver, gold plated, costume jewelry." },
  { name: "Watch Wholesaler", website: "https://www.watchwholesaler.com", category: "wholesale", tags: "watches,timepieces,fashion,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Watch wholesaler. Fashion, sports, luxury watches." },
  { name: "Beads Wholesale", website: "https://www.beadswholesale.com", category: "wholesale", tags: "jewelry,beads,crafts,diy,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Beads, jewelry findings, craft supplies wholesale." },

  // === UK SUPPLIERS ===
  { name: "Banggood UK", website: "https://www.banggood.com", category: "dropshipper", tags: "uk,general,electronics,home,global", country: "United Kingdom", integrationType: "api", leadTime: "3-12 days", notes: "UK warehouse. Electronics, home, fashion, toys. Dropshipping program." },
  { name: "Go Dropship UK", website: "https://www.godropship.com", category: "dropshipper", tags: "uk,general,fulfillment,no-minimum", country: "United Kingdom", integrationType: "custom", leadTime: "2-5 days", notes: "UK-based dropshipping. No minimum order. Fast delivery across UK." },
  { name: "eSources UK", website: "https://www.esources.co.uk", category: "dropshipper", tags: "uk,directory,general,wholesale", country: "United Kingdom", integrationType: "custom", leadTime: "varies", notes: "UK's largest wholesale directory. 171K+ dropshippers listed." },
  { name: "The Wholesaler UK", website: "https://www.thewholesaler.co.uk", category: "dropshipper", tags: "uk,directory,general,wholesale", country: "United Kingdom", integrationType: "custom", leadTime: "varies", notes: "UK wholesale trade directory. 100K+ products. 21+ years." },
  { name: "BigBuy", website: "https://www.bigbuy.eu", category: "dropshipper", tags: "uk,eu,general,fulfillment,wholesale", country: "United Kingdom", integrationType: "api", leadTime: "2-7 days", notes: "European dropshipping & wholesale. 110K+ products. UK warehouse." },
  { name: "Pixmania", website: "https://www.pixmania.com", category: "dropshipper", tags: "uk,electronics,home,photo,eu", country: "United Kingdom", integrationType: "custom", leadTime: "3-10 days", notes: "Electronics, photography, home appliances. European distribution." },

  // === EU SUPPLIERS ===
  { name: "Dropshipping.de", website: "https://www.dropshipping.de", category: "dropshipper", tags: "eu,germany,general,fulfillment", country: "Germany", integrationType: "custom", leadTime: "2-7 days", notes: "German dropshipping supplier. Fast EU delivery." },
  { name: "Wholesale Germany", website: "https://www.wholesalegermany.com", category: "wholesale", tags: "eu,germany,general,wholesale", country: "Germany", integrationType: "custom", leadTime: "3-10 days", notes: "German wholesale directory. EU-focused suppliers." },
  { name: "ManoMano", website: "https://www.manomano.com", category: "marketplace", tags: "eu,home,DIY,garden,france", country: "France", integrationType: "api", leadTime: "3-10 days", notes: "European marketplace for home improvement and garden products." },
  { name: "Fruugo", website: "https://www.fruugo.com", category: "marketplace", tags: "eu,global,marketplace,general", country: "Finland", integrationType: "api", leadTime: "5-15 days", notes: "Global marketplace connecting retailers to international customers." },

  // === AUSTRALIA ===
  { name: "OZ Wholesale", website: "https://www.ozwholesale.com", category: "wholesale", tags: "au,general,wholesale,directory", country: "Australia", integrationType: "custom", leadTime: "3-10 days", notes: "Australian wholesale directory and dropshipping suppliers." },
  { name: "Wholesale Home AU", website: "https://www.wholesalehome.com.au", category: "wholesale", tags: "au,home,furniture,garden", country: "Australia", integrationType: "custom", leadTime: "3-10 days", notes: "Australian home and garden wholesale." },
  { name: "Dropship Direct AU", website: "https://www.dropshipdirect.com.au", category: "dropshipper", tags: "au,general,fulfillment,dropship", country: "Australia", integrationType: "custom", leadTime: "3-7 days", notes: "Australian dropshipping. Local warehouses. Fast delivery." },
  { name: "Online Wholesale AU", website: "https://www.onlinewholesale.com.au", category: "wholesale", tags: "au,general,wholesale,directory", country: "Australia", integrationType: "custom", leadTime: "3-10 days", notes: "Australian wholesale products and suppliers directory." },

  // === CANADA ===
  { name: "Canadian Wholesale", website: "https://www.canadianwholesale.com", category: "wholesale", tags: "ca,general,wholesale,directory", country: "Canada", integrationType: "custom", leadTime: "3-10 days", notes: "Canadian wholesale directory. Local suppliers." },
  { name: "Wholesale Canada", website: "https://www.wholesalecanada.com", category: "wholesale", tags: "ca,general,wholesale,directory", country: "Canada", integrationType: "custom", leadTime: "3-10 days", notes: "Canadian wholesale and dropshipping suppliers." },
  { name: "Dropship Canada", website: "https://www.dropshipcanada.ca", category: "dropshipper", tags: "ca,general,fulfillment,dropship", country: "Canada", integrationType: "custom", leadTime: "2-7 days", notes: "Canadian dropshipping platform. Local fulfillment." },

  // === SPECIALIZED NICHE ===
  { name: "GoPro Wholesale", website: "https://www.gopro.com", category: "wholesale", tags: "electronics,cameras,action-cameras", country: "United States", integrationType: "custom", leadTime: "3-7 days", notes: "GoPro authorized wholesale. Action cameras and accessories." },
  { name: "DJI Wholesale", website: "https://www.dji.com", category: "wholesale", tags: "electronics,drones,cameras", country: "China", integrationType: "custom", leadTime: "5-15 days", notes: "DJI authorized wholesale. Drones, cameras, gimbals." },
  { name: "Guitar Wholesale", website: "https://www.guitarwholesale.com", category: "wholesale", tags: "music,guitars,instruments,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Musical instruments wholesale. Guitars, amps, accessories." },
  { name: "Book Wholesale", website: "https://www.bookwholesale.com", category: "wholesale", tags: "books,media,education,wholesale", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Book wholesaler. Fiction, non-fiction, educational." },
  { name: "Craft Supplies Wholesale", website: "https://www.craftsupplieswholesale.com", category: "wholesale", tags: "crafts,diy,art,supplies,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Craft and art supplies wholesale." },
  { name: "Party Supplies Wholesale", website: "https://www.partysupplieswholesale.com", category: "wholesale", tags: "party,events,decorations,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Party supplies, decorations, event accessories wholesale." },
  { name: "Garden Supplies Wholesale", website: "https://www.gardensupplieswholesale.com", category: "wholesale", tags: "garden,outdoor,plants,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Garden and outdoor living products wholesale." },
  { name: "Office Supplies Wholesale", website: "https://www.officesupplieswholesale.com", category: "wholesale", tags: "office,supplies,stationery,us", country: "United States", integrationType: "custom", leadTime: "3-7 days", notes: "Office and stationery supplies wholesale." },

  // === DROPSHIPPING AUTOMATION TOOLS ===
  { name: "Easync", website: "https://www.easync.com", category: "dropshipper", tags: "automation,ebay,integration,tool", country: "United States", integrationType: "api", leadTime: "varies", notes: "eBay dropshipping automation. Auto-import, auto-order, auto-fulfill." },
  { name: "Dropified", website: "https://www.dropified.com", category: "dropshipper", tags: "automation,general,fulfillment,tool", country: "United States", integrationType: "api", leadTime: "varies", notes: "Dropshipping automation platform. Product import, order fulfillment." },
  { name: "Oberlo", website: "https://www.oberlo.com", category: "dropshipper", tags: "automation,shopify,aliexpress,tool", country: "United States", integrationType: "api", leadTime: "varies", notes: "Shopify dropshipping app. AliExpress integration." },
  { name: "Spocket Suppliers", website: "https://www.spocket.co/directory", category: "dropshipper", tags: "directory,us,eu,fashion,home", country: "United States", integrationType: "api", leadTime: "2-7 days", notes: "Spocket supplier directory. US/EU suppliers. Fast shipping." },

  // === ADDITIONAL REGIONAL ===
  { name: "Banggood", website: "https://www.banggood.com", category: "dropshipper", tags: "global,electronics,general,warehouse", country: "China", integrationType: "api", leadTime: "7-20 days", notes: "Global dropshipping. Electronics, fashion, home. Multiple warehouses worldwide." },
  { name: "GearBest", website: "https://www.gearbest.com", category: "dropshipper", tags: "global,electronics,gadgets,general", country: "China", integrationType: "custom", leadTime: "10-25 days", notes: "Electronics and gadgets. Dropshipping program available." },
  { name: "LightInTheBox", website: "https://www.lightinthebox.com", category: "dropshipper", tags: "global,general,fashion,electronics,home", country: "China", integrationType: "custom", leadTime: "10-25 days", notes: "General merchandise. Wedding dresses, electronics, home goods." },
  { name: "MiniInTheBox", website: "https://www.miniinthebox.com", category: "dropshipper", tags: "global,general,gadgets,home,electronics", country: "China", integrationType: "custom", leadTime: "10-25 days", notes: "Mini goods and gadgets. Home, electronics, fashion." },
  { name: "Rosegal", website: "https://www.rosegal.com", category: "dropshipper", tags: "global,fashion,plus-size,womens", country: "China", integrationType: "custom", leadTime: "10-25 days", notes: "Plus-size women's fashion. Dropshipping available." },
  { name: "Zaful", website: "https://www.zaful.com", category: "dropshipper", tags: "global,fashion,womens,swimwear", country: "China", integrationType: "custom", leadTime: "10-25 days", notes: "Women's fashion, swimwear, accessories. Dropshipping program." },
  { name: "DressLily", website: "https://www.dresslily.com", category: "dropshipper", tags: "global,fashion,womens,dresses", country: "China", integrationType: "custom", leadTime: "10-25 days", notes: "Women's dresses and fashion. Wholesale and dropshipping." },

  // === US-BASED WHOLESALE ===
  { name: "Wholesale Fashion Shoes", website: "https://www.wholesalefashionshoes.com", category: "wholesale", tags: "shoes,footwear,fashion,us", country: "United States", integrationType: "custom", leadTime: "3-7 days", notes: "Shoe wholesale. Athletic, casual, dress, boots." },
  { name: "Handbag Wholesale", website: "https://www.handbagwholesale.com", category: "wholesale", tags: "handbags,purses,accessories,fashion,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Handbag and purse wholesaler. Designer-inspired, fashion, casual." },
  { name: "Sunglasses Wholesale", website: "https://www.sunglasseswholesale.com", category: "wholesale", tags: "sunglasses,eyewear,accessories,us", country: "United States", integrationType: "custom", leadTime: "3-7 days", notes: "Sunglasses wholesale. Fashion, sport, polarized." },
  { name: "Hat Wholesale", website: "https://www.hatwholesale.com", category: "wholesale", tags: "hats,headwear,accessories,us", country: "United States", integrationType: "custom", leadTime: "3-7 days", notes: "Hat wholesaler. Baseball caps, beanies, fashion hats." },
  { name: "Scarf Wholesale", website: "https://www.scarfwholesale.com", category: "wholesale", tags: "scarves,accessories,fashion,us", country: "United States", integrationType: "custom", leadTime: "3-7 days", notes: "Scarf and wrap wholesaler. Silk, cotton, wool, fashion." },
  { name: "Belt Wholesale", website: "https://www.beltwholesale.com", category: "wholesale", tags: "belts,accessories,fashion,us", country: "United States", integrationType: "custom", leadTime: "3-7 days", notes: "Belt wholesaler. Leather, fashion, casual, dress." },

  // === ELECTRONICS ACCESSORIES ===
  { name: "Phone Case Wholesale", website: "https://www.phonecasewholesale.com", category: "wholesale", tags: "phone-cases,accessories,electronics,us", country: "United States", integrationType: "custom", leadTime: "3-7 days", notes: "Phone case wholesale. iPhone, Samsung, all major brands." },
  { name: "Screen Protector Wholesale", website: "https://www.screenprotectorwholesale.com", category: "wholesale", tags: "screen-protectors,accessories,electronics,us", country: "United States", integrationType: "custom", leadTime: "3-7 days", notes: "Screen protector wholesale. Tempered glass, privacy, anti-glare." },
  { name: "Charger Wholesale", website: "https://www.chargerwholesale.com", category: "wholesale", tags: "chargers,cables,electronics,accessories,us", country: "United States", integrationType: "custom", leadTime: "3-7 days", notes: "Charger and cable wholesale. USB, Lightning, USB-C, wireless." },
  { name: "Headphone Wholesale", website: "https://www.headphonewholesale.com", category: "wholesale", tags: "headphones,audio,electronics,us", country: "United States", integrationType: "custom", leadTime: "3-7 days", notes: "Headphone and audio accessory wholesale." },
  { name: "Smartwatch Wholesale", website: "https://www.smartwatchwholesale.com", category: "wholesale", tags: "smartwatches,wearables,electronics,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Smartwatch and wearable wholesale." },
  { name: "Camera Wholesale", website: "https://www.camerawholesale.com", category: "wholesale", tags: "cameras,photography,electronics,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Camera and photography equipment wholesale." },

  // === HOME TEXTILES ===
  { name: "Bedding Wholesale", website: "https://www.beddingwholesale.com", category: "wholesale", tags: "bedding,linen,home,textiles,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Bedding and linen wholesale. Sheets, comforters, pillows." },
  { name: "Towel Wholesale", website: "https://www.towelwholesale.com", category: "wholesale", tags: "towels,bath,home,textiles,us", country: "United States", integrationType: "custom", leadTime: "3-7 days", notes: "Towel and bath linen wholesale." },
  { name: "Curtain Wholesale", website: "https://www.curtainwholesale.com", category: "wholesale", tags: "curtains,drapes,window,home,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Curtain and drape wholesale. Custom sizes available." },
  { name: "Rug Wholesale", website: "https://www.rugwholesale.com", category: "wholesale", tags: "rugs,carpets,home,flooring,us", country: "United States", integrationType: "custom", leadTime: "5-15 days", notes: "Rug and carpet wholesale. Area rugs, runners, mats." },

  // === KITCHEN & DINING ===
  { name: "Cookware Wholesale", website: "https://www.cookwarewholesale.com", category: "wholesale", tags: "cookware,kitchen,cooking,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Cookware and kitchen tools wholesale." },
  { name: "Kitchen Gadgets Wholesale", website: "https://www.kitchengadgetswholesale.com", category: "wholesale", tags: "kitchen,gadgets,appliances,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Kitchen gadgets and small appliances wholesale." },
  { name: "Tableware Wholesale", website: "https://www.tablewarewholesale.com", category: "wholesale", tags: "tableware,dinnerware,kitchen,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Tableware, dinnerware, glassware wholesale." },
  { name: "Drinkware Wholesale", website: "https://www.drinkwarewholesale.com", category: "wholesale", tags: "drinkware,cups,bottles,kitchen,us", country: "United States", integrationType: "custom", leadTime: "3-7 days", notes: "Drinkware wholesale. Bottles, mugs, cups, tumblers." },

  // === HEALTH & WELLNESS ===
  { name: "Vitamin Wholesale", website: "https://www.vitaminwholesale.com", category: "wholesale", tags: "vitamins,supplements,health,wellness,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Vitamin and supplement wholesale." },
  { name: "Sports Nutrition Wholesale", website: "https://www.sportsnutritionwholesale.com", category: "wholesale", tags: "sports-nutrition,protein,health,fitness,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Sports nutrition and supplement wholesale." },
  { name: "Essential Oil Wholesale", website: "https://www.essentialoilwholesale.com", category: "wholesale", tags: "essential-oils,aromatherapy,health,wellness,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Essential oil and aromatherapy wholesale." },
  { name: "Medical Supplies Wholesale", website: "https://www.medicalsupplieswholesale.com", category: "wholesale", tags: "medical,supplies,health,safety,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Medical and health supplies wholesale." },

  // === TOOLS & HARDWARE ===
  { name: "Tool Wholesale", website: "https://www.toolwholesale.com", category: "wholesale", tags: "tools,hardware,workshop,diy,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Power tools and hardware wholesale." },
  { name: "Hardware Wholesale", website: "https://www.hardwarewholesale.com", category: "wholesale", tags: "hardware,building,supplies,diy,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Building and hardware supplies wholesale." },
  { name: "Lighting Wholesale", website: "https://www.lightingwholesale.com", category: "wholesale", tags: "lighting,lamps,fixtures,home,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Lighting fixtures and lamps wholesale." },
  { name: "Electrical Wholesale", website: "https://www.electricalwholesale.com", category: "wholesale", tags: "electrical,supplies,wiring,diy,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Electrical supplies and equipment wholesale." },

  // === STATIONERY & OFFICE ===
  { name: "Pen Wholesale", website: "https://www.penwholesale.com", category: "wholesale", tags: "pens,stationery,office,writing,us", country: "United States", integrationType: "custom", leadTime: "3-7 days", notes: "Pen and writing instrument wholesale." },
  { name: "Paper Wholesale", website: "https://www.paperwholesale.com", category: "wholesale", tags: "paper,stationery,office,supplies,us", country: "United States", integrationType: "custom", leadTime: "3-7 days", notes: "Paper and stationery wholesale." },
  { name: "Art Supply Wholesale", website: "https://www.artsupplywholesale.com", category: "wholesale", tags: "art,supplies,painting,drawing,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Art and craft supply wholesale." },

  // === LUGGAGE & TRAVEL ===
  { name: "Luggage Wholesale", website: "https://www.luggagewholesale.com", category: "wholesale", tags: "luggage,travel,bags,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Luggage and travel bag wholesale." },
  { name: "Backpack Wholesale", website: "https://www.backpackwholesale.com", category: "wholesale", tags: "backpacks,bags,school,travel,us", country: "United States", integrationType: "custom", leadTime: "3-7 days", notes: "Backpack and school bag wholesale." },
  { name: "Travel Accessories Wholesale", website: "https://www.travelaccessorieswholesale.com", category: "wholesale", tags: "travel,accessories,tourist,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Travel accessories and gear wholesale." },

  // === PLUS MORE SPECIALIZED ===
  { name: "Fishing Wholesale", website: "https://www.fishingwholesale.com", category: "wholesale", tags: "fishing,tackle,outdoor,sports,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Fishing tackle and equipment wholesale." },
  { name: "Camping Wholesale", website: "https://www.campingwholesale.com", category: "wholesale", tags: "camping,outdoor,gear,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Camping and outdoor gear wholesale." },
  { name: "Hunting Wholesale", website: "https://www.huntingwholesale.com", category: "wholesale", tags: "hunting,outdoor,sports,gear,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Hunting equipment and gear wholesale." },
  { name: "Equine Wholesale", website: "https://www.equinewholesale.com", category: "wholesale", tags: "horse,equestrian,pet,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Equestrian and horse supply wholesale." },

  // === ADDITIONAL PLATFORMS ===
  { name: "Shopify Collective", website: "https://www.shopify.com/collective", category: "marketplace", tags: "us,brands,shopify,network", country: "United States", integrationType: "api", leadTime: "varies", notes: "Shopify's supplier network. Connect with US brands." },
  { name: "Handshake", website: "https://www.joinhanshake.com", category: "marketplace", tags: "us,wholesale,brands,shopify", country: "United States", integrationType: "api", leadTime: "varies", notes: "Shopify's wholesale marketplace. US brands." },
  { name: "Faire", website: "https://www.faire.com", category: "marketplace", tags: "us,wholesale,brands,general", country: "United States", integrationType: "api", leadTime: "3-10 days", notes: "Wholesale marketplace connecting retailers with independent brands." },
  { name: "Tundra", website: "https://www.tundra.com", category: "marketplace", tags: "us,wholesale,general,brands", country: "United States", integrationType: "api", leadTime: "3-10 days", notes: "Free wholesale marketplace. No membership fees. US brands." },
  { name: "Abound", website: "https://www.abound.com", category: "marketplace", tags: "us,wholesale,brands,general", country: "United States", integrationType: "api", leadTime: "3-10 days", notes: "Wholesale marketplace for independent retailers." },
  { name: "Bulq", website: "https://www.bulq.com", category: "wholesale", tags: "us,liquidation,wholesale,general", country: "United States", integrationType: "custom", leadTime: "5-15 days", notes: "Liquidation and wholesale pallets. Customer returns, overstock." },
  { name: "Direct Liquidation", website: "https://www.directliquidation.com", category: "wholesale", tags: "us,liquidation,pallets,general", country: "United States", integrationType: "custom", leadTime: "5-15 days", notes: "Wholesale liquidation pallets. Amazon returns, retail overstock." },
  { name: "B-Stock", website: "https://www.bstock.com", category: "marketplace", tags: "us,liquidation,pallets,auction", country: "United States", integrationType: "custom", leadTime: "5-15 days", notes: "B2B liquidation marketplace. Amazon, Walmart, Target returns." },
  { name: "Via Trading", website: "https://www.viatrading.com", category: "wholesale", tags: "us,liquidation,pallets,general", country: "United States", integrationType: "custom", leadTime: "5-15 days", notes: "Wholesale liquidation and closeout merchandise." },

  // === MORE NICHE SUPPLIERS ===
  { name: "Vape Wholesale", website: "https://www.vapewholesale.com", category: "wholesale", tags: "vape,ecig,smoking,us,wholesale", country: "United States", integrationType: "custom", leadTime: "3-7 days", notes: "Vape and e-cigarette wholesale." },
  { name: "Tobacco Wholesale", website: "https://www.tobaccowholesale.com", category: "wholesale", tags: "tobacco,smoking,cigars,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Tobacco product wholesale." },
  { name: "Cigar Wholesale", website: "https://www.cigarwholesale.com", category: "wholesale", tags: "cigars,smoking,premium,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Premium cigar wholesale." },
  { name: "Wine Wholesale", website: "https://www.winewholesale.com", category: "wholesale", tags: "wine,beverages,alcohol,us", country: "United States", integrationType: "custom", leadTime: "5-15 days", notes: "Wine and spirits wholesale." },
  { name: "Coffee Wholesale", website: "https://www.coffeewholesale.com", category: "wholesale", tags: "coffee,beverages,beans,us", country: "United States", integrationType: "custom", leadTime: "3-7 days", notes: "Coffee bean and product wholesale." },
  { name: "Tea Wholesale", website: "https://www.teawholesale.com", category: "wholesale", tags: "tea,beverages,loose-leaf,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Tea and tea accessory wholesale." },
  { name: "Spice Wholesale", website: "https://www.spicewholesale.com", category: "wholesale", tags: "spices,seasonings,food,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Spice and seasoning wholesale." },
  { name: "Candy Wholesale", website: "https://www.candywholesale.com", category: "wholesale", tags: "candy,sweets,confectionery,food,us", country: "United States", integrationType: "custom", leadTime: "3-7 days", notes: "Candy and confectionery wholesale." },
  { name: "Snack Wholesale", website: "https://www.snackwholesale.com", category: "wholesale", tags: "snacks,food,healthy,us", country: "United States", integrationType: "custom", leadTime: "3-7 days", notes: "Snack food wholesale." },

  // === EMERGING & TRENDING ===
  { name: "Temu Supplier Program", website: "https://www.temu.com", category: "marketplace", tags: "global,general,discount,trending", country: "China", integrationType: "api", leadTime: "7-15 days", notes: "Fast-growing marketplace. Competitive pricing. Wide product range." },
  { name: "TikTok Shop Suppliers", website: "https://www.tiktok.com/business", category: "marketplace", tags: "global,social,trending,general", country: "China", integrationType: "api", leadTime: "5-15 days", notes: "TikTok Shop integration. Trending products. Social commerce." },
  { name: "Shopify Spring", website: "https://www.shopify.com/spring", category: "marketplace", tags: "us,sustainable,eco,fashion,home", country: "United States", integrationType: "api", leadTime: "3-10 days", notes: "Sustainable and eco-friendly products marketplace." },

  // === STATIONERY ADDITIONAL ===
  { name: "Notebook Wholesale", website: "https://www.notebookwholesale.com", category: "wholesale", tags: "notebooks,journals,stationery,office,us", country: "United States", integrationType: "custom", leadTime: "3-7 days", notes: "Notebook and journal wholesale." },
  { name: "Planner Wholesale", website: "https://www.plannerwholesale.com", category: "wholesale", tags: "planners,organizers,stationery,us", country: "United States", integrationType: "custom", leadTime: "3-7 days", notes: "Planner and organizer wholesale." },
  { name: "Sticker Wholesale", website: "https://www.stickerwholesale.com", category: "wholesale", tags: "stickers,decals,stationery,crafts,us", country: "United States", integrationType: "custom", leadTime: "3-7 days", notes: "Sticker and decal wholesale." },
  { name: "Washi Tape Wholesale", website: "https://www.washitapewholesale.com", category: "wholesale", tags: "washi-tape,crafts,stationery,japanese,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Washi tape and craft tape wholesale." },
  { name: "Card Wholesale", website: "https://www.cardwholesale.com", category: "wholesale", tags: "greeting-cards,stationery,paper,us", country: "United States", integrationType: "custom", leadTime: "3-7 days", notes: "Greeting card and paper product wholesale." },
  { name: "Gift Wrap Wholesale", website: "https://www.giftwrapwholesale.com", category: "wholesale", tags: "gift-wrap,ribbon,bows,party,us", country: "United States", integrationType: "custom", leadTime: "3-7 days", notes: "Gift wrap and ribbon wholesale." },
  { name: "Candle Wholesale", website: "https://www.candlewholesale.com", category: "wholesale", tags: "candles,home-decor,gifts,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Candle and home fragrance wholesale." },
  { name: "Soap Wholesale", website: "https://www.soapwholesale.com", category: "wholesale", tags: "soap,bath,body,wellness,us", country: "United States", integrationType: "custom", leadTime: "3-7 days", notes: "Handmade and artisan soap wholesale." },
  { name: "Bath Bomb Wholesale", website: "https://www.bathbombwholesale.com", category: "wholesale", tags: "bath-bombs,bath,body,wellness,us", country: "United States", integrationType: "custom", leadTime: "3-7 days", notes: "Bath bomb and bath product wholesale." },
  { name: "Incense Wholesale", website: "https://www.incensewholesale.com", category: "wholesale", tags: "incense,home-fragrance,wellness,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Incense and home fragrance wholesale." },

  // === HOME IMPROVEMENT ===
  { name: "Paint Wholesale", website: "https://www.paintwholesale.com", category: "wholesale", tags: "paint,home-improvement,diy,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Paint and painting supplies wholesale." },
  { name: "Flooring Wholesale", website: "https://www.flooringwholesale.com", category: "wholesale", tags: "flooring,tiles,home-improvement,us", country: "United States", integrationType: "custom", leadTime: "5-15 days", notes: "Flooring material wholesale." },
  { name: "Plumbing Wholesale", website: "https://www.plumbingwholesale.com", category: "wholesale", tags: "plumbing,supplies,home-improvement,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Plumbing supplies and fixtures wholesale." },
  { name: "HVAC Wholesale", website: "https://www.hvacwholesale.com", category: "wholesale", tags: "hvac,heating,cooling,home,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "HVAC equipment and supplies wholesale." },
  { name: "Security Wholesale", website: "https://www.securitywholesale.com", category: "wholesale", tags: "security,cameras,alarms,home,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Home security and surveillance wholesale." },
  { name: "Smart Home Wholesale", website: "https://www.smarthomewholesale.com", category: "wholesale", tags: "smart-home,automation,electronics,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Smart home device and automation wholesale." },

  // === BEAUTY TOOLS ===
  { name: "Hair Tool Wholesale", website: "https://www.hairtoolwholesale.com", category: "wholesale", tags: "hair-tools,beauty,styling,us", country: "United States", integrationType: "custom", leadTime: "3-7 days", notes: "Hair styling tool wholesale. Dryers, straighteners, curlers." },
  { name: "Nail Supply Wholesale", website: "https://www.nailsupplywholesale.com", category: "wholesale", tags: "nail,beauty,salon,polish,us", country: "United States", integrationType: "custom", leadTime: "3-7 days", notes: "Nail care and salon supply wholesale." },
  { name: "Makeup Brush Wholesale", website: "https://www.makeupbrushwholesale.com", category: "wholesale", tags: "makeup,brushes,beauty,cosmetics,us", country: "United States", integrationType: "custom", leadTime: "3-7 days", notes: "Makeup brush and tool wholesale." },
  { name: "Skincare Tool Wholesale", website: "https://www.skincaretoolwholesale.com", category: "wholesale", tags: "skincare,tools,beauty,devices,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Skincare device and tool wholesale." },
  { name: "Mirror Wholesale", website: "https://www.mirrorwholesale.com", category: "wholesale", tags: "mirrors,home-decor,beauty,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Mirror wholesale. Lighted, wall, floor mirrors." },

  // === WALL ART & DECOR ===
  { name: "Wall Art Wholesale", website: "https://www.wallartwholesale.com", category: "wholesale", tags: "wall-art,decor,pictures,home,us", country: "United States", integrationType: "custom", leadTime: "5-15 days", notes: "Wall art and print wholesale." },
  { name: "Canvas Print Wholesale", website: "https://www.canvasprintwholesale.com", category: "wholesale", tags: "canvas-prints,wall-art,photography,us", country: "United States", integrationType: "custom", leadTime: "5-15 days", notes: "Canvas print and photo wholesale." },
  { name: "Poster Wholesale", website: "https://www.posterwholesale.com", category: "wholesale", tags: "posters,prints,wall-art,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Poster and art print wholesale." },
  { name: "Frame Wholesale", website: "https://www.framewholesale.com", category: "wholesale", tags: "frames,picture-frames,home-decor,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Picture frame and framing wholesale." },
  { name: "Sculpture Wholesale", website: "https://www.sculpturewholesale.com", category: "wholesale", tags: "sculpture,statues,home-decor,art,us", country: "United States", integrationType: "custom", leadTime: "5-15 days", notes: "Sculpture and statue wholesale." },
  { name: "Vase Wholesale", website: "https://www.vasewholesale.com", category: "wholesale", tags: "vases,home-decor,flowers,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Vase and flower container wholesale." },
  { name: "Clock Wholesale", website: "https://www.clockwholesale.com", category: "wholesale", tags: "clocks,home-decor,wall,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Clock wholesale. Wall, desk, floor clocks." },

  // === OUTDOOR & GARDEN ===
  { name: "Plant Wholesale", website: "https://www.plantwholesale.com", category: "wholesale", tags: "plants,garden,nursery,outdoor,us", country: "United States", integrationType: "custom", leadTime: "5-15 days", notes: "Plant and nursery wholesale." },
  { name: "Flower Wholesale", website: "https://www.flowerwholesale.com", category: "wholesale", tags: "flowers,floral,garden,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Fresh and artificial flower wholesale." },
  { name: "Pottery Wholesale", website: "https://www.potterywholesale.com", category: "wholesale", tags: "pottery,planters,garden,home,us", country: "United States", integrationType: "custom", leadTime: "5-15 days", notes: "Pottery and planter wholesale." },
  { name: "Fountain Wholesale", website: "https://www.fountainwholesale.com", category: "wholesale", tags: "fountains,garden,water,outdoor,us", country: "United States", integrationType: "custom", leadTime: "5-15 days", notes: "Garden fountain and water feature wholesale." },
  { name: "Grill Wholesale", website: "https://www.grillwholesale.com", category: "wholesale", tags: "grills,bbq,outdoor,cooking,us", country: "United States", integrationType: "custom", leadTime: "5-15 days", notes: "BBQ grill and outdoor cooking wholesale." },
  { name: "Patio Wholesale", website: "https://www.patiowholesale.com", category: "wholesale", tags: "patio,furniture,outdoor,us", country: "United States", integrationType: "custom", leadTime: "5-15 days", notes: "Patio furniture and outdoor living wholesale." },

  // === SPORTS ADDITIONAL ===
  { name: "Golf Wholesale", website: "https://www.golfwholesale.com", category: "wholesale", tags: "golf,sports,equipment,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Golf equipment and accessory wholesale." },
  { name: "Tennis Wholesale", website: "https://www.tenniswholesale.com", category: "wholesale", tags: "tennis,sports,racquets,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Tennis equipment wholesale." },
  { name: "Swim Wholesale", website: "https://www.swimwholesale.com", category: "wholesale", tags: "swimming,sports,gear,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Swimming and water sports wholesale." },
  { name: "Ski Wholesale", website: "https://www.skiwholesale.com", category: "wholesale", tags: "ski,snowboard,winter,sports,us", country: "United States", integrationType: "custom", leadTime: "5-15 days", notes: "Ski and snowboard equipment wholesale." },
  { name: "Boxing Wholesale", website: "https://www.boxingwholesale.com", category: "wholesale", tags: "boxing,mma,fighting,sports,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Boxing and MMA equipment wholesale." },
  { name: "Bicycle Wholesale", website: "https://www.bicyclewholesale.com", category: "wholesale", tags: "bicycles,cycling,sports,us", country: "United States", integrationType: "custom", leadTime: "5-15 days", notes: "Bicycle and cycling accessory wholesale." },
  { name: "Scooter Wholesale", website: "https://www.scooterwholesale.com", category: "wholesale", tags: "scooters,electric,personal-transport,us", country: "United States", integrationType: "custom", leadTime: "5-15 days", notes: "Electric scooter and personal transport wholesale." },

  // === MUSIC & ENTERTAINMENT ===
  { name: "Musical Instrument Wholesale", website: "https://www.musicalinstrumentwholesale.com", category: "wholesale", tags: "musical-instruments,music,gear,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Musical instrument and gear wholesale." },
  { name: "Drum Wholesale", website: "https://www.drumwholesale.com", category: "wholesale", tags: "drums,percussion,music,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Drum and percussion wholesale." },
  { name: "Keyboard Wholesale", website: "https://www.keyboardwholesale.com", category: "wholesale", tags: "keyboards,pianos,music,instruments,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Keyboard and piano wholesale." },
  { name: "DJ Equipment Wholesale", website: "https://www.djequipmentwholesale.com", category: "wholesale", tags: "dj,equipment,music,audio,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "DJ equipment and accessory wholesale." },
  { name: "Game Wholesale", website: "https://www.gamewholesale.com", category: "wholesale", tags: "video-games,gaming,entertainment,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Video game and gaming accessory wholesale." },
  { name: "Board Game Wholesale", website: "https://www.boardgamewholesale.com", category: "wholesale", tags: "board-games,games,toys,family,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Board game and puzzle wholesale." },
  { name: "Collectible Wholesale", website: "https://www.collectiblewholesale.com", category: "wholesale", tags: "collectibles,figures,toys,hobby,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Collectible and figurine wholesale." },
  { name: "Card Game Wholesale", website: "https://www.cardgamewholesale.com", category: "wholesale", tags: "card-games,trading-cards,games,us", country: "United States", integrationType: "custom", leadTime: "3-10 days", notes: "Trading card game and accessory wholesale." },
];

async function main() {
  console.log(`Seeding ${supplierList.length} vendors...`);
  let count = 0;
  for (const s of supplierList) {
    try {
      await db.insert(vendors).values({
        name: s.name,
        website: s.website,
        category: s.category,
        tags: s.tags,
        country: s.country,
        integrationType: s.integrationType as any,
        leadTime: s.leadTime,
        notes: s.notes,
        status: "active",
        isGlobal: true,
        verificationStatus: "verified",
        verifiedAt: new Date(),
      });
      count++;
      if (count % 25 === 0) console.log(`  ${count}/${supplierList.length} inserted...`);
    } catch (err: any) {
      console.error(`  Failed to insert ${s.name}:`, err?.message);
    }
  }
  console.log(`Done. ${count} vendors seeded.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

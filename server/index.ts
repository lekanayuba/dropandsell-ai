import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

let appReady = false;
let indexHtmlContent: string | null = null;

// Resolve __dirname in a way that works in both CJS (production build) and ESM (tsx dev runtime).
const moduleDir = (() => {
  try {
    if (typeof __dirname !== "undefined") return __dirname;
  } catch {}
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    return process.cwd();
  }
})();

const candidateIndexPaths = [
  path.resolve(moduleDir, "public", "index.html"),
  path.resolve(process.cwd(), "dist", "public", "index.html"),
];

// Only preload the built index.html in production. In development the Vite dev
// server owns "/" and transforms index.html on the fly; serving a stale built
// copy here would reference hashed asset files that no longer exist.
if (process.env.NODE_ENV === "production") {
  for (const indexPath of candidateIndexPaths) {
    try {
      if (fs.existsSync(indexPath)) {
        indexHtmlContent = fs.readFileSync(indexPath, "utf-8");
        console.log("Loaded index.html from", indexPath);
        break;
      }
    } catch (e) {
      console.log("Could not preload index.html from", indexPath, ":", e);
    }
  }
}

// Assigned once the daily-broadcast module loads at startup. Invoked on every
// inbound request (it self-throttles and is a no-op outside the live deployment).
let triggerDailyBroadcast: (() => void) | null = null;

const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  const url = (req.url || "").split("?")[0];

  if (triggerDailyBroadcast) triggerDailyBroadcast();

  if (url === "/health" || url === "/health/") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("OK");
    return;
  }

  if (url === "/" && (req.method === "GET" || req.method === "HEAD")) {
    if (!appReady) {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Loading...</title><meta http-equiv=\"refresh\" content=\"2\"></head><body><p>Starting up...</p></body></html>");
      return;
    }
    if (indexHtmlContent) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(indexHtmlContent);
      return;
    }
  }

  app(req, res);
});

app.use(cors({
  origin: true,
  credentials: true,
  allowedHeaders: ["Content-Type", "X-API-Key", "X-Unique-URL", "Authorization"],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
}));

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// 25 MB JSON limit — product/variation payloads can include several embedded
// data-URL images (each up to ~2 MB after server-side resize) plus rich
// description HTML. The default 100 KB limit otherwise produces the misleading
// "request entity too large" error when saving products with multiple pictures.
app.use(
  express.json({
    limit: '50mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: '50mb' }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  // Endpoints whose JSON response bodies must NEVER be written to logs
  // because they contain secrets (API keys, OAuth tokens, etc.).
  const sensitiveResponsePaths = [
    "/api/user/extension-credentials",
    "/api/user/api-key",
  ];

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      const isSensitive = sensitiveResponsePaths.some(p => path === p || path.startsWith(p + "?") || path.startsWith(p + "/"));
      if (capturedJsonResponse && !isSensitive) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      } else if (isSensitive && capturedJsonResponse) {
        logLine += ` :: [redacted]`;
      }

      log(logLine);
    }
  });

  next();
});

app.get('/u/:code', (req, res) => {
  res.redirect('/');
});

app.get('/u/:code/{*rest}', (req, res) => {
  const remainingPath = req.originalUrl.replace(/^\/u\/[^/]+/, '') || '/';
  res.redirect(remainingPath);
});

app.use('/u/:code/api', (_req, res) => {
  res.status(400).json({ 
    message: 'API requests should not include the /u/code prefix. Use the base URL (e.g. https://dropandsell.online) as your API URL.',
    error: 'invalid_api_path'
  });
});

const port = parseInt(process.env.PORT || "5000", 10);
httpServer.listen(
  {
    port,
    host: "0.0.0.0",
  },
  () => {
    log(`serving on port ${port}`);

    (async () => {
      try {
        await registerRoutes(httpServer, app);

        // One-shot, idempotent production data fixes. See
        // server/dataPatches.ts for the rules each patch must follow.
        try {
          const { runStartupDataPatches } = await import("./dataPatches.js");
          await runStartupDataPatches();
        } catch (patchErr: any) {
          console.error("[startup] data patches failed (non-fatal):", patchErr?.message || patchErr);
        }

        // Daily listing-resolved broadcast campaign (auto-stops after one month).
        // Triggered from the top-level HTTP handler with an atomic per-day DB
        // claim so it sends at most once per day across all autoscale instances.
        // Only the live deployment touches the table or sends mail.
        try {
          const { ensureBroadcastCampaignTable, maybeRunDailyBroadcast } = await import("./dailyBroadcast.js");
          if (process.env.REPLIT_DEPLOYMENT === "1") {
            await ensureBroadcastCampaignTable();
          }
          triggerDailyBroadcast = maybeRunDailyBroadcast;
        } catch (broadcastErr: any) {
          console.error("[startup] daily broadcast setup failed (non-fatal):", broadcastErr?.message || broadcastErr);
        }

        app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
          const rawMessage = err?.message || "Internal Server Error";

          // Detect transient infrastructure errors from the managed Postgres
          // control plane (Neon/Replit). When the control plane is briefly
          // unreachable, every DB query throws "Control plane request failed".
          // Returning 503 with a friendly message lets the client retry and
          // tells users it's a temporary service blip — not their credentials.
          const isTransientDb =
            /control plane request failed/i.test(rawMessage) ||
            /Connection terminated unexpectedly/i.test(rawMessage) ||
            err?.code === 'ECONNRESET' ||
            err?.code === 'ETIMEDOUT';

          const status = isTransientDb
            ? 503
            : (err.status || err.statusCode || 500);
          const message = isTransientDb
            ? "Our database is having a brief hiccup. Please try again in a few seconds."
            : rawMessage;

          if (isTransientDb) {
            console.warn(`[transient-db-error] ${rawMessage}`);
          } else {
            console.error("Internal Server Error:", err);
          }

          if (res.headersSent) {
            return next(err);
          }

          return res.status(status).json({ message });
        });

        app.use('/api/{*path}', (_req: Request, res: Response) => {
          res.status(404).json({ message: 'Not found' });
        });

        if (process.env.NODE_ENV === "production") {
          serveStatic(app);
        } else {
          const { setupVite } = await import("./vite");
          await setupVite(httpServer, app);
        }

        appReady = true;
        log(`application fully initialized`);

        try {
          const { seedAdminUser } = await import("./seedAdmin");
          await seedAdminUser();
        } catch (err: any) {
          console.error("[seed-admin] startup hook failed:", err?.message || err);
        }

        try {
          const { storage } = await import("./storage");
          const pendingPaidEmails = ['Kafilatyakub2000@yahoo.co.uk', 'tina_ogbomo@yahoo.com', 'teejay23113@gmail.com', 'Mercya75@hotmail.com'];
          for (const email of pendingPaidEmails) {
            const user = await storage.getUserByEmail(email);
            if (user && user.subscriptionStatus === 'pending' && user.stripeCustomerId) {
              const updates: any = { subscriptionStatus: 'active' };
              if (user.subscriptionPlan !== 'Starter Plan') {
                updates.subscriptionPlan = 'Starter Plan';
              }
              await storage.updateUser(user.id, updates);
              console.log(`[Startup-Fix] Activated subscription for ${email} on ${updates.subscriptionPlan || user.subscriptionPlan}`);
            }
          }

          const planCorrections: Record<string, string> = {
            'otreoglobal@gmail.com': 'Basic Plan',
          };
          for (const [corrEmail, correctPlan] of Object.entries(planCorrections)) {
            const corrUser = await storage.getUserByEmail(corrEmail);
            if (corrUser && corrUser.subscriptionPlan !== correctPlan) {
              await storage.updateUser(corrUser.id, {
                subscriptionPlan: correctPlan,
                subscriptionStatus: 'active',
              });
              const { db } = await import("./db");
              const { subscriptions } = await import("@shared/schema");
              const { eq } = await import("drizzle-orm");
              const [existingSub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, corrUser.id));
              if (existingSub) {
                await db.update(subscriptions).set({ planName: correctPlan, status: 'active', currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }).where(eq(subscriptions.userId, corrUser.id));
              } else {
                await db.insert(subscriptions).values({ userId: corrUser.id, planName: correctPlan, status: 'active', currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) });
              }
              console.log(`[Startup-Fix] Corrected plan for ${corrEmail} to ${correctPlan}`);
            }
          }

          {
            const { db: fixDb } = await import("./db");
            const { subscriptions: fixSubs } = await import("@shared/schema");
            const ormFix = await import("drizzle-orm");
            const nullPeriodSubs = await fixDb.select().from(fixSubs).where(ormFix.isNull(fixSubs.currentPeriodEnd));
            if (nullPeriodSubs.length > 0) {
              const defaultEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
              for (const sub of nullPeriodSubs) {
                await fixDb.update(fixSubs).set({ currentPeriodEnd: defaultEnd }).where(ormFix.eq(fixSubs.id, sub.id));
              }
              console.log(`[Startup-Fix] Set renewal date for ${nullPeriodSubs.length} subscription(s) with missing dates`);
            }
          }

          const defaultFlags = [
            { featureKey: 'jumia_marketplace', name: 'Jumia Marketplace', description: 'Jumia marketplace integration — connect stores, sync orders, and publish products across 12 African countries.', isEnabled: true, adminOnly: true },
            { featureKey: 'drop_and_sell', name: 'DROSEL Auto-Listing', description: 'Let verified expert listers research and list winning products directly on your eBay store. 120 products per set with a 7-day delivery guarantee.', isEnabled: true, adminOnly: true },
          ];
          for (const flagDef of defaultFlags) {
            const existing = await storage.getFeatureFlag(flagDef.featureKey);
            if (!existing) {
              await storage.createFeatureFlag(flagDef);
              console.log(`[Startup] Seeded feature flag: ${flagDef.featureKey}`);
            }
          }

          // One-shot subscription cancellation: Gloria Uwadi (goguanyia@gmail.com)
          // Idempotent — only runs while the account is still 'active'. Sets the
          // subscription to "cancelled" with no auto-renewal, and emails her a
          // confirmation. Subsequent boots find the status already cancelled and skip.
          try {
            const cancelEmail = 'goguanyia@gmail.com';
            const cancelUser = await storage.getUserByEmail(cancelEmail);
            if (cancelUser && cancelUser.subscriptionStatus === 'active') {
              const planLabel = cancelUser.subscriptionPlan || 'Starter Plan';
              await storage.updateUser(cancelUser.id, {
                subscriptionStatus: 'cancelled',
              });
              const { db: cdb } = await import('./db');
              const { subscriptions: cSubs } = await import('@shared/schema');
              const cOrm = await import('drizzle-orm');
              const [existingCSub] = await cdb.select().from(cSubs).where(cOrm.eq(cSubs.userId, cancelUser.id));
              // Access ends on 3 May 2026 (end of day UTC) — no renewal afterwards.
              const endDate = new Date('2026-05-03T23:59:59Z');
              if (existingCSub) {
                await cdb.update(cSubs)
                  .set({ status: 'cancelled', currentPeriodEnd: endDate })
                  .where(cOrm.eq(cSubs.userId, cancelUser.id));
              } else {
                await cdb.insert(cSubs).values({
                  userId: cancelUser.id,
                  planName: planLabel,
                  status: 'cancelled',
                  currentPeriodEnd: endDate,
                });
              }
              const { sendSubscriptionCancellationEmail } = await import('./email');
              const userDisplayName = (cancelUser.firstName || '').trim() || undefined;
              await sendSubscriptionCancellationEmail(cancelEmail, userDisplayName, planLabel, endDate);
              console.log(`[Startup-Fix] Cancelled subscription for ${cancelEmail} (plan=${planLabel}, endDate=${endDate?.toISOString() ?? 'n/a'}) and sent confirmation email.`);
            }
          } catch (cancelErr: any) {
            console.error('[Startup-Fix] Failed to cancel Gloria Uwadi subscription:', cancelErr?.message || cancelErr);
          }

          // One-shot reminder email to all users who haven't picked a plan yet.
          // Uses an audit_logs marker per user so each address is emailed at most once.
          try {
            const { db: rdb } = await import('./db');
            const { users: rUsers, auditLogs: rAuditLogs } = await import('@shared/schema');
            const rOrm = await import('drizzle-orm');
            const REMINDER_ACTION = 'no_plan_reminder_sent_v2';

            // Find every user without an active subscription plan.
            const noPlanUsers = await rdb.select({
              id: rUsers.id,
              email: rUsers.email,
              firstName: rUsers.firstName,
            }).from(rUsers).where(
              rOrm.and(
                rOrm.or(
                  rOrm.isNull(rUsers.subscriptionStatus),
                  rOrm.eq(rUsers.subscriptionStatus, ''),
                  rOrm.eq(rUsers.subscriptionStatus, 'no plan'),
                  rOrm.eq(rUsers.subscriptionStatus, 'none'),
                ),
                rOrm.isNotNull(rUsers.email),
                rOrm.ne(rUsers.email, ''),
              )
            );

            if (noPlanUsers.length > 0) {
              const { sendNoPlanReminderEmail } = await import('./email');
              let sent = 0;
              let skipped = 0;
              let failed = 0;

              for (const u of noPlanUsers) {
                try {
                  // Skip if we've already sent the reminder to this user.
                  const [already] = await rdb.select({ id: rAuditLogs.id })
                    .from(rAuditLogs)
                    .where(rOrm.and(
                      rOrm.eq(rAuditLogs.userId, u.id),
                      rOrm.eq(rAuditLogs.action, REMINDER_ACTION),
                    ))
                    .limit(1);
                  if (already) {
                    skipped++;
                    continue;
                  }

                  const displayName = (u.firstName || '').trim() || undefined;
                  const ok = await sendNoPlanReminderEmail(u.email!, displayName);
                  if (ok) {
                    await rdb.insert(rAuditLogs).values({
                      userId: u.id,
                      action: REMINDER_ACTION,
                      source: 'system',
                      details: { email: u.email },
                    });
                    sent++;
                    // Brief pause to stay well under Resend rate limits.
                    await new Promise((r) => setTimeout(r, 250));
                  } else {
                    failed++;
                  }
                } catch (perUserErr: any) {
                  failed++;
                  console.error(`[Startup] No-plan reminder failed for ${u.email}:`, perUserErr?.message || perUserErr);
                }
              }
              console.log(`[Startup] No-plan reminder pass: ${sent} sent, ${skipped} already-sent (skipped), ${failed} failed, ${noPlanUsers.length} candidates total.`);
            } else {
              console.log('[Startup] No-plan reminder: no eligible users found.');
            }
          } catch (reminderErr: any) {
            console.error('[Startup] No-plan reminder pass failed:', reminderErr?.message || reminderErr);
          }

          // Free-access grants — give complimentary Enterprise plan to specific users
          const freeAccessEmails = ['bigafott@gmail.com'];
          for (const grantEmail of freeAccessEmails) {
            try {
              const grantUser = await storage.getUserByEmail(grantEmail);
              if (grantUser && grantUser.subscriptionPlan !== 'enterprise') {
                await storage.updateUser(grantUser.id, {
                  subscriptionPlan: 'enterprise',
                  subscriptionStatus: 'active',
                });
                console.log(`[Startup] Granted free Enterprise access to ${grantEmail}`);
              }
            } catch (err: any) {
              console.error(`[Startup] Failed to grant free access to ${grantEmail}:`, err.message);
            }
          }

          // Auto-seed Global VeRO list if empty
          const { db } = await import("./db");
          const { globalVeroList } = await import("@shared/schema");
          const { eq, and, sql: sqlFn } = await import("drizzle-orm");
          const veroBlockBrands = [
            // Luxury fashion — extreme enforcement
            'Louis Vuitton','Gucci','Chanel','Prada','Hermès','Hermes','Burberry','Dior','Versace','Balenciaga',
            'Givenchy','Fendi','Valentino','Saint Laurent','Bottega Veneta','Cartier','Tiffany','Rolex','Omega',
            'TAG Heuer','Patek Philippe','Breitling','Alexander McQueen','Jimmy Choo','Christian Louboutin',
            'Montblanc','Bvlgari','Supreme','Off-White','Stone Island','Moncler','Salvatore Ferragamo',
            'Ferragamo','Celine','Loewe','Loro Piana','Brunello Cucinelli','Rimowa','Hublot','IWC',
            'Audemars Piguet','David Yurman','Chopard','Van Cleef & Arpels','Graff',
            'Chanel No. 5','Gucci Eyewear','Prada Eyewear','Dolce & Gabbana','Dolce Gabbana',
            'Mulberry','MCM','Furla','Longchamp',
            // Tech — active VeRO reporters (HGR blocks these)
            'Apple','Bose','Beats by Dre','Sony','Microsoft','Nintendo','Dyson',
            'GoPro','DJI','iRobot','Roomba','Arduino','Intuit',
            // Sportswear — strict enforcement
            'Nike','Adidas','Under Armour','Lululemon','Abercrombie & Fitch',
            // Entertainment/media — extreme enforcement (Disney owns Marvel, Lucasfilm, etc.)
            'Disney','Marvel','Warner Bros','Lucasfilm','Star Wars','DC Comics',
            'LEGO','Hasbro','Mattel','Funko','Good Smile Company',
            // Automotive — active enforcers
            'Ferrari','Porsche','Harley-Davidson','John Deere','General Motors',
            'Jaguar','Land Rover','Delorean','Bombardier',
            // Cosmetics/personal care — active VeRO reporters
            'MAC Cosmetics','Charlotte Tilbury','Dermalogica','Dollar Shave Club',
            'Amway','It Works','Forever Living',
            // eBay official VeRO participants (from eBay's published list — actively file claims)
            'Alessi','All Saints','American Eagle Outfitters','Axon','Taser',
            'Benchmade','Bloomberg','Brother International','Buck Knives',
            'Canon','Car-Freshner','Chandler Tool','Chloé','Coway',
            'Dansko','Garmin','Gerber Childrenswear','Gibson','Gretsch',
            'GUNNAR Optiks','iFixit','Incipio','Jabra','GN Netcom',
            'Jemella','GHD','ghd','Juul','Kirby','Moon Boot','Technica',
            'TechSmith','Telebrands','The Richemont Group',
            'Tiffany & Co','Tommy Hilfiger','Tommie Copper',
            'Nordstrom',
            // Official VeRO participants — additional confirmed active enforcers
            'Ralph Lauren','Levi Strauss',"Levi's",'Levis','Coach','Kate Spade',
            'Michael Kors','Calvin Klein','Oakley','Ray-Ban',
            'Estée Lauder','Estee Lauder','Clinique','Lancôme','Lancome',
            'Pandora','Swarovski','Vivienne Westwood',
            'Canada Goose','Patagonia','The North Face','Columbia',
            'Crocs','UGG','Birkenstock','Dr. Martens','Converse',
            'Samsung','Philips','Canon','Nikon','JBL','Fitbit',
            'Hugo Boss','Armani','Giorgio Armani','Lacoste',
            'Tom Ford','Jo Malone','Creed',
            'BMW','Mercedes-Benz','Audi','Volkswagen','Toyota','Ford',
            'Rolex Watches','Omega Watches',
            'Fred Perry','Paul Smith','Ted Baker','Superdry',
            'FIFA','NFL','NBA','Premier League','UEFA',
            'Bosch','DeWalt','Makita','3M','Caterpillar','Snap-on','Snap On',
            'OtterBox','Vans',
            'Yves Saint Laurent','YSL','Jean Paul Gaultier','Marc Jacobs',
            'Paco Rabanne','Issey Miyake','Thierry Mugler',
            'Yankee Candle','Le Creuset','KitchenAid','Weber','Yeti',
            'Red Bull','Monster Energy','Coca-Cola',
            'PlayStation','Xbox',
            'Osprey','Samsonite','Tumi',
            'Peloton','Callaway','TaylorMade','Titleist','Speedo',
            'Shimano','Specialized','Trek',
            'NARS','Benefit Cosmetics',"Kiehl's",'La Mer','Urban Decay',
            'Fenty Beauty','Bobbi Brown','Clarins','Shiseido','SK-II',
            'Drunk Elephant','Sunday Riley','Tatcha',
            'Royal Canin','Johnson & Johnson',
            'Ring','Nest','Sonos','Bang & Olufsen',
            'Velcro','Onesie',
          ];

          const veroWarnBrands = [
            'Puma','New Balance','Reebok','Barbour',
            'Jack Wolfskin','Berghaus',"Arc'teryx",'Arcteryx','Napapijri','Timberland','Skechers',
            'ASICS','Jordan','Air Jordan','Clarks','ECCO',
            'Stanley','Cuisinart',
            'Bosch Auto','Brembo','Denso','Thule','Halfords',
            'GoPro Hero','Garmin Watch',
            'Zara','H&M','ASOS','Hollister','Gap','Wrangler','True Religion','G-Star Raw','Diesel','Guess',
            'Just for Men','Just For Men','Gillette','Braun','Olay','Pantene','Head & Shoulders','Oral-B',
            'Crest','Dove','TRESemmé','TRESemme','Neutrogena','Aveeno','Nivea','Vaseline','CeraVe',
            'The Ordinary','La Roche-Posay','Vichy','Bioderma','Garnier','Maybelline','Revlon','NYX',
            'Rimmel','Max Factor','Bare Minerals','bareMinerals','Morphe',
            'Wahl','Philips Norelco','Schwarzkopf','Redken','Kérastase','Kerastase','Aussie',
            'Herbal Essences','Colgate','Sensodyne',
            'BaByliss','Davidoff','Calvin Klein CK','Acqua di Gio','Sauvage',
            'Penhaligons','Byredo','Diptyque',
            'Intel','AMD','NVIDIA','Google','Dell','HP','Lenovo','Asus','Acer','LG','Panasonic',
            'Toshiba','Huawei','OnePlus','Xiaomi',
            'Marshall','Sennheiser','Audio-Technica','Logitech','Razer','SteelSeries','Corsair',
            'Amazon Echo','Alexa','Roku','Epson','Brother','SanDisk',
            'Western Digital','Seagate','Kingston',
            'Casio','Seiko','Citizen','Tissot','Longines','Tudor','Daniel Wellington','Fossil','G-Shock',
            'Theragun','Bowflex','Ping','Spalding','Wilson','Yonex','HEAD',
            'Breville','Kenwood','Nutribullet','NutriBullet','Vitamix','Shark','Ninja',
            'Instant Pot','Nespresso',"De'Longhi",'DeLonghi','Sage','Smeg','Dualit',
            'Russell Hobbs','Tefal','Morphy Richards','Miele','Karcher','Kärcher','Hoover','Vax','BISSELL',
            'Bayer','Pfizer','GSK','GlaxoSmithKline','Durex','Cadbury','Nestlé','Nestle',
            'Pepsi','Jack Daniels','Guinness','Johnnie Walker',
            'Steam','Epic Games','Roblox',
            'Links of London','Thomas Sabo','Persol',
            'Tom Ford Eyewear','Maui Jim','Hills',
            'Montblanc Pen','Parker Pen','Cross Pen',
          ];

          const veroKeywords: string[] = [];

          const veroWarnKeywords = [
            'replica','knockoff','knock off','fake','counterfeit','imitation',
            '1:1 copy','mirror copy','not original','unauthorized',
            'bootleg','pirated','super copy',
            'inspired by','style of','like authentic','designer inspired','AAA quality',
            'dupes','dupe','OEM copy','grade A copy','unbranded alternative',
          ];

          const existingItems = await db.select({ value: globalVeroList.value, type: globalVeroList.type, severity: globalVeroList.severity }).from(globalVeroList);
          const existingSet = new Set(existingItems.map(e => `${e.type}::${e.value}`));
          const existingMap = new Map(existingItems.map(e => [`${e.type}::${e.value}`, e.severity]));
          let added = 0;
          let upgraded = 0;

          const blockBrandSet = new Set(veroBlockBrands.map(b => b));
          for (const brand of veroBlockBrands) {
            const key = `brand::${brand}`;
            if (existingSet.has(key)) {
              if (existingMap.get(key) !== 'block') {
                await db.update(globalVeroList).set({ severity: 'block', reason: 'VeRO protected brand — actively enforced' }).where(
                  and(eq(globalVeroList.type, 'brand'), eq(globalVeroList.value, brand))
                );
                upgraded++;
              }
            } else {
              await db.insert(globalVeroList).values({
                type: 'brand', value: brand, reason: 'VeRO protected brand — actively enforced',
                category: 'brand_protection', severity: 'block', isActive: true,
              });
              added++;
            }
          }

          for (const brand of veroWarnBrands) {
            const key = `brand::${brand}`;
            if (existingSet.has(key)) {
              if (!blockBrandSet.has(brand) && existingMap.get(key) === 'block') {
                await db.update(globalVeroList).set({ severity: 'warn' }).where(
                  and(eq(globalVeroList.type, 'brand'), eq(globalVeroList.value, brand))
                );
              }
            } else {
              await db.insert(globalVeroList).values({
                type: 'brand', value: brand, reason: 'Brand advisory — listing allowed with caution',
                category: 'brand_protection', severity: 'warn', isActive: true,
              });
              added++;
            }
          }

          for (const kw of veroWarnKeywords) {
            const key = `keyword::${kw}`;
            if (existingSet.has(key)) {
              if (existingMap.get(key) === 'block') {
                await db.update(globalVeroList).set({ severity: 'warn', reason: 'Counterfeit indicator — listing allowed' }).where(
                  and(eq(globalVeroList.type, 'keyword'), eq(globalVeroList.value, kw))
                );
                upgraded++;
              }
            } else {
              await db.insert(globalVeroList).values({
                type: 'keyword', value: kw, reason: 'Counterfeit indicator — listing allowed',
                category: 'counterfeit_prevention', severity: 'warn', isActive: true,
              });
              added++;
            }
          }

          const [finalCount] = await db.select({ count: sqlFn<number>`count(*)` }).from(globalVeroList);
          if (added > 0 || upgraded > 0) {
            console.log(`[Startup] VeRO list updated: ${added} added, ${upgraded} upgraded to block. Total: ${finalCount.count}`);
          } else {
            console.log(`[Startup] Global VeRO list is up to date (${finalCount.count} entries)`);
          }
        } catch (fixErr) {
          console.error('[Startup-Fix] Error:', fixErr);
        }
      } catch (err) {
        console.error("Failed to initialize application:", err);
        process.exit(1);
      }
    })();
  },
);

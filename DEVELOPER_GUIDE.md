# DropandSell Automation App — Developer Technical Guide

## 1. Project Overview

DropandSell Automation App is a multi-tenant SaaS dropshipping platform with end-to-end automated fulfilment. It enables sellers to connect multiple marketplace stores (eBay, Shopify, Amazon, TikTok Shop, Jumia), manage product inventory from diverse vendors, automate pricing and fulfilment, and handle payments via an integrated wallet and referral system.

**Live URL:** https://dropandsell.online

---

## 2. Tech Stack

| Layer       | Technology                                              |
|-------------|--------------------------------------------------------|
| Frontend    | React 18, TypeScript, Vite                             |
| Routing     | Wouter                                                 |
| State       | TanStack React Query v5                                |
| UI          | shadcn/ui (Radix UI primitives), Tailwind CSS          |
| Forms       | React Hook Form + Zod validation                       |
| Charts      | Recharts                                               |
| Icons       | Lucide React, React Icons                              |
| Backend     | Express.js 5, TypeScript                               |
| ORM         | Drizzle ORM                                            |
| Database    | PostgreSQL                                             |
| Auth        | Replit Auth (OpenID Connect / Passport.js)             |
| Payments    | Stripe (subscriptions, Connect payouts)                |
| Email       | Resend                                                 |
| AI          | OpenAI (product descriptions, chatbot)                 |
| i18n        | Custom system (39 languages, RTL support)              |
| Dev Server  | tsx (TypeScript execution), Vite dev server            |

---

## 3. Project Structure

```
├── client/                       # Frontend (React + Vite)
│   └── src/
│       ├── pages/                # Page components (34 pages)
│       │   ├── Dashboard.tsx
│       │   ├── Orders.tsx
│       │   ├── Stores.tsx
│       │   ├── Inventory.tsx
│       │   ├── Fulfillment.tsx
│       │   ├── Vendors.tsx
│       │   ├── Analytics.tsx
│       │   ├── Automation.tsx
│       │   ├── DropAndSell.tsx
│       │   ├── Wallet.tsx
│       │   ├── Referrals.tsx
│       │   ├── Subscription.tsx
│       │   ├── Addons.tsx
│       │   ├── Profile.tsx
│       │   ├── Settings.tsx
│       │   ├── AdminSubscribers.tsx   # Admin panel
│       │   ├── AdminGlobalVero.tsx    # VeRO management
│       │   ├── Login.tsx
│       │   ├── Onboarding.tsx
│       │   └── ...
│       ├── components/
│       │   ├── ui/               # shadcn/ui components
│       │   ├── Sidebar.tsx       # Main navigation sidebar
│       │   ├── LanguageSwitcher.tsx
│       │   ├── SupportChat.tsx
│       │   ├── StatsCard.tsx
│       │   └── StoreFilterDropdown.tsx
│       ├── hooks/                # Custom React hooks
│       │   ├── use-auth.ts
│       │   ├── use-orders.ts
│       │   ├── use-products.ts
│       │   ├── use-stores.ts
│       │   ├── use-wallet.ts
│       │   ├── use-feature-flags.ts
│       │   ├── use-store-filter.ts
│       │   └── ...
│       ├── i18n/                 # Internationalisation
│       │   ├── translations.ts   # All 39 language translations
│       │   └── LanguageContext.tsx
│       ├── lib/
│       │   ├── queryClient.ts    # TanStack Query setup
│       │   ├── currency.ts       # Currency formatting
│       │   ├── export-excel.ts   # Excel export utilities
│       │   └── utils.ts          # Tailwind cn() helper
│       ├── data/
│       │   └── vendor-directory.ts  # 1,218 global vendors
│       ├── App.tsx               # Root component + routes
│       └── main.tsx              # Entry point
│
├── server/                       # Backend (Express)
│   ├── index.ts                  # Server entry point
│   ├── routes.ts                 # All API routes (~9,100 lines)
│   ├── storage.ts                # Database operations (IStorage interface)
│   ├── db.ts                     # PostgreSQL connection pool
│   ├── email.ts                  # Email templates & sending (Resend)
│   ├── stripeClient.ts           # Stripe integration
│   ├── vite.ts                   # Vite dev server integration
│   ├── static.ts                 # Static file serving (production)
│   ├── webhookHandlers.ts        # Stripe webhook handlers
│   ├── trendingScheduler.ts      # Trending products auto-refresh
│   ├── trendingData.ts           # Trending products dataset
│   ├── priceComparisonData.ts    # Price comparison data
│   ├── marketplaces/
│   │   └── ebay.ts               # eBay API integration
│   └── replit_integrations/      # Replit-managed integrations
│       ├── auth/                 # Replit Auth setup
│       ├── image/                # OpenAI image client
│       └── audio/                # OpenAI audio client
│
├── shared/                       # Shared between frontend & backend
│   ├── schema.ts                 # Drizzle schema + Zod types
│   └── routes.ts                 # (if exists) API route contracts
│
├── package.json
├── tsconfig.json
├── vite.config.ts
├── drizzle.config.ts
├── tailwind.config.ts
└── replit.md                     # Project documentation
```

---

## 4. Database Schema

PostgreSQL with 33 tables. Key tables:

| Table                    | Purpose                                          |
|--------------------------|--------------------------------------------------|
| `users`                  | User accounts, subscription info, referral codes |
| `stores`                 | Connected marketplace stores (eBay, Shopify, etc.) |
| `products`               | Product inventory                                |
| `orders`                 | Marketplace orders                               |
| `sku_mappings`           | SKU-to-vendor product mappings                   |
| `fulfillment_jobs`       | Automated fulfilment job tracking                |
| `pricing_rules`          | Per-store pricing rules                          |
| `marketplace_listings`   | Published marketplace listings                   |
| `publish_queue`          | Staging area for batch publishing                |
| `wallet`                 | User wallet balances                             |
| `transactions`           | Wallet transaction history                       |
| `referrals`              | Referral tracking and commissions                |
| `subscriptions`          | Stripe subscription records                      |
| `addon_purchases`        | Premium add-on purchases                         |
| `feature_flags`          | Admin feature flag controls                      |
| `trending_products`      | Trending products database                       |
| `global_vero_list`       | VeRO-restricted brands (453 entries)             |
| `vero_brand_aliases`     | Brand alias mappings for VeRO matching           |
| `vero_audit_log`         | VeRO validation audit trail                      |
| `freelancer_profiles`    | Drop & Sell freelancer listing agents             |
| `drop_and_sell_orders`   | Drop & Sell service orders                       |
| `suggestions`            | User feature suggestions                         |
| `conversations` / `messages` | Support chat                                 |
| `sessions`               | Express session store                            |

All data is multi-tenant — isolated via `userId` foreign keys.

Schema is defined in `shared/schema.ts` using Drizzle ORM. Each model has:
- Drizzle table definition
- Insert schema (via `createInsertSchema` from `drizzle-zod`)
- Insert type (`z.infer<typeof insertSchema>`)
- Select type (`typeof table.$inferSelect`)

---

## 5. Environment Variables

### Required Secrets

| Variable               | Purpose                                      |
|------------------------|----------------------------------------------|
| `DATABASE_URL`         | PostgreSQL connection string                 |
| `SESSION_SECRET`       | Express session encryption key               |
| `RESEND_API_KEY`       | Email sending via Resend                     |
| `SHOPIFY_API_KEY`      | Shopify OAuth app key                        |
| `SHOPIFY_API_SECRET`   | Shopify OAuth app secret                     |
| `AMAZON_CLIENT_ID`     | Amazon SP-API client ID                      |
| `AMAZON_CLIENT_SECRET` | Amazon SP-API client secret                  |
| `TIKTOK_APP_KEY`       | TikTok Shop API app key                      |
| `TIKTOK_APP_SECRET`    | TikTok Shop API app secret                   |

### eBay-specific (stored per-user in `stores` table credentials)

| Variable                 | Purpose                                    |
|--------------------------|--------------------------------------------|
| `EBAY_APP_ID`            | eBay application ID                        |
| `EBAY_CERT_ID`           | eBay certificate ID                        |
| `EBAY_DEV_ID`            | eBay developer ID                          |
| `EBAY_RUNAME`            | eBay redirect URL name                     |
| `EBAY_VERIFICATION_TOKEN`| eBay webhook verification                  |

### Auto-configured (Replit platform)

| Variable                          | Purpose                            |
|-----------------------------------|------------------------------------|
| `REPL_ID`                         | Replit app identifier              |
| `ISSUER_URL`                      | OIDC issuer URL                    |
| `AI_INTEGRATIONS_OPENAI_API_KEY`  | OpenAI API key (Replit-managed)    |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | OpenAI base URL (Replit-managed)   |

---

## 6. Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL database
- npm

### Installation

```bash
# Install dependencies
npm install

# Push database schema
npm run db:push

# Start development server (Express + Vite)
npm run dev
```

The dev server runs on port 5000 and serves both the API and the frontend.

### NPM Scripts

| Script       | Command                                | Purpose                     |
|-------------|----------------------------------------|-----------------------------|
| `dev`       | `NODE_ENV=development tsx server/index.ts` | Start dev server          |
| `build`     | `tsx script/build.ts`                  | Production build            |
| `start`     | `NODE_ENV=production node dist/index.cjs` | Start production server  |
| `check`     | `tsc`                                  | TypeScript type checking    |
| `db:push`   | `drizzle-kit push`                     | Push schema changes to DB   |

---

## 7. Architecture & Key Patterns

### Frontend Architecture

- **Routing**: Wouter — routes defined in `client/src/App.tsx`
- **Data Fetching**: TanStack Query v5 with a default fetcher configured in `queryClient.ts`. Queries use `queryKey: ['/api/endpoint']` and do NOT need a custom `queryFn`.
- **Mutations**: Use `apiRequest` from `@lib/queryClient` for POST/PATCH/DELETE requests. Always invalidate cache via `queryClient.invalidateQueries({ queryKey })` after mutations.
- **Auth**: `useAuth()` hook from `use-auth.ts` — provides `user`, `isLoading`, `isAuthenticated`.
- **Feature Flags**: `useFeatureAccess(flagKey)` hook returns `{ hasAccess }` based on user role and flag state.

### Backend Architecture

- **Storage Abstraction**: All database operations go through the `IStorage` interface in `server/storage.ts`. Routes never access the database directly.
- **Routes**: All API endpoints defined in `server/routes.ts`. Protected routes use `protectedApi` which enforces authentication.
- **Admin Check**: `user?.isAdmin === 'true' || user?.email === 'dropandsellauth@gmail.com'`
- **Email**: Dynamic imports used throughout routes: `const { sendXxxEmail } = await import('./email.js')`
- **Feature Flags**: Controlled via `feature_flags` table. `adminOnly: true` restricts to admin-only access. `requireDropAndSellAccess` middleware enforces access control.

### Multi-Tenancy

All data queries are filtered by `userId`. The `userId` comes from the authenticated session (`req.user.claims.sub`).

### Store Limits by Plan

| Plan          | Monthly Price | Store Limit |
|---------------|--------------|-------------|
| Free/No plan  | £0           | 2           |
| Starter       | £12          | 2           |
| Basic         | £20          | 4           |
| Growth        | £35          | 6           |
| Professional  | £50          | 8           |
| Business      | £75          | 12          |
| Enterprise    | £100         | 15          |

All users receive +1 bonus store (service disruption compensation). Legacy users (created before 10 April 2026) receive an additional +1 bonus.

---

## 8. Key Features & Their Locations

### Marketplace Integrations
- OAuth connection flows: `server/routes.ts` (search for `/connect/ebay`, `/connect/shopify`, etc.)
- Callback handlers: `client/src/pages/EbayCallback.tsx`, `ShopifyCallback.tsx`, `AmazonCallback.tsx`, `TikTokCallback.tsx`
- eBay API client: `server/marketplaces/ebay.ts`

### Automated Fulfilment
- Fulfilment jobs, SKU mappings, tracking sync: `server/routes.ts` (search for `/fulfillment`)
- Frontend: `client/src/pages/Fulfillment.tsx`

### Drop & Sell Listing Service
- Backend routes: `server/routes.ts` (search for `/drop-and-sell`)
- Frontend: `client/src/pages/DropAndSell.tsx`
- Freelancer auto-assignment, delivery approval/rejection, dynamic pricing

### Subscription & Payments
- Stripe integration: `server/stripeClient.ts`, `server/webhookHandlers.ts`
- Subscription page: `client/src/pages/Subscription.tsx`

### Referral System
- Referral tracking, commission, wallet withdrawals via Stripe Connect
- Frontend: `client/src/pages/Referrals.tsx`, `client/src/pages/Wallet.tsx`

### VeRO Compliance
- Brand-level VeRO checking with alias support
- Admin management: `client/src/pages/AdminGlobalVero.tsx`
- 453 pre-loaded restricted brands

### Internationalisation (i18n)
- 39 languages with English fallback
- RTL support for Arabic, Hebrew, Urdu, Farsi
- Translations: `client/src/i18n/translations.ts`
- Context: `client/src/i18n/LanguageContext.tsx`
- Language stored in `localStorage` key `"dropandsell_lang"`

### Admin Panel
- `client/src/pages/AdminSubscribers.tsx` — user management, analytics, revenue, feature flags, email broadcasts
- Feature flags control feature rollout (admin-only testing → publish to all users)

---

## 9. Styling & Theming

- **Brand Colour**: `#285261` (HSL: 195, 42%, 27%)
- **Typography**: Inter (body/buttons/forms) + Plus Jakarta Sans (headings)
- **Sidebar**: Dark navy sidebar, 260px width. Main content offset: `lg:ml-[260px]`
- **Theme**: CSS custom properties in `client/src/index.css`. Dark mode supported via `.dark` class.
- **Logo**: `attached_assets/Drop_1.jpg_1775119096004.jpeg` (imported as `@assets/Drop_1.jpg_1775119096004.jpeg`)
- **Component Library**: shadcn/ui — components in `client/src/components/ui/`

---

## 10. API Overview

All API routes are prefixed with `/api`. Protected routes require authentication.

### Core Endpoints (Partial List)

| Method | Endpoint                          | Purpose                        |
|--------|-----------------------------------|--------------------------------|
| GET    | `/api/auth/user`                  | Get authenticated user         |
| GET    | `/api/stores`                     | List user's connected stores   |
| GET    | `/api/products`                   | List user's products           |
| GET    | `/api/orders`                     | List user's orders             |
| GET    | `/api/dashboard/stats`            | Dashboard statistics           |
| GET    | `/api/feature-flags`              | List feature flags             |
| GET    | `/api/vendors`                    | List user's vendors            |
| GET    | `/api/wallet`                     | Get wallet balance             |
| GET    | `/api/referrals`                  | Get referral stats             |
| POST   | `/api/products`                   | Create product                 |
| POST   | `/api/orders/:id/track`           | Update order tracking          |
| POST   | `/api/subscription/checkout`      | Create Stripe checkout         |
| POST   | `/api/drop-and-sell/orders`       | Create DAS order               |
| POST   | `/api/admin/send-banner-apology`  | Send broadcast email           |
| PUT    | `/api/feature-flags/:key`         | Toggle feature flag            |

For the complete list, refer to `server/routes.ts`.

---

## 11. Testing & Deployment

### Type Checking
```bash
npm run check
```

### Building for Production
```bash
npm run build
npm start
```

### Database Migrations
```bash
npm run db:push
```
This uses Drizzle Kit to push schema changes from `shared/schema.ts` to the database.

### Deployment
The app is deployed on Replit. The production build outputs to `dist/` and runs via `node dist/index.cjs`.

---

## 12. Important Notes for Developers

1. **Never modify ID column types** — Changing `serial` to `varchar` or vice versa will break existing data.
2. **Keep `server/routes.ts` organised** — It's a large file (~9,100 lines). Use search to find specific sections.
3. **Storage interface** — Always add new DB operations to `IStorage` in `server/storage.ts` first, then implement in `DatabaseStorage`.
4. **Schema first** — Define data models in `shared/schema.ts` before writing routes or UI.
5. **Email templates** — All in `server/email.ts`. Use the established pattern with `getUncachableResendClient()`.
6. **Admin access** — Checked via `user?.isAdmin === 'true' || user?.email === 'dropandsellauth@gmail.com'`.
7. **Feature flags** — Use `feature_flags` table with `adminOnly` for staged rollout.
8. **Vite config** — Do NOT modify `server/vite.ts` or `vite.config.ts` unless absolutely necessary.
9. **TanStack Query v5** — Only object form: `useQuery({ queryKey: ['key'] })`, not `useQuery(['key'])`.
10. **Import paths** — Use `@/` for client imports, `@shared/` for shared, `@assets/` for assets.

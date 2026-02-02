# DropFlow - Dropshipping Automation SaaS Platform

## Overview

DropFlow is a multi-tenant SaaS platform for automating dropshipping operations across multiple e-commerce marketplaces. The platform enables sellers to connect marketplace stores, manage product inventory from multiple vendors, track orders, and handle payments through an integrated wallet system. Built with a modern full-stack architecture using React, Express, and PostgreSQL.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state caching and synchronization
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens and CSS variables for theming
- **Form Handling**: React Hook Form with Zod validation via @hookform/resolvers
- **Build Tool**: Vite with path aliases (@/, @shared/, @assets/)

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Design**: RESTful API with typed route contracts defined in shared/routes.ts
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Validation**: Zod schemas generated from Drizzle schemas via drizzle-zod
- **Session Management**: express-session with PostgreSQL session store (connect-pg-simple)
- **Authentication**: Replit Auth integration using OpenID Connect (OIDC) with Passport.js

### Data Layer
- **Database**: PostgreSQL (required via DATABASE_URL environment variable)
- **Schema Location**: shared/schema.ts contains all table definitions
- **Migrations**: Drizzle Kit for schema migrations (drizzle-kit push)
- **Multi-tenancy**: User isolation via userId foreign keys on all business entities

### Key Design Patterns
1. **Shared Type Safety**: API contracts, schemas, and types are defined in the shared/ directory and imported by both client and server
2. **Protected Routes**: Client-side route protection via useAuth hook; server-side via isAuthenticated middleware
3. **Storage Abstraction**: IStorage interface in server/storage.ts abstracts database operations
4. **Typed API Contracts**: Route definitions in shared/routes.ts define method, path, request/response schemas

### Project Structure
```
├── client/src/          # React frontend
│   ├── components/      # UI components (shadcn/ui)
│   ├── hooks/           # Custom React hooks (auth, data fetching)
│   ├── pages/           # Route page components
│   └── lib/             # Utilities (queryClient, auth-utils)
├── server/              # Express backend
│   ├── replit_integrations/auth/  # Replit Auth implementation
│   ├── routes.ts        # API route handlers
│   └── storage.ts       # Database abstraction layer
├── shared/              # Shared code between client/server
│   ├── schema.ts        # Drizzle database schema
│   ├── routes.ts        # API contract definitions
│   └── models/auth.ts   # Auth-related schemas
└── migrations/          # Drizzle migration files
```

## External Dependencies

### Database
- **PostgreSQL**: Primary database, connection via DATABASE_URL environment variable
- **Drizzle ORM**: Type-safe database queries and schema management

### Authentication
- **Replit Auth**: OpenID Connect authentication via Replit's identity provider
- **Session Storage**: PostgreSQL-backed sessions via connect-pg-simple
- Required environment variables: ISSUER_URL, SESSION_SECRET, REPL_ID

### Payment Processing
- **Stripe**: Payment processing integration via Replit's connector system
- Supports both development and production environments
- Subscription plans for tiered service offerings (Starter through Enterprise)
- Required: Stripe connector configured in Replit environment

### Runtime Environment
- **Node.js**: ES modules (type: "module" in package.json)
- **TypeScript**: Strict mode enabled, bundler module resolution
- **Build Process**: Custom build script using esbuild for server, Vite for client

## Automation Engine

### Pricing Rules
- Three pricing types: markup_percent, margin_percent, fixed_amount
- Rules can target specific vendors or apply globally (vendorId = null)
- Priority-based application: higher priority rules take precedence
- Optional min/max price constraints to prevent under/over-pricing
- Calculation: costPrice × (1 + markup%) or costPrice / (1 - margin%) or costPrice + fixed

### CSV Import
- Upload vendor product catalogs with automatic field detection
- Field mapping UI allows matching CSV columns to database fields
- Preview before import shows first 5 rows
- Batch processing with error tracking per row
- Creates products linked to selected vendor with import job tracking

### Publish Queue
- Staging area for products before marketplace publishing
- Add products individually or bulk from Inventory page
- Automatic pricing rule application based on vendor and priority
- Batch publish to connected marketplace stores
- Simulates marketplace API calls (Shopify, eBay, Amazon) - production-ready structure

### Security Model
- All automation data (pricing rules, import jobs, publish queue) filtered by userId
- Storage layer enforces ownership on all CRUD operations
- Single-record getters accept optional userId for secure access
- Routes pass authenticated user ID to all storage operations
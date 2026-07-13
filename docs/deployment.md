# Deployment and setup

This project should be deployed in two separate steps: prepare the database, then start the web process.

## Required environment

- `DATABASE_URL`: PostgreSQL connection string.
- `SESSION_SECRET`: long random string. Keep this stable in production or existing users will be logged out.
- `APP_URL`: public app URL used in email links.

Optional integrations:

- `ISSUER_URL` and `REPL_ID`: only needed for the Replit OIDC `/api/login` flow.
- `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY`: needed for paid subscriptions.
- `RESEND_API_KEY`: needed for verification and notification email delivery.
- `OPENAI_API_KEY`: needed for AI support and pricing features.
- Marketplace keys such as `EBAY_*`, `AMAZON_*`, `SHOPIFY_*`, `JUMIA_*`, and `WOOCOMMERCE_*`: needed only for those platform sync features.

## Fresh setup

1. Install dependencies with `npm ci`.
2. Provision PostgreSQL and set `DATABASE_URL`.
3. Set `SESSION_SECRET` before starting the app.
4. Create the schema with `npm run db:setup`.
5. Start the app with `npm run dev` locally, or deploy with the configured Replit build/run commands.
6. Register the owner account in the app.
7. Promote that account with `ADMIN_EMAIL=owner@example.com npm run admin:promote`.

The startup compatibility checks in `server/db.ts` only add a small set of missing columns for older deployments. They do not replace `npm run db:setup` on a fresh database.

## Existing production database

Before changing a live database:

1. Take a database backup.
2. Run `npm run db:setup` against staging first.
3. Run `npm run verify`.
4. Deploy the application build.
5. Confirm login, admin dashboard access, store listing, inventory listing, and order pages before broad rollout.

## Admin access

There are no hardcoded admin credentials. Admin access requires an existing user with `role = 'admin'`.

Recommended flow:

1. Register an owner account through the normal app login page.
2. Run `ADMIN_EMAIL=owner@example.com npm run admin:promote` with database access.
3. Log in at `/admin/login` using that account email and password.

## Useful commands

- `npm run verify`: typecheck, tests, and lint errors.
- `npm run build`: production client/server build.
- `npm run db:setup`: apply the Drizzle schema to the configured database.
- `npm run admin:promote`: promote an existing user to admin.

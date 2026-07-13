# Stock automation foundation

This implements the backend foundation for BRD Requirement 1 and prepares Requirement 4.

## Data model

- `product_vendor_sources`: enabled vendor sources for a product, including vendor SKU, source URL, priority, primary flag, stock quantity, stock status, and last sync metadata.
- `product_stock_rules`: product-level OOS and restock settings, including OOS threshold, OOS automation enablement, optional pinned vendor source, restock threshold, and restock quantity.
- `stock_sync_events`: audit log for vendor stock updates, listing OOS/restored decisions, and future restock actions.

The old `products.quantity` flow remains the fallback. If no vendor sources exist, stock sync behaves as before.

## Effective stock logic

1. If a stock rule pins a vendor source, evaluate only that enabled source.
2. Otherwise, sum enabled vendor sources for the product.
3. If sources exist but have never synced and are still `unknown`, fall back to `products.quantity`.
4. If no sources exist, fall back to `products.quantity`.
5. OOS automation only marks listings out of stock when `oosAutomationEnabled` is true.
6. Restock evaluation is calculated, but no real vendor purchase is placed yet.

## API endpoints

- `GET /api/products/:id/stock-sources`
- `POST /api/products/:id/stock-sources`
- `PUT /api/products/:id/stock-sources/:sourceId`
- `GET /api/products/:id/stock-rule`
- `PUT /api/products/:id/stock-rule`
- `GET /api/products/:id/stock-evaluation`
- `GET /api/products/:id/stock-events`

Creating or updating a source/rule recalculates effective stock and triggers the existing store sync path for that product.

## Rollout notes

- Run `npm run db:setup` before deploying this to a fresh or staging database.
- On production, take a DB backup first and verify against staging.
- The first frontend follow-up should add a unified product stock settings table for OOS threshold, OOS automation, restock threshold, restock automation, and restock quantity.
- Real auto-restock still needs vendor purchase/reorder integrations and spend-cap controls before it should place orders.

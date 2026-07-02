// Single source of truth for subscription plan pricing.
// Shared between the API routes and the recurring referral-commission engine.

export const YEARLY_DISCOUNT = 0.10;

export const SUBSCRIPTION_PLANS = [
  { id: 'starter', name: 'Starter Plan', listings: 500, priceGbp: 12, storeLimit: 2 },
  { id: 'basic', name: 'Basic Plan', listings: 750, priceGbp: 20, storeLimit: 4 },
  { id: 'growth', name: 'Growth Plan', listings: 1200, priceGbp: 35, storeLimit: 6 },
  { id: 'professional', name: 'Professional Plan', listings: 2000, priceGbp: 50, storeLimit: 8 },
  { id: 'business', name: 'Business Plan', listings: 4000, priceGbp: 75, storeLimit: 12 },
  { id: 'enterprise', name: 'Enterprise Plan', listings: 8000, priceGbp: 100, storeLimit: 15 },
];

export function getYearlyPrice(monthlyPrice: number): number {
  return Math.round(monthlyPrice * 12 * (1 - YEARLY_DISCOUNT) * 100) / 100;
}

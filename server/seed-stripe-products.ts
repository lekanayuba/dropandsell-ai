import { getUncachableStripeClient } from './stripeClient';

const SUBSCRIPTION_PLANS = [
  { name: 'Starter Plan', listings: 500, price: 1200, currency: 'gbp' },   // £12
  { name: 'Basic Plan', listings: 750, price: 2000, currency: 'gbp' },     // £20
  { name: 'Growth Plan', listings: 1200, price: 3500, currency: 'gbp' },   // £35
  { name: 'Professional Plan', listings: 2000, price: 5000, currency: 'gbp' }, // £50
  { name: 'Business Plan', listings: 4000, price: 7500, currency: 'gbp' }, // £75
  { name: 'Enterprise Plan', listings: 8000, price: 10000, currency: 'gbp' }, // £100
];

export async function seedStripeProducts() {
  try {
    const stripe = await getUncachableStripeClient();
    
    console.log('Creating subscription plans in Stripe...');
    
    for (const plan of SUBSCRIPTION_PLANS) {
      // Check if product already exists
      const existingProducts = await stripe.products.search({
        query: `name:'${plan.name}'`,
      });
      
      if (existingProducts.data.length > 0) {
        console.log(`Plan "${plan.name}" already exists, skipping...`);
        continue;
      }
      
      // Create product
      const product = await stripe.products.create({
        name: plan.name,
        description: `Up to ${plan.listings.toLocaleString()} item listings per month`,
        metadata: {
          listings_limit: plan.listings.toString(),
          plan_type: 'subscription',
        },
      });
      
      // Create monthly price
      const monthlyPrice = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.price,
        currency: plan.currency,
        recurring: { interval: 'month' },
        metadata: {
          listings_limit: plan.listings.toString(),
        },
      });
      
      console.log(`Created: ${plan.name} - £${plan.price / 100}/month (${plan.listings} listings)`);
      console.log(`  Product ID: ${product.id}`);
      console.log(`  Price ID: ${monthlyPrice.id}`);
    }
    
    console.log('Subscription plans created successfully!');
  } catch (error) {
    console.error('Error creating subscription plans:', error);
    throw error;
  }
}

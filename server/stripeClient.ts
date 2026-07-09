import Stripe from 'stripe';

let connectionSettings: any;

async function getCredentials() {
  // Determine which environment to use based on deployment status
  const isProduction = process.env.REPLIT_DEPLOYMENT === '1';
  const targetEnvironment = isProduction ? 'production' : 'development';

  // Production fallback: live keys from deployment secrets, used when the
  // connector has no production connection configured (or the connector
  // lookup itself fails). Deliberately production-only so development can
  // never silently pick up live keys.
  const envFallback = (isProduction && process.env.STRIPE_SECRET_KEY)
    ? {
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
        secretKey: process.env.STRIPE_SECRET_KEY,
      }
    : null;

  try {
    const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
    const xReplitToken = process.env.REPL_IDENTITY
      ? 'repl ' + process.env.REPL_IDENTITY
      : process.env.WEB_REPL_RENEWAL
        ? 'depl ' + process.env.WEB_REPL_RENEWAL
        : null;

    if (!xReplitToken) {
      // Fallback for when we might not have the REPL_IDENTITY (e.g. some dev scenarios), 
      // though in Replit environment it should be there.
      // Throwing error as per blueprint guidance
      throw new Error('X_REPLIT_TOKEN not found for repl/depl');
    }

    // Use stripe connector for all environments
    const connectorName = 'stripe';

    const url = new URL(`https://${hostname}/api/v2/connection`);
    url.searchParams.set('include_secrets', 'true');
    url.searchParams.set('connector_names', connectorName);
    url.searchParams.set('environment', targetEnvironment);

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    });

    const data = await response.json();

    connectionSettings = data.items?.[0];

    if (!connectionSettings || (!connectionSettings.settings.publishable || !connectionSettings.settings.secret)) {
      if (envFallback) return envFallback;
      // If connection isn't set up yet, we might want to fail gracefully or warn
      console.warn(`Stripe ${targetEnvironment} connection not found or incomplete`);
      return null;
    }

    return {
      publishableKey: connectionSettings.settings.publishable,
      secretKey: connectionSettings.settings.secret,
    };
  } catch (err) {
    if (envFallback) return envFallback;
    throw err;
  }
}

// WARNING: Never cache this client.
// Always call this function again to get a fresh client.
export async function getUncachableStripeClient() {
  const credentials = await getCredentials();
  
  if (!credentials) {
    throw new Error("Stripe credentials not available");
  }

  return new Stripe(credentials.secretKey, {
    apiVersion: '2025-08-27.basil',
  });
}

// Webhook signature verification requires ONLY the signing secret — never the
// Stripe API credentials. Keep this independent of the Stripe connection so
// webhook delivery keeps working (and Stripe never auto-disables the endpoint)
// even if the connection is removed or temporarily unavailable.
const webhookVerifier = new Stripe('sk_webhook_signature_verification_only');

export function constructVerifiedWebhookEvent(rawBody: string | Buffer, signature: string, webhookSecret: string) {
  return webhookVerifier.webhooks.constructEvent(rawBody, signature, webhookSecret);
}

// Use getStripePublishableKey() for client-side operations
export async function getStripePublishableKey() {
  const credentials = await getCredentials();
  return credentials?.publishableKey || null;
}

// Use getStripeSecretKey() for server-side operations requiring the secret key
export async function getStripeSecretKey() {
  const credentials = await getCredentials();
  return credentials?.secretKey || null;
}

// StripeSync singleton for webhook processing and data sync
let stripeSync: any = null;

export async function getStripeSync() {
  if (!stripeSync) {
    // Only import if we have credentials
    const secretKey = await getStripeSecretKey();
    if (!secretKey) return null;

    const { StripeSync } = await import('stripe-replit-sync');
    
    stripeSync = new StripeSync({
      poolConfig: {
        connectionString: process.env.DATABASE_URL!,
        max: 2,
      },
      stripeSecretKey: secretKey,
    });
  }
  return stripeSync;
}

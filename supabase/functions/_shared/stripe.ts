import Stripe from 'npm:stripe@17.7.0';

// Single Stripe client for all billing functions. Uses the Fetch HTTP client,
// which is required in Deno / edge runtimes. STRIPE_SECRET_KEY is a function
// secret — never EXPO_PUBLIC_. Set with:
//   npx supabase secrets set STRIPE_SECRET_KEY=sk_...
export function getStripe(): Stripe {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  return new Stripe(key, {
    httpClient: Stripe.createFetchHttpClient(),
  });
}

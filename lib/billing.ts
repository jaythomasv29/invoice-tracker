import * as WebBrowser from 'expo-web-browser';
import type { SupabaseClient } from '@supabase/supabase-js';

// Opens Stripe Checkout for the current org's Pro subscription in the system
// browser. Fulfillment happens server-side via the stripe-webhook function
// (which flips the org's plan flag) — this call just gets the user to the
// hosted checkout page. After it resolves (browser closed), the caller should
// reload the Clerk org and re-check `isPro`.
export async function startProCheckout(supabase: SupabaseClient, email?: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('create-checkout', {
    body: { email },
  });
  if (error) throw new Error(await readFnError(error, 'Could not start checkout'));
  if (!data?.url) throw new Error(data?.error ?? 'No checkout URL returned');
  await WebBrowser.openBrowserAsync(data.url);
}

// Opens the Stripe billing portal (manage payment method / cancel) for the
// current org's existing subscription.
export async function openBillingPortal(supabase: SupabaseClient): Promise<void> {
  const { data, error } = await supabase.functions.invoke('billing-portal', {
    body: {},
  });
  if (error) throw new Error(await readFnError(error, 'Could not open billing portal'));
  if (!data?.url) throw new Error(data?.error ?? 'No portal URL returned');
  await WebBrowser.openBrowserAsync(data.url);
}

// supabase.functions error messages are just "non-2xx status code" — the real
// message our function threw is in the response body on error.context.
async function readFnError(error: unknown, fallback: string): Promise<string> {
  const context = (error as { context?: Response }).context;
  try {
    const raw = await context?.text();
    const parsed = raw ? JSON.parse(raw) : undefined;
    if (parsed?.error) return parsed.error;
  } catch {
    // not JSON — fall through
  }
  return (error as { message?: string })?.message ?? fallback;
}

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Plan } from './entitlements';
export async function syncSubscription(client: SupabaseClient): Promise<Plan> {
  const { data, error } = await client.functions.invoke('sync-subscription', { body: {} });
  if (error || !data?.plan) throw new Error('Your purchase is safe. Verification is delayed; retry Restore purchases shortly.');
  return data.plan as Plan;
}

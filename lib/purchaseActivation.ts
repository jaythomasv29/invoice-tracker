import type { Plan } from './entitlements.ts';

// A successful StoreKit purchase is final even when our access sync is delayed.
// Never throw a sync/network failure back into the purchase-failed handler.
export async function confirmPurchaseActivation(options: {
  expected: Plan;
  sync: () => Promise<Plan>;
  reload: () => Promise<unknown>;
  current: () => boolean;
  delay?: (ms: number) => Promise<void>;
  attempts?: number;
}): Promise<'active' | 'pending' | 'cancelled'> {
  const delay = options.delay ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  for (let attempt = 0; attempt < (options.attempts ?? 4); attempt++) {
    if (!options.current()) return 'cancelled';
    try {
      const plan = await options.sync();
      if (!options.current()) return 'cancelled';
      if (plan === options.expected) {
        await options.reload();
        return options.current() ? 'active' : 'cancelled';
      }
    } catch { /* The transaction succeeded; access confirmation can be retried. */ }
    if (attempt + 1 < (options.attempts ?? 4)) await delay(1500);
  }
  return options.current() ? 'pending' : 'cancelled';
}

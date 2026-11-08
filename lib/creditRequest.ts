import { assertSavedRecordIds } from './recordIdentity';
// Credit requests for shorted deliveries: turns the lines marked missing on an
// invoice into a ready-to-send message for the vendor's rep, and records
// where each credit stands (requested → credited) so the Home worklist only
// shows money that's still outstanding.
import type { SupabaseClient } from '@supabase/supabase-js';
import { Share } from 'react-native';

export type CreditStatus = 'requested' | 'credited';

import { buildCreditRequestMessage, type CreditRequestInput } from './creditRequestMessage';
export { buildCreditRequestMessage, creditTotal, type CreditLine, type CreditRequestInput } from './creditRequestMessage';

/** Opens the share sheet. Resolves true when the user sent/shared it. */
export async function shareCreditRequest(input: CreditRequestInput): Promise<boolean> {
  const result = await Share.share({
    title: `Credit request — ${input.vendorName}`,
    message: buildCreditRequestMessage(input),
  });
  return result.action === Share.sharedAction;
}

export async function setCreditStatus(
  supabase: SupabaseClient,
  lineItemIds: string[],
  status: CreditStatus | null,
): Promise<void> {
  if (lineItemIds.length === 0) return;
  assertSavedRecordIds(...lineItemIds);
  const { error } = await supabase
    .from('invoice_line_items')
    .update({ credit_status: status, credit_status_at: status ? new Date().toISOString() : null })
    .in('id', lineItemIds);
  if (error) throw new Error('Could not update the credit status. Please retry.');
}

/** Marks a saved line missing (or received again) after the fact. */
export async function setLineMissing(supabase: SupabaseClient, lineItemId: string, missing: boolean): Promise<void> {
  assertSavedRecordIds(lineItemId);
  const { error } = await supabase
    .from('invoice_line_items')
    .update(missing
      ? { reconciliation_status: 'missing' }
      : { reconciliation_status: 'received', credit_status: null, credit_status_at: null })
    .eq('id', lineItemId);
  if (error) throw new Error('Could not update the item. Please retry.');
}

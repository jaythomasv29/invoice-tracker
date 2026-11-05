import { Alert } from 'react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
export const AI_CONSENT_VERSION = '2026-11-01';
export async function ensureAiConsent(client: SupabaseClient): Promise<boolean> {
  const { data, error } = await client.from('ai_consents').select('version,withdrawn_at').maybeSingle();
  if (error) throw new Error('Could not check AI permission. Please try again.');
  if (data?.version === AI_CONSENT_VERSION && !data.withdrawn_at) return true;
  const accepted = await new Promise<boolean>((resolve) => Alert.alert(
    'Allow Anthropic AI processing?',
    'Sift sends your receipt/invoice photos and their contents, or your dish name and optional dish photo, to Anthropic (Claude) to extract purchase details or draft recipe ingredients. Receipt and invoice photos may contain names, addresses and account numbers. Review AI results before relying on them. You can withdraw permission in Profile at any time; saved records stay available.',
    [{ text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
     { text: 'Allow AI processing', onPress: () => resolve(true) }],
    { cancelable: false },
  ));
  if (!accepted) return false;
  const { error: saveError } = await client.rpc('set_ai_consent', { p_accept: true });
  if (saveError) throw new Error('Could not save AI permission. Please try again.');
  return true;
}
export async function withdrawAiConsent(client: SupabaseClient): Promise<void> {
  const { error } = await client.rpc('set_ai_consent', { p_accept: false });
  if (error) throw new Error('Could not withdraw permission. Please try again.');
}

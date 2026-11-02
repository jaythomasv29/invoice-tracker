import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
export const CONSENT_VERSION = '2026-11-01';
export function adminClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
}
export async function requireAiConsent(client: SupabaseClient): Promise<void> {
  if (Deno.env.get('AI_PROCESSING_ENABLED') === 'false') throw new Error('AI processing is temporarily unavailable. Your saved records are still available.');
  const { data, error } = await client.from('ai_consents').select('version,withdrawn_at').single();
  if (error || data?.version !== CONSENT_VERSION || data.withdrawn_at) throw new Error('Please allow Anthropic AI processing in Profile before continuing.');
}
export async function beginAiJob(org: string, resource: string, kind: 'invoice' | 'recipe', cap: number) {
  const { data, error } = await adminClient().rpc('begin_ai_job', { p_org: org, p_resource: resource, p_kind: kind, p_cap: cap });
  if (error) throw new Error('Could not reserve AI processing. Please try again.');
  return data as { allowed: boolean; code?: string; id?: string; used?: number };
}
export async function finishAiJob(id: string | undefined, success: boolean) {
  if (!id) return;
  const { error } = await adminClient().rpc('finish_ai_job', { p_id: id, p_success: success });
  if (error) console.error('AI job finalization failed', id); // no invoice payloads
}
export async function readImage(client: SupabaseClient, bucket: string, path: string) {
  const { data, error } = await client.storage.from(bucket).download(path);
  if (error || !data) throw new Error('Could not read image. Please upload it again.');
  if (data.size > 8 * 1024 * 1024) throw new Error('Each image must be smaller than 8 MB.');
  const mediaType = data.type || 'image/jpeg';
  if (!['image/jpeg','image/png','image/webp','image/gif'].includes(mediaType)) throw new Error('Unsupported image format.');
  const bytes = new Uint8Array(await data.arrayBuffer());
  let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
  return { data: btoa(binary), mediaType, bytes };
}

export async function setAiJobPhase(id: string | undefined, phase: 'checking' | 'reading' | 'saving') {
  if (!id) return;
  const { error } = await adminClient().from('ai_jobs').update({ phase }).eq('id',id).eq('status','running');
  if (error) console.error('AI progress update delayed');
}

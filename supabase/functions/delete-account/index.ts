import { createClient } from 'npm:@supabase/supabase-js@2';
import { requestDeletion, runDeletion } from '../_shared/accountDeletion.ts';
import { corsHeaders } from '../_shared/cors.ts';
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const auth = req.headers.get('Authorization');
  if (!auth) return Response.json({ error: 'Please sign in again.' }, { status: 401, headers: corsHeaders });
  const client = createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{ global: { headers: { Authorization: auth } } });
  const { data, error } = await client.rpc('current_identity');
  if (error || !data?.user_id) return Response.json({ error: 'Please sign in again.' }, { status: 401, headers: corsHeaders });
  try {
    await runDeletion(await requestDeletion(data.user_id));
    return Response.json({ deleted: true }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 409, headers: corsHeaders });
  }
});

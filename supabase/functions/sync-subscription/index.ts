import { getVerifiedOrgId } from '../_shared/clerkAuth.ts';
import { syncBilling } from '../_shared/billingSync.ts';
import { corsHeaders } from '../_shared/cors.ts';
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const orgId = await getVerifiedOrgId(req.headers.get('Authorization'));
  if (!orgId) return Response.json({ error: 'Please sign in to your restaurant.' }, { status: 401, headers: corsHeaders });
  try { return Response.json({ plan: await syncBilling(orgId) }, { headers: corsHeaders }); }
  catch { return Response.json({ error: 'Your purchase is safe. Subscription verification is delayed. Please retry Restore purchases.' }, { status: 503, headers: corsHeaders }); }
});

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { detectPriceCreep } from '../_shared/priceAlerts.ts';
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS')
    return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')
    return new Response('Method not allowed', { status: 405 });
  try {
    const auth = req.headers.get('Authorization');
    if (!auth) return new Response('Unauthorized', { status: 401 });
    const db = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: {
          headers: {
            Authorization: auth,
            'x-sift-workspace': req.headers.get('x-sift-workspace') ?? '',
          },
        },
      },
    );
    const { invoiceId } = await req.json();
    const { data: invoice, error } = await db
      .from('invoices')
      .select('id,organization_id,vendor_id,status')
      .eq('id', invoiceId)
      .single();
    if (
      error ||
      !invoice ||
      !invoice.organization_id.startsWith('pws_') ||
      invoice.status !== 'saved'
    )
      return new Response('Saved receipt not found', { status: 404 });
    const { data: lines, error: lineError } = await db
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', invoiceId)
      .is('voided_at', null);
    if (lineError) throw lineError;
    await detectPriceCreep(
      db,
      invoice.organization_id,
      invoice.vendor_id,
      invoice.id,
      lines ?? [],
    );
    return Response.json({ refreshed: true }, { headers: corsHeaders });
  } catch {
    return Response.json(
      { error: 'Could not refresh receipt insights.' },
      { status: 503, headers: corsHeaders },
    );
  }
});

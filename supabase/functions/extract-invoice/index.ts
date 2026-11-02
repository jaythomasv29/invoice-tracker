import { compareInvoiceIdentity } from '../_shared/invoiceIdentity.ts';
import { getOrganization } from '../_shared/clerkAuth.ts';
// Invoice extraction pipeline — PRD section 6.3 / 9.
//
// Flow: the client uploads invoice photo(s) to Supabase Storage, creates a
// draft `invoices` row (status: 'pending', image_urls populated), then
// invokes this function with that invoice's id. This function downloads the
// images, extracts structured data via Claude Sonnet 5, resolves/creates the
// vendor, writes the line items, and flips the invoice to status: 'scanned'
// so the client can load it into the review screen. Low-confidence fields
// are flagged (not re-extracted with a bigger model) — the 2-tap confirm
// flow in the review screen is the resolution path for those.
//
// Not yet built (left as a clean follow-up, not silently skipped): the
// cross-vendor item-normalization/fuzzy-matching layer (PRD 6.3) that would
// resolve `invoice_line_items.item_id` against the canonical `items` catalog.
// Line items are written with `item_id: null` for now.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { adminClient, beginAiJob, finishAiJob, readImage, requireAiConsent, setAiJobPhase } from '../_shared/aiControls.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
// Server-side secret (never EXPO_PUBLIC_) used to read the org's plan flag off
// Clerk. Set with: npx supabase secrets set CLERK_SECRET_KEY=sk_...

const MODEL_SONNET = 'claude-sonnet-5';
// Cheap vision model used only for the duplicate-fingerprint pre-check (a few
// header fields, small max_tokens) — never for the real line-item extraction.
// Keep the model-id convention in sync with MODEL_SONNET above.
const MODEL_HAIKU = 'claude-haiku-4-5-20251001';

// Monthly invoice cap per tier. Every tier is capped now (Pro is not unlimited).
// Keep in sync with PLAN_INVOICE_CAPS in lib/entitlements.ts (RN bundle).
type Plan = 'free' | 'plus' | 'pro';
const PLAN_INVOICE_CAPS: Record<Plan, number> = { free: 10, plus: 300, pro: 150 };

// Reads the org's plan from Clerk publicMetadata. Authoritative (can't be
// spoofed by the client) and always fresh. Fails safe to 'free' if the secret
// isn't configured or the lookup fails — extraction still works up to the free
// cap, it just won't recognize a paid tier until CLERK_SECRET_KEY is set.
async function getOrgPlan(orgId: string): Promise<Plan> {
  const org = await getOrganization(orgId);
  const plan = org?.public_metadata?.plan;
  return plan === 'pro' ? 'pro' : plan === 'plus' ? 'plus' : 'free';
}

// Matches VENDOR_FALLBACK_PALETTE in lib/invoicePipeline.ts (the client's
// fallback for vendor rows that predate this) — kept in sync by hand since
// one runs on Deno and the other in the RN bundle.
const VENDOR_COLOR_PALETTE = ['#5DB075', '#5B7FD4', '#E09030', '#4AABB8', '#E07A30', '#9B7FD4'];

function normalizeVendorName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,'"()&]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Strict schema for the extraction tool call — see PRD 6.3 for the field list.
const EXTRACTION_TOOL = {
  name: 'record_invoice_extraction',
  description: 'Record structured data extracted from a restaurant distributor invoice image.',
  input_schema: {
    type: 'object',
    properties: {
      vendor: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          contact_name: { type: 'string' },
          contact_phone: { type: 'string' },
          account_number: { type: 'string' },
        },
        required: ['name'],
      },
      invoice_number: { type: 'string' },
      invoice_date: { type: 'string', description: 'ISO 8601 date, e.g. 2026-07-14' },
      subtotal: { type: 'number' },
      tax: { type: 'number' },
      total: { type: 'number' },
      line_items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            description: { type: 'string', description: 'Raw item description exactly as printed' },
            clean_name: {
              type: 'string',
              description: 'Short, human-readable product name with item codes, mark codes, return-policy notes, and redundant bilingual text stripped — see prompt for the sanitization rules',
            },
            quantity: { type: 'number' },
            unit_of_measure: { type: 'string', description: 'Exactly as printed: CS, LB, EA, BX, OZ, etc.' },
            unit_price: { type: 'number' },
            extended_price: { type: 'number' },
            line_item_type: { type: 'string', enum: ['charge', 'credit'] },
            category: { type: 'string', description: 'protein | produce | dairy | dry_goods | seafood | other' },
            confidence: { type: 'number', description: '0-1 confidence for this line item as a whole' },
            low_confidence_fields: { type: 'array', items: { type: 'string' } },
          },
          required: ['description', 'clean_name', 'quantity', 'unit_of_measure', 'unit_price', 'extended_price', 'line_item_type', 'confidence'],
        },
      },
    },
    required: ['vendor', 'line_items'],
  },
};

const EXTRACTION_PROMPT = `You are extracting structured data from a photo of a restaurant food-distributor invoice (Sysco, US Foods, PFG, or a local produce/meat/seafood vendor).

Read every line item exactly as printed — never guess or estimate a number that isn't visibly on the page. If a field is smudged, handwritten, or ambiguous, still provide your best reading but flag it in low_confidence_fields and lower the confidence score for that field's scope.

Tag each line item's type as "credit" (a return, damaged-case credit, or short-shipment credit memo) vs "charge" (everything else) — this distinction matters downstream and must not be guessed if the invoice doesn't make it clear from context (returns/credits are usually marked with a minus sign, "CR", "RETURN", or listed in a separate credits section).

Distributor-printed descriptions (especially from smaller produce/meat/seafood vendors) are often cluttered with item/SKU codes, mark codes, bracketed handling or return-policy notes, and redundant bilingual text. Alongside the verbatim description, produce clean_name: a short, human-readable product name for display and cross-invoice price comparison. Strip:
- Item/SKU/lot codes and alternate-code lists (e.g. "#40", "'14088 or 14080 or 14085 or 14074")
- Mark codes and handling tags in angle or square brackets (e.g. <PDTO>, <TAIL ON>, <IQF>, <Fragile, Don't Crush>)
- Bracketed return/policy notes, in any language (e.g. "【Return on the spot only. 仅限即场退货】")
- A duplicate translation of the same word in another language once the English (or one clear language) name is kept
- Vendor/brand names that aren't part of the product identity (e.g. "Mt.Sanderson", "FONG KEE", "GUM QUAI") unless no other identifying text exists
Keep whatever actually distinguishes the product — species/cut, grade or size (e.g. "16/20", "Medium", "Extra Firm"), and pack format only if not already captured by quantity/unit_of_measure. Use Title Case, no trailing punctuation, no code fragments. Never invent a product — clean_name must describe exactly what the raw description says, just with the noise removed. If a description is already short and clean, clean_name can match it almost verbatim.

Examples from a real invoice:
- "Breast Mt.Sanderson·#40·鸡胸肉·'14088 or 14080 or 14085 or 14074<Wayne Sanderson or Sanderson>" → "Chicken Breast"
- "PDT-ON·Good Old·16/20(Asia)·#10·有尾虾仁<PDTO>,<Label>,<TAIL ON><IQF>India or Indonesia" → "Shrimp, Tail-On (16/20)"
- "Firm Tofu·FONG KEE·60PC·方记散装硬豆腐<MarkCode/Label>【Return on the spot only.仅限即场退货】" → "Firm Tofu"
- "PC-Mexico Basil·#1·墨西哥九层塔【Return on the spot only.仅限即场退货】·<MarkCode/Label>" → "Mexico Basil"

Call record_invoice_extraction with the complete result.`;

interface ExtractionResult {
  vendor: { name: string; contact_name?: string; contact_phone?: string; account_number?: string };
  invoice_number?: string;
  invoice_date?: string;
  subtotal?: number;
  tax?: number;
  total?: number;
  line_items: Array<{
    description: string;
    clean_name: string;
    quantity: number;
    unit_of_measure: string;
    unit_price: number;
    extended_price: number;
    line_item_type: 'charge' | 'credit';
    category?: string;
    confidence: number;
    low_confidence_fields?: string[];
  }>;
}

// `path` is a storage object path (e.g. "org_xxx/invoice-id/0.jpg") in the
// private invoice-images bucket, not a directly-fetchable URL — sign it
// first through the caller's own RLS-scoped client, then fetch that.
//
// Also returns a SHA-256 hash of the raw image bytes (hex) for the exact-image
// dedup layer. Deno's runtime ships Web Crypto (`crypto.subtle`), so this costs
// no dependency and no client-side work — and it must stay server-side so the
// client can't spoof or skip it.
async function storagePathToBase64(
  supabase: any,
  path: string
): Promise<{ data: string; mediaType: string; hash: string }> {
  const { data, mediaType, bytes } = await readImage(supabase, 'invoice-images', path);
  const hashBuf = await crypto.subtle.digest('SHA-256', bytes);
  const hash = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return { data, mediaType, hash };
}

async function extractWithModel(
  model: string,
  images: { data: string; mediaType: string }[]
): Promise<ExtractionResult> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal: AbortSignal.timeout(75000),
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      tools: [EXTRACTION_TOOL],
      tool_choice: { type: 'tool', name: 'record_invoice_extraction' },
      messages: [
        {
          role: 'user',
          content: [
            ...images.map((img) => ({
              type: 'image',
              source: { type: 'base64', media_type: img.mediaType, data: img.data },
            })),
            { type: 'text', text: EXTRACTION_PROMPT },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API error (${res.status}): ${body}`);
  }

  const json = await res.json();
  const toolUse = json.content?.find((b: any) => b.type === 'tool_use');
  if (!toolUse) throw new Error('Model did not return a structured extraction.');
  return toolUse.input as ExtractionResult;
}

// --- Duplicate detection ---------------------------------------------------
//
// Two layers run before the (expensive) Sonnet extraction, both server-side:
//
//   1. Exact image-hash overlap (free) catches a literal re-upload of the same
//      file — see storagePathToBase64's SHA-256 hash.
//   2. A cheap Haiku fingerprint catches the *same paper invoice re-photographed*
//      — a new photo has different bytes, so layer 1 misses it, but the printed
//      vendor/number/date/total are the same. We spend one small Haiku call
//      (four header fields, tiny max_tokens, no line items) to read just those
//      and compare against the org's existing invoices. This second layer is a
//      deliberate, already-decided tradeoff: a duplicate costs one cheap Haiku
//      call instead of a full Sonnet extraction; a non-duplicate costs one cheap
//      Haiku call on top of the Sonnet call.

const FINGERPRINT_TOOL = {
  name: 'record_invoice_fingerprint',
  description: 'Record only the identifying header fields of a restaurant distributor invoice, for duplicate detection.',
  input_schema: {
    type: 'object',
    properties: {
      vendor_name: { type: 'string' },
      invoice_number: { type: 'string' },
      invoice_date: { type: 'string', description: 'ISO 8601 date, e.g. 2026-07-14' },
      total: { type: 'number' },
    },
    required: ['vendor_name'],
  },
};

const FINGERPRINT_PROMPT = `Read ONLY the identifying header of this restaurant food-distributor invoice photo: the vendor/company name, the invoice number, the invoice date, and the grand total. Do not read line items. Report exactly what is printed; leave a field out if it isn't clearly visible. Call record_invoice_fingerprint with the result.`;

interface FingerprintResult {
  vendor_name: string;
  invoice_number?: string;
  invoice_date?: string;
  total?: number;
}

async function fingerprintWithModel(
  model: string,
  images: { data: string; mediaType: string }[]
): Promise<FingerprintResult> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal: AbortSignal.timeout(75000),
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 256,
      tools: [FINGERPRINT_TOOL],
      tool_choice: { type: 'tool', name: 'record_invoice_fingerprint' },
      messages: [
        {
          role: 'user',
          content: [
            ...images.map((img) => ({
              type: 'image',
              source: { type: 'base64', media_type: img.mediaType, data: img.data },
            })),
            { type: 'text', text: FINGERPRINT_PROMPT },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API error (${res.status}): ${body}`);
  }

  const json = await res.json();
  const toolUse = json.content?.find((b: any) => b.type === 'tool_use');
  if (!toolUse) throw new Error('Model did not return a structured fingerprint.');
  return toolUse.input as FingerprintResult;
}

const DUPLICATE_INVOICE_CODE = 'DUPLICATE_INVOICE_DETECTED';

// Builds the shared 409 body the client turns into the "possible duplicate"
// confirmation UI. Same shape for either dedup layer — the client doesn't need
// to know which one caught it. `existing` is a row selected with
// `id, invoice_date, total, vendors(name)`.
function duplicateResponse(existing: any, canOverride = true): Response {
  const vendorName = existing.vendors?.name ?? null;
  return new Response(
    JSON.stringify({
      error: 'This looks like a duplicate of an invoice you already have.',
      code: DUPLICATE_INVOICE_CODE,
      canOverride,
      existingInvoiceId: existing.id,
      vendorName,
      invoiceDate: existing.invoice_date ?? null,
      total: existing.total ?? null,
    }),
    { status: 409, headers: { ...corsHeaders, 'content-type': 'application/json' } }
  );
}

const PRICE_ALERT_THRESHOLD_PCT = 3;

// Fires right after extraction — comparing at whatever unit the vendor
// printed (case, lb, box, ...) needs no weight/unit normalization to work.
// Matching is by vendor + clean_name + unit_of_measure (case-insensitive
// exact match) against the item's own most recent prior invoice from the
// same vendor; the canonical cross-vendor items catalog (item_id) is a
// separate, not-yet-built follow-up (see file header).
async function detectPriceCreep(
  supabase: any,
  organizationId: string,
  vendorId: string,
  invoiceId: string,
  lineItems: any[]
): Promise<void> {
  const eligible = lineItems.filter(
    (li) => li.line_item_type === 'charge' && li.clean_name && li.unit_of_measure && li.unit_price > 0
  );

  await Promise.all(eligible.map(async (li) => {
    try {
      const { data: priorRows } = await supabase
        .from('invoice_line_items')
        .select('unit_price, invoices!inner(vendor_id, invoice_date, created_at)')
        .eq('organization_id', organizationId)
        .eq('invoices.vendor_id', vendorId)
        .ilike('clean_name', li.clean_name)
        .ilike('unit_of_measure', li.unit_of_measure)
        .is('voided_at', null)
        .neq('invoice_id', invoiceId);

      if (!priorRows?.length) return;

      const mostRecent = priorRows.reduce((latest: any, row: any) => {
        const rowDate = row.invoices?.invoice_date ?? row.invoices?.created_at ?? '';
        const latestDate = latest.invoices?.invoice_date ?? latest.invoices?.created_at ?? '';
        return rowDate > latestDate ? row : latest;
      });

      const previousPrice = Number(mostRecent.unit_price);
      const newPrice = Number(li.unit_price);
      if (!previousPrice || previousPrice <= 0) return;

      const pctChange = ((newPrice - previousPrice) / previousPrice) * 100;
      if (pctChange <= PRICE_ALERT_THRESHOLD_PCT) return;

      await supabase.from('price_alerts').insert({
        organization_id: organizationId,
        vendor_id: vendorId,
        line_item_id: li.id,
        item_name: li.clean_name,
        previous_price: previousPrice,
        new_price: newPrice,
        unit: li.unit_of_measure,
        pct_change: Math.round(pctChange * 100) / 100,
      });
    } catch {
      // Best-effort — a failed comparison for one item shouldn't fail the
      // whole extraction the client is waiting on.
    }
  }));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Declared outside the try so the catch-all below can release a slot this
  // request reserved but didn't end up using.
  let supabase: any;
  let jobId: string | undefined;

  try {
    const { invoiceId, skipDuplicateCheck } = await req.json();
    if (!invoiceId) throw new Error('invoiceId is required');

    // Forward the caller's Clerk-issued JWT so every query below runs
    // through RLS as that user — no service-role bypass needed.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');

    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: invoice, error: fetchErr } = await supabase
      .from('invoices')
      .select('id, organization_id, image_urls, status')
      .eq('id', invoiceId)
      .single();
    if (fetchErr || !invoice) throw new Error(`Invoice not found: ${fetchErr?.message}`);
    if (invoice.status !== 'pending') throw new Error('This invoice has already been processed. Open it from invoice history.');
    if (invoice.image_urls?.length > 5) throw new Error('Import up to 5 pages per invoice.');
    await requireAiConsent(supabase);
    if (!invoice.image_urls?.length) throw new Error('Invoice has no images to extract from');

    // Plan gate — enforced here, before any Claude spend. Every tier has a
    // monthly cap (Free 10 / Plus 300 / Pro 150). Over the cap, return 402 with
    // a code the client maps to the paywall (rather than a generic error toast).
    const plan = await getOrgPlan(invoice.organization_id);
    const cap = PLAN_INVOICE_CAPS[plan];
    {
      const reservation = await beginAiJob(invoice.organization_id, invoiceId, 'invoice', cap);
      const { allowed, used } = reservation;
      if (!allowed && reservation.code !== 'FREE_LIMIT_REACHED') throw new Error(reservation.code === 'AI_BUSY' ? 'This invoice is already processing. Please wait.' : 'Too many AI requests. Please try again later.');
      if (!allowed) {
        return new Response(
          JSON.stringify({
            error:
              plan === 'free'
                ? 'You’ve used all your free extractions this month.'
                : 'You’ve reached your plan’s monthly extraction limit.',
            code: 'FREE_LIMIT_REACHED',
            used,
            cap,
          }),
          { status: 402, headers: { ...corsHeaders, 'content-type': 'application/json' } }
        );
      }
      jobId = reservation.id;
    }

    const images = await Promise.all(
      invoice.image_urls.map((path: string) => storagePathToBase64(supabase, path))
    );

    const imageHashes = images.map((img) => img.hash);
    if (new Set(imageHashes).size !== imageHashes.length) throw new Error('The same photo appears more than once. Remove repeated pages and retry.');

    // Exact complete page sets are always blocked. The override only skips
    // a possible header match; final commit still rejects strong identities.
      // Layer 1 — exact image bytes (free). Postgres array-overlap (`&&`)
      // against this org's already-extracted invoices.
      const { data: hashMatches } = await supabase
        .from('invoices')
        .select('id, invoice_date, total, image_hashes, vendors(name)')
        .eq('organization_id', invoice.organization_id)
        .in('status', ['scanned', 'saved'])
        .overlaps('image_hashes', imageHashes);
      const exactMatch = hashMatches?.find((row:any) => row.image_hashes?.length === imageHashes.length && imageHashes.every(hash => row.image_hashes.includes(hash)));
      if (exactMatch) {
        await finishAiJob(jobId, false);
        return duplicateResponse(exactMatch, false);
      }

    if (!skipDuplicateCheck) {
      // Layer 2 — cheap Haiku fingerprint. Catches the same paper invoice
      // re-photographed (different bytes, so layer 1 missed it) by reading only
      // vendor/number/date/total and matching against existing invoices.
      const fp = await fingerprintWithModel(MODEL_HAIKU, images);
      const normalizedFpVendor = normalizeVendorName(fp.vendor_name ?? '');
      if (normalizedFpVendor) {
        const { data: candidates } = await supabase
          .from('invoices')
          .select('id, invoice_number, invoice_date, total, vendors(name)')
          .eq('organization_id', invoice.organization_id)
          .in('status', ['scanned', 'saved']);

        const identity = {vendor:fp.vendor_name??'',number:fp.invoice_number,date:fp.invoice_date,total:fp.total};
        const fpMatch = (candidates ?? []).find((c:any)=>compareInvoiceIdentity(identity,{vendor:c.vendors?.name??'',number:c.invoice_number,date:c.invoice_date,total:c.total==null?null:Number(c.total)}));
        if (fpMatch) {
          const match=compareInvoiceIdentity(identity,{vendor:fpMatch.vendors?.name??'',number:fpMatch.invoice_number,date:fpMatch.invoice_date,total:fpMatch.total==null?null:Number(fpMatch.total)});
          await finishAiJob(jobId, false);
          return duplicateResponse(fpMatch, match !== 'same');
        }
      }
    }

    await setAiJobPhase(jobId, 'reading');
    const result = await extractWithModel(MODEL_SONNET, images);
    await setAiJobPhase(jobId, 'saving');

    // Resolve or create the vendor. OCR reads of the same vendor's name
    // drift between scans in trivial ways ("S.J. Distributors LLC" vs
    // "S. J. Distributors LLC") that an exact ILIKE match misses, so match
    // on a normalized form and fall back to each vendor's `aliases` (a
    // column that already existed in the schema but was never populated).
    const normalizedTarget = normalizeVendorName(result.vendor.name);
    const { data: orgVendors } = await supabase
      .from('vendors')
      .select('id, name, aliases')
      .eq('organization_id', invoice.organization_id);

    const existingVendor = (orgVendors ?? []).find((v: any) =>
      normalizeVendorName(v.name) === normalizedTarget ||
      (v.aliases ?? []).some((a: string) => normalizeVendorName(a) === normalizedTarget)
    );

    let vendorId = existingVendor?.id as string | undefined;
    if (existingVendor && existingVendor.name !== result.vendor.name &&
        !(existingVendor.aliases ?? []).includes(result.vendor.name)) {
      await supabase
        .from('vendors')
        .update({ aliases: [...(existingVendor.aliases ?? []), result.vendor.name] })
        .eq('id', existingVendor.id);
    }
    if (!vendorId) {
      // Assigned once at creation so it's stable in the DB — the client
      // only needs its own fallback for vendor rows that predate this.
      // Count-then-insert runs inside one advisory-locked DB function so
      // concurrent scans for two different new vendors can't both read the
      // same count and collide on the same color.
      const { data: newVendor, error: vendorErr } = await supabase
        .rpc('create_vendor_with_palette_color', {
          p_organization_id: invoice.organization_id,
          p_name: result.vendor.name,
          p_contact_name: result.vendor.contact_name ?? null,
          p_contact_phone: result.vendor.contact_phone ?? null,
          p_account_number: result.vendor.account_number ?? null,
          p_palette: VENDOR_COLOR_PALETTE,
        })
        .single();
      if (vendorErr) throw new Error(`Could not create vendor: ${vendorErr.message}`);
      vendorId = (newVendor as any).id;
    }

    const lineItemRows = result.line_items.map((li) => ({
      organization_id: invoice.organization_id,
      invoice_id: invoiceId,
      raw_description: li.description,
      clean_name: li.clean_name,
      qty: li.quantity,
      unit_of_measure: li.unit_of_measure,
      unit_price: li.unit_price,
      extended_price: li.extended_price,
      line_item_type: li.line_item_type,
      category: li.category,
      confidence: li.confidence,
      low_confidence_fields: li.low_confidence_fields ?? [],
      reconciliation_status: 'pending',
    }));

    const { error: commitErr } = await adminClient().rpc('complete_invoice_extraction', {
      p_job: jobId, p_vendor: vendorId,
      p_patch: { invoice_number: result.invoice_number, invoice_date: result.invoice_date,
        subtotal: result.subtotal, tax: result.tax, total: result.total,
        raw_ai_response: result, image_hashes: imageHashes },
      p_lines: lineItemRows,
    });
    if (commitErr) {
      const duplicateId = commitErr.message.match(/duplicate invoice:([0-9a-f-]{36})/i)?.[1];
      if (duplicateId) {
        await finishAiJob(jobId, false);
        const { data: existing } = await supabase.from('invoices').select('id, invoice_date, total, vendors(name)').eq('id',duplicateId).single();
        if (existing) return duplicateResponse(existing,false);
      }
      throw new Error('Could not save invoice. Please try again.');
    }
    jobId = undefined; // commit includes quota completion in the same transaction
    const { data: updatedInvoice } = await supabase.from('invoices').select('*, vendors(name)').eq('id', invoiceId).single();
    const { data: insertedLineItems } = await supabase.from('invoice_line_items').select('*').eq('invoice_id', invoiceId);

    // Always detect price creep so free orgs can see the *count* as an upgrade
    // teaser ("3 price increases this month"); the alert *details* stay
    // Pro-gated in the UI. Detection is cheap SQL (no AI spend), so running it
    // for everyone is fine — and it means a converting user immediately sees the
    // alerts that were already waiting for them.
    if (vendorId) {
      try { await detectPriceCreep(supabase, invoice.organization_id, vendorId, invoiceId, insertedLineItems ?? []); } catch { console.error('Price alert refresh failed'); }
    }

    return new Response(
      JSON.stringify({ invoice: updatedInvoice, lineItems: insertedLineItems }),
      { headers: { ...corsHeaders, 'content-type': 'application/json' } }
    );
  } catch (err) {
    // This extraction didn't reach scanned/saved — give back its reserved cap
    // slot so a failure (a bad photo, a transient Anthropic error) doesn't
    // silently cost the org one of their free extractions.
    await finishAiJob(jobId, false);
    // Log the full detail server-side (may include upstream Anthropic error
    // bodies) but don't forward it verbatim to the client.
    console.error('[extract-invoice] failed');
    const message = (err as Error).message ?? 'Extraction failed';
    const safeMessage = message.startsWith('Anthropic API error') ? 'Extraction failed — please try again.' : message;
    return new Response(JSON.stringify({ error: safeMessage }), {
      status: 400,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }
});

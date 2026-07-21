import type { SupabaseClient } from '@supabase/supabase-js';
import type { Invoice, LineItem, LineItemType, VerificationStatus } from '../store/useStore';

const CATEGORY_COLORS: Record<string, string> = {
  protein: '#E07A30',
  produce: '#5DB075',
  dairy: '#5B7FD4',
  dry_goods: '#9B8A50',
  seafood: '#4AABB8',
};
const DEFAULT_CATEGORY_COLOR = '#9696A8';

const LOW_CONFIDENCE_THRESHOLD = 0.75;

// Same rotation the extract-invoice edge function assigns new vendors at
// creation time — this is only the fallback for vendor rows that predate
// that (color is null), so results are stable rather than a random color
// on every render.
const VENDOR_FALLBACK_PALETTE = ['#5DB075', '#5B7FD4', '#E09030', '#4AABB8', '#E07A30', '#9B7FD4'];

export function fallbackVendorColor(vendorId: string): string {
  let hash = 0;
  for (let i = 0; i < vendorId.length; i++) hash = (hash * 31 + vendorId.charCodeAt(i)) >>> 0;
  return VENDOR_FALLBACK_PALETTE[hash % VENDOR_FALLBACK_PALETTE.length];
}

export function categoryColor(category: string | null | undefined): string {
  if (!category) return DEFAULT_CATEGORY_COLOR;
  return CATEGORY_COLORS[category.toLowerCase()] ?? DEFAULT_CATEGORY_COLOR;
}

export function categoryLabel(category: string | null | undefined): string {
  if (!category) return 'Other';
  return category
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '';
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// DB row shapes, as returned by the extract-invoice edge function.
interface DbLineItem {
  id: string;
  raw_description: string;
  clean_name: string | null;
  qty: number | null;
  unit_of_measure: string | null;
  unit_price: number | null;
  extended_price: number | null;
  category: string | null;
  confidence: number | null;
  low_confidence_fields: string[] | null;
  confirmed: boolean | null;
  reconciliation_status: string | null;
  line_item_type: string | null;
}

interface DbInvoice {
  id: string;
  vendor_id: string | null;
  vendors?: { name: string | null } | null;
  invoice_number: string | null;
  invoice_date: string | null;
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  status: 'pending' | 'scanned' | 'saved';
  image_urls: string[] | null;
}

function mapLineItem(row: DbLineItem): LineItem {
  const confidence = row.confidence ?? 1;
  const lowConfidenceFields = row.low_confidence_fields ?? [];
  const needsConfirm = !row.confirmed && (confidence < LOW_CONFIDENCE_THRESHOLD || lowConfidenceFields.length > 0);
  // Older rows extracted before clean_name existed fall back to the raw text.
  const cleanName = row.clean_name?.trim() || row.raw_description;

  return {
    id: row.id,
    desc: cleanName,
    rawDesc: cleanName.trim().toLowerCase() === row.raw_description.trim().toLowerCase()
      ? undefined
      : row.raw_description,
    qty: row.qty ?? 0,
    unit: row.unit_of_measure ?? '',
    unitPrice: row.unit_price ?? 0,
    ext: row.extended_price ?? 0,
    category: categoryLabel(row.category),
    catColor: categoryColor(row.category),
    needsConfirm,
    confirmNote: needsConfirm
      ? `Uncertain: ${lowConfidenceFields.join(', ') || 'low-confidence read'} — please confirm`
      : undefined,
    confirmed: row.confirmed ?? false,
    expanded: false,
    // 'short' stays a valid DB value (see migration) but the UI only surfaces
    // received/missing/pending — collapse it the same way the rest of the
    // app does.
    verification: ((row.reconciliation_status === 'short' ? 'missing' : row.reconciliation_status) ??
      'pending') as VerificationStatus,
    disputeVal: row.extended_price ?? 0,
    type: (row.line_item_type ?? 'charge') as LineItemType,
  };
}

export function mapInvoice(dbInvoice: DbInvoice, dbLineItems: DbLineItem[]): Invoice {
  return {
    id: dbInvoice.id,
    vendorId: dbInvoice.vendor_id ?? '',
    vendorName: dbInvoice.vendors?.name ?? 'Unknown vendor',
    invoiceNumber: dbInvoice.invoice_number ?? '',
    date: formatDate(dbInvoice.invoice_date),
    dateIso: dbInvoice.invoice_date,
    lineItems: dbLineItems.map(mapLineItem),
    subtotal: dbInvoice.subtotal ?? 0,
    tax: dbInvoice.tax ?? 0,
    total: dbInvoice.total ?? 0,
    status: dbInvoice.status,
    pages: dbInvoice.image_urls?.length ?? 1,
  };
}

export async function createDraftInvoice(supabase: SupabaseClient, organizationId: string): Promise<string> {
  const { data, error } = await supabase
    .from('invoices')
    .insert({ organization_id: organizationId, status: 'pending', image_urls: [] })
    .select('id')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Could not create invoice');
  return data.id as string;
}

// Uploads local capture URIs (camera/image-picker file:// URIs) to the
// private invoice-images bucket at {organizationId}/{invoiceId}/{n}.jpg, and
// attaches the resulting storage paths to the invoice row.
export async function uploadInvoiceImages(
  supabase: SupabaseClient,
  organizationId: string,
  invoiceId: string,
  localUris: string[]
): Promise<string[]> {
  const paths: string[] = [];
  for (let i = 0; i < localUris.length; i++) {
    const path = `${organizationId}/${invoiceId}/${i}.jpg`;
    const arrayBuffer = await fetch(localUris[i]).then((r) => r.arrayBuffer());
    const { error } = await supabase.storage
      .from('invoice-images')
      .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
    if (error) throw new Error(`Could not upload image ${i + 1}: ${error.message}`);
    paths.push(path);
  }

  const { error: attachErr } = await supabase.from('invoices').update({ image_urls: paths }).eq('id', invoiceId);
  if (attachErr) throw new Error(`Could not attach images to invoice: ${attachErr.message}`);

  return paths;
}

export async function extractInvoice(supabase: SupabaseClient, invoiceId: string): Promise<Invoice> {
  const { data, error } = await supabase.functions.invoke('extract-invoice', {
    body: { invoiceId },
  });
  if (error) {
    // FunctionsHttpError's own .message is just "non-2xx status code" — the
    // real error text this edge function actually threw is in the response
    // body carried on error.context.
    const context = (error as { context?: Response }).context;
    let detail: string | undefined;
    try {
      const raw = await context?.text();
      detail = raw ? JSON.parse(raw)?.error : undefined;
    } catch {
      // context wasn't JSON (network-level failure, not our function's own
      // error response) — fall back to the generic message below.
    }
    throw new Error(detail ?? error.message ?? 'Extraction failed');
  }
  if (data?.error) throw new Error(data.error);
  return mapInvoice(data.invoice, data.lineItems);
}

export async function fetchInvoiceById(
  supabase: SupabaseClient,
  organizationId: string,
  invoiceId: string
): Promise<Invoice> {
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('*, vendors(name)')
    .eq('id', invoiceId)
    .eq('organization_id', organizationId)
    .single();
  if (error || !invoice) throw new Error(error?.message ?? 'Invoice not found');

  const { data: lineItems, error: lineItemsErr } = await supabase
    .from('invoice_line_items')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('created_at', { ascending: true });
  if (lineItemsErr) throw new Error(lineItemsErr.message);

  return mapInvoice(invoice, lineItems ?? []);
}

export async function fetchVendorInvoices(
  supabase: SupabaseClient,
  organizationId: string,
  vendorId: string
): Promise<Invoice[]> {
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('*, vendors(name), invoice_line_items(*)')
    .eq('organization_id', organizationId)
    .eq('vendor_id', vendorId)
    .eq('status', 'saved')
    .order('invoice_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  return (invoices ?? []).map((inv: any) => mapInvoice(inv, inv.invoice_line_items ?? []));
}

export async function fetchAllInvoices(
  supabase: SupabaseClient,
  organizationId: string
): Promise<Invoice[]> {
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('*, vendors(name), invoice_line_items(*)')
    .eq('organization_id', organizationId)
    .eq('status', 'saved')
    .order('invoice_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  return (invoices ?? []).map((inv: any) => mapInvoice(inv, inv.invoice_line_items ?? []));
}

// Storage paths are private (RLS-scoped bucket) — resolve to short-lived
// signed URLs on demand rather than persisting public ones, same pattern
// the extract-invoice edge function uses server-side.
export async function fetchInvoiceImageUrls(
  supabase: SupabaseClient,
  organizationId: string,
  invoiceId: string
): Promise<string[]> {
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('image_urls')
    .eq('id', invoiceId)
    .eq('organization_id', organizationId)
    .single();
  if (error || !invoice) throw new Error(error?.message ?? 'Invoice not found');

  const paths: string[] = invoice.image_urls ?? [];
  const signed = await Promise.all(
    paths.map(async (path) => {
      const { data, error: signErr } = await supabase.storage
        .from('invoice-images')
        .createSignedUrl(path, 300);
      if (signErr || !data) throw new Error(signErr?.message ?? `Could not sign ${path}`);
      return data.signedUrl;
    })
  );
  return signed;
}

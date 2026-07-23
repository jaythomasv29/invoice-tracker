// Plan / entitlement model.
//
// The plan lives on the Clerk *organization* (a restaurant), in
// `organization.publicMetadata.plan` — set to 'pro' to unlock everything, any
// other value (or unset) is treated as 'free'. publicMetadata is readable
// client-side for UI gating, and the extract-invoice edge function reads the
// same flag server-side (via the Clerk Backend API) to enforce the extraction
// cap where it actually costs money. Keep FREE_MONTHLY_EXTRACTION_CAP in sync
// with the copy in supabase/functions/extract-invoice/index.ts.

export type Plan = 'free' | 'pro';

// Free orgs may run this many extractions per calendar month; resets on the 1st.
export const FREE_MONTHLY_EXTRACTION_CAP = 10;

// Shape of what we read off Clerk org publicMetadata (kept loose on purpose).
type OrgLike = { publicMetadata?: Record<string, unknown> | null } | null | undefined;

export function planFromOrg(org: OrgLike): Plan {
  return org?.publicMetadata?.plan === 'pro' ? 'pro' : 'free';
}

// The edge function returns HTTP 402 with this code when a free org is over the
// monthly cap, so the client can route to the paywall instead of showing a
// generic error toast.
export const EXTRACTION_LIMIT_CODE = 'FREE_LIMIT_REACHED';

export class ExtractionLimitError extends Error {
  readonly code = EXTRACTION_LIMIT_CODE;
  readonly used?: number;
  readonly cap?: number;
  constructor(message = 'You’ve used all your free extractions this month.', used?: number, cap?: number) {
    super(message);
    this.name = 'ExtractionLimitError';
    this.used = used;
    this.cap = cap;
  }
}

// The edge function returns HTTP 409 with this code when a scan looks like a
// duplicate of an invoice this org already has (caught by either the exact
// image-hash layer or the cheap Haiku fingerprint layer — the client doesn't
// need to know which). The client turns it into a "warn, let the user
// override" confirmation UI rather than a hard failure, so the payload carries
// enough to show the existing invoice and link to it.
export const DUPLICATE_INVOICE_CODE = 'DUPLICATE_INVOICE_DETECTED';

export class DuplicateInvoiceError extends Error {
  readonly code = DUPLICATE_INVOICE_CODE;
  readonly existingInvoiceId: string;
  readonly vendorName: string | null;
  readonly invoiceDate: string | null;
  readonly total: number | null;
  constructor(
    message: string,
    existingInvoiceId: string,
    vendorName: string | null,
    invoiceDate: string | null,
    total: number | null
  ) {
    super(message);
    this.name = 'DuplicateInvoiceError';
    this.existingInvoiceId = existingInvoiceId;
    this.vendorName = vendorName;
    this.invoiceDate = invoiceDate;
    this.total = total;
  }
}

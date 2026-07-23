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

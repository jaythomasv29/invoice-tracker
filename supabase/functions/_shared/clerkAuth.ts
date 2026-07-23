// Reads identity claims from the caller's Clerk-issued JWT, and talks to the
// Clerk Backend API to read/update organization metadata (the source of truth
// for the plan flag). CLERK_SECRET_KEY is a function secret — never
// EXPO_PUBLIC_. Set with: npx supabase secrets set CLERK_SECRET_KEY=sk_...

const CLERK_API = 'https://api.clerk.com/v1';

function clerkKey(): string {
  const k = Deno.env.get('CLERK_SECRET_KEY');
  if (!k) throw new Error('CLERK_SECRET_KEY is not set');
  return k;
}

// Decodes (does NOT re-verify) the Clerk JWT payload. Safe here because these
// functions also touch RLS-protected data with the same token, and a forged
// token wouldn't get past Supabase's third-party-auth verification on those
// queries — so we're only reading claims off a token that's already trusted.
function decodeJwt(authHeader: string | null): Record<string, any> | null {
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

// The active organization id from the token. Clerk exposes it as a flat
// `org_id` claim on the Supabase-integration token, but fall back to the nested
// `o.id` form just in case the session token shape differs.
export function getOrgId(authHeader: string | null): string | null {
  const c = decodeJwt(authHeader);
  return c?.org_id ?? c?.o?.id ?? null;
}

export function getUserId(authHeader: string | null): string | null {
  return decodeJwt(authHeader)?.sub ?? null;
}

export async function getOrganization(orgId: string): Promise<any> {
  const res = await fetch(`${CLERK_API}/organizations/${orgId}`, {
    headers: { Authorization: `Bearer ${clerkKey()}` },
  });
  if (!res.ok) throw new Error(`Clerk getOrganization failed: ${res.status}`);
  return res.json();
}

// Merges the given metadata into the org (Clerk deep-merges top-level keys, so
// this preserves other keys you don't pass).
export async function updateOrgMetadata(
  orgId: string,
  body: { public_metadata?: Record<string, unknown>; private_metadata?: Record<string, unknown> },
): Promise<void> {
  const res = await fetch(`${CLERK_API}/organizations/${orgId}/metadata`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${clerkKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Clerk updateOrgMetadata failed: ${res.status} ${await res.text()}`);
}

export async function setOrgPlan(orgId: string, plan: 'free' | 'pro'): Promise<void> {
  await updateOrgMetadata(orgId, { public_metadata: { plan } });
}

// The caller's primary email, for pre-filling the Stripe customer. Best-effort.
export async function getUserPrimaryEmail(userId: string): Promise<string | null> {
  const res = await fetch(`${CLERK_API}/users/${userId}`, {
    headers: { Authorization: `Bearer ${clerkKey()}` },
  });
  if (!res.ok) return null;
  const u = await res.json();
  const primaryId = u.primary_email_address_id;
  const match = (u.email_addresses ?? []).find((x: any) => x.id === primaryId);
  return match?.email_address ?? null;
}

// Reads identity claims from the caller's Clerk-issued JWT, and talks to the
// Clerk Backend API to read/update organization metadata (the source of truth
// for the plan flag). CLERK_SECRET_KEY is a function secret — never
// EXPO_PUBLIC_. Set with: npx supabase secrets set CLERK_SECRET_KEY=sk_...

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const CLERK_API = 'https://api.clerk.com/v1';

function clerkKey(): string {
  const k = Deno.env.get('CLERK_SECRET_KEY');
  if (!k) throw new Error('CLERK_SECRET_KEY is not set');
  return k;
}

// Decodes (does NOT verify) the Clerk JWT payload. Only safe to read claims
// that don't gate access to anything — e.g. `sub` to look up an email for
// pre-filling a Stripe customer. NEVER use this for org_id: use
// getVerifiedOrgId instead, which is spoof-proof.
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

export function getUserId(authHeader: string | null): string | null {
  return decodeJwt(authHeader)?.sub ?? null;
}

// The active organization id, verified. Rather than trusting the org_id claim
// off a locally-decoded (unsigned-check) JWT — which any caller could forge —
// this asks Postgres for private.current_org_id() through an RLS-scoped
// client carrying the caller's token. Supabase's third-party-auth integration
// only populates auth.jwt() from a token whose signature it has verified
// against Clerk's JWKS, so a forged token yields no org id here rather than an
// attacker-chosen one. Use this (not the JWT claim) anywhere an org_id drives
// a privileged action, e.g. issuing Stripe billing-portal/checkout sessions.
export async function getVerifiedOrgId(authHeader: string | null): Promise<string | null> {
  if (!authHeader) return null;
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await supabase.rpc('current_org_id');
  if (error) return null;
  return (data as string | null) ?? null;
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

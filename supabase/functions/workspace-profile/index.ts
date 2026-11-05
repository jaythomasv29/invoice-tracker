import { createClient } from 'npm:@supabase/supabase-js@2';
import { adminClient } from '../_shared/aiControls.ts';
import { clerkRequest, getOrganization } from '../_shared/clerkAuth.ts';
import { corsHeaders } from '../_shared/cors.ts';
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS')
    return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')
    return new Response('Method not allowed', { status: 405 });
  try {
    const auth = req.headers.get('Authorization');
    if (!auth) throw new Error('Sign in required');
    const client = createClient(
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
    const { data: identity, error } = await client.rpc('current_identity');
    if (
      error ||
      !identity?.user_id ||
      !identity?.issuer ||
      !identity?.organization_id
    )
      return Response.json(
        { error: 'Select an authorized workspace.' },
        { status: 401, headers: corsHeaders },
      );
    const id = identity.organization_id;
    const personal = id.startsWith('pws_');
    const db = adminClient();
    const org = await getOrganization(id);
    const { data: link, error: linkError } = await db
      .from('workspace_billing_links')
      .select('*')
      .eq('workspace_id', id)
      .maybeSingle();
    if (linkError) throw new Error('Could not read billing identity');
    const isAdmin =
      personal ||
      (['admin', 'org:admin'].includes(identity.organization_role) &&
        org.created_by === identity.user_id);
    const isOwner = link
      ? link.owner_user_id === identity.user_id &&
        link.owner_issuer === identity.issuer
      : isAdmin;
    let customer = link?.customer_id ?? id;
    let billingReady = !!link;
    let purchaseUnavailableReason =
      'Only the workspace billing owner can purchase or restore.';
    if (!link && isAdmin) {
      let preferred = id;
      if (personal) {
        // Preserve a returning business owner's existing Apple receipt identity.
        const memberships = await clerkRequest(
          `/users/${encodeURIComponent(identity.user_id)}/organization_memberships?limit=100`,
        );
        const owned = (memberships.data ?? [])
          .filter((m: any) => m.role === 'org:admin')
          .sort((a: any, b: any) => a.created_at - b.created_at);
        for (const membership of owned) {
          const candidate = membership.organization.id;
          const candidateOrg = await getOrganization(candidate);
          if (candidateOrg.created_by !== identity.user_id) continue;
          const { data: existing, error: existingError } = await db
            .from('workspace_billing_links')
            .select('owner_user_id,owner_issuer')
            .eq('workspace_id', candidate)
            .maybeSingle();
          if (existingError)
            throw new Error('Could not resolve billing ownership');
          if (
            !existing ||
            (existing.owner_user_id === identity.user_id &&
              existing.owner_issuer === identity.issuer)
          ) {
            preferred = candidate;
            break;
          }
        }
      }
      const { data, error: bindError } = await db.rpc(
        'bind_workspace_billing',
        {
          p_workspace: id,
          p_type: personal ? 'personal' : 'business',
          p_user: identity.user_id,
          p_issuer: identity.issuer,
          p_preferred_customer: preferred,
        },
      );
      if (bindError?.message?.includes('One workspace per account type'))
        purchaseUnavailableReason =
          'This account already has a Business workspace linked for purchases. Switch to that workspace to manage Business Pro; this additional business can use Free.';
      if (!bindError) {
        customer = data;
        billingReady = true;
      }
    }
    return Response.json(
      {
        id,
        name: org.name,
        type: personal ? 'personal' : 'business',
        publicMetadata: org.public_metadata ?? {},
        billingCustomerId: customer,
        canPurchase: isOwner && billingReady,
        purchaseUnavailableReason,
      },
      { headers: corsHeaders },
    );
  } catch {
    return Response.json(
      { error: 'Could not load your workspace. Please retry.' },
      { status: 503, headers: corsHeaders },
    );
  }
});

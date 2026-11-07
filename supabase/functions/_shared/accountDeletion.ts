import { adminClient } from './aiControls.ts';
import { clerkRequest, ClerkNotFoundError } from './clerkAuth.ts';
const clerk = clerkRequest;
async function allMemberships(path: string) {
  const rows: any[] = [];
  for (let offset = 0; ; offset += 100) {
    const result = await clerk(`${path}?limit=100&offset=${offset}`);
    rows.push(...(result.data ?? []));
    if (result.data.length < 100) return rows;
  }
}
export async function requestDeletion(userId: string, issuer:string) {
  const db = adminClient();
  const { data: existing, error } = await db.from('account_deletions').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw new Error('Could not check deletion status.');
  if (existing) return existing;
  const memberships = await allMemberships(`/users/${encodeURIComponent(userId)}/organization_memberships`);
  const {data:personal,error:personalError}=await db.from('personal_workspaces').select('id').eq('owner_user_id',userId).eq('owner_issuer',issuer);
  if(personalError)throw new Error('Could not check household ownership.');
  const eraseOrgs: string[] = (personal??[]).map(p=>p.id);
  for (const membership of memberships) {
    const orgId = membership.organization.id;
    const members = await allMemberships(`/organizations/${encodeURIComponent(orgId)}/memberships`);
    if (members.length === 1 && members[0].public_user_data.user_id === userId) eraseOrgs.push(orgId);
    else if (membership.role === 'org:admin' && !members.some(m => m.public_user_data.user_id !== userId && m.role === 'org:admin')) {
      throw new Error('Make another member an administrator or remove other members before deleting the only administrator account. Contact support@siftcosts.com for help.');
    }
  }
  const { data, error: insertError } = await db.from('account_deletions').insert({ user_id: userId, owner_issuer:issuer, organization_ids: eraseOrgs }).select().single();
  if (insertError) throw new Error('Could not start account deletion. Please retry.');
  return data;
}
async function removeFolder(bucket: string, prefix: string): Promise<void> {
  const storage = adminClient().storage.from(bucket);
  // Remove each page before fetching the same offset, so deletion cannot skip items.
  for (;;) {
    const { data, error } = await storage.list(prefix, { limit: 100 });
    if (error) throw new Error('Photo deletion is delayed. Please retry.');
    if (!data?.length) return;
    for (const item of data) {
      const path = `${prefix}/${item.name}`;
      if (!item.id) await removeFolder(bucket, path);
      else { const { error } = await storage.remove([path]); if (error) throw new Error('Photo deletion is delayed. Please retry.'); }
    }
  }
}
export async function runDeletion(job: any) {
  if (job.status === 'complete') return;
  const db = adminClient();
  for (const orgId of job.organization_ids as string[]) {
    // Don't erase data while a model operation could still commit it.
    const { count, error: activeError } = await db.from('ai_jobs').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'running').gt('created_at', new Date(Date.now()-15*60*1000).toISOString());
    if (activeError || count) throw new Error('A Smart Sift request is finishing. Account deletion has started; retry in a few minutes.');
    const {count:insights,error:insightError}=await db.from('product_insight_jobs').select('id',{count:'exact',head:true}).eq('organization_id',orgId).eq('status','running').gt('created_at',new Date(Date.now()-2*60*1000).toISOString());
    if(insightError||insights)throw new Error('A Smart Sift product review is finishing. Retry deletion in a few minutes.');
    await removeFolder('invoice-images', orgId);
    await removeFolder('recipe-images', orgId);
    // Remove child records first; each deletion is idempotent and checked.
    for (const table of ['product_group_actions','product_group_aliases','product_display_groups','product_insight_jobs','recipe_ingredients','recipes','price_alerts','delivery_disputes','invoice_line_items','invoices','insight_briefings','vendors','items','extraction_usage','ai_jobs','billing_sync_locks','ai_model_usage']) {
      const { error } = await db.from(table).delete().eq('organization_id', orgId);
      if (error) throw new Error('Data deletion is delayed. Please retry.');
    }
    const {data:link,error:linkError}=await db.from('workspace_billing_links').select('customer_id').eq('workspace_id',orgId).maybeSingle();
    if(linkError)throw new Error('Purchase record deletion is delayed.');
    const customer=link?.customer_id??orgId;
    const {count:otherLinks,error:countError}=await db.from('workspace_billing_links').select('workspace_id',{count:'exact',head:true}).eq('customer_id',customer).not('workspace_id','in',`(${job.organization_ids.join(',')})`);
    if(countError)throw new Error('Purchase record deletion is delayed.');
    if(!otherLinks){
      const revenueKey=Deno.env.get('REVENUECAT_SECRET_API_KEY');
      if(!revenueKey)throw new Error('Purchase record deletion needs support. Your deletion remains queued.');
      const response=await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(customer)}`,{method:'DELETE',headers:{Authorization:`Bearer ${revenueKey}`},signal:AbortSignal.timeout(15000)});
      if(!response.ok&&response.status!==404)throw new Error('Purchase record deletion is delayed. Please retry.');
    }
    const {error:unlinkError}=await db.from('workspace_billing_links').delete().eq('workspace_id',orgId);
    if(unlinkError)throw new Error('Purchase record deletion is delayed.');
    if(orgId.startsWith('pws_')){const {error}=await db.from('personal_workspaces').delete().eq('id',orgId);if(error)throw new Error('Household deletion is delayed.');}
    else await clerk(`/organizations/${encodeURIComponent(orgId)}`, 'DELETE');
  }
  const { error: consentError } = await db.from('ai_consents').delete().eq('user_id', job.user_id);
  if (consentError) throw new Error('Permission record deletion is delayed. Please retry.');
  const { error: authorError } = await db.from('invoices').update({ created_by: null }).eq('created_by', job.user_id);
  if (authorError) throw new Error('Personal record cleanup is delayed.');
  const {error:groupAuthorError}=await db.from('product_group_actions').update({actor_user_id:null}).eq('actor_user_id',job.user_id);
  if(groupAuthorError)throw new Error('Product grouping author cleanup is delayed.');
  let profile: any = null;
  try { profile = await clerk(`/users/${encodeURIComponent(job.user_id)}`); } catch (error) { if (!(error instanceof ClerkNotFoundError)) throw error; }
  for (const email of profile?.email_addresses ?? []) {
    const { error } = await db.from('waitlist_signups').delete().eq('email',email.email_address.toLowerCase());
    if (error) throw new Error('Contact record deletion is delayed.');
  }
  await clerk(`/users/${encodeURIComponent(job.user_id)}`, 'DELETE');
  const { error } = await db.from('account_deletions').update({ status: 'complete', completed_at: new Date().toISOString() }).eq('user_id', job.user_id);
  if (error) throw new Error('Deletion confirmation is delayed. Please retry.');
}

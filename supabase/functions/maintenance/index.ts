import { adminClient, finishAiJob } from '../_shared/aiControls.ts';
import { runDeletion } from '../_shared/accountDeletion.ts';
Deno.serve(async req => {
  const token = Deno.env.get('MAINTENANCE_AUTH_TOKEN');
  if (!token || req.method !== 'POST' || req.headers.get('Authorization') !== `Bearer ${token}`) return new Response('Unauthorized',{status:401});
  const db = adminClient(); let failures = 0;
  const { data: stale, error: staleError } = await db.from('ai_jobs').select('id').eq('status','running').lt('created_at',new Date(Date.now()-10*60*1000).toISOString()).limit(100);
  if (staleError) failures++;
  for (const job of stale ?? []) await finishAiJob(job.id,false);
  const { data: deletions, error: deletionError } = await db.from('account_deletions').select('*').eq('status','pending').limit(10);
  if (deletionError) failures++;
  for (const job of deletions ?? []) { try { await runDeletion(job); } catch { failures++; } }
  const { error: abandonedError } = await db.from('invoices').delete().eq('status','pending').lt('created_at',new Date(Date.now()-86400000).toISOString());
  if (abandonedError) failures++;
  const { data: files, error: fileError } = await db.from('storage_deletion_queue').select('*').order('created_at').limit(100);
  if (fileError) failures++;
  for (const job of files ?? []) {
    const { error } = job.paths.length ? await db.storage.from(job.bucket).remove(job.paths) : { error: null };
    if (error) { failures++; continue; }
    const { error: removeError } = await db.from('storage_deletion_queue').delete().eq('id',job.id);
    if (removeError) failures++;
  }
  const { error: retentionError } = await db.from('account_deletions').delete().eq('status','complete').lt('completed_at',new Date(Date.now()-30*86400000).toISOString());
  if (retentionError) failures++;
  return Response.json({ failures },{status:failures?503:200});
});

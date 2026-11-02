-- Run after deploying maintenance. Store the random MAINTENANCE_AUTH_TOKEN function secret as
-- sift_maintenance_key and its https://<ref>.supabase.co/functions/v1 base URL
-- as sift_functions_url in Supabase Vault. Never commit those values.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
select cron.schedule('sift-maintenance','*/5 * * * *',$schedule$
 select net.http_post(
   url := (select decrypted_secret from vault.decrypted_secrets where name='sift_functions_url') || '/maintenance',
   headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='sift_maintenance_key')),
   body := '{}'::jsonb,
   timeout_milliseconds := 90000
 );
$schedule$);

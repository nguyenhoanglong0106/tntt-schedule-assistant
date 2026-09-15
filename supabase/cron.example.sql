-- Run after deploying process-reminders with --no-verify-jwt.
-- Replace the two values below with your own project URL and a strong random CRON secret.
create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'tntt_project_url');
select vault.create_secret('CHANGE_ME_STRONG_RANDOM_SECRET', 'tntt_cron_secret');

select cron.schedule(
  'tntt-process-reminders',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='tntt_project_url') || '/functions/v1/process-reminders',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='tntt_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

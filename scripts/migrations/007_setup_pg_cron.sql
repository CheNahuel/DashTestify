-- Enable required extensions
create extension if not exists pg_cron;
create extension if not exists http;
create extension if not exists supabase_vault;

-- Create private schema for internal functions
create schema if not exists private;

-- Trigger function that calls the Edge Functions
-- Edge Functions authenticate internally using SUPABASE_SERVICE_ROLE_KEY env var
create or replace function private.trigger_sync(p_function_name text)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  -- Call the Edge Function (no auth token needed - Edge Function authenticates internally)
  perform net.http_post(
    url := 'https://kayzrduiqcxvwwjftttk.supabase.co/functions/v1/' || p_function_name,
    headers := jsonb_build_object(
      'content-type', 'application/json'
    ),
    body := jsonb_build_object('timestamp', now()::text)
  );
end;
$$;

-- Daily sync: runs at 1 AM UTC every day
select cron.schedule(
  'sync-crypto-daily',
  '0 1 * * *',
  $$select private.trigger_sync('sync-daily');$$
);

-- Intraday sync: runs every 5 minutes
select cron.schedule(
  'sync-crypto-intraday',
  '*/5 * * * *',
  $$select private.trigger_sync('sync-intraday');$$
);

-- You can check cron jobs with:
-- select * from cron.job;
--
-- Remove a job with:
-- select cron.unschedule('sync-crypto-daily');
-- select cron.unschedule('sync-crypto-intraday');
--
-- View cron job execution logs:
-- select * from cron.job_run_details order by start_time desc limit 10;

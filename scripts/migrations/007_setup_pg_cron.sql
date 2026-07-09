-- Enable pg_cron extension (if not already enabled)
create extension if not exists pg_cron;

-- Daily sync: runs at 1 AM UTC every day
-- Calls the sync-daily Edge Function
select cron.schedule(
  'sync-crypto-daily',
  '0 1 * * *',
  $$
    select net.http_post(
      url:='https://PROJECT_ID.supabase.co/functions/v1/sync-daily',
      headers:=jsonb_build_object(
        'authorization', 'Bearer ' || current_setting('app.internal_sync_secret'),
        'content-type', 'application/json'
      ),
      body:=jsonb_build_object(
        'timestamp', now()::text
      )
    ) as request_id;
  $$
);

-- Intraday sync: runs every 5 minutes
-- Calls the sync-intraday Edge Function
select cron.schedule(
  'sync-crypto-intraday',
  '*/5 * * * *',
  $$
    select net.http_post(
      url:='https://PROJECT_ID.supabase.co/functions/v1/sync-intraday',
      headers:=jsonb_build_object(
        'authorization', 'Bearer ' || current_setting('app.internal_sync_secret'),
        'content-type', 'application/json'
      ),
      body:=jsonb_build_object(
        'timestamp', now()::text
      )
    ) as request_id;
  $$
);

-- You can check cron jobs with:
-- select * from cron.job;
--
-- Remove a job with:
-- select cron.unschedule('sync-crypto-daily');
-- select cron.unschedule('sync-crypto-intraday');

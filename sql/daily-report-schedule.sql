-- ===========================================================================
-- Schedule the nightly report
-- ---------------------------------------------------------------------------
-- Cron POKES every 15 minutes; the FUNCTION decides whether to send, by
-- comparing the studio-local clock to settings.daily_report_hour/minute and
-- checking it has not already sent today.
--
-- That split is deliberate. pg_cron runs in UTC, so a fixed nightly UTC
-- schedule would silently send at 6:55 for half the year and 8:55 for the
-- other half every time Texas changes clocks. It also means Race can move his
-- send time with an UPDATE instead of a schedule change, and that a poke lost
-- to a cold start is simply caught by the next one 15 minutes later.
--
-- The token is read from settings at call time rather than baked in, so
-- rotating it does not mean editing the job.
-- ===========================================================================

select cron.unschedule('daily-report')
 where exists (select 1 from cron.job where jobname = 'daily-report');

select cron.schedule(
  'daily-report',
  '*/15 * * * *',
  $job$
  select net.http_post(
    url     := 'https://akdncbzxiwvihfcyijvm.supabase.co/functions/v1/daily-report',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-report-token', (select daily_report_token::text from public.settings limit 1)
               ),
    body    := '{}'::jsonb
  );
  $job$
);

select jobid, jobname, schedule, active from cron.job order by jobid;

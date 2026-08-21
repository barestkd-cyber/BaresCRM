-- Run the billing engine once a day, early, in studio time.
--
-- Safe to schedule while the engine is OFF: with billing_engine_live false it
-- performs the whole run, writes nothing, and reports what it would have
-- charged. That means the cron is already proven by the time Race flips the
-- switch, rather than being the untested part on the first real billing day.
--
-- 08:00 America/Chicago is 13:00 UTC in CDT and 14:00 in CST. pg_cron runs on
-- UTC, so this fires at 13:00 UTC: 8am in summer, 7am in winter. Early enough
-- that a decline is discovered before the studio opens and late enough that
-- nobody is charged at 3am.
select cron.unschedule('charge-due') where exists (select 1 from cron.job where jobname = 'charge-due');

select cron.schedule('charge-due', '0 13 * * *', $job$
  select net.http_post(
    url     := 'https://akdncbzxiwvihfcyijvm.supabase.co/functions/v1/charge-due',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-billing-token', (select billing_token::text from public.settings limit 1)
               ),
    body    := '{}'::jsonb
  );
$job$);

select jobname, schedule, active from cron.job order by jobname;

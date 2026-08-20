-- ===========================================================================
-- Nightly report: settings + scheduling
-- ---------------------------------------------------------------------------
-- Replaces the Spark batch-settlement email Race got every night. Spec is his,
-- from 2026-08-18/19: sections are Money in today, Needs you, Tomorrow, New
-- contacts, in that order. NO attendance ("that's useless information in an
-- email"). A section with nothing in it does not render at all. Do NOT list
-- the day's classes. Send at 7:55 PM studio-local.
--
-- WHY THE SEND TIME LIVES HERE and not in the cron expression: pg_cron runs in
-- UTC, so a fixed UTC schedule would drift an hour every time Texas changes
-- clocks and would silently send at 6:55 or 8:55 for half the year. Instead
-- cron pokes the function every 15 minutes and the FUNCTION decides, comparing
-- the studio-local clock against these settings. That is DST-proof, it means
-- Race can move the send time without touching a schedule, and it self-heals:
-- if one poke fails, the next one still sends.
--
-- daily_report_last_sent is the guard that keeps that from sending 96 times.
--
-- Run:  supabase db query --linked -f sql/daily-report.sql
-- ===========================================================================

-- 1 ─ pg_net: what lets a scheduled job call an Edge Function over HTTP.
--     pg_cron was already installed; this was the missing half.
create extension if not exists pg_net;

-- 2 ─ the knobs, on the settings singleton
alter table public.settings
  add column if not exists daily_report_hour    integer not null default 19,
  add column if not exists daily_report_minute  integer not null default 55,
  add column if not exists daily_report_to      text,
  add column if not exists daily_report_last_sent date,
  add column if not exists daily_report_enabled boolean not null default true;

comment on column public.settings.daily_report_hour is
  'Studio-local hour (0-23) to send the nightly report. Owner picked 19 (7:55 PM).';
comment on column public.settings.daily_report_minute is
  'Studio-local minute. Cron polls every 15 min, so effective granularity is 15.';
comment on column public.settings.daily_report_to is
  'Where the report goes. NULL falls back to the same owner address receipts use.';
comment on column public.settings.daily_report_last_sent is
  'Studio-local date of the last successful send. The guard against re-sending.';

update public.settings
   set daily_report_hour = 19,
       daily_report_minute = 55
 where daily_report_hour is null or daily_report_minute is null;

select daily_report_enabled,
       daily_report_hour || ':' || lpad(daily_report_minute::text, 2, '0') as send_at_local,
       coalesce(daily_report_to, '(owner default)') as sends_to,
       coalesce(daily_report_last_sent::text, 'never') as last_sent,
       (select count(*) from pg_extension where extname = 'pg_net') as pg_net_installed
  from public.settings limit 1;

-- 3 ─ a shared token so only the scheduler can trigger a send. The function is
--     low-risk (it only ever mails the owner, never a caller-supplied address)
--     but an open endpoint that emails business figures on demand is still not
--     something to leave lying around.
alter table public.settings
  add column if not exists daily_report_token uuid not null default gen_random_uuid();

select 'token present: ' || (daily_report_token is not null)::text as token_check
  from public.settings limit 1;

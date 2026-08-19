-- ===========================================================================
-- Testing signup page: one live/not-live switch, and a soft deadline
-- ---------------------------------------------------------------------------
-- Owner, 2026-08-19: "dont close registration just say the deadline lol. its a
-- quasi deadline. lets not overengineer this. just a toggle for a page
-- live/not live. ill set it open when i want"
--
-- Three changes, all in the direction of less machinery:
--
-- 1. ONE switch, on the settings singleton, not per row and not per date.
--    The page is live or it is not. Race says the word and it flips.
--
-- 2. The deadline is DISPLAY TEXT, never a gate. Renamed closes_on ->
--    signup_by so nothing later reads the name and decides to enforce it. A
--    parent who signs up on the 28th still gets in; that is the owner's call
--    and it is how the Spark page has always actually worked.
--
-- 3. public_from is dropped. It was a GENERATED column, test_date - 28, which
--    opened every group four weeks ahead of its OWN date, so Cubs on the 28th
--    and Juniors on the 29th opened a day apart. That is the behaviour he
--    objected to, and the toggle replaces it. Nothing is lost: every value it
--    ever held was computed from test_date, which is still there.
--
-- WHICH GROUPS SHOW: those with test_date >= today, studio-local. Past
-- testings fall off on their own, so adding December's groups needs no cleanup
-- of August's and no notion of a "testing event" to group rows under.
--
-- Run:  supabase db query --linked -f sql/testing-page-toggle.sql
-- ===========================================================================

alter table public.settings
  add column if not exists testing_page_live boolean not null default false;

comment on column public.settings.testing_page_live is
  'Master switch for the public belt-testing signup page. Owner flips it; nothing else gates the page.';

do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='testing_dates'
                and column_name='closes_on')
     and not exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='testing_dates'
                and column_name='signup_by')
  then
    alter table public.testing_dates rename column closes_on to signup_by;
  end if;
end $$;

alter table public.testing_dates
  add column if not exists signup_by date;

comment on column public.testing_dates.signup_by is
  'SOFT deadline, shown to parents as text. Never enforced: signups stay open while the page is live.';

alter table public.testing_dates drop column if exists public_from;

-- verify --------------------------------------------------------------------
select (select testing_page_live from public.settings limit 1) as page_live,
       (select count(*) from public.testing_dates
         where test_date >= (now() at time zone 'America/Chicago')::date) as upcoming_groups,
       (select count(*) from information_schema.columns
         where table_schema='public' and table_name='testing_dates'
           and column_name='public_from') as public_from_still_there;

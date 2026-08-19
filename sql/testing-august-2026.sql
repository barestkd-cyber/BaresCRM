-- ===========================================================================
-- August 2026 belt testing: the groups a parent can sign up for
-- ---------------------------------------------------------------------------
-- Sources, in authority order:
--   1. Owner, 2026-08-19: "Testing is august 28th for cubs, august 29th 9:30am
--      for jr white-orange belts, 11am for jhnior green-black belts and all
--      teens/adults."
--   2. His CURRENT live Spark signup page (sparkpages.io/?i=_paHb), read
--      2026-08-19, which filled in three things he did not say out loud:
--      Cubs tests at 5:30 PM, there is a fourth paid option (Late Testing,
--      Tuesday September 1 at 5:30 PM, a flat $70), and registration closes
--      Thursday August 27.
--
-- Weekdays verified against the database, never assumed: 2026-08-28 is a
-- Friday, 2026-08-29 a Saturday, 2026-09-01 a Tuesday.
--
-- MODELLED AS ONE ROW PER GROUP. A group is what a parent actually signs up
-- for, because it is what tells them when to show up. The page has the parent
-- PICK their group from these plain-English labels rather than deriving it
-- from the student's belt: the parent knows their own child's belt, deriving
-- it needs the belt catalog plus a green-belt cutoff rule, and a wrong
-- derivation sends a family to the studio at the wrong hour.
--
-- fee_cents must be written EXPLICITLY because the column defaults to 6000:
--   NULL  -> the family ladder in pricing_settings applies (the three regular
--            groups, where seat 1 is $50 Cubs / $60 otherwise, then 50/30/10)
--   7000  -> Late Testing is a flat per-seat price and never laddered.
--
-- Run:  supabase db query --linked -f sql/testing-august-2026.sql
-- ===========================================================================

-- 1 ─ columns the groups need -----------------------------------------------
-- Pre-existing table, so explicit add-column-if-not-exists per the §19 gotcha.

alter table public.testing_dates
  add column if not exists start_time text,
  add column if not exists applies_to text,
  add column if not exists sort_order integer default 100,
  add column if not exists signup_by date;

comment on column public.testing_dates.applies_to is
  'Plain-English who-this-is-for, shown on the public signup page.';
comment on column public.testing_dates.fee_cents is
  'Per-seat price override. NULL means use the family ladder in pricing_settings.';
comment on column public.testing_dates.signup_by is
  'SOFT deadline shown to parents. Never enforced.';

-- 2 ─ the groups --------------------------------------------------------------
-- Idempotent on (label, test_date): a re-run updates rather than duplicating.

with g(label, test_date, start_time, applies_to, sort_order, fee_cents, signup_by) as (values
  ('Cubs',
   date '2026-08-28', '5:30 PM',
   'Cubs students. Friday, August 28 at 5:30 PM.',
   10, null::integer, date '2026-08-27'),
  ('Juniors, white through orange belt',
   date '2026-08-29', '9:30 AM',
   'Juniors with a white, yellow or orange belt. Saturday, August 29 at 9:30 AM.',
   20, null::integer, date '2026-08-27'),
  ('Juniors green belt and up, and all Teens and Adults',
   date '2026-08-29', '11:00 AM',
   'Juniors with a green belt or higher, plus every Teen and Adult student. Saturday, August 29 at 11:00 AM.',
   30, null::integer, date '2026-08-27'),
  ('Late Testing',
   date '2026-09-01', '5:30 PM',
   'For students who cannot make their scheduled group. Tuesday, September 1 at 5:30 PM.',
   40, 7000, date '2026-08-27')
)
insert into public.testing_dates (label, test_date, start_time, applies_to, sort_order, fee_cents, signup_by)
select g.label, g.test_date, g.start_time, g.applies_to, g.sort_order, g.fee_cents, g.signup_by
  from g
 where not exists (
   select 1 from public.testing_dates t
    where t.label = g.label and t.test_date = g.test_date
 );

with g(label, test_date, start_time, applies_to, sort_order, fee_cents, signup_by) as (values
  ('Cubs', date '2026-08-28', '5:30 PM',
   'Cubs students. Friday, August 28 at 5:30 PM.', 10, null::integer, date '2026-08-27'),
  ('Juniors, white through orange belt', date '2026-08-29', '9:30 AM',
   'Juniors with a white, yellow or orange belt. Saturday, August 29 at 9:30 AM.', 20, null::integer, date '2026-08-27'),
  ('Juniors green belt and up, and all Teens and Adults', date '2026-08-29', '11:00 AM',
   'Juniors with a green belt or higher, plus every Teen and Adult student. Saturday, August 29 at 11:00 AM.', 30, null::integer, date '2026-08-27'),
  ('Late Testing', date '2026-09-01', '5:30 PM',
   'For students who cannot make their scheduled group. Tuesday, September 1 at 5:30 PM.', 40, 7000, date '2026-08-27')
)
update public.testing_dates t
   set start_time = g.start_time,
       applies_to = g.applies_to,
       sort_order = g.sort_order,
       fee_cents  = g.fee_cents,
       signup_by  = g.signup_by
  from g
 where t.label = g.label and t.test_date = g.test_date;

-- 3 ─ verify -------------------------------------------------------------------
select label, test_date::text as on_date, to_char(test_date,'Dy') as dow,
       coalesce(start_time,'(time not set)') as at_time,
       coalesce(fee_cents::text,'ladder') as fee,
       signup_by::text as signup_by

  from public.testing_dates
 order by sort_order;

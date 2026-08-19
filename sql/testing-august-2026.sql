-- ===========================================================================
-- August 2026 belt testing: the three groups
-- ---------------------------------------------------------------------------
-- Owner, 2026-08-19: "Testing is august 28th for cubs, august 29th 9:30am for
-- jr white-orange belts, 11am for jhnior green-black belts and all
-- teens/adults."
--
-- Weekdays verified against the database, not assumed: 2026-08-28 is a Friday
-- and 2026-08-29 is a Saturday.
--
-- MODELLED AS THREE ROWS, ONE PER GROUP. A group is what a parent actually
-- signs up for, because it is what tells them when to show up. The page will
-- have the parent PICK their group from these three plain-English labels
-- rather than deriving it from the student's belt: the parent knows their own
-- child's belt, a derivation needs the belt catalog and a green-belt cutoff
-- rule, and a wrong derivation sends a family to the studio at the wrong hour.
--
-- fee_cents is left NULL on purpose, and must be written EXPLICITLY as null
-- because the column defaults to 6000. It is a per-event override; with NULL
-- the family ladder in pricing_settings applies (see sql/testing-checkout.sql).
--
-- public_from is NOT set here: it is a GENERATED column, `test_date - 28`, so
-- a testing becomes publicly visible four weeks ahead on its own. For these
-- two dates that fell on July 31 and August 1, both already past, so both
-- groups are visible the moment the page exists.
--
-- Run:  supabase db query --linked -f sql/testing-august-2026.sql
-- ===========================================================================

-- 1 ─ columns the groups need -----------------------------------------------
-- Pre-existing table, so explicit add-column-if-not-exists per the §19 gotcha.

alter table public.testing_dates
  add column if not exists start_time text,
  add column if not exists applies_to text,
  add column if not exists sort_order integer default 100;

comment on column public.testing_dates.applies_to is
  'Plain-English who-this-is-for, shown on the public signup page.';
comment on column public.testing_dates.fee_cents is
  'Per-event price override. NULL means use the family ladder in pricing_settings.';

-- 2 ─ the three August groups ------------------------------------------------
-- Idempotent on (label, test_date) so a re-run updates rather than duplicating.

insert into public.testing_dates (label, test_date, start_time, applies_to, sort_order, fee_cents)
select v.label, v.test_date, v.start_time, v.applies_to, v.sort_order, null
  from (values
    ('Cubs',
     date '2026-08-28', null,
     'Cubs students. Friday, August 28.',
     10),
    ('Juniors, white through orange belt',
     date '2026-08-29', '9:30 AM',
     'Juniors with a white, yellow or orange belt. Saturday, August 29 at 9:30 AM.',
     20),
    ('Juniors green belt and up, and all Teens and Adults',
     date '2026-08-29', '11:00 AM',
     'Juniors with a green belt or higher, plus every Teen and Adult student. Saturday, August 29 at 11:00 AM.',
     30)
  ) as v(label, test_date, start_time, applies_to, sort_order)
 where not exists (
   select 1 from public.testing_dates t
    where t.label = v.label and t.test_date = v.test_date
 );

update public.testing_dates t
   set start_time = v.start_time,
       applies_to = v.applies_to,
       sort_order = v.sort_order,
       fee_cents  = null
  from (values
    ('Cubs', date '2026-08-28', null,
     'Cubs students. Friday, August 28.', 10),
    ('Juniors, white through orange belt', date '2026-08-29', '9:30 AM',
     'Juniors with a white, yellow or orange belt. Saturday, August 29 at 9:30 AM.', 20),
    ('Juniors green belt and up, and all Teens and Adults', date '2026-08-29', '11:00 AM',
     'Juniors with a green belt or higher, plus every Teen and Adult student. Saturday, August 29 at 11:00 AM.', 30)
  ) as v(label, test_date, start_time, applies_to, sort_order)
 where t.label = v.label and t.test_date = v.test_date;

-- 3 ─ verify -----------------------------------------------------------------
select label, test_date::text as on_date,
       to_char(test_date, 'Dy') as weekday,
       coalesce(start_time, '(time not set)') as at_time,
       public_from::text as visible_from
  from public.testing_dates
 order by sort_order;

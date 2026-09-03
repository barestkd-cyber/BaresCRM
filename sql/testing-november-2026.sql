-- ===========================================================================
-- November 2026 testing, closing out Fall Cycle 2026.
--   Cubs        Fri 2026-11-13  5:30 PM
--   Juniors W-O Sat 2026-11-14  9:30 AM
--   Green+ / T+A Sat 2026-11-14 11:00 AM
--   Late        Tue 2026-11-17  5:30 PM   flat $70, never laddered
-- Awards Thu 2026-11-19 ends the cycle (CYCLES.md).
-- Weekdays verified against a calendar, not assumed.
--
-- fee_cents must be explicit: the column defaults to 6000, and NULL is what
-- means "use the family ladder in pricing_settings".
-- Idempotent on (label, test_date).
-- ===========================================================================
with g(label, test_date, start_time, applies_to, sort_order, fee_cents, signup_by, program) as (values
  ('Cubs', date '2026-11-13', '5:30 PM',
   'Cubs students. Friday, November 13 at 5:30 PM.', 10, null::integer, date '2026-11-12', 'Cubs'),
  ('Juniors, White through Orange Belt', date '2026-11-14', '9:30 AM',
   'Juniors with a White, Yellow or Orange Belt. Saturday, November 14 at 9:30 AM.', 20, null::integer, date '2026-11-12', 'TKD'),
  ('Juniors Green Belt and up, and all Teens and Adults', date '2026-11-14', '11:00 AM',
   'Juniors with a Green Belt or higher, plus every Teen and Adult student. Saturday, November 14 at 11:00 AM.', 30, null::integer, date '2026-11-12', 'TKD'),
  ('Late Testing', date '2026-11-17', '5:30 PM',
   'For students who cannot make their scheduled group. Tuesday, November 17 at 5:30 PM.', 40, 7000, date '2026-11-12', 'Any')
)
insert into public.testing_dates (label, test_date, start_time, applies_to, sort_order, fee_cents, signup_by, program)
select g.* from g
 where not exists (select 1 from public.testing_dates t
                    where t.label = g.label and t.test_date = g.test_date);

select td.label, td.test_date::text as on_date,
       to_char(td.test_date,'Dy') as dow, td.start_time,
       coalesce(td.fee_cents::text,'ladder') as fee,
       (select count(*) from public.testing_signups s where s.testing_date_id = td.id) as signups
  from public.testing_dates td
 where td.test_date >= current_date
 order by td.test_date, td.sort_order;

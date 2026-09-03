-- ===========================================================================
-- Whether a testing is taking signups, decided per testing instead of by the
-- calendar (owner, 2026-09-03: "Keep it dark for now. Keep the August one
-- live in case somebody still has to pay me.")
--
-- The page used to show every testing_date in the FUTURE, which meant adding
-- November dates opened them for sale the same instant, and August closed
-- itself the day it passed. Neither was a decision anyone made.
--
-- Now: signups_open is the gate. A past testing can stay open for late
-- payment; a future one stays dark until it is announced.
-- ===========================================================================
alter table public.testing_dates
  add column if not exists signups_open boolean not null default false;

comment on column public.testing_dates.signups_open is
  'Does the public checkout page offer this testing? Decided per testing, not by its date, so a past testing can stay open for late payment.';

-- August stays open: people still owe for it.
update public.testing_dates set signups_open = true  where test_date < date '2026-10-01';
-- November stays dark until he announces it.
update public.testing_dates set signups_open = false where test_date >= date '2026-10-01';

select label, test_date::text as on_date, signups_open,
       (select count(*) from public.testing_signups s where s.testing_date_id = testing_dates.id) as signups
  from public.testing_dates order by test_date, sort_order;

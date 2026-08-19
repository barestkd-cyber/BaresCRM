-- ===========================================================================
-- Which program each testing group belongs to
-- ---------------------------------------------------------------------------
-- Two things depend on this and neither should be guessed from the label text:
--
--   1. PRICE. Seat 1 of a family pays the program rate: $50 Cubs, $60 anyone
--      else. Sniffing the word "Cub" out of a label would mean a renamed group
--      silently repricing.
--   2. WHICH BELT LIST the parent picks their student's rank from. Cubs run a
--      completely separate ladder (owner, 2026-08-19): White, Yellow, Orange,
--      Green, Purple, Blue, Brown, Red, Black, 2nd Degree Cub Black. It does
--      not appear in portal/shared/belts.js at all, which only carries the
--      32-rank TKD ladder.
--
-- 'Any' means show both ladders: Late Testing is the catch-up slot and either
-- kind of student can be in it.
--
-- Run:  supabase db query --linked -f sql/testing-group-program.sql
-- ===========================================================================

alter table public.testing_dates
  add column if not exists program text;

comment on column public.testing_dates.program is
  'Cubs | TKD | Any. Drives the seat-1 price and which belt ladder the signup page offers.';

update public.testing_dates set program = 'Cubs' where label = 'Cubs';
update public.testing_dates set program = 'TKD'  where label like 'Juniors%';
update public.testing_dates set program = 'Any'  where label = 'Late Testing';
update public.testing_dates set program = 'TKD'  where program is null;

select label, program, test_date::text as on_date,
       coalesce(start_time,'-') as at_time,
       coalesce(fee_cents::text,'ladder') as fee
  from public.testing_dates order by sort_order;

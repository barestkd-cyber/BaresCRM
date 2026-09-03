-- ===========================================================================
-- Stripe specification migration (spec confirmed by owner 2026-09-03)
-- ---------------------------------------------------------------------------
-- 1. Fold the retired stripe keys onto their new categories. The catalogue
--    now uses ONE one-step per belt (spec section 5 explicitly retires the
--    two-gray-stripe idea), so one-step-1 and one-step-2 both become
--    'one-step'. Done now while the table holds two rows; after the handout
--    goes out this would be rewriting real history.
-- 2. cycle_id on an earned stripe. Red, Purple, Orange and (from Green up)
--    Green rotate school-wide every 10 weeks, so "has a Red stripe" is not
--    the same question as "has completed the CURRENT self-defense
--    curriculum". Without the cycle stamped at award time that second
--    question - the one section 10 asks - cannot be answered at all.
--    Nullable on purpose: rows earned before today keep an honest null.
-- ===========================================================================

update public.student_stripes set stripe_key = 'one-step'
 where stripe_key in ('one-step-1','one-step-2');

update public.student_stripes set stripe_key = 'stances'
 where stripe_key like '%--stripe-1-stances%';

alter table public.student_stripes
  add column if not exists cycle_id uuid references public.cycle_data(id);

comment on column public.student_stripes.cycle_id is
  'The 10-week cycle this stripe was earned in. Null for rows predating the stamp. Never rewritten - it says which rotation the student actually completed.';

create index if not exists student_stripes_cat_idx
  on public.student_stripes (stripe_key, cycle_id);

select stripe_key, belt, source, coalesce(cycle_id::text,'(none)') as cycle
  from public.student_stripes order by belt;

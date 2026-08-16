-- ============================================================================
-- BaresTKD — Little Kickers goes on sale
-- ----------------------------------------------------------------------------
-- Run ONCE in the Supabase SQL editor. Safe to re-run (inserts are guarded).
--
-- Adds the two rows the Little Kickers checkout page sells from:
--   * the 6-week session plan, $109 paid in full at enrollment
--   * the optional t-shirt, $25 (taxable, like all merchandise)
--
-- The lk-checkout function and the POS both price FROM THESE ROWS — change
-- the price here and every surface follows. Session DATES are not stored
-- here; the current cohort lives in the lk-checkout function config.
-- ============================================================================

-- Session plans expire; the column already exists in live projects that ran
-- the POS builds, and this guard makes the file self-sufficient anywhere else.
alter table public.pricing_plans add column if not exists duration_weeks integer;
alter table public.pricing_plans add column if not exists sellable boolean not null default true;

insert into public.pricing_plans
  (code, name, program, category, billing_frequency, recurring_cents, down_cents,
   payment_count, pif_cents, family_position, supports_household_discount,
   promo_label, description, display_order, sellable, duration_weeks)
values
  ('little_kickers_session', 'Little Kickers — 6-Week Session', 'Little Kickers',
   'other', 'one_time', null, 0, null, 10900, null, false,
   'Belt & first stripe included',
   'Six-week Little Kickers session (ages 2–3 with a parent), paid in full at enrollment.',
   40, true, 6)
on conflict (code) do nothing;

-- The t-shirt add-on. products has no unique name key, so guard by hand.
insert into public.products (name, price_cents, taxable, active, display_order)
select 'Little Kickers T-Shirt', 2500, true, true, 210
where not exists (select 1 from public.products where name = 'Little Kickers T-Shirt');

-- Sanity: both rows visible?
select code, name, pif_cents, duration_weeks from public.pricing_plans where code = 'little_kickers_session';
select name, price_cents, taxable from public.products where name = 'Little Kickers T-Shirt';

-- ─── ROLLBACK (commented) ───────────────────────────────────────────────────
-- delete from public.products      where name = 'Little Kickers T-Shirt';
-- delete from public.pricing_plans where code = 'little_kickers_session';

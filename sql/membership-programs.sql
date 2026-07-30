-- ============================================================================
-- BaresTKD — Program-first catalog migration
-- ----------------------------------------------------------------------------
-- Run ONCE in the Supabase SQL editor, AFTER membership-schema.sql.
-- Safe to re-run (renames no-op once applied, inserts are on-conflict).
--
-- What this does, per Mr. Bares' direction:
--   1. Juniors TKD and Teens/Adults TKD become SEPARATE programs with their
--      own catalog rows. Prices start identical but are independent forever.
--   2. Every row gets a `program` stamp (the sales bucket it belongs to).
--   3. Adds `sellable`: sellable=true rows are pitchable products; sellable=
--      false rows are the ENGINE'S RATE TABLE (family positions, TKD-member
--      rates, weekly bundles). "Add-on" is a price, not a product — the
--      pricing engine picks these rows automatically; the UI never sells
--      them directly.
-- ============================================================================

alter table pricing_plans add column if not exists sellable boolean not null default true;

-- ─── 1) The shared core-TKD rows become the JUNIORS set ─────────────────────
update pricing_plans set code='juniors_pif',               name='Juniors Taekwondo — Paid in Full',       program='Juniors' where code='tkd_pif';
update pricing_plans set code='juniors_option_b',          name='Juniors Taekwondo — Option B',           program='Juniors' where code='tkd_option_b';
update pricing_plans set code='juniors_option_c',          name='Juniors Taekwondo — Option C',           program='Juniors' where code='tkd_option_c';
update pricing_plans set code='juniors_option_d',          name='Juniors Taekwondo — Option D',           program='Juniors' where code='tkd_option_d';
update pricing_plans set code='juniors_weekly',            name='Juniors Taekwondo — Weekly',             program='Juniors' where code='tkd_weekly';
update pricing_plans set code='juniors_family_second',     name='Juniors Taekwondo — 2nd family member',  program='Juniors' where code='tkd_family_second';
update pricing_plans set code='juniors_family_third_plus', name='Juniors Taekwondo — 3rd+ family member', program='Juniors' where code='tkd_family_third_plus';

-- ─── 2) TEENS/ADULTS set (same prices today; independent from now on) ───────
insert into pricing_plans
  (code, name, program, category, billing_frequency, recurring_cents, down_cents,
   payment_count, pif_cents, family_position, supports_household_discount,
   promo_label, description, display_order)
values
  ('adults_pif',               'Teens/Adults Taekwondo — Paid in Full',       'Teens/Adults', 'core_tkd', 'one_time', null,  0,     null, 140000, null, false, null, 'One payment, full program.',                  17),
  ('adults_option_b',          'Teens/Adults Taekwondo — Option B',           'Teens/Adults', 'core_tkd', 'monthly',  9500,  35900, 12,   null,   null, false, null, 'Higher down payment, lowest monthly.',        18),
  ('adults_option_c',          'Teens/Adults Taekwondo — Option C',           'Teens/Adults', 'core_tkd', 'monthly',  11000, 25900, 12,   null,   null, false, null, 'Balanced down payment and monthly.',          19),
  ('adults_option_d',          'Teens/Adults Taekwondo — Option D',           'Teens/Adults', 'core_tkd', 'monthly',  12900, 12900, 12,   null,   null, false, null, 'Lowest down payment, highest monthly.',       20),
  ('adults_weekly',            'Teens/Adults Taekwondo — Weekly',             'Teens/Adults', 'core_tkd', 'weekly',   3395,  0,     null, null,   null, false, null, 'Pay weekly, no contract.',                    21),
  ('adults_family_second',     'Teens/Adults Taekwondo — 2nd family member',  'Teens/Adults', 'core_tkd', 'monthly',  11900, 0,     null, null,   2,    false, null, 'Second household member in Taekwondo.',       22),
  ('adults_family_third_plus', 'Teens/Adults Taekwondo — 3rd+ family member', 'Teens/Adults', 'core_tkd', 'monthly',  7900,  0,     null, null,   3,    false, null, 'Third and each additional household member.', 23)
on conflict (code) do nothing;

-- ─── 3) Program stamps on everything else ───────────────────────────────────
update pricing_plans set program='Kickboxing'             where code in ('specialty_kickboxing','addon_kickboxing') and (program is null or program<>'Kickboxing');
update pricing_plans set program='Jiu Jitsu'              where code in ('specialty_jiujitsu','addon_jiujitsu')     and (program is null or program<>'Jiu Jitsu');
update pricing_plans set program='Kickboxing + Jiu Jitsu' where code in ('specialty_both','addon_both','specialty_dropin');
-- Weekly bundles are Teens/Adults rates (specialties are 13+).
update pricing_plans set program='Teens/Adults'           where category='weekly_bundle';
-- ampd_addon already carries program 'AMP''D' from the seed.

-- ─── 4) Rate rows are engine-internal, never sold directly ──────────────────
update pricing_plans set sellable=false
 where family_position is not null
    or category in ('addon','weekly_bundle');

-- ============================================================================
-- ROLLBACK (commented). Reverses this migration only, not the base schema.
-- ============================================================================
-- update pricing_plans set code='tkd_pif',               name='Taekwondo — Paid in Full',       program=null where code='juniors_pif';
-- update pricing_plans set code='tkd_option_b',          name='Taekwondo — Option B',           program=null where code='juniors_option_b';
-- update pricing_plans set code='tkd_option_c',          name='Taekwondo — Option C',           program=null where code='juniors_option_c';
-- update pricing_plans set code='tkd_option_d',          name='Taekwondo — Option D',           program=null where code='juniors_option_d';
-- update pricing_plans set code='tkd_weekly',            name='Taekwondo — Weekly',             program=null where code='juniors_weekly';
-- update pricing_plans set code='tkd_family_second',     name='Taekwondo — 2nd family member',  program=null where code='juniors_family_second';
-- update pricing_plans set code='tkd_family_third_plus', name='Taekwondo — 3rd+ family member', program=null where code='juniors_family_third_plus';
-- delete from pricing_plans where code like 'adults\_%' escape '\';
-- alter table pricing_plans drop column if exists sellable;

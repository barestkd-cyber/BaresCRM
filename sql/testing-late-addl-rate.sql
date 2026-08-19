-- ===========================================================================
-- Late Testing: $70 for the first family member, $60 for each additional
-- ---------------------------------------------------------------------------
-- Owner, 2026-08-19: "2nd + late tester can be 60".
--
-- Until now fee_cents was a FLAT per-event override that ignored family
-- position entirely, which is why Late Testing charged $70 to everyone. That
-- was right when it was the answer to "does Late Testing ladder?", and it is
-- wrong now: a second child testing late gets a break, just a smaller one than
-- the regular ladder gives.
--
-- So an event override is now a PAIR:
--   fee_cents       what the first family member pays
--   fee_addl_cents  what every later family member pays (NULL = same as first)
--
-- The regular groups leave both NULL and keep using the ladder in
-- pricing_settings ($50/$60 first, then 50/30/10).
--
-- Also settles the tax question. Owner: "yioure right no tax on service." The
-- web checkout already books testing fees untaxed; this flips the catalog's
-- "Testing fee" product to match so a testing sold at the POS is not taxed
-- 8.25% while the same testing sold online is not.
--
-- Run:  supabase db query --linked -f sql/testing-late-addl-rate.sql
-- ===========================================================================

alter table public.testing_dates
  add column if not exists fee_addl_cents integer;

comment on column public.testing_dates.fee_cents is
  'Per-event price for the FIRST family member. NULL means use the ladder in pricing_settings.';
comment on column public.testing_dates.fee_addl_cents is
  'Per-event price for each ADDITIONAL family member. NULL means they pay fee_cents too.';

update public.testing_dates
   set fee_addl_cents = 6000
 where label = 'Late Testing' and test_date = date '2026-09-01';

-- A belt testing is a service, not goods. The web page has always booked it
-- untaxed; this is the POS catching up.
update public.products
   set taxable = false
 where name ilike '%testing fee%';

select label,
       coalesce(fee_cents::text, 'ladder')      as first_seat,
       coalesce(fee_addl_cents::text, 'same')   as later_seats
  from public.testing_dates
 order by sort_order;

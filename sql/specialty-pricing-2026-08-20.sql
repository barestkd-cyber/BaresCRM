-- ===========================================================================
-- Specialty pricing: $99 alone, $129 for both
-- ---------------------------------------------------------------------------
-- Owner, 2026-08-20: "no alone 99 and both 129". A single specialty rises from
-- $89 to $99; the two together are $129, so the second discipline is $30
-- rather than a full second fee. He priced it on mat capacity: "these spots on
-- the mat are special and twice a week is plenty."
--
-- TKD member add-on rates are NOT touched. Those are the rates a Taekwondo
-- member already pays for a specialty and he did not change them.
--
-- Repricing never touches a sold membership: those are frozen snapshots, which
-- is exactly why the catalog is safe to edit.
--
-- Run:  supabase db query --linked -f sql/specialty-pricing-2026-08-20.sql
-- ===========================================================================

update public.pricing_plans set recurring_cents = 9900
 where code in ('specialty_kickboxing', 'specialty_jiujitsu');

update public.pricing_plans set recurring_cents = 12900
 where code = 'specialty_both';

select name, code, '$' || (recurring_cents / 100.0)::numeric(10,2)::text as price, sellable
  from public.pricing_plans
 where code in ('specialty_kickboxing','specialty_jiujitsu','specialty_both',
                'addon_kickboxing','addon_jiujitsu','addon_both','ampd_addon')
 order by sellable desc, recurring_cents;

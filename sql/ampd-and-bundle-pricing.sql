-- ===========================================================================
-- AMP'D standalone, and the specialty bundle at $129
-- ---------------------------------------------------------------------------
-- Owner, 2026-08-20: "ampd is 50 a month, lets do kb and jiu jitsu at 129
-- together. 4 classes a month for 129 is reasonable. then 89 for one?"
--
-- AMP'D: $50 a month for everyone. There is no member-versus-stranger rate, so
-- the single existing plan is simply the price. The row was NAMED "Add-on",
-- which was fine while only the POS could see it and is wrong the moment a
-- public page prints it, so it is renamed. The code stays `ampd_addon`;
-- nothing outside this rename depends on the display name.
--
-- Bundle: Kickboxing + Jiu Jitsu together goes $119 -> $99. A single
-- specialty stays $89, which is what it already was, so no change there.
-- Corrected the same day from an initial $129: the owner priced it on mat
-- capacity rather than on class count. "These spots on the mat are special and
-- twice a week is plenty."
--
-- Repricing a plan NEVER touches an existing membership: sold memberships are
-- frozen snapshots, which is exactly why the catalog can be edited freely.
--
-- Run:  supabase db query --linked -f sql/ampd-and-bundle-pricing.sql
-- ===========================================================================

update public.pricing_plans
   set name = 'AMP''D — Monthly'
 where code = 'ampd_addon';

update public.pricing_plans
   set recurring_cents = 9900
 where code = 'specialty_both';

select program, code, name, billing_frequency,
       coalesce(recurring_cents, pif_cents) as cents, sellable
  from public.pricing_plans
 where code in ('ampd_addon','specialty_both','specialty_kickboxing','specialty_jiujitsu','addon_both')
 order by program, code;

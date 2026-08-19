-- ===========================================================================
-- Belt ranks are proper nouns: "Orange Belt", not "orange belt"
-- ---------------------------------------------------------------------------
-- Owner, 2026-08-19: "ranks are capital so Orange Belt etc."
--
-- The rank NAMES the page offers were already correct (they come verbatim from
-- portal/shared/belts.js and match contacts.rank). What was lowercase was the
-- prose around them: the group labels and their descriptions, written as
-- ordinary sentences rather than as the rank names they actually are.
--
-- Stripe counts are left alone on purpose. "2 or more black stripes" is a
-- count of stripes, not a rank, so black stays lowercase there.
--
-- Run:  supabase db query --linked -f sql/testing-rank-capitalisation.sql
-- ===========================================================================

update public.testing_dates
   set label = 'Juniors, White through Orange Belt',
       applies_to = 'Juniors with a White, Yellow or Orange Belt. Saturday, August 29 at 9:30 AM.'
 where test_date = date '2026-08-29' and label = 'Juniors, white through orange belt';

update public.testing_dates
   set label = 'Juniors Green Belt and up, and all Teens and Adults',
       applies_to = 'Juniors with a Green Belt or higher, plus every Teen and Adult student. Saturday, August 29 at 11:00 AM.'
 where test_date = date '2026-08-29' and label = 'Juniors green belt and up, and all Teens and Adults';

select label, applies_to from public.testing_dates order by sort_order;

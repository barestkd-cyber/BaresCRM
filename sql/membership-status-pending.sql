-- A membership must be able to exist WITHOUT being active. Everything the
-- enrollment checkouts write happens before the card clears, so an abandoned
-- or declined checkout used to leave a fully active member who paid nothing,
-- and that ghost counted toward the next sibling's family discount because
-- BTKDPricing.isQualifying only asks whether the status is 'active'.
--
-- 'pending' is the state between "they filled the form" and "the money
-- landed". Nothing else has to change: every existing check for 'active'
-- keeps working, and a pending row simply is not one.
alter type membership_status add value if not exists 'pending';

select string_agg(e.enumlabel, ', ' order by e.enumsortorder) as membership_status
  from pg_type t join pg_enum e on e.enumtypid = t.oid
 where t.typname = 'membership_status';

-- ===========================================================================
-- Emerson Allen: the same backfill the other 92 got
-- ---------------------------------------------------------------------------
-- She was created in the CRM on 2026-07-21 and carries no spark_id, so the
-- spark_id-keyed backfill skipped her. spark_id is a migration key and not an
-- identity (owner, 2026-08-22: "that was for matching imports, not needed
-- once spark is dumped"), so she is matched here by name and date of birth
-- instead. There is exactly one Emerson Allen, and her date of birth already
-- on file agrees with the export, which is what makes the name safe to use.
--
-- coalesce as everywhere else: nothing already known is touched.
-- ===========================================================================

update public.contacts set
  gender     = coalesce(gender,     'Female'),
  address    = coalesce(address,    '6109 Havens Trail Tyler, TX 75707'),
  entered_on = coalesce(entered_on, '2026-08-07'::date),
  phone      = coalesce(phone,      '2147636106')
where first_name = 'Emerson' and last_name = 'Allen'
  and dob = '2019-03-01'::date;

select first_name||' '||last_name as who, dob::text as dob, gender, phone,
       address, entered_on::text as entered
from public.contacts where first_name = 'Emerson' and last_name = 'Allen';

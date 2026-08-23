-- ===========================================================================
-- Take a parent's address off a child's contact record
-- ---------------------------------------------------------------------------
-- Owner, 2026-08-23: "emerson doesnt have her own address?" She does not.
-- carltonallen89@ was sitting in her contact's own email field, so the send
-- rule read it as hers and returned it as "own" - the right inbox for the
-- wrong reason, and her profile claimed an address she has never had.
--
-- She is one of fourteen. Nothing is lost: every one of these addresses is
-- already on the guardian record it belongs to, which is where the send rule
-- and the profile both read it from now.
--
-- MINORS ONLY, and only where the address demonstrably belongs to a guardian.
-- An adult whose own address is also their guardian row - Laura Castagnola,
-- Hillary Fort, Lacy Musslewhite - is correct and untouched. So is Danica
-- Riggle, whose record carries Matt's: a married couple sharing an address is
-- ordinary, and guessing otherwise would take away the only address she has.
--
-- The old value is kept in a note rather than thrown away, so nothing here is
-- unrecoverable if a child turns out to have genuinely used a parent address.
-- ===========================================================================

update public.contacts c
set email = null,
    tags = array_remove(coalesce(c.tags, '{}'), 'email-was-a-guardians')
           || array['email-was-a-guardians: ' || c.email]
where c.email is not null
  and c.dob is not null
  and date_part('year', age(c.dob)) < 18
  and exists (
    select 1 from public.guardian_emails ge
    where lower(ge.email) = lower(c.email)
  );

select count(*) filter (where email is null) as cleared_now,
       count(*) as minors_with_a_guardian_address
from public.contacts c
where c.dob is not null and date_part('year', age(c.dob)) < 18
  and exists (select 1 from public.contacts c2 where c2.id = c.id
              and (c2.tags is not null and array_to_string(c2.tags,',') like '%email-was-a-guardians%'));

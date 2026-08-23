-- ===========================================================================
-- Staff can read and write guardians
-- ---------------------------------------------------------------------------
-- Owner, 2026-08-22, on finding both Allen guardians invisible in the CRM
-- while sitting in the database the whole time.
--
-- student_guardians had RLS on and exactly two SELECT policies, both written
-- for the PARENT side of the portal: one for a parent seeing their own
-- children, one matching a guardian's email against the caller's login. There
-- was no staff policy at all, so the CRM could only ever show Race guardian
-- rows carrying HIS OWN email address. Every other family's guardians read as
-- "No guardian on file", and the CRM does not check the error, so an empty
-- result rendered as a confident answer.
--
-- Guardian rows have only ever been written by Edge Functions using the
-- service key, which bypasses RLS. Staff need write access too, or importing
-- or correcting a guardian from the CRM is impossible.
--
-- Matches the house pattern already used on contacts, households and
-- household_members: one ALL policy gated on is_staff().
-- ===========================================================================

drop policy if exists student_guardians_staff_all on public.student_guardians;
create policy student_guardians_staff_all on public.student_guardians
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

select policyname, cmd, qual
from pg_policies
where schemaname='public' and tablename='student_guardians'
order by policyname;

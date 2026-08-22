-- ===========================================================================
-- Last visit per student, for the Members list and the At-risk chip/tile.
-- ---------------------------------------------------------------------------
-- One row per student who has EVER checked in: max(class_date). The CRM used
-- to read only the last 90 days of attendance, so anyone absent longer than
-- that (or who never came) had no "last visit" at all and was silently left
-- OUT of "At risk". Now "never" and "months ago" both count.
--
-- security_invoker: the view runs with the caller's own rights, so the RLS
-- on attendance still applies (staff see everyone; nobody else sees more
-- than they already could).
--
-- Run:  supabase db query --linked -f sql/contact-last-visit.sql
-- ===========================================================================
create or replace view public.contact_last_visit
  with (security_invoker = true) as
  select student_id, max(class_date) as last_date
    from public.attendance
   group by student_id;

grant select on public.contact_last_visit to authenticated;

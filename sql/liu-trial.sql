-- Read-only: who is "Liu" with a trial booked for tomorrow (2026-09-01)?
-- Need the child's name, the parent's name/email, and the booked time so the
-- email says the right thing.
select 'CONTACT' as probe, c.id::text as a,
       c.first_name || ' ' || c.last_name as b,
       coalesce(c.email,'(no email)') as c2,
       coalesce(c.segment::text,'') || ' · dob ' || coalesce(c.dob::text,'?') as d
  from public.contacts c
 where c.first_name ilike '%liu%' or c.last_name ilike '%liu%'
union all
select 'GUARDIAN', g.id::text, coalesce(g.name,'(nameless)'),
       coalesce((select string_agg(ge.email,', ') from public.guardian_emails ge
                  where ge.guardian_id = g.id),'(no email)'),
       coalesce(sg.label,'') || ' → ' || coalesce(k.first_name || ' ' || k.last_name,'?')
  from public.guardians g
  left join public.student_guardians sg on sg.guardian_id = g.id
  left join public.contacts k on k.id = sg.student_id
 where g.name ilike '%liu%'
    or exists (select 1 from public.contacts c2
                where c2.id = sg.student_id and c2.last_name ilike '%liu%')
 order by 1, 2;

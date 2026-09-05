-- One row per (guardian email, student) for active students, so each family
-- gets a sheet naming the exact address their account must use and carrying
-- a check-in code per child. QR value is contacts.id, same as the kiosk scans.
select
  lower(trim(ge.email))                         as family_email,
  coalesce(nullif(trim(g.name),''), 'Family')   as guardian,
  c.id::text                                    as student_id,
  trim(c.first_name || ' ' || c.last_name)      as student,
  coalesce(c.rank,'')                           as rank
from public.guardians g
join public.guardian_emails ge  on ge.guardian_id = g.id
join public.student_guardians sg on sg.guardian_id = g.id
join public.contacts c           on c.id = sg.student_id
where c.segment = 'active'
  and coalesce(ge.email,'') like '%@%'
order by family_email, student;

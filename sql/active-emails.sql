-- Every email that reaches an ACTIVE family: the student's own address, plus
-- every guardian address linked to an active student. Kids mostly carry no
-- email, so the guardian side is where most of these live.
select distinct lower(trim(e)) as email
  from (
    select c.email as e
      from public.contacts c
     where c.segment = 'active' and coalesce(c.email,'') <> ''
    union all
    select ge.email
      from public.contacts c
      join public.student_guardians sg on sg.student_id = c.id
      join public.guardian_emails ge on ge.guardian_id = sg.guardian_id
     where c.segment = 'active' and coalesce(ge.email,'') <> ''
    union all
    select sg.email
      from public.contacts c
      join public.student_guardians sg on sg.student_id = c.id
     where c.segment = 'active' and coalesce(sg.email,'') <> ''
  ) x
 where e like '%@%'
 order by 1;

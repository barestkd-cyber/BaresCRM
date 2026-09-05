-- Everyone who tested, with every email that reaches them: their own address
-- if they have one (adults do), plus every guardian address linked to them.
select distinct
  c.id::text                                as student_id,
  trim(c.first_name || ' ' || c.last_name)  as student,
  coalesce(c.rank,'')                       as rank,
  lower(trim(e.email))                      as email,
  coalesce(e.who,'')                        as who
from public.testing_signups ts
join public.contacts c on c.id = ts.contact_id
join lateral (
  select c.email as email, '' as who
  union all
  select ge.email, coalesce(g.name,'')
    from public.student_guardians sg
    join public.guardian_emails ge on ge.guardian_id = sg.guardian_id
    left join public.guardians g on g.id = sg.guardian_id
   where sg.student_id = c.id
) e on true
where coalesce(e.email,'') like '%@%'
order by student, email;

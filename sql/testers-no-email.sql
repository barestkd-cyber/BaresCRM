select trim(c.first_name||' '||c.last_name) as student, coalesce(c.rank,'') as rank
  from public.testing_signups ts
  join public.contacts c on c.id = ts.contact_id
 where not exists (select 1 from public.student_guardians sg
                     join public.guardian_emails ge on ge.guardian_id=sg.guardian_id
                    where sg.student_id=c.id and coalesce(ge.email,'') like '%@%')
   and coalesce(c.email,'') not like '%@%'
 order by 1;

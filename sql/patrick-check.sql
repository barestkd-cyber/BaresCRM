select 'contact' as t,
       (select c.id::text||' email='||coalesce(nullif(c.email,''),'(none)')
          from contacts c where c.first_name='Patrick' and c.last_name='Larano') as v
union all
select 'guardians',
       coalesce((select string_agg(g.name||' <'||
         coalesce((select string_agg(ge.email,',') from guardian_emails ge where ge.guardian_id=g.id),'-')||'>',' | ')
          from student_guardians sg join guardians g on g.id=sg.guardian_id
          join contacts c on c.id=sg.student_id
         where c.first_name='Patrick' and c.last_name='Larano'),'none')
union all
select 'household',
       coalesce((select h.id::text||' primary='||coalesce(h.primary_guardian_id::text,'none')
          from household_members hm join households h on h.id=hm.household_id
          join contacts c on c.id=hm.contact_id
         where c.first_name='Patrick' and c.last_name='Larano'),'not in a household')
union all
select 'is his email taken',
       coalesce((select 'yes, guardian '||coalesce(nullif(g.name,''),'(unnamed)')
          from guardian_emails ge join guardians g on g.id=ge.guardian_id
         where lower(ge.email)='florencepatricklarano@yahoo.com'),'no');

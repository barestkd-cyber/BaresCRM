select 'NEWSOM' as probe, trim(c.first_name||' '||c.last_name) as a,
       coalesce(c.email,'(none)') as b, c.segment::text as c2, c.id::text as d
  from public.contacts c where c.last_name ilike '%newsom%'
union all
select 'NEWSOM-GUARDIAN', coalesce(g.name,'(nameless)'), ge.email,
       coalesce(trim(k.first_name||' '||k.last_name),'(no kid)'), coalesce(sg.label,'')
  from public.guardians g
  join public.guardian_emails ge on ge.guardian_id = g.id
  left join public.student_guardians sg on sg.guardian_id = g.id
  left join public.contacts k on k.id = sg.student_id
 where g.name ilike '%newsom%' or ge.email ilike '%newsom%'
union all
select 'APPLE', trim(c.first_name||' '||c.last_name), coalesce(c.email,'(none)'),
       c.segment::text, c.id::text
  from public.contacts c where c.last_name ilike 'apple'
union all
select 'APPLE-GUARDIAN', coalesce(g.name,'(nameless)'), ge.email,
       coalesce(trim(k.first_name||' '||k.last_name),'(no kid)'), coalesce(sg.label,'')
  from public.guardians g
  join public.guardian_emails ge on ge.guardian_id = g.id
  left join public.student_guardians sg on sg.guardian_id = g.id
  left join public.contacts k on k.id = sg.student_id
 where g.name ilike '%apple%' or ge.email ilike '%apple%'
 order by 1,2;

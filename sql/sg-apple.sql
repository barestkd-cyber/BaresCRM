select 'LINK' as probe,
       coalesce(trim(k.first_name||' '||k.last_name),'?') as student,
       coalesce(g.name,'(nameless)') as guardian,
       coalesce(nullif(trim(sg.email),''),'(NULL on the link)') as link_email,
       coalesce(sg.label,'') as label
  from public.student_guardians sg
  left join public.contacts k on k.id = sg.student_id
  left join public.guardians g on g.id = sg.guardian_id
 where k.last_name ilike 'apple' or k.last_name ilike '%newsom%'
union all
select 'FN', pg_get_functiondef(oid), '', '', ''
  from pg_proc where proname = 'my_student_ids'
 order by 1, 2;

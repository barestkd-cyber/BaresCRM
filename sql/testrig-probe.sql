-- Read-only: is `students` a table or a view over contacts (the curriculum
-- check-in reads it by contact id)? And what meets today, Wednesday (day=2)?
select 'STUDENTS' as probe, table_type as a, '' as b, '' as c
  from information_schema.tables
 where table_schema='public' and table_name='students'
union all
select 'VIEWDEF', left(view_definition, 300), '', ''
  from information_schema.views
 where table_schema='public' and table_name='students'
union all
select 'WEDCLASS', coalesce(label,''), coalesce(prog_css,''),
       coalesce(time,'')||' · belt '||coalesce(belt,'-')
  from public.schedule_template where day = 2
union all
select 'JUNKROW', c.id::text, c.first_name||' '||c.last_name, coalesce(c.email,'')
  from public.contacts c where c.email ilike '%rocketlauncher%'
 order by 1,2;

-- Read-only: is attendance.source an enum (needs a migration to add 'kiosk')
-- or free text? And is there anything signed up under rocketlauncher500?
select 'SRCTYPE' as probe, data_type as a, coalesce(udt_name,'') as b, '' as c
  from information_schema.columns
 where table_schema='public' and table_name='attendance' and column_name='source'
union all
select 'ENUMVAL', e.enumlabel, '', ''
  from pg_enum e join pg_type t on t.oid=e.enumtypid
 where t.typname = (select udt_name from information_schema.columns
                     where table_schema='public' and table_name='attendance'
                       and column_name='source')
union all
select 'SRCCHECK', conname, pg_get_constraintdef(oid), ''
  from pg_constraint where conrelid='public.attendance'::regclass and contype='c'
union all
select 'CONTACT', c.first_name||' '||c.last_name, coalesce(c.email,''), c.segment::text
  from public.contacts c where c.email ilike '%rocketlauncher%'
union all
select 'GUARDIAN', coalesce(g.name,'(nameless)'), ge.email,
       coalesce((select string_agg(k.first_name||' '||k.last_name, ', ')
                   from public.student_guardians sg
                   join public.contacts k on k.id=sg.student_id
                  where sg.guardian_id=g.id),'(no kids linked)')
  from public.guardian_emails ge join public.guardians g on g.id=ge.guardian_id
 where ge.email ilike '%rocketlauncher%'
union all
select 'SG_EMAIL', sg.email, coalesce(k.first_name||' '||k.last_name,'?'), coalesce(sg.label,'')
  from public.student_guardians sg
  left join public.contacts k on k.id=sg.student_id
 where sg.email ilike '%rocketlauncher%'
 order by 1,2;

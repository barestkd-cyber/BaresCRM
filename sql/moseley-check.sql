select 'Harrison contact' as t,
       coalesce((select c.id::text||' '||c.segment::text from contacts c
                  where c.first_name ilike 'harrison' and c.last_name ilike 'moseley'),'NOT FOUND') as v
union all
select 'his guardians',
       coalesce((select string_agg(coalesce(nullif(g.name,''),'(unnamed)')||' ['||left(g.id::text,8)||'] <'
           || coalesce((select string_agg(ge.email,', ') from guardian_emails ge where ge.guardian_id=g.id),'none')||'>', ' | ')
          from student_guardians sg join guardians g on g.id=sg.guardian_id
          join contacts c on c.id=sg.student_id
         where c.first_name ilike 'harrison' and c.last_name ilike 'moseley'),'none')
union all
select 'is that address already used',
       coalesce((select 'yes, on '||coalesce(nullif(g.name,''),'(unnamed)')
          from guardian_emails ge join guardians g on g.id=ge.guardian_id
         where lower(ge.email)='mattmoseley@protonmail.com'),'no')
union all
select 'any Matt Moseley guardian',
       coalesce((select string_agg(g.name||' ['||left(g.id::text,8)||']',', ')
          from guardians g where g.name ilike '%moseley%'),'none');

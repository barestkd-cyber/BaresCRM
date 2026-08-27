select 'guardians holding that email' as t,
       coalesce(string_agg(left(g.id::text,8)||' '||coalesce(nullif(g.name,''),'(unnamed)'),' | '),'none') as v
  from guardian_emails ge join guardians g on g.id=ge.guardian_id
 where lower(ge.email) = 'm_mogle@icloud.com'
union all
select 'Cody guardians',
       coalesce((select string_agg(coalesce(nullif(g.name,''),'(unnamed)'),', ')
          from student_guardians sg join guardians g on g.id=sg.guardian_id
          join contacts c on c.id=sg.student_id
         where c.first_name='Cody' and c.last_name='Mogle'),'NONE')
union all
select 'other Mogle contacts',
       coalesce((select string_agg(c.first_name||' '||c.last_name||' ('||c.segment::text||')',', ')
          from contacts c where c.last_name ilike '%mogle%'),'none')
union all
select 'legacy link rows for Cody',
       coalesce((select string_agg(coalesce(sg.name,'-')||' / '||coalesce(sg.email,'-'),', ')
          from student_guardians sg join contacts c on c.id=sg.student_id
         where c.first_name='Cody' and c.last_name='Mogle'),'none');

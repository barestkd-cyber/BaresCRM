select 'Cody contact email' as t,
       (select coalesce(nullif(c.email,''),'(none)') from contacts c
         where c.first_name='Cody' and c.last_name='Mogle') as v
union all
select 'Cody guardians',
       coalesce((select string_agg(coalesce(nullif(g.name,''),'(unnamed)'),', ')
          from student_guardians sg join guardians g on g.id=sg.guardian_id
          join contacts c on c.id=sg.student_id
         where c.first_name='Cody' and c.last_name='Mogle'),'NONE')
union all
select 'contacts holding m_mogle@icloud.com',
       coalesce((select string_agg(c.first_name||' '||c.last_name,', ') from contacts c
         where lower(coalesce(c.email,''))='m_mogle@icloud.com'),'none')
union all
select 'guardian holding it',
       coalesce((select coalesce(nullif(g.name,''),'(unnamed)')
          from guardian_emails ge join guardians g on g.id=ge.guardian_id
         where lower(ge.email)='m_mogle@icloud.com'),'none');

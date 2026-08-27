select g.id::text as gid,
       coalesce((select string_agg(ge.email,',') from guardian_emails ge where ge.guardian_id=g.id),'') as email,
       coalesce((select string_agg(c.first_name||' '||c.last_name,', ')
                   from student_guardians sg join contacts c on c.id=sg.student_id
                  where sg.guardian_id=g.id),'-') as kids
  from guardians g
 where coalesce(nullif(g.name,''),'') = ''
 order by 3;

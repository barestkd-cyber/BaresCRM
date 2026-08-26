select left(g.id::text,8) as gid,
       coalesce((select string_agg(ge.email,',') from guardian_emails ge where ge.guardian_id=g.id),'-') as email,
       coalesce((select string_agg(distinct s.payer_name,' | ')
                   from pos_sales s
                  where lower(coalesce(s.payer_email,'')) in
                        (select lower(ge.email) from guardian_emails ge where ge.guardian_id=g.id)
                    and coalesce(s.payer_name,'') <> ''),'-') as from_a_sale,
       coalesce((select string_agg(distinct sg.name,' | ') from student_guardians sg
                  where sg.guardian_id=g.id and coalesce(sg.name,'') <> ''),'-') as from_link,
       coalesce((select string_agg(c.first_name||' '||c.last_name,', ')
                   from student_guardians sg join contacts c on c.id=sg.student_id
                  where sg.guardian_id=g.id),'-') as kids
  from guardians g
 where coalesce(nullif(g.name,''),'') = ''
 order by 2;

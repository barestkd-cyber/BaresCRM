select 'guardian holds ' || e.addr as probe,
       coalesce(g.name, '(no guardian has this email either)') as who
  from (values ('tessawingfield8415@gmail.com'), ('tnewsom@emaengineer.com'), ('tim@apples.email')) e(addr)
  left join guardian_emails ge on lower(ge.email) = e.addr
  left join guardians g on g.id = ge.guardian_id
union all
select 'guardians of ' || c.first_name || ' ' || c.last_name,
       coalesce((select string_agg(g2.name || ' <' || coalesce((select string_agg(ge2.email, ',') from guardian_emails ge2 where ge2.guardian_id = g2.id), 'no email') || '>', ' · ')
          from student_guardians sg join guardians g2 on g2.id = sg.guardian_id
         where sg.student_id = c.id), 'NO GUARDIANS AT ALL')
  from contacts c
 where c.last_name in ('Wingfield','Newsom','Apple')
 order by 1;

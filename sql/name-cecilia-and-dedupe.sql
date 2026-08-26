-- 1. The one nameless guardian whose name the CRM already knows: it was typed
--    at checkout and stored on the sale, just never written to the person.
update guardians g
   set name = s.payer_name
  from pos_sales s
 where coalesce(nullif(g.name,''),'') = ''
   and coalesce(s.payer_name,'') <> ''
   and lower(coalesce(s.payer_email,'')) in
       (select lower(ge.email) from guardian_emails ge where ge.guardian_id = g.id);

-- 2. Johnny Kubit has Hillary Fort twice: once from my 2026-08-23 backfill and
--    once from the checkout's legacy row (label 'parent', no link name). Drop
--    the legacy one, keeping whichever row carries a relationship label.
delete from student_guardians a
 where a.ctid in (
   select b.ctid from student_guardians b
     join contacts c on c.id = b.student_id
    where c.first_name='Johnny' and c.last_name='Kubit'
      and b.guardian_id = (select guardian_id from student_guardians x
                             where x.student_id = b.student_id
                             group by guardian_id having count(*) > 1 limit 1)
      and b.ctid <> (select min(y.ctid) from student_guardians y
                      where y.student_id = b.student_id and y.guardian_id = b.guardian_id));

select 'Cecilia' as t, (select coalesce(nullif(name,''),'STILL BLANK') from guardians
   where id in (select guardian_id from guardian_emails where lower(email)='kyungsk612@gmail.com')) as v
union all
select 'Johnny Kubit guardians',
   coalesce((select string_agg(coalesce(nullif(g.name,''),'(unnamed)'),', ')
      from student_guardians sg join guardians g on g.id=sg.guardian_id
      join contacts c on c.id=sg.student_id
     where c.first_name='Johnny' and c.last_name='Kubit'),'none')
union all
select 'nameless remaining', (select count(*)::text from guardians where coalesce(nullif(name,''),'')='');

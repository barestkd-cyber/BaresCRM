-- Who is on the active student list, and who looks like they should not be
-- (or should be, and isn't). Read-only.
select c.segment::text as segment,
       c.first_name || ' ' || c.last_name as who,
       coalesce(c.rank,'-') as rank,
       coalesce((select max(a.class_date)::text from attendance a where a.student_id = c.id),'never') as last_class,
       (select count(*) from attendance a
         where a.student_id = c.id and a.class_date > current_date - 60) as classes_60d,
       (select count(*) from enrollments e
         where e.student_id = c.id and e.status = 'active') as rosters,
       (select count(*) from memberships m
         where m.contact_id = c.id and m.status = 'active') as memberships
  from contacts c
 where c.segment::text in ('active','trial')
 order by c.segment::text, classes_60d, c.last_name;

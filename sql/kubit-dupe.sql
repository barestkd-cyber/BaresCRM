delete from student_guardians a
 using contacts c, guardians g
 where c.id = a.student_id and g.id = a.guardian_id
   and c.first_name='Johnny' and c.last_name='Kubit'
   and g.name = 'Hillary Fort'
   and coalesce(a.label,'') = 'parent'
   and coalesce(a.name,'') = '';

select coalesce(string_agg(coalesce(nullif(g.name,''),'(unnamed)')||' ['||coalesce(sg.label,'-')||']', ', '),'none') as guardians
  from student_guardians sg join guardians g on g.id=sg.guardian_id
  join contacts c on c.id=sg.student_id
 where c.first_name='Johnny' and c.last_name='Kubit';

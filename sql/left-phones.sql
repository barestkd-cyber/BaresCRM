select c.first_name||' '||c.last_name as who,
       date_part('year', age(c.dob))::int as yrs, c.phone,
       (select string_agg(coalesce(g.name,'(unnamed)')||' '||coalesce(array_to_string(g.phones,'/'),'-'), ' | ')
          from student_guardians sg join guardians g on g.id = sg.guardian_id
         where sg.student_id = c.id) as their_guardians
from contacts c
where c.phone is not null and c.dob is not null and date_part('year', age(c.dob)) < 18
order by yrs;

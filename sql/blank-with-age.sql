select g.id, g.email, g.label, c.first_name, c.last_name,
       coalesce(date_part('year', age(c.dob))::int, -1) as yrs
from student_guardians g join contacts c on c.id = g.student_id
where g.name is null and g.email is not null;

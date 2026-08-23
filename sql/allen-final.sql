select c.first_name as student, coalesce(g.name,'(no name)') as guardian,
       g.label, g.email
from contacts c join student_guardians g on g.student_id = c.id
where c.last_name = 'Allen' and c.first_name in ('Luther','Emerson')
order by c.first_name, g.label;

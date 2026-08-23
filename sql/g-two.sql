select c.first_name as student, g.label, g.email, coalesce(g.name,'(blank)') as gname
from contacts c join student_guardians g on g.student_id = c.id
where c.first_name in ('Luther','Emerson') and c.last_name = 'Allen'
order by c.first_name, g.label;

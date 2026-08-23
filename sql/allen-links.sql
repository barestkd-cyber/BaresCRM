-- Guardians on each Allen kid, and any household they belong to.
select c.first_name||' '||c.last_name as student, c.id,
       c.email as own_email, c.rank,
       g.email as guardian_email, g.label as guardian_label
from contacts c
left join student_guardians g on g.student_id = c.id
where c.last_name ilike 'allen'
order by c.first_name, g.email;

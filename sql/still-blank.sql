-- What is left, and whether it belongs to a Spark student at all.
select c.first_name||' '||c.last_name as student,
       g.label, g.email,
       case when c.spark_id is null then 'not from Spark' else 'Spark' end as origin
from student_guardians g join contacts c on c.id = g.student_id
where g.name is null and g.email is not null
order by origin, c.first_name;

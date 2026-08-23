-- If guardians collapse to one record per NAME, these are the names that
-- carry more than one address. Each must be verified as one human, not two
-- people who happen to share a name.
select g.name,
       string_agg(distinct lower(g.email), ' + ') as addresses,
       string_agg(distinct c.first_name||' '||c.last_name, ', ') as children
from student_guardians g
join contacts c on c.id = g.student_id
where g.name is not null
group by g.name
having count(distinct lower(g.email)) > 1
order by g.name;

-- Colette should be ONE person with five children; Katie Hardin one person
-- with two addresses.
select g.name,
       (select count(*) from student_guardians sg where sg.guardian_id = g.id) as children,
       (select string_agg(lower(e.email), ' + ') from guardian_emails e where e.guardian_id = g.id) as addresses
from guardians g
where g.name in ('Colette Toit','Katie Hardin','Carlton Allen','Tim Apple','Kristie Allen')
order by g.name;

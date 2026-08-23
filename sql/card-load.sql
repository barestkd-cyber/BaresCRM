-- If guardians are shared across a household, how crowded does one Contact
-- card get? Modelled on surname, since only one household exists so far.
select c.last_name as family,
       count(distinct c.id) as participants,
       count(distinct lower(g.email)) as distinct_guardians,
       count(distinct c.id) + count(distinct lower(g.email)) as rows_on_one_card
from contacts c left join student_guardians g on g.student_id = c.id
where c.last_name in ('Du Toit','DuToit','Nannen','Randall','Osborne','Tarry','Teague','Apple','Allen')
group by c.last_name order by 4 desc;

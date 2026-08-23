-- If guardians become one row per person, what does "one person" key on?
-- Email is the obvious answer. These are the places it would get it wrong.
select 'one email, two different names' as issue,
       coalesce(string_agg(distinct lower(email), ', '), 'none') as detail
from (select email from student_guardians where email is not null and name is not null
      group by email having count(distinct name) > 1) d
join student_guardians using (email)
union all
select 'one name, two different emails',
       coalesce(string_agg(distinct name || ' -> ' || cnt::text || ' addresses', ' | '), 'none')
from (select name, count(distinct lower(email)) as cnt from student_guardians
      where name is not null and email is not null
      group by name having count(distinct lower(email)) > 1) e;

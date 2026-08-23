select count(*) as rows,
       count(distinct lower(email)) as distinct_emails,
       count(distinct name) filter (where name is not null) as distinct_names
from student_guardians where email is not null;

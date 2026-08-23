select count(*) as guardian_rows,
       count(*) filter (where name is not null and name <> '') as with_name,
       count(*) filter (where phone is not null and phone <> '') as with_phone,
       count(distinct lower(email)) as distinct_people,
       max(kids) as most_kids_one_guardian
from student_guardians,
     lateral (select count(*) as kids from student_guardians g2
              where lower(g2.email) = lower(student_guardians.email)) k;

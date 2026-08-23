select lower(email) as email, count(*) as students,
       string_agg(coalesce(name,'(no name)'), ' / ') as names_on_file
from student_guardians where email is not null
group by 1 having count(*) > 1 order by 2 desc limit 8;

select id, student_id, lower(email) as email, label, name
from student_guardians where email is not null;

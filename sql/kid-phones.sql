select count(*) as minors_with_a_phone
from contacts c
where c.phone is not null and c.dob is not null
  and date_part('year', age(c.dob)) < 18;

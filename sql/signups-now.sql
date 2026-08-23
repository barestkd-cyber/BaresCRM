select s.created_at, s.student_name, s.rank, s.program, s.family_position,
       s.fee_cents, s.paid, s.sale_id, s.belt_size,
       d.label as session, d.test_date, d.start_time,
       c.first_name||' '||c.last_name as contact, c.email, c.phone
from testing_signups s
left join testing_dates d on d.id = s.testing_date_id
left join contacts c on c.id = s.contact_id
order by s.created_at;

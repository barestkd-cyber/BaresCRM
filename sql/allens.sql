select id, first_name, last_name, email, phone, rank, dob, created_at, segment
from contacts
where last_name ilike 'allen' or email ilike '%carltonallen%'
order by created_at;

select count(*) as signups,
       count(*) filter (where paid) as paid,
       min(created_at)::date as first_at
from testing_signups;

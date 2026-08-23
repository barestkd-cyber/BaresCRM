select first_name, last_name, coalesce(spark_id,'(none)') as spark_id,
       coalesce(dob::text,'-') as dob, coalesce(email,'-') as email, created_at::date::text as created
from contacts
where (first_name ilike 'emerson' and last_name ilike 'allen')
   or (first_name ilike 'sophie' and last_name ilike 'cater');

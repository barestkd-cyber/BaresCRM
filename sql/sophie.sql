select first_name, last_name, coalesce(spark_id,'-') as spark_id, created_at::date::text as created
from contacts where first_name ilike '%sophi%' or last_name ilike '%cat%';

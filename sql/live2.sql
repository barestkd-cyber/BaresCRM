select spark_id, first_name, last_name, rank, segment, program, last_visit::text as last_visit
from contacts where spark_id is not null;

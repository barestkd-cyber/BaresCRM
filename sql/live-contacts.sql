select spark_id, first_name, last_name, dob::text as dob, gender, phone, email
from contacts where spark_id is not null;

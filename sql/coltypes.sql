select column_name, data_type, character_maximum_length as len
from information_schema.columns
where table_schema='public' and table_name='contacts'
  and column_name in ('dob','gender','phone','address','joined_on','entered_on','belt_size','kick_size');

select column_name, is_nullable, column_default
from information_schema.columns
where table_schema='public' and table_name='guardians'
order by ordinal_position;

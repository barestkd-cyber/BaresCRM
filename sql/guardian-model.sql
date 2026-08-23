select string_agg(column_name||' '||data_type, ', ' order by ordinal_position) as cols
from information_schema.columns
where table_schema='public' and table_name='student_guardians';

select table_name, column_name
from information_schema.columns
where table_schema='public'
  and (column_name ilike '%stripe%' or column_name ilike '%rank%' or column_name ilike '%belt%')
  and table_name not in ('contacts')
order by table_name, column_name;

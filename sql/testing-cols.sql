select table_name, string_agg(column_name, ', ' order by ordinal_position) as cols
from information_schema.columns
where table_schema='public' and table_name in ('testing_dates','testing_sessions','testing_signups')
group by table_name;

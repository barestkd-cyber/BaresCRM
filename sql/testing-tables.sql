select table_name from information_schema.tables
where table_schema='public' and (table_name ilike '%test%' or table_name ilike '%event%')
order by table_name;

select table_name, column_name
  from information_schema.columns
 where table_schema = 'public'
   and (column_name ilike '%phone%' or column_name ilike '%mobile%')
 order by table_name;

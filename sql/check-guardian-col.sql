select column_name from information_schema.columns
where table_schema='public' and table_name='contacts'
  and column_name like '%guardian%';

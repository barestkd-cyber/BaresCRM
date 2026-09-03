select 'TABLE' as probe, table_name as a, '' as b
  from information_schema.tables
 where table_schema='public' and table_name like '%stripe%'
union all
select 'COL', column_name, data_type
  from information_schema.columns
 where table_schema='public' and table_name='student_stripes'
union all
select 'ROWS', count(*)::text, coalesce(string_agg(distinct source,', '),'-')
  from public.student_stripes
 order by 1,2;

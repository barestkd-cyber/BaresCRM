select 'COL' as probe, column_name as a, data_type as b
  from information_schema.columns
 where table_schema='public' and table_name='cycle_data'
union all
select 'ROWS', count(*)::text, ''
  from public.cycle_data
 order by 1,2;

-- Who exactly holds a Cubs signup, and which contact columns exist for the
-- testing app's roster mapping (read-only).
select 'CUB' as probe, ts.student_name as a, coalesce(ts.rank,'') as b,
       ts.source::text as c, '' as d
  from public.testing_signups ts
 where ts.testing_date_id = 'e57ae446-5088-4505-938e-f60716e51f8e'
union all
select 'COL', column_name, data_type, '', ''
  from information_schema.columns
 where table_schema='public' and table_name='contacts'
 order by 1, 2;

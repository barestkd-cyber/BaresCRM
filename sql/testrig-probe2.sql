select 'SG_COL' as probe, column_name as a, data_type as b, is_nullable as c
  from information_schema.columns
 where table_schema='public' and table_name='student_guardians'
union all
select 'EN_COL', column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema='public' and table_name='enrollments'
union all
select 'AUTHUSER', email, coalesce(last_sign_in_at::date::text,'never'), id::text
  from auth.users where email ilike '%rocketlauncher%'
union all
select 'ALLOWED', email, coalesce(name,''), ''
  from public.allowed_emails where email ilike '%rocketlauncher%'
 order by 1,2;

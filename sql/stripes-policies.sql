select 'POLICY' as probe, policyname as a, cmd as b, coalesce(qual,'') as c
  from pg_policies where schemaname='public' and tablename='student_stripes'
union all
select 'ROW', stripe_key, belt, source||' · by '||coalesce(awarded_by,'?')
  from public.student_stripes
 order by 1,2;

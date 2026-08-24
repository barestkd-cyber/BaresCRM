-- Will the database accept what the roster checkbox writes?
-- 1) any check constraint on enrollments.status
select 'constraint' as kind, conname as name, pg_get_constraintdef(oid) as detail
  from pg_constraint
 where conrelid = 'public.enrollments'::regclass
union all
-- 2) can staff insert/update at all
select 'policy', policyname || ' [' || cmd || ']', coalesce(qual, with_check)
  from pg_policies
 where schemaname = 'public' and tablename = 'enrollments'
union all
select 'rls enabled', relname, relrowsecurity::text
  from pg_class where oid = 'public.enrollments'::regclass;

-- Read-only: rows the browser must delete for the Kubit dup, and the RLS
-- policies gating a staff session on each table involved.
select 'ENROLLMENT' as probe, e.id::text as a, e.program as b,
       coalesce(e.status,'') as c
  from public.enrollments e
 where e.sale_id = '8578258b-474f-4b2b-8ecc-45689a9c6379'
union all
select 'POLICY-' || tablename, policyname, cmd, roles::text
  from pg_policies
 where schemaname='public'
   and tablename in ('enrollments','pos_sale_lines','pos_payments')
 order by 1, 2;

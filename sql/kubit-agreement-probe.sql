-- Read-only: does a signed agreement hold the Kubit duplicate (sale
-- 8578258b), and how are membership_agreements FKs/policies shaped.
select 'AGREEMENT' as probe, a.id::text as a,
       coalesce(a.sale_id::text,'') as b,
       coalesce(a.membership_id::text,'') as c, '' as d
  from public.membership_agreements a
 where a.sale_id = '8578258b-474f-4b2b-8ecc-45689a9c6379'
    or a.membership_id = '20d031a2-b28b-4260-88eb-5cec5024942e'
union all
select 'COL', column_name, is_nullable, data_type, ''
  from information_schema.columns
 where table_schema='public' and table_name='membership_agreements'
   and column_name in ('sale_id','membership_id','contact_id')
union all
select 'FK', conname, pg_get_constraintdef(oid), '', ''
  from pg_constraint
 where conrelid = 'public.membership_agreements'::regclass and contype='f'
union all
select 'POLICY', policyname, cmd, roles::text, coalesce(qual,'')
  from pg_policies
 where schemaname='public' and tablename='membership_agreements'
 order by 1, 2;

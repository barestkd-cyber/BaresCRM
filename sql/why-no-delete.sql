select 'DELETE policy' as kind,
       policyname as name,
       coalesce(qual,'-') as detail
  from pg_policies where schemaname='public' and tablename='pos_sales' and cmd in ('DELETE','ALL')
union all
select 'FK pointing at pos_sales',
       conrelid::regclass::text || '.' || (select string_agg(a.attname,',')
         from unnest(conkey) k join pg_attribute a on a.attrelid=conrelid and a.attnum=k),
       case confdeltype when 'c' then 'ON DELETE CASCADE'
                        when 'n' then 'ON DELETE SET NULL'
                        when 'a' then 'NO ACTION  <-- blocks the delete'
                        else confdeltype::text end
  from pg_constraint
 where confrelid = 'public.pos_sales'::regclass and contype='f'
 order by 1,2;

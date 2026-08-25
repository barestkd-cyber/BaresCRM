select 'sale_customer' as t, left(s.id::text,8) as k,
       coalesce(s.stripe_customer_id,'NONE') as v
  from pos_sales s
 where s.created_at >= '2026-08-24 05:00:00+00' and s.total_cents > 0
union all
select 'guardian', g.name, coalesce(g.stripe_customer_id,'NULL')
  from guardians g
 where g.name in ('Tessa Wingfield','Tonya Newsom','Tim Apple')
union all
select 'sg_cols', column_name, coalesce(column_default,'no default')
  from information_schema.columns
 where table_schema='public' and table_name='student_guardians'
 order by 1,2;

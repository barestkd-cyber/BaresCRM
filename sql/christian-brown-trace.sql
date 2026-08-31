-- Read-only: what just happened around Christian Brown - his contact, any
-- trial/booking rows, recent sales, and any email-ish tables that exist.
select 'TABLES' as probe, table_name as a, '' as b, '' as c
  from information_schema.tables
 where table_schema='public'
   and (table_name ilike '%email%' or table_name ilike '%trial%'
     or table_name ilike '%booking%' or table_name ilike '%mail%')
union all
select 'CONTACT', c.id::text, c.first_name || ' ' || c.last_name,
       c.segment::text || ' · ' || coalesce(c.email,'no email') || ' · created ' || c.created_at::date
  from public.contacts c
 where c.first_name ilike 'christian' and c.last_name ilike 'brown'
 order by 1, 2;

-- Did checkout create a second Luther? And how many students share a name?
select 'Luther Allen contacts' as q, count(*)::text as a from contacts
  where first_name ilike 'luther' and last_name ilike 'allen'
union all
select 'contacts created 2026-08-22', count(*)::text from contacts
  where created_at::date = '2026-08-22'
union all
select 'name collisions in contacts',
  coalesce(string_agg(nm||' x'||n, ', '),'none') from (
    select lower(first_name)||' '||lower(last_name) as nm, count(*) as n
    from contacts where first_name is not null and last_name is not null
    group by 1 having count(*) > 1) d;

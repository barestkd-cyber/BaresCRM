select 'orphan sale' as t, s.status::text as v
  from pos_sales s where left(s.id::text,8)='e7d79ec5'
union all
select 'oliver census rows', count(*)::text
  from testing_signups ts
 where ts.contact_id in (select id from contacts where first_name='Oliver' and last_name='Allen');

-- The pre-contact surfaces: raw funnel writes that exist BEFORE somebody
-- becomes a contact. Every column of each row is cast to text and stripped to
-- digits, so the number is found no matter which field or format holds it.
with q as (select '9035922239' as digits)
select 'trial_bookings' as src, left(to_jsonb(t)::text, 200) as row_text
  from trial_bookings t, q
 where regexp_replace(to_jsonb(t)::text, '\D', '', 'g') like '%' || q.digits || '%'
union all
select 'contact_methods', left(to_jsonb(t)::text, 200)
  from contact_methods t, q
 where regexp_replace(to_jsonb(t)::text, '\D', '', 'g') like '%' || q.digits || '%'
union all
select 'testing_signups', left(to_jsonb(t)::text, 200)
  from testing_signups t, q
 where regexp_replace(to_jsonb(t)::text, '\D', '', 'g') like '%' || q.digits || '%'
union all
select 'event_registrations', left(to_jsonb(t)::text, 200)
  from event_registrations t, q
 where regexp_replace(to_jsonb(t)::text, '\D', '', 'g') like '%' || q.digits || '%'
union all
select 'store_orders', left(to_jsonb(t)::text, 200)
  from store_orders t, q
 where regexp_replace(to_jsonb(t)::text, '\D', '', 'g') like '%' || q.digits || '%'
union all
select 'students_legacy', left(to_jsonb(t)::text, 200)
  from students_legacy t, q
 where regexp_replace(to_jsonb(t)::text, '\D', '', 'g') like '%' || q.digits || '%';

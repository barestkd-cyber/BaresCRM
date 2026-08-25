select e.type, count(*) as n,
       min(e.received_at)::text as first_seen,
       string_agg(distinct coalesce(e.handle_error,'ok'), ' | ') as outcomes
  from payment_events e
 where e.received_at >= '2026-08-23 05:00:00+00'
 group by e.type order by 2 desc;

select e.type, (e.received_at at time zone 'America/Chicago')::timestamp(0) as at_ct,
       coalesce(e.handle_error,'ok') as outcome
  from payment_events e
 where e.type like 'payout%'
 order by e.received_at;

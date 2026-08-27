select e.type,
       (e.received_at at time zone 'America/Chicago')::timestamp(0)::text as at_ct,
       coalesce(substring(e.payload::text from '"last4":\s*"([0-9]{4})"'),'-') as last4,
       coalesce(substring(e.payload::text from '"brand":\s*"([a-z]+)"'),'-') as brand
  from payment_events e
 where e.payload::text like '%cus_V6wWiAiUCMzAeq%'
 order by e.received_at;

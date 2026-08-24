-- Which Stripe events have actually reached us. If payment_method.attached
-- has never arrived, the endpoint is not subscribed to it.
select event_type, count(*) as seen, max(created_at)::date::text as last_seen
from payment_events group by event_type order by 2 desc;

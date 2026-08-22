-- The events the testing page actually sells seats to, and whether anyone has
-- registered yet.
select e.id, e.title, e.event_date, e.event_time, e.price_cents, e.active,
       (select count(*) from event_registrations r where r.event_id = e.id) as signed_up
from events e
where e.event_date >= '2026-08-01'
order by e.event_date, e.event_time;

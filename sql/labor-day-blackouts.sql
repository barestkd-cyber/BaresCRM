-- ===========================================================================
-- Labor Day weekend closures, 2026
-- ---------------------------------------------------------------------------
-- Not invented: Race's own published Spark testing page says "Saturday,
-- September 5th / Monday September 7th - NO CLASS OR EVENTS - LABOR DAY".
-- These are the first real blackout rows, full closure on all three toggles.
-- Weekdays verified below, never assumed.
-- ===========================================================================

insert into public.calendar_events
  (type, title, event_date, event_time, created_by, blocks_classes, blocks_trials, blocks_privates)
select 'blackout', 'Closed · Labor Day weekend', v.d, 'All day', 'claude (from the published Spark schedule)', true, true, true
  from (values (date '2026-09-05'), (date '2026-09-07')) as v(d)
 where not exists (
   select 1 from public.calendar_events e
    where e.type = 'blackout' and e.event_date = v.d
 );

select title, event_date::text, to_char(event_date,'Day') as weekday,
       blocks_classes, blocks_trials, blocks_privates
  from public.calendar_events where type = 'blackout' order by event_date;

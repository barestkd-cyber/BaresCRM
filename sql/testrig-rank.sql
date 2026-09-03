-- Give the geofence test student a rank so the new belt filter is visible:
-- White Belt is inside WHI-BLU (4:45) and All (10:15), but outside BR-BLK
-- (4:15), which should drop under "view more classes".
update public.contacts set rank = 'White Belt'
 where id = 'affa5794-18e7-4945-9f48-33708b92dc95' and rank is null;
select first_name||' '||last_name as who, coalesce(rank,'(none)') as rank
  from public.contacts where id = 'affa5794-18e7-4945-9f48-33708b92dc95';

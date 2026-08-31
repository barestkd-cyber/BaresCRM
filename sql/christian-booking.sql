-- Read-only: Christian Brown's trial bookings, newest first, full shape.
select b.*
  from public.trial_bookings b
 where b.contact_id = '1b235c45-05cb-455b-9e08-24756a5a31a2'
 order by b.created_at desc
 limit 5;

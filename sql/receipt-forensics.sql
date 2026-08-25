select 'sale' as t,
       left(s.id::text,8) as ref,
       s.status || ' · buyer=' || coalesce(left(s.buyer_contact_id::text,8),'NULL')
         || ' · stripe_email=' || coalesce(s.stripe_email,'NONE')
         || ' · receipt_sent=' || coalesce(s.receipt_sent_at::text,'NEVER')
         || ' · confirmed=' || coalesce(s.confirmed_at::text,'never') as detail
  from pos_sales s
 where s.created_at >= '2026-08-24 05:00:00+00' and s.total_cents > 0
union all
select 'webhook_event', left(e.stripe_event_id,18),
       e.type || ' · handled=' || coalesce(e.handled_at::text,'NO')
         || ' · error=' || coalesce(e.handle_error,'none')
  from payment_events e
 where e.received_at >= '2026-08-24 05:00:00+00' and e.type like 'checkout%'
union all
select 'signup', coalesce(ts.student_name, '?'),
       'contact=' || coalesce(left(ts.contact_id::text,8),'NULL')
  from testing_signups ts
 where ts.created_at >= '2026-08-24 05:00:00+00';

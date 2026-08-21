-- Removes the one end-to-end test booking made while verifying the private
-- lesson page (Probe Test, probe-priv@example.com). Its Stripe intent was
-- never confirmed, so no money moved and there is nothing to refund.
delete from public.calendar_events
 where created_by = 'private-checkout@website' and title like 'Private · Probe Test%';

delete from public.private_lessons where email = 'probe-priv@example.com';

delete from public.pos_sale_lines
 where sale_id in (select id from public.pos_sales
                    where staff_email = 'private-checkout@website'
                      and receipt_email = 'probe-priv@example.com');

delete from public.pos_sales
 where staff_email = 'private-checkout@website'
   and receipt_email = 'probe-priv@example.com'
   and status <> 'paid';

delete from public.contacts where email = 'probe-priv@example.com';

select
  (select count(*) from public.contacts where email='probe-priv@example.com') as probe_contacts,
  (select count(*) from public.private_lessons) as lessons,
  (select count(*) from public.pos_sales) as sales,
  (select count(*) from public.calendar_events where created_by='private-checkout@website') as probe_cal,
  (select coalesce(sum(amount_cents),0) from public.pos_payments) as collected_cents;

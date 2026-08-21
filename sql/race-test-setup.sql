-- A member due today with a SCHEDULED installment and a saved Stripe customer,
-- for racing two charge runs against each other. Removed by race-test-cleanup.
insert into public.contacts (id, first_name, last_name, email, brand, stripe_customer_id)
values ('00000000-0000-4000-8000-00000000ace1'::uuid, 'Race', 'Condition', 'race-test@example.com', 'btkd', null)
on conflict (id) do nothing;

insert into public.memberships (id, contact_id, program, plan_code, status,
  billing_frequency, final_recurring_cents, final_down_cents, next_bill_on, started_on, payment_count)
values ('00000000-0000-4000-8000-00000000ace1'::uuid,
  '00000000-0000-4000-8000-00000000ace1'::uuid,
  'Juniors Taekwondo', 'jr_option_b', 'active',
  'monthly', 9500, 0, (now() at time zone 'America/Chicago')::date, date '2026-07-01', 12)
on conflict (id) do update set next_bill_on = excluded.next_bill_on, status='active';

insert into public.membership_installments (membership_id, contact_id, seq, due_on, amount_cents, status)
values ('00000000-0000-4000-8000-00000000ace1'::uuid,
  '00000000-0000-4000-8000-00000000ace1'::uuid,
  1, (now() at time zone 'America/Chicago')::date, 9500, 'scheduled')
on conflict (membership_id, due_on) do update set status='scheduled', attempts=0, sale_id=null, last_error=null;

select i.status, i.attempts, m.next_bill_on::text
  from public.membership_installments i join public.memberships m on m.id=i.membership_id
 where m.id = '00000000-0000-4000-8000-00000000ace1'::uuid;

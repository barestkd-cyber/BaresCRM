-- A throwaway member whose payment is overdue, so the billing engine can be
-- watched selecting, scheduling and pricing a real charge WITHOUT a card
-- behind it. Removed by sql/billing-probe-cleanup.sql.
insert into public.contacts (id, first_name, last_name, email, brand)
values ('00000000-0000-4000-8000-00000000b111'::uuid, 'Billing', 'Probe', 'billing-probe@example.com', 'btkd')
on conflict (id) do nothing;

insert into public.memberships (id, contact_id, program, plan_code, status,
  billing_frequency, final_recurring_cents, final_down_cents, next_bill_on, started_on, created_by)
values ('00000000-0000-4000-8000-00000000b222'::uuid,
  '00000000-0000-4000-8000-00000000b111'::uuid,
  'Juniors Taekwondo', 'juniors_option_c', 'active',
  'monthly', 11000, 0, current_date - 2, current_date - 32, 'billing probe')
on conflict (id) do update set next_bill_on = current_date - 2, status = 'active';

select c.first_name||' '||c.last_name as who, m.program, m.billing_frequency,
       m.final_recurring_cents, m.next_bill_on::text as due,
       case when c.stripe_customer_id is null then 'no card (deliberate)' else 'card' end as card
  from public.memberships m join public.contacts c on c.id = m.contact_id
 where m.id = '00000000-0000-4000-8000-00000000b222'::uuid;

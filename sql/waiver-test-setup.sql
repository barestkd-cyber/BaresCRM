-- A member due today whose installment for today was WAIVED. Before the fix
-- the engine would re-create and charge it. Removed by waiver-test-cleanup.sql.
insert into public.contacts (id, first_name, last_name, email, brand)
values ('00000000-0000-4000-8000-000000000a1e'::uuid, 'Waiver', 'Test', 'waiver-test@example.com', 'btkd')
on conflict (id) do nothing;

insert into public.memberships (id, contact_id, program, plan_code, status,
  billing_frequency, final_recurring_cents, final_down_cents, next_bill_on, started_on)
values ('00000000-0000-4000-8000-000000000a1d'::uuid,
  '00000000-0000-4000-8000-000000000a1e'::uuid,
  'Juniors Taekwondo', 'jr_option_b', 'active',
  'monthly', 9500, 0, (now() at time zone 'America/Chicago')::date, date '2026-07-01')
on conflict (id) do update set next_bill_on = excluded.next_bill_on, status = 'active';

insert into public.membership_installments (membership_id, contact_id, seq, due_on, amount_cents, status, note)
values ('00000000-0000-4000-8000-000000000a1d'::uuid,
  '00000000-0000-4000-8000-000000000a1e'::uuid,
  1, (now() at time zone 'America/Chicago')::date, 9500, 'waived', 'injured, owner waived this month')
on conflict (membership_id, due_on) do update set status = 'waived';

select m.program, m.next_bill_on::text as due_today, m.final_recurring_cents,
       i.status as installment_status, i.amount_cents
  from public.memberships m
  join public.membership_installments i on i.membership_id = m.id
 where m.id = '00000000-0000-4000-8000-000000000a1d'::uuid;

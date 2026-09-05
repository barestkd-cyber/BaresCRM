-- Cody bills every SATURDAY (owner). 2026-09-12 is the first Saturday after
-- today; weekday verified, not assumed.
update public.memberships
   set next_bill_on = date '2026-09-12'
 where id = '68172229-9e20-41e3-9b6c-48d228fc20ab';

select trim(c.first_name||' '||c.last_name) as student,
       m.billing_frequency, (m.final_recurring_cents/100.0) as amount,
       m.next_bill_on::text as first_bill,
       to_char(m.next_bill_on,'Day') as falls_on
  from public.memberships m join public.contacts c on c.id=m.contact_id
 where m.id = '68172229-9e20-41e3-9b6c-48d228fc20ab';

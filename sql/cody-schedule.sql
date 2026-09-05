-- Cody is billable the moment he has a next_bill_on. Set it to next Friday so
-- it lands in a dry run first, and confirm what the engine will see.
-- (Weekly $27.95, cubs_weekly, active.)
update public.memberships
   set next_bill_on = date '2026-09-11'
 where id = '68172229-9e20-41e3-9b6c-48d228fc20ab'
   and next_bill_on is null;

select trim(c.first_name||' '||c.last_name) as student,
       m.program, m.billing_frequency,
       (m.final_recurring_cents/100.0) as amount,
       m.next_bill_on::text as first_bill,
       coalesce(c.stripe_customer_id,'(none on child)') as child_card,
       (select coalesce(string_agg(g.name||' '||coalesce(g.stripe_customer_id,'(no card)'), ' | '),'-')
          from public.student_guardians sg join public.guardians g on g.id=sg.guardian_id
         where sg.student_id=c.id) as guardians
  from public.memberships m
  join public.contacts c on c.id = m.contact_id
 where m.id = '68172229-9e20-41e3-9b6c-48d228fc20ab';

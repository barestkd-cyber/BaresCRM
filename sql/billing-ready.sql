-- What the billing engine can see right now, and why.
-- Every active recurring membership, whether it has a date, whether the
-- person (or their guardian) has a card, and what the next charge would be.
select
  coalesce(c.first_name || ' ' || c.last_name, '(no contact)')     as student,
  m.program,
  m.billing_frequency                                             as freq,
  '$' || (m.final_recurring_cents / 100.0)::text                   as amount,
  coalesce(m.next_bill_on::text, 'NO DATE - INVISIBLE TO BILLING') as next_bill,
  coalesce(m.payment_count::text, 'ongoing')                       as term,
  case
    when c.stripe_customer_id is not null then 'own card'
    when exists (
      select 1
        from public.student_guardians sg
        join public.guardians g on g.id = sg.guardian_id
       where sg.student_id = m.contact_id
         and g.stripe_customer_id is not null
    ) then 'guardian card'
    else 'NO CARD ON FILE'
  end                                                              as pays_with
from public.memberships m
left join public.contacts c on c.id = m.contact_id
where m.status = 'active'
  and coalesce(m.final_recurring_cents, 0) > 0
order by m.next_bill_on nulls first, student;

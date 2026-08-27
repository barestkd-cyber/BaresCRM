select left(m.id::text,8) as membership,
       c.first_name||' '||c.last_name as who,
       m.status::text,
       coalesce(m.billing_frequency::text,'NULL') as bills_on,   -- what charge-due reads
       coalesce(m.frequency::text,'NULL')         as legacy_freq,
       coalesce(m.next_bill_on::text,'none')      as next_bill,
       coalesce(m.payment_count::text,'-')        as payments,
       coalesce(m.final_recurring_cents::text,'0') as recurring_cents,
       coalesce(m.payments_remaining::text,'-')   as remaining
  from memberships m join contacts c on c.id = m.contact_id
 where m.program ilike '%little kicker%' or m.plan_label ilike '%little kicker%'
 order by c.last_name;

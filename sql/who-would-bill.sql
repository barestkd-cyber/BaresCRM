select 'DUE NOW' as probe, trim(c.first_name||' '||c.last_name) as who,
       m.program||' '||m.billing_frequency as what,
       (m.final_recurring_cents/100.0)::text as amount,
       m.next_bill_on::text as due
  from public.memberships m join public.contacts c on c.id=m.contact_id
 where m.status='active' and m.billing_frequency in ('weekly','monthly')
   and m.next_bill_on is not null and m.next_bill_on <= current_date
union all
select 'SCHEDULED LATER', trim(c.first_name||' '||c.last_name),
       m.program||' '||m.billing_frequency,
       (m.final_recurring_cents/100.0)::text, m.next_bill_on::text
  from public.memberships m join public.contacts c on c.id=m.contact_id
 where m.status='active' and m.billing_frequency in ('weekly','monthly')
   and m.next_bill_on > current_date
union all
select 'NO BILL DATE', trim(c.first_name||' '||c.last_name),
       m.program||' '||coalesce(m.billing_frequency,'?'),
       (m.final_recurring_cents/100.0)::text, '(none)'
  from public.memberships m join public.contacts c on c.id=m.contact_id
 where m.status='active' and m.next_bill_on is null
union all
select 'PENDING INSTALLMENTS', count(*)::text, '', '', ''
  from public.membership_installments where status in ('scheduled','charging')
 order by 1,2;

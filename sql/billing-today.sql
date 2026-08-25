select 'memberships by frequency' as t, coalesce(m.billing_frequency::text,'?') as k,
       m.status::text as k2, count(*)::text as v
  from memberships m
 group by 2,3
union all
select 'installments by status', i.status::text, '', count(*)::text
  from membership_installments i
 group by 2
union all
select 'due on or before Sep 18', '', '',
       count(*)::text || ' installments · $' || coalesce(sum(i.amount_cents)/100.0,0)::text
  from membership_installments i
 where i.status::text = 'scheduled' and i.due_on <= '2026-09-18'
union all
select 'active monthly, no card on membership', '', '', count(*)::text
  from memberships m
 where m.status::text='active' and m.billing_frequency::text in ('monthly','weekly')
   and m.payment_method_id is null
 order by 1,2;

-- What Christian Brown's membership actually says, and what she has paid.
select 'MEMBERSHIP' as probe, m.id::text as a,
       coalesce(m.program,'')||' · '||coalesce(m.plan_code,'') as b,
       m.status::text||' · '||coalesce(m.billing_frequency,'?') as c,
       'rec='||coalesce((m.final_recurring_cents/100.0)::text,'-')
         ||'  down='||coalesce((m.final_down_cents/100.0)::text,'-')
         ||'  next='||coalesce(m.next_bill_on::text,'(none)') as d,
       'started='||coalesce(m.started_on::text,'?')||'  sale='||coalesce(m.sale_id::text,'(none)') as e
  from public.memberships m
  join public.contacts c on c.id = m.contact_id
 where c.last_name ilike 'brown' and c.first_name ilike 'christian%'
union all
select 'INVOICE', s.id::text, s.status,
       (s.total_cents/100.0)::text,
       s.sale_date::text,
       coalesce(s.allow_partial::text,'')
  from public.pos_sales s
  join public.contacts c on c.id = s.buyer_contact_id
 where c.last_name ilike 'brown' and c.first_name ilike 'christian%'
union all
select 'PAYMENTS', p.id::text, p.method,
       (p.amount_cents/100.0)::text, p.occurred_at::date::text,
       coalesce(p.card_brand,'')||' '||coalesce(p.card_last4,'')
  from public.pos_payments p
  join public.pos_sales s on s.id = p.sale_id
  join public.contacts c on c.id = s.buyer_contact_id
 where c.last_name ilike 'brown' and c.first_name ilike 'christian%'
union all
select 'CARD', c.id::text, trim(c.first_name||' '||c.last_name),
       coalesce(c.stripe_customer_id,'(no card)'), coalesce(c.email,''), c.segment::text
  from public.contacts c
 where c.last_name ilike 'brown' and c.first_name ilike 'christian%'
 order by 1,5;

select 'CONTACT' as probe, c.id::text as a, c.first_name||' '||c.last_name as b,
       coalesce(c.email,'(no email)') as c2, c.segment::text as d, '' as e
  from public.contacts c where c.last_name ilike '%eagleton%'
union all
select 'SALE', s.id::text, s.status,
       (s.total_cents/100.0)::text || ' ' || coalesce(s.tender_method,'(no method)'),
       coalesce(s.receipt_email,'(none)') || ' @ ' || coalesce(s.receipt_sent_at::text,'NEVER SENT'),
       coalesce(s.stripe_payment_intent,'(no intent)')
  from public.pos_sales s
  left join public.contacts c on c.id = s.buyer_contact_id
 where c.last_name ilike '%eagleton%' or s.payer_name ilike '%eagleton%'
union all
select 'PAYMENT', p.sale_id::text, p.kind||' '||p.method,
       (p.amount_cents/100.0)::text, coalesce(p.stripe_object_id,'(none)'),
       coalesce(p.card_brand,'')||' '||coalesce(p.card_last4,'')
  from public.pos_payments p
 where p.sale_id in (select s.id from public.pos_sales s
                      left join public.contacts c on c.id = s.buyer_contact_id
                     where c.last_name ilike '%eagleton%' or s.payer_name ilike '%eagleton%')
 order by 1,2;

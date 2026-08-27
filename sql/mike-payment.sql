select left(s.id::text,8) as sale, s.status::text,
       coalesce(s.staff_email,'-') as created_by,
       coalesce(s.tender_method,'-') as tender,
       coalesce(s.stripe_payment_intent,'-') as pi,
       coalesce((select string_agg(p.kind||' '||(p.amount_cents/100.0)::text||' via '||coalesce(p.method,'-')||' '||coalesce(left(p.stripe_object_id,12),'-'),' | ')
                   from pos_payments p where p.sale_id=s.id),'no payments') as payments
  from pos_sales s join contacts c on c.id=s.buyer_contact_id
 where c.first_name='Mike' and c.last_name='Mohrbach';

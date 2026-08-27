select (s.created_at at time zone 'America/Chicago')::timestamp(0)::text as when_ct,
       coalesce(s.staff_email,'-') as source,
       (s.total_cents/100.0)::text as amt,
       coalesce(s.payer_name,'-') as payer,
       coalesce(s.stripe_customer_id,'-') as customer,
       coalesce((select string_agg(coalesce(p.method,'-')||' / '||coalesce(left(p.stripe_object_id,14),'-'),', ')
                   from pos_payments p where p.sale_id=s.id),'no payment') as paid_with
  from pos_sales s
  left join contacts c on c.id = s.buyer_contact_id
 where c.last_name ilike '%riggle%' or lower(coalesce(s.payer_email,'')) like '%riggle%'
    or lower(coalesce(s.payer_name,'')) like '%riggle%'
 order by s.created_at;

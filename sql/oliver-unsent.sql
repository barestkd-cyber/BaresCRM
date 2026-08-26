select left(s.id::text,8) as sale,
       (s.created_at at time zone 'America/Chicago')::timestamp(0) as made,
       s.status::text, s.total_cents/100.0 as total,
       coalesce((select sum(p.amount_cents) from pos_payments p where p.sale_id=s.id),0)/100.0 as paid,
       coalesce(s.payer_name,'-') as typed_name,
       coalesce(s.payer_email,'-') as typed_email,
       coalesce(s.staff_email,'-') as via
  from pos_sales s
  join contacts c on c.id = s.buyer_contact_id
 where c.first_name='Oliver' and c.last_name='Allen'
 order by s.created_at;

select left(s.id::text,8) as invoice, s.status::text,
       (s.total_cents/100.0)::text as amount,
       (s.created_at at time zone 'America/Chicago')::date::text as made,
       coalesce((select left(m.id::text,8) from memberships m where m.sale_id=s.id),'-') as membership
  from pos_sales s join contacts c on c.id=s.buyer_contact_id
 where c.last_name ilike '%kubit%' order by s.created_at;

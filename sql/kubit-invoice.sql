select left(s.id::text,8) as sale, s.status::text,
       (s.total_cents/100.0)::text as total,
       coalesce(s.staff_email,'-') as source,
       (s.created_at at time zone 'America/Chicago')::timestamp(0)::text as made,
       (select count(*) from pos_payments p where p.sale_id=s.id)::text as payments,
       (select count(*) from memberships m where m.sale_id=s.id)::text as memberships,
       (select count(*) from enrollments e where e.sale_id=s.id)::text as enrollments,
       (select count(*) from membership_installments i where i.sale_id=s.id)::text as installments
  from pos_sales s join contacts c on c.id=s.buyer_contact_id
 where c.first_name='Johnny' and c.last_name='Kubit';

select 'sales' as t,
       coalesce(string_agg(left(s.id::text,8)||' '||s.status::text||' $'||(s.total_cents/100.0)::text
         ||' @'||(s.created_at at time zone 'America/Chicago')::timestamp(0)::text
         ||' pi='||coalesce(left(s.stripe_payment_intent,14),'none')
         ||' rcpt='||coalesce(s.receipt_sent_at::text,'no'), ' | ' order by s.created_at),'none') as v
  from pos_sales s join contacts c on c.id=s.buyer_contact_id where c.last_name ilike '%mogle%'
union all
select 'payments', coalesce((select string_agg(p.kind||' $'||(p.amount_cents/100.0)::text
         ||' '||coalesce(left(p.stripe_object_id,14),'-'),', ')
   from pos_payments p join pos_sales s on s.id=p.sale_id join contacts c on c.id=s.buyer_contact_id
  where c.last_name ilike '%mogle%'),'NONE')
union all
select 'contacts', coalesce(string_agg(left(c.id::text,8)||' '||c.first_name||' '||c.last_name
         ||' '||c.segment::text||' @'||(c.created_at at time zone 'America/Chicago')::timestamp(0)::text, ' | ' order by c.created_at),'none')
  from contacts c where c.last_name ilike '%mogle%'
union all
select 'memberships', coalesce((select string_agg(left(m.id::text,8)||' '||m.status::text
         ||' sale='||coalesce(left(m.sale_id::text,8),'none'),', ')
   from memberships m join contacts c on c.id=m.contact_id where c.last_name ilike '%mogle%'),'none')
union all
select 'stripe events today', coalesce((select string_agg(e.type||' @'||(e.received_at at time zone 'America/Chicago')::timestamp(0)::text,' | ' order by e.received_at)
   from payment_events e where e.payload::text ilike '%mogle%'),'NONE');

select 'attached_to_old_customer' as t, count(*)::text as v
  from payment_events e
 where e.type = 'payment_method.attached'
   and e.payload::text like '%cus_V8GkNWtPV7rEru%'
union all
select 'attached_to_new_customer', count(*)::text
  from payment_events e
 where e.type = 'payment_method.attached'
   and e.payload::text like '%cus_V8MKb9tMHfrlyJ%'
union all
select 'card_invite_row', left(to_jsonb(ci)::text, 300)
  from card_invites ci
 where to_jsonb(ci)::text ilike '%wingfield%' or to_jsonb(ci)::text ilike '%tessa%';

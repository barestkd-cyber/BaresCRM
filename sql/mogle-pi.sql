select 'payment intent on sale' as t,
       coalesce((select coalesce(s.stripe_payment_intent,'NONE') from pos_sales s
                  where s.id::text like 'a7690da2%'),'?') as v
union all
select 'stripe customer', coalesce((select coalesce(s.stripe_customer_id,'NONE') from pos_sales s
                  where s.id::text like 'a7690da2%'),'?')
union all
select 'webhook events mentioning that PI',
       coalesce((select string_agg(e.type||' @'||(e.received_at at time zone 'America/Chicago')::timestamp(0)::text, ' | ')
          from payment_events e
         where e.payload::text like '%'||(select s.stripe_payment_intent from pos_sales s where s.id::text like 'a7690da2%')||'%'),
       'NO EVENTS - Stripe never reported an attempt')
union all
select 'any failed events today',
       coalesce((select string_agg(e.type||' @'||(e.received_at at time zone 'America/Chicago')::timestamp(0)::text,' | ')
          from payment_events e
         where e.received_at > now() - interval '1 day'
           and (e.type ilike '%fail%' or e.type ilike '%error%' or e.type ilike '%canceled%')),'none');

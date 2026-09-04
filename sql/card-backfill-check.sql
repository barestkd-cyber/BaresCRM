select 'REMAINING' as probe,
       count(*) filter (where card_last4 is null and stripe_object_id is not null)::text as a,
       count(*) filter (where card_last4 is not null)::text as b,
       count(*)::text as c
  from public.pos_payments
union all
select 'TIM', coalesce(p.card_brand,'-')||' '||coalesce(p.card_last4,'-'),
       (p.amount_cents/100.0)::text, p.occurred_at::date::text
  from public.pos_payments p
  join public.pos_sales s on s.id = p.sale_id
 where s.view_token = '73dbb79fadc32017abd20fcf292fc02a'
 order by 1;

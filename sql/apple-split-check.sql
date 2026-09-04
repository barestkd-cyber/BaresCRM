-- Did the split payment land correctly end to end?
select 'SALE' as probe,
       s.status as a,
       (s.total_cents/100.0)::text as b,
       'allow_partial=' || s.allow_partial::text as c,
       coalesce(s.receipt_email,'-') || ' @ ' || coalesce(s.receipt_sent_at::text,'never') as d
  from public.pos_sales s where s.view_token = '73dbb79fadc32017abd20fcf292fc02a'
union all
select 'PAYMENT', p.kind || ' ' || p.method,
       (p.amount_cents/100.0)::text,
       coalesce(p.stripe_object_id,'(none)'),
       coalesce(p.card_brand,'') || ' ' || coalesce(p.card_last4,'') || ' @ ' || p.occurred_at::text
  from public.pos_payments p
  join public.pos_sales s on s.id = p.sale_id
 where s.view_token = '73dbb79fadc32017abd20fcf292fc02a'
union all
select 'BALANCE',
       (s.total_cents/100.0)::text,
       ((select coalesce(sum(amount_cents),0) from public.pos_payments p where p.sale_id = s.id)/100.0)::text,
       ((s.total_cents - (select coalesce(sum(amount_cents),0) from public.pos_payments p where p.sale_id = s.id))/100.0)::text,
       'total / paid / still owed'
  from public.pos_sales s where s.view_token = '73dbb79fadc32017abd20fcf292fc02a'
 order by 1, 5;

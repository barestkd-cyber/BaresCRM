select program, code, name,
       coalesce(promo_label,'(none)') as promo,
       billing_frequency::text as bills,
       coalesce(pif_cents,0)/100.0 as pif,
       coalesce(down_cents,0)/100.0 as down,
       coalesce(recurring_cents,0)/100.0 as recurring,
       active, sellable
  from pricing_plans
 where program in ('Cubs','Juniors') and active
 order by program, display_order;

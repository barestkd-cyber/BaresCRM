-- Savings badges on the Juniors checkout page. The page already renders
-- promo_label; the Juniors plans simply never had one, which is why Cubs
-- showed percentages and Juniors showed nothing.
--
-- Percentages computed against the weekly total over a year ($33.95 x 52 =
-- $1,765.40), the same baseline that reproduces the Cubs figures exactly
-- (18/12/6 and "Savings of $254" on the printed sheet). Race rounded the top
-- two DOWN to 20% and 10%: a claim that undersells is safe, one that
-- oversells is not.
update pricing_plans set promo_label = '20% off!'  where code = 'juniors_pif';
update pricing_plans set promo_label = '15% off!'  where code = 'juniors_option_b';
update pricing_plans set promo_label = '10% off!'  where code = 'juniors_option_c';
update pricing_plans set promo_label = '5% off!'   where code = 'juniors_option_d';
update pricing_plans set promo_label = 'No down payment!' where code = 'juniors_weekly';

select code, name, coalesce(promo_label,'(none)') as badge,
       coalesce(pif_cents,0)/100.0 as pif,
       coalesce(down_cents,0)/100.0 as down,
       coalesce(recurring_cents,0)/100.0 as recurring
  from pricing_plans
 where program = 'Juniors' and active and sellable
 order by display_order;

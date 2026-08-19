-- Remove the SAMPLE testing registration created earlier to preview the
-- receipt emails. It has a $103.20 payment row against it, which was never
-- real money. Harmless while the ledger held nothing but test data; now that
-- the first genuine payment has landed it would show up as revenue in Reports
-- and in every collected total from here on.
do $$
declare v_sale uuid := '451544ce-89d1-4441-9f0e-f47b4f1ca4c0';
begin
  delete from public.testing_signups where sale_id = v_sale;
  delete from public.pos_sale_lines  where sale_id = v_sale;
  delete from public.pos_payments    where sale_id = v_sale;
  delete from public.pos_sales       where id      = v_sale;
end $$;

select (select count(*) from public.pos_sales)                     as sales,
       (select count(*) from public.pos_payments)                  as payments,
       (select coalesce(sum(amount_cents),0) from public.pos_payments) as collected_cents;

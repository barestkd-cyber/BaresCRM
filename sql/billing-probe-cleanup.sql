-- Remove the throwaway member used to watch the billing engine select,
-- schedule, price and fail-safely. Nothing was ever charged.
delete from public.membership_installments
 where membership_id = '00000000-0000-4000-8000-00000000b222'::uuid;
delete from public.pos_sale_lines
 where sale_id in (select id from public.pos_sales where staff_email = 'charge-due@auto'
                    and buyer_contact_id = '00000000-0000-4000-8000-00000000b111'::uuid);
delete from public.pos_sales
 where staff_email = 'charge-due@auto'
   and buyer_contact_id = '00000000-0000-4000-8000-00000000b111'::uuid;
delete from public.memberships where id = '00000000-0000-4000-8000-00000000b222'::uuid;
delete from public.contacts where id = '00000000-0000-4000-8000-00000000b111'::uuid;

select (select count(*) from public.contacts where email='billing-probe@example.com') as probe_left,
       (select count(*) from public.membership_installments) as installments,
       (select count(*) from public.pos_sales) as sales,
       (select coalesce(sum(amount_cents),0) from public.pos_payments) as collected_cents,
       (select billing_engine_live from public.settings limit 1) as engine_live;

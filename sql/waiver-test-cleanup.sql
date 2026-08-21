-- Removes the waiver test member. Nothing was ever charged: the engine is off
-- and every run above was a dry run.
delete from public.membership_installments where membership_id = '00000000-0000-4000-8000-000000000a1d'::uuid;
delete from public.memberships where id = '00000000-0000-4000-8000-000000000a1d'::uuid;
delete from public.contacts where id = '00000000-0000-4000-8000-000000000a1e'::uuid;
select (select count(*) from public.contacts where email='waiver-test@example.com') as test_left,
       (select count(*) from public.pos_sales) as sales,
       (select coalesce(sum(amount_cents),0) from public.pos_payments) as collected_cents;

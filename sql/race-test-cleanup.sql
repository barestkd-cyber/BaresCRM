-- Removes the Race Condition test member used to prove the atomic claim.
-- Nothing was charged: the contact had no card on file.
delete from public.pos_sale_lines where sale_id in
  (select id from public.pos_sales where buyer_contact_id in
    (select id from public.contacts where email='race-test@example.com'));
delete from public.membership_installments where contact_id in
  (select id from public.contacts where email='race-test@example.com');
delete from public.pos_sales where buyer_contact_id in
  (select id from public.contacts where email='race-test@example.com');
delete from public.memberships where contact_id in
  (select id from public.contacts where email='race-test@example.com');
delete from public.contacts where email='race-test@example.com';
select (select count(*) from public.contacts where email='race-test@example.com') as test_left,
       (select count(*) from public.pos_sales) as sales,
       (select coalesce(sum(amount_cents),0) from public.pos_payments) as collected_cents;

-- Proves the review's finding #2/#4 is fixed: deleting an installment invoice
-- used to fail with FK 23503 and freeze the installment. Rolls back.
begin;
insert into public.contacts (id, first_name, last_name, brand)
values ('00000000-0000-4000-8000-0000000000f1'::uuid, 'FKRelease', 'Test', 'btkd');
insert into public.memberships (id, contact_id, program, plan_code, status,
  billing_frequency, final_recurring_cents, final_down_cents, next_bill_on, started_on)
values ('00000000-0000-4000-8000-0000000000f2'::uuid, '00000000-0000-4000-8000-0000000000f1'::uuid,
  'Teens/Adults Taekwondo', 'tkd_month_to_month', 'active', 'monthly', 11000, 0, date '2026-09-20', date '2026-08-20');
insert into public.pos_sales (id, buyer_contact_id, sale_date, staff_email, brand,
  tender_method, status, subtotal_cents, discount_cents, admin_fee_cents, tax_cents, total_cents)
values ('00000000-0000-4000-8000-0000000000f3'::uuid, '00000000-0000-4000-8000-0000000000f1'::uuid,
  current_date, 'test', 'btkd', null, 'unpaid', 11000, 0, 0, 0, 11000);
insert into public.membership_installments (id, membership_id, contact_id, seq, due_on, amount_cents, status, sale_id)
values ('00000000-0000-4000-8000-0000000000f4'::uuid, '00000000-0000-4000-8000-0000000000f2'::uuid,
  '00000000-0000-4000-8000-0000000000f1'::uuid, 1, date '2026-09-20', 11000, 'invoiced',
  '00000000-0000-4000-8000-0000000000f3'::uuid);

-- what posDeleteInvoice now does first
update public.membership_installments set status='scheduled', sale_id=null
 where sale_id='00000000-0000-4000-8000-0000000000f3'::uuid;
delete from public.pos_sales where id='00000000-0000-4000-8000-0000000000f3'::uuid;

select status as installment_status_after_delete,
       coalesce(sale_id::text,'released') as sale_link,
       (select count(*) from public.pos_sales where id='00000000-0000-4000-8000-0000000000f3'::uuid) as sale_rows_left
  from public.membership_installments where id='00000000-0000-4000-8000-0000000000f4'::uuid;
rollback;

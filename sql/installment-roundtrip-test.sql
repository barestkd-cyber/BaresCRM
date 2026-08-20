-- Proves the exact row shapes the CRM writes are accepted, then throws it all
-- away. ROLLBACK at the end: nothing here survives.
begin;

insert into public.contacts (id, first_name, last_name, brand)
values ('00000000-0000-4000-8000-00000000c0de'::uuid, 'Roundtrip', 'Test', 'btkd');

insert into public.memberships (id, contact_id, program, plan_code, status,
  billing_frequency, final_recurring_cents, final_down_cents, next_bill_on, started_on)
values ('00000000-0000-4000-8000-00000000dead'::uuid,
  '00000000-0000-4000-8000-00000000c0de'::uuid,
  'Teens/Adults Taekwondo', 'tkd_month_to_month', 'active',
  'monthly', 11000, 0, date '2026-09-20', date '2026-08-20');

-- what memSchedGenerate writes (engine dates, anchor day 20)
insert into public.membership_installments (membership_id, contact_id, seq, due_on, amount_cents, status)
select '00000000-0000-4000-8000-00000000dead'::uuid,
       '00000000-0000-4000-8000-00000000c0de'::uuid,
       g, (date '2026-09-20' + ((g-1) || ' month')::interval)::date, 11000, 'scheduled'
  from generate_series(1,12) g;

-- what memSchedSave writes: move installment 2 two weeks later, reprice it
update public.membership_installments
   set due_on = date '2026-11-03', amount_cents = 9000
 where membership_id = '00000000-0000-4000-8000-00000000dead'::uuid and seq = 2;

insert into public.membership_edits (membership_id, contact_id, field, old_value, new_value, reason, edited_by)
values ('00000000-0000-4000-8000-00000000dead'::uuid, '00000000-0000-4000-8000-00000000c0de'::uuid,
  'installment 2 due date', '2026-10-20', '2026-11-03', 'She asked to be billed two weeks late in October', 'test');

-- what memSchedInvoice writes
insert into public.pos_sales (id, buyer_contact_id, sale_date, staff_email, brand,
  tender_method, status, subtotal_cents, discount_cents, admin_fee_cents, tax_cents, total_cents, notes)
values ('00000000-0000-4000-8000-00000000beef'::uuid,
  '00000000-0000-4000-8000-00000000c0de'::uuid, current_date, 'test', 'btkd',
  null, 'unpaid', 9000, 0, 0, 0, 9000, 'installment 2 of 12');

insert into public.pos_sale_lines (sale_id, kind, label, qty, unit_cents, discount_cents,
  taxable, line_total_cents, student_contact_id, membership_id)
values ('00000000-0000-4000-8000-00000000beef'::uuid, 'mem',
  'Teens/Adults Taekwondo - installment 2 of 12', 1, 9000, 0, false, 9000,
  '00000000-0000-4000-8000-00000000c0de'::uuid, '00000000-0000-4000-8000-00000000dead'::uuid);

update public.membership_installments
   set status = 'invoiced', sale_id = '00000000-0000-4000-8000-00000000beef'::uuid
 where membership_id = '00000000-0000-4000-8000-00000000dead'::uuid and seq = 2;

select
  (select count(*) from public.membership_installments
    where membership_id='00000000-0000-4000-8000-00000000dead'::uuid) as installments,
  (select count(*) from public.membership_installments
    where membership_id='00000000-0000-4000-8000-00000000dead'::uuid and status='scheduled') as still_scheduled,
  (select to_char(due_on,'YYYY-MM-DD') from public.membership_installments
    where membership_id='00000000-0000-4000-8000-00000000dead'::uuid and seq=2) as moved_to,
  (select amount_cents from public.membership_installments
    where membership_id='00000000-0000-4000-8000-00000000dead'::uuid and seq=2) as repriced_to,
  (select to_char(due_on,'YYYY-MM-DD') from public.membership_installments
    where membership_id='00000000-0000-4000-8000-00000000dead'::uuid and seq=12) as last_due,
  (select count(*) from public.pos_sale_lines
    where sale_id='00000000-0000-4000-8000-00000000beef'::uuid) as invoice_lines,
  (select count(*) from public.membership_edits
    where membership_id='00000000-0000-4000-8000-00000000dead'::uuid) as audit_rows;

rollback;

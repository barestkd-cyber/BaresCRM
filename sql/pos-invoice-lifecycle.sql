-- ============================================================================
-- BaresTKD — invoice lifecycle: CLOSE and DELETE (run once; safe to re-run)
-- ----------------------------------------------------------------------------
-- Owner rules (2026-08-13):
--   * An invoice with ANY payment applied is PERMANENTLY undeletable. The
--     pos_payments FK already physically guarantees this (payment rows block
--     the delete); the policy below repeats it for defense in depth.
--   * CLOSE: an unpaid invoice's remaining balance is forgiven — no longer
--     due, NOT recorded as paid. Partial payments stay on record. Closed
--     invoices leave the dashboard banner and the Unpaid filter.
--   * DELETE: unpaid + zero payments only — "this sale never happened."
--     The CRM unwinds any membership/enrollment the tender seeded first.
-- ============================================================================

-- 1. status gains 'closed'.
alter table public.pos_sales drop constraint if exists pos_sales_status_check;
alter table public.pos_sales add constraint pos_sales_status_check
  check (status in ('unpaid','pending_payment','processing','paid','failed','abandoned','voided','closed'));

-- 2. Staff may DELETE an invoice only while it is unpaid/closed AND has no
--    payment rows. (The pos_payments FK blocks payment-bearing deletes even
--    if this policy ever regressed.)
drop policy if exists pos_sales_staff_delete on public.pos_sales;
create policy pos_sales_staff_delete on public.pos_sales
  for delete using (
    is_staff()
    and status in ('unpaid','closed')
    and not exists (select 1 from public.pos_payments p where p.sale_id = id)
  );

-- 3. Deleting a sale unwinds what it seeded. memberships already carries a
--    staff-all policy (house style); enrollments' staff delete is added
--    defensively here, scoped to sale-provenance rows only.
drop policy if exists enrollments_staff_delete_sale on public.enrollments;
create policy enrollments_staff_delete_sale on public.enrollments
  for delete using (is_staff() and sale_id is not null);

-- ROLLBACK (commented):
-- drop policy if exists pos_sales_staff_delete on public.pos_sales;
-- drop policy if exists enrollments_staff_delete_sale on public.enrollments;
-- alter table public.pos_sales drop constraint if exists pos_sales_status_check;
-- alter table public.pos_sales add constraint pos_sales_status_check
--   check (status in ('unpaid','pending_payment','processing','paid','failed','abandoned','voided'));

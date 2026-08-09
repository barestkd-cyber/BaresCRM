-- ============================================================================
-- BaresTKD — invoice model patch (run AFTER pos-ledger.sql, once)
-- ----------------------------------------------------------------------------
-- Owner decision 2026-08-09: sales are INVOICES, paid or unpaid. "Charge to
-- account" is retired — it read as "take their payment now," which it never
-- was. An unpaid invoice has NO tender method yet; the method is recorded at
-- the moment it is actually paid. Safe to re-run.
-- ============================================================================

-- 1. tender_method becomes nullable (null = unpaid invoice, no payment yet)
--    and 'account' leaves the allowed set.
alter table public.pos_sales alter column tender_method drop not null;

alter table public.pos_sales drop constraint if exists pos_sales_tender_method_check;
alter table public.pos_sales add constraint pos_sales_tender_method_check
  check (tender_method is null or tender_method in ('cash','check','card','ach'));

-- 2. status gains 'unpaid' (an invoice saved with no payment attempt).
--    'pending_payment' stays reserved for a Stripe checkout in flight
--    (Phase B) — the two are different facts and sweep differently.
alter table public.pos_sales drop constraint if exists pos_sales_status_check;
alter table public.pos_sales add constraint pos_sales_status_check
  check (status in ('unpaid','pending_payment','processing','paid','failed','abandoned','voided'));

-- 3. Migrate anything recorded under the old interim model.
update public.pos_sales
   set status = 'unpaid', tender_method = null
 where tender_method = 'account' or (status = 'pending_payment' and stripe_session_id is null);

-- 4. Staff may UPDATE a sale — needed to mark an unpaid invoice paid.
--    (Phase A2 moves this transition server-side and this policy tightens.)
drop policy if exists pos_sales_staff_update on public.pos_sales;
create policy pos_sales_staff_update on public.pos_sales
  for update using (is_staff()) with check (is_staff());

-- ============================================================================
-- ROLLBACK (commented)
-- ============================================================================
-- drop policy if exists pos_sales_staff_update on public.pos_sales;
-- alter table public.pos_sales drop constraint if exists pos_sales_status_check;
-- alter table public.pos_sales add constraint pos_sales_status_check
--   check (status in ('pending_payment','processing','paid','failed','abandoned','voided'));
-- update public.pos_sales set tender_method='account', status='pending_payment' where status='unpaid';
-- alter table public.pos_sales alter column tender_method set not null;

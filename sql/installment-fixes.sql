-- ===========================================================================
-- Fixes from the adversarial review of the 2026-08-20 payment-schedule build
-- ---------------------------------------------------------------------------
-- 1. sale_id had no ON DELETE action, so an installment invoice could never be
--    deleted (FK 23503) and the installment stayed frozen as 'invoiced' with
--    no way back. Deleting a mis-raised invoice must release the installment.
-- 2. The public blackout policy is row-scoped but not column-scoped, so anon
--    could read created_by (a staff login email) and notes. RLS cannot express
--    column limits; column GRANTs can.
-- ===========================================================================

alter table public.membership_installments
  drop constraint if exists membership_installments_sale_id_fkey;
alter table public.membership_installments
  add constraint membership_installments_sale_id_fkey
  foreign key (sale_id) references public.pos_sales(id) on delete set null;

-- Anon may read the closure FACTS and nothing else. Staff keep full access
-- through their own role.
revoke select on public.calendar_events from anon;
grant select (id, type, title, event_date, event_time, blocks_classes, blocks_trials, blocks_privates)
  on public.calendar_events to anon;

select
  (select confdeltype from pg_constraint
    where conname='membership_installments_sale_id_fkey') as on_delete_action,
  (select count(*) from information_schema.column_privileges
    where table_name='calendar_events' and grantee='anon' and privilege_type='SELECT') as anon_readable_columns;

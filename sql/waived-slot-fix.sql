-- ===========================================================================
-- A waived installment must HOLD its slot
-- ---------------------------------------------------------------------------
-- Found by adversarial review before the engine ever ran. The just-in-time
-- scheduler asked "is there already an installment for this date?" while
-- filtering to status in (scheduled, invoiced, paid), and the unique index
-- carried the identical WHERE clause. A 'waived' or 'canceled' row therefore
-- satisfied NEITHER: it did not answer the question and it did not block the
-- insert.
--
-- So: Race waives October for an injured student, with a reason on the record.
-- October 1 arrives, the engine sees no qualifying installment, writes a fresh
-- one at full list price, and charges the card that same run. The waiver is
-- defeated by the very mechanism meant to enforce it, and at the wrong amount,
-- because the new row takes final_recurring_cents rather than whatever the
-- waived one was repriced to.
--
-- The slot belongs to the membership and the date, whatever the outcome was.
-- Waived and canceled are ANSWERS, not absences.
-- ===========================================================================

drop index if exists membership_installments_due_uidx;
create unique index membership_installments_due_uidx
  on public.membership_installments (membership_id, due_on);

select indexdef from pg_indexes where indexname = 'membership_installments_due_uidx';

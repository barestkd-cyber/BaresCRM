-- ============================================================================
-- BaresTKD — the "what you actually bought" note on a receipt
-- ----------------------------------------------------------------------------
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
--
-- THE PROBLEM: a paid receipt says "$112.46 PAID" and nothing else. A parent
-- who enrolls in August has nothing in their inbox telling them class starts
-- September 16 at 9:30. Wrong email for a session bought a month ahead.
--
-- customer_note is written by the thing that made the sale (lk-checkout fills
-- it with the session dates) and rendered in the receipt email.
--
-- KEPT SEPARATE FROM `notes` ON PURPOSE. `notes` is Race's internal scratch
-- space, and internal scratch space must never render into a customer inbox.
-- The owner's copy gets `notes`; the customer's gets `customer_note`.
-- ============================================================================

alter table public.pos_sales add column if not exists customer_note text;

comment on column public.pos_sales.customer_note is
  'Customer-facing detail rendered in the receipt email (class dates, what to bring). NEVER put internal remarks here - use notes for those.';

notify pgrst, 'reload schema';

-- ─── ROLLBACK (commented) ───────────────────────────────────────────────────
-- alter table public.pos_sales drop column if exists customer_note;

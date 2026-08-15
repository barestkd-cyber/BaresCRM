-- ============================================================================
-- BaresTKD — clear TEST-MODE sales before going live
-- ----------------------------------------------------------------------------
-- Everything taken while Stripe was in test mode is fake money sitting in a
-- real ledger. Run this ONCE, in the Supabase SQL editor, on the day you flip
-- Stripe to live keys — before the first real sale.
--
-- READ THIS BEFORE RUNNING ANYTHING BELOW
--   * This DELETES rows. There is no undo in the app. Supabase Pro keeps
--     daily backups for 7 days, so a mistake is recoverable, but only if you
--     notice it inside a week.
--   * Work through the steps IN ORDER. Step 1 only looks; step 2 shows exactly
--     what would go; step 3 is the only step that destroys anything.
--   * The cutoff below is the safety rail. Set it to a timestamp AFTER your
--     last test sale and BEFORE your first real one. Nothing outside that
--     window is touched, so a stray real sale cannot be caught by accident.
-- ============================================================================

-- ─── STEP 1 — LOOK FIRST. What is in the ledger, and when? ──────────────────
-- Run this alone. Confirm the newest row really is a test sale.
select
  date_trunc('day', created_at) as day,
  count(*)                      as sales,
  sum(total_cents)/100.0        as dollars,
  min(created_at)               as first_sale,
  max(created_at)               as last_sale
from public.pos_sales
group by 1
order by 1 desc;


-- ─── STEP 2 — DRY RUN. Exactly what step 3 would delete. ────────────────────
-- Set the cutoff, then run this on its own and READ THE RESULT. If a single
-- row here is a real sale, stop and change the cutoff.
with cutoff as (select timestamptz '2026-12-31 23:59:59-06' as before_ts)
select s.id, s.created_at, s.status, s.total_cents/100.0 as dollars,
       s.buyer_contact_id, s.stripe_email,
       (select count(*) from public.pos_payments        p where p.sale_id = s.id) as payments,
       (select count(*) from public.memberships         m where m.sale_id = s.id) as memberships,
       (select count(*) from public.membership_agreements a
          where a.sale_id = s.id)                                                 as agreements
from public.pos_sales s, cutoff
where s.created_at <= cutoff.before_ts
order by s.created_at desc;


-- ─── STEP 3 — DELETE. Only after step 2 looked right. ───────────────────────
-- Wrapped in a transaction so nothing is half-removed if a statement fails.
-- The row counts are echoed as it goes.
--
-- ORDER MATTERS: children before parents, because agreements point at
-- memberships and memberships point at sales.
--
-- UNCOMMENT THE BLOCK BELOW TO RUN IT. It is commented out on purpose so that
-- opening this file and hitting Run cannot delete anything.

/*
begin;

create temp table _doomed on commit drop as
select id from public.pos_sales
where created_at <= timestamptz '2026-12-31 23:59:59-06';   -- ← same cutoff as step 2

-- Signed agreements attached to those sales.
delete from public.membership_agreements a using _doomed d where a.sale_id = d.id;

-- Memberships sold on those invoices, and the class rosters they seeded.
delete from public.enrollments  e using _doomed d where e.sale_id = d.id;
delete from public.memberships  m using _doomed d where m.sale_id = d.id;

-- Money rows, then the webhook dedupe log, then the invoices themselves.
delete from public.pos_payments    p using _doomed d where p.sale_id = d.id;
delete from public.pos_sale_lines  l using _doomed d where l.sale_id = d.id;
delete from public.payment_events  v using _doomed d where v.sale_id = d.id;
delete from public.pos_sales       s using _doomed d where s.id      = d.id;

-- Confirm the ledger is empty (or holds only what you expect) BEFORE commit.
select count(*) as sales_remaining from public.pos_sales;

commit;
-- If anything above looked wrong, run  rollback;  instead of commit.
*/


-- ─── STEP 4 — AFTER COMMITTING, sanity check ────────────────────────────────
-- select count(*) from public.pos_sales;
-- select count(*) from public.membership_agreements;
-- select count(*) from public.memberships;

-- ─── NOT DELETED BY THIS SCRIPT, ON PURPOSE ─────────────────────────────────
--   contacts            — real people you actually entered; deleting them
--                         would take their attendance history with them.
--   pricing_plans       — your catalog.
--   attendance          — real check-ins, unrelated to test payments.
-- If a test CONTACT needs removing, delete that one row by id by hand after
-- checking what references it.

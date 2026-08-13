-- ============================================================================
-- BaresTKD — emailed receipts: sent-stamp + view-link token (run once; safe
-- to re-run). REPLACES the earlier two-line version of this file, which was
-- never run.
-- ----------------------------------------------------------------------------
-- receipt_email / receipt_sent_at: where and when a receipt email went out.
-- view_token: random bearer token for the PUBLIC view-only invoice page
-- (receipt-view Edge Function). Deliberately NOT the row id: tokens can be
-- rotated/revoked without touching the invoice, and printed short-ids never
-- reveal a working link. Anyone with the link sees that ONE invoice.
-- ============================================================================

create extension if not exists pgcrypto;

alter table public.pos_sales add column if not exists receipt_email   text;
alter table public.pos_sales add column if not exists receipt_sent_at timestamptz;
alter table public.pos_sales add column if not exists view_token text unique
  default encode(gen_random_bytes(16), 'hex');

-- Backfill sales created before the column existed.
update public.pos_sales
   set view_token = encode(gen_random_bytes(16), 'hex')
 where view_token is null;

-- ROLLBACK (commented):
-- alter table public.pos_sales drop column if exists receipt_email;
-- alter table public.pos_sales drop column if exists receipt_sent_at;
-- alter table public.pos_sales drop column if exists view_token;
